"""Day_1 A4 #4 and #5: bullet tailor with Keep/Revert; returning user's full tailor."""

import json

import pytest

from app.agents.providers.base import LlmTransientError
from tests.fixtures import SAMPLE_JD, sample_cv

pytestmark = pytest.mark.db


def profile_in() -> dict:
    """The sample CV in client input shape (ids + text only)."""
    cv = sample_cv().model_dump(mode="json")
    for section in ("experience", "projects"):
        for item in cv[section]:
            item["bullets"] = [{"id": b["id"], "text": b["text"]} for b in item["bullets"]]
    cv["skills"] = {k: [s["name"] for s in v] for k, v in cv["skills"].items()}
    return cv


async def returning_user(api):
    h = api.new_user()
    assert (await api.client.put("/profile", json={"content": profile_in()},
                                 headers=h)).status_code == 200
    res = (await api.client.post("/resumes", json={"template": "jake", "mode": "tailored"},
                                 headers=h)).json()
    assert (await api.client.put(f"/resumes/{res['id']}/jd", json={"text": SAMPLE_JD},
                                 headers=h)).status_code == 200
    return h, res["id"]


async def get(api, h, rid):
    return (await api.client.get(f"/resumes/{rid}", headers=h)).json()


def bullet(resume, bid):
    return next(b for s in ("experience", "projects") for i in resume["content"][s]
                for b in i["bullets"] if b["id"] == bid)


# ---------- per-bullet ----------

