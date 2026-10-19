"""Day 2 frontend wiring: settings, JD company/role (SAVE-2), dashboard content, tailor job
steps (TAIL-3) and the save-to-profile truth fix (TRUTH-1)."""

import psycopg
import pytest

from tests.fixtures import SAMPLE_JD
from tests.integration.test_tailoring_api import bullet, get, honest_tailor, returning_user

pytestmark = pytest.mark.db

TAILORED_NW1 = ("Reduced p95 payment-event latency by 38% by moving the ledger service to "
                "Kafka Streams in Java on AWS")
FACT_NW1 = "Cut payment-event latency by 38% (p95) by moving the ledger service"


# ---------- settings ----------

async def test_settings_default_then_save_and_isolated(api):
    h = api.new_user()
    r = await api.client.get("/settings", headers=h)
    assert r.json() == {"display_name": None, "ask_before_save": True, "product_emails": False}

    body = {"display_name": "Arjun M.", "ask_before_save": False, "product_emails": True}
    assert (await api.client.put("/settings", json=body, headers=h)).json() == body
    assert (await api.client.get("/settings", headers=h)).json() == body

    other = (await api.client.get("/settings", headers=api.new_user())).json()
    assert other["display_name"] is None


async def test_settings_reject_unknown_and_blank_fields(api):
    h = api.new_user()
    for bad in ({"ask_before_save": True, "product_emails": False, "plan": "pro"},
                {"display_name": "", "ask_before_save": True, "product_emails": False}):
        assert (await api.client.put("/settings", json=bad, headers=h)).status_code == 422


# ---------- JD company/role (SAVE-2) ----------

async def test_user_company_and_role_override_detection(api):
    h, rid = await returning_user(api)
    r = await api.client.put(f"/resumes/{rid}/jd", headers=h,
                             json={"text": SAMPLE_JD, "company": "Freshworks",
                                   "role": "SDE-2 Backend"})
    assert (r.json()["company"], r.json()["role"]) == ("Freshworks", "SDE-2 Backend")
    summary = (await api.client.get("/resumes", headers=h)).json()[0]
    assert (summary["company"], summary["role"]) == ("Freshworks", "SDE-2 Backend")


async def test_dashboard_lists_content_for_thumbnails(api):
    h, rid = await returning_user(api)
    summary = (await api.client.get("/resumes", headers=h)).json()[0]
    assert summary["id"] == rid
    assert summary["content"]["experience"][0]["company"] == "Northwind Fintech"


# ---------- tailor job steps (TAIL-3) ----------

async def test_full_tailor_reports_steps_and_clears_them(api):
    h, rid = await returning_user(api)
    seen: list[str] = []

    def tailor_and_peek(user_message: str) -> dict:
        # Runs inside the LLM call: the row must say 'rewriting' right now.
        with psycopg.connect(api.admin_url) as conn:
            seen.append(conn.execute("select job_step from app.resumes where id = %s",
                                     (rid,)).fetchone()[0])
        return honest_tailor(user_message)

    api.provider.push(tailor_and_peek)
    assert (await api.client.post(f"/resumes/{rid}/tailor", json={"scope": "all"},
                                  headers=h)).status_code == 202
    res = await get(api, h, rid)
    assert seen == ["rewriting"]
    assert (res["status"], res["job_step"]) == ("ready", None)


# ---------- save to profile keeps facts, not AI wording (TRUTH-1) ----------

async def _keep_tailored_nw1(api, h, rid) -> int:
    api.provider.push({"text": TAILORED_NW1})
    r = await api.client.post(f"/resumes/{rid}/bullets/nw1/tailor", headers=h)
    r = await api.client.post(f"/resumes/{rid}/bullets/nw1/keep", headers=h,
                              json={"expected_version": r.json()["row_version"]})
    kept = r.json()["bullet"]
    assert (kept["tailor_state"], kept["text"]) == ("kept", TAILORED_NW1)
    assert kept["original_text"].startswith(FACT_NW1)   # Keep no longer drops the fact
    return r.json()["row_version"]


async def test_save_to_profile_writes_facts_not_ai_wording(api):
    h, rid = await returning_user(api)
    await _keep_tailored_nw1(api, h, rid)
    version = (await api.client.get("/profile", headers=h)).json()["row_version"]
    r = await api.client.post(f"/resumes/{rid}/save-to-profile", headers=h,
                              json={"expected_version": version})
    assert r.status_code == 200, r.text
    saved = (await api.client.get("/profile", headers=h)).json()["content"]
    nw1 = saved["experience"][0]["bullets"][0]
    assert nw1["text"].startswith(FACT_NW1)
    assert (nw1["origin"], nw1["original_text"]) == ("user", None)


async def test_retailoring_a_kept_bullet_starts_from_the_fact(api):
    h, rid = await returning_user(api)
    await _keep_tailored_nw1(api, h, rid)
    api.provider.push({"text": "Cut p95 latency 38% with Kafka Streams in Java on AWS"})
    r = await api.client.post(f"/resumes/{rid}/bullets/nw1/tailor", headers=h)
    assert r.status_code == 200, r.text
    assert FACT_NW1 in api.provider.calls[-1]["user"]   # the fact, not the AI wording
    assert TAILORED_NW1 not in api.provider.calls[-1]["user"]
    assert r.json()["bullet"]["original_text"].startswith(FACT_NW1)
    assert bullet(await get(api, h, rid), "nw1")["tailor_state"] == "proposed"