async def test_bullet_tailor_then_revert_then_keep(api):
    h, rid = await returning_user(api)
    api.provider.push({"text": "Reduced p95 payment-event latency by 38% by moving the ledger "
                               "service to Kafka Streams in Java on AWS"})
    r = await api.client.post(f"/resumes/{rid}/bullets/nw1/tailor", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["bullet"]["tailor_state"] == "proposed"
    version = r.json()["row_version"]

    r = await api.client.post(f"/resumes/{rid}/bullets/nw1/revert",
                              json={"expected_version": version}, headers=h)
    assert r.json()["bullet"]["text"].startswith("Cut payment-event latency by 38%")
    assert r.json()["bullet"]["tailor_state"] == "none"

    api.provider.push({"text": "Reduced p95 latency by 38% with Kafka Streams in Java"})
    r = await api.client.post(f"/resumes/{rid}/bullets/nw1/tailor", headers=h)
    r = await api.client.post(f"/resumes/{rid}/bullets/nw1/keep",
                              json={"expected_version": r.json()["row_version"]}, headers=h)
    assert r.json()["bullet"]["tailor_state"] == "kept"


async def test_invented_bullet_is_rejected_and_unchanged(api):
    h, rid = await returning_user(api)
    api.provider.push({"text": "Cut latency by 60% by moving the ledger to Kubernetes"})
    r = await api.client.post(f"/resumes/{rid}/bullets/nw1/tailor", headers=h)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "truth_violation"
    assert set(r.json()["error"]["details"]["rules"]) == {"unknown_number", "unknown_skill"}
    assert bullet(await get(api, h, rid), "nw1")["tailor_state"] == "none"


async def test_user_edited_bullet_unlocks_only_via_its_own_tailor(api):
    h, rid = await returning_user(api)
    res = await get(api, h, rid)
    exp = [{**{k: v for k, v in i.items() if k != "bullets"},
            "bullets": [{"id": b["id"], "text": b["text"]} for b in i["bullets"]]}
           for i in res["content"]["experience"]]
    exp[0]["bullets"][2]["text"] = "Mentored 2 interns; both shipped in under 8 weeks"
    r = await api.client.patch(f"/resumes/{rid}", headers=h, json={
        "expected_version": res["row_version"],
        "change": {"section": "experience", "value": exp}})
    assert bullet(await get(api, h, rid), "nw3")["locked"] is True

    api.provider.push({"text": "Mentored 2 interns to ship in under 8 weeks"})
    r = await api.client.post(f"/resumes/{rid}/bullets/nw3/tailor", headers=h)
    proposed = r.json()["bullet"]
    assert (proposed["locked"], proposed["original_origin"]) == (False, "user")
    r = await api.client.post(f"/resumes/{rid}/bullets/nw3/revert",
                              json={"expected_version": r.json()["row_version"]}, headers=h)
    assert (r.json()["bullet"]["locked"], r.json()["bullet"]["origin"]) == (True, "user")


async def test_other_user_cannot_tailor_my_bullet(api):
    h, rid = await returning_user(api)
    r = await api.client.post(f"/resumes/{rid}/bullets/nw1/tailor", headers=api.new_user())
    assert r.status_code == 404
    assert api.provider.calls == []  # no LLM call spent on someone else's resume


# ---------- full tailor (returning user, A4 #5) ----------

def honest_tailor(user_message: str) -> dict:
    data = json.loads(user_message[user_message.index("{"):])
    items = data["items"]
    exp_ids = [i["id"] for i in items if i["kind"] == "experience"]
    out = []
    for item in items:
        bullets = [{"id": b["id"], "text": b["text"]} for b in item["bullets"]]
        if item["id"] == "nw":
            bullets[0]["text"] = ("Reduced p95 payment-event latency by 38% by moving the "
                                  "ledger service to Kafka Streams in Java on AWS")
            bullets[1]["text"] = "Scaled settlement to 2M events/day on Kubernetes"  # invented
        out.append({"id": item["id"], "bullets": bullets})
    skills = data["skills"]
    return {"experience_order": exp_ids, "items": out,
            "skills": {**skills, "languages": list(reversed(skills["languages"]))},
            "missing_skills": ["Kubernetes", "Java"]}  # Java isn't missing: filtered out


async def test_full_tailor_job(api):
    h, rid = await returning_user(api)
    api.provider.push(honest_tailor)
    r = await api.client.post(f"/resumes/{rid}/tailor", json={"scope": "all"}, headers=h)
    assert r.status_code == 202

    res = await get(api, h, rid)  # ASGITransport has run the background task by now
    assert res["status"] == "ready", res["error_code"]
    assert bullet(res, "nw1")["tailor_state"] == "proposed"
    assert bullet(res, "nw2")["text"].startswith("Owned the settlement pipeline")  # kept
    assert res["missing_skills"] == ["Kubernetes"]
    assert res["tailor_report"]["kept_original"] == ["experience[nw].bullets[nw2]"]
    assert [s["name"] for s in res["content"]["skills"]["languages"]] == ["SQL", "Python",
                                                                         "Java"]


async def test_llm_outage_fails_job_and_leaves_content(api):
    h, rid = await returning_user(api)
    before = (await get(api, h, rid))["content"]
    api.provider.push(*[LlmTransientError("503")] * 3)
    await api.client.post(f"/resumes/{rid}/tailor", json={}, headers=h)
    res = await get(api, h, rid)
    assert (res["status"], res["error_code"]) == ("failed", "llm_unavailable")
    assert res["content"] == before


async def test_tailor_needs_jd_and_respects_quota(api):
    h = api.new_user()
    await api.client.put("/profile", json={"content": profile_in()}, headers=h)
    rid = (await api.client.post("/resumes", json={"template": "jake", "mode": "tailored"},
                                 headers=h)).json()["id"]
    r = await api.client.post(f"/resumes/{rid}/tailor", json={}, headers=h)
    assert r.json()["error"]["details"]["reason"] == "no_jd"

    await api.client.put(f"/resumes/{rid}/jd", json={"text": SAMPLE_JD}, headers=h)
    api.container.quota._limits["full_tailor"] = 1
    api.provider.push(honest_tailor)
    assert (await api.client.post(f"/resumes/{rid}/tailor", json={},
                                  headers=h)).status_code == 202
    r = await api.client.post(f"/resumes/{rid}/tailor", json={}, headers=h)
    assert r.status_code == 429
