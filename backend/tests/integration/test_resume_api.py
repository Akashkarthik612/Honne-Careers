"""Day_1 A4 #2, #3 and the B5 edit rules, over HTTP against real Postgres + RLS."""

import pytest

pytestmark = pytest.mark.db

EXPERIENCE = [{"id": "e1", "role": "Engineer", "company": "Northwind", "start": "Jul 2021",
               "bullets": [{"id": "b1", "text": "Cut latency by 38% with Kafka"}]}]


async def _resume(api, headers, mode="scratch"):
    r = await api.client.post("/resumes", json={"template": "jake", "mode": mode},
                              headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


async def _patch(api, headers, rid, version, section, value, step=None):
    body = {"expected_version": version, "change": {"section": section, "value": value}}
    if step:
        body["wizard_step"] = step
    return await api.client.patch(f"/resumes/{rid}", json=body, headers=headers)


async def test_wizard_autosave_and_stale_second_tab(api):
    h = api.new_user()
    res = await _resume(api, h)
    assert res["wizard_step"] == "personal"

    r = await _patch(api, h, res["id"], 1, "experience", EXPERIENCE, step="projects")
    assert r.status_code == 200
    assert r.json()["row_version"] == 2

    stale = await _patch(api, h, res["id"], 1, "personal", {"name": "Tab two"})
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "stale_version"

    got = (await api.client.get(f"/resumes/{res['id']}", headers=h)).json()
    bullet = got["content"]["experience"][0]["bullets"][0]
    assert (bullet["origin"], bullet["locked"]) == ("user", True)   # B5: server-stamped
    assert bullet["text"] == "Cut latency by 38% with Kafka"        # exactly as typed
    assert got["wizard_step"] == "projects"


async def test_client_cannot_set_origin_or_unlock(api):
    h = api.new_user()
    res = await _resume(api, h)
    forged = [{**EXPERIENCE[0], "bullets": [{"id": "b1", "text": "x", "origin": "ai",
                                              "locked": False}]}]
    r = await _patch(api, h, res["id"], 1, "experience", forged)
    assert r.status_code == 422  # unknown fields rejected, not silently dropped


async def test_unknown_section_and_duplicate_ids_rejected(api):
    h = api.new_user()
    res = await _resume(api, h)
    assert (await _patch(api, h, res["id"], 1, "salary", {})).status_code == 422
    dup = [EXPERIENCE[0], {**EXPERIENCE[0]}]
    assert (await _patch(api, h, res["id"], 1, "experience", dup)).status_code == 422


async def test_other_user_gets_404_everywhere(api):
    owner, intruder = api.new_user(), api.new_user()
    rid = (await _resume(api, owner))["id"]
    for method, path, body in [
        ("GET", f"/resumes/{rid}", None),
        ("PATCH", f"/resumes/{rid}", {"expected_version": 1,
                                       "change": {"section": "personal", "value": {}}}),
        ("DELETE", f"/resumes/{rid}", None),
        ("POST", f"/resumes/{rid}/duplicate", None),
        ("PUT", f"/resumes/{rid}/jd", {"text": "Backend engineer role"}),
    ]:
        r = await api.client.request(method, path, json=body, headers=intruder)
        assert r.status_code == 404, (method, path, r.status_code)
    assert (await api.client.get("/resumes", headers=intruder)).json() == []
    assert (await api.client.get(f"/resumes/{rid}", headers=owner)).status_code == 200


async def test_dashboard_duplicate_and_delete_with_files(api):
    h = api.new_user()
    res = await _resume(api, h)
    user_id = h["Authorization"].removeprefix("Bearer user:")
    api.files.objects[f"{user_id}/resumes/{res['id']}/{'a' * 64}.pdf"] = b"%PDF"

    copy = (await api.client.post(f"/resumes/{res['id']}/duplicate", headers=h)).json()
    assert copy["title"].endswith("(copy)")
    assert len((await api.client.get("/resumes", headers=h)).json()) == 2

    assert (await api.client.delete(f"/resumes/{res['id']}", headers=h)).status_code == 204
    assert not api.files.objects  # A4 #2: delete removes storage files too
    assert [r["id"] for r in (await api.client.get("/resumes", headers=h)).json()] == [
        copy["id"]]


async def test_jd_word_limit_and_dedupe(api):
    h = api.new_user()
    rid = (await _resume(api, h, mode="tailored"))["id"]
    too_long = " ".join(["word"] * 1001)
    r = await api.client.put(f"/resumes/{rid}/jd", json={"text": too_long}, headers=h)
    assert r.status_code == 422

    jd = "SDE-2, Backend Engineer · Chennai\nBuild event-driven services in Java."
    first = (await api.client.put(f"/resumes/{rid}/jd", json={"text": jd}, headers=h)).json()
    again = (await api.client.put(f"/resumes/{rid}/jd", json={"text": jd}, headers=h)).json()
    assert first["id"] == again["id"]
    assert first["role"] == "SDE-2, Backend Engineer"


async def test_profile_create_update_and_returning_user_prefill(api):
    h = api.new_user()
    assert (await api.client.get("/profile", headers=h)).status_code == 404
    content = {"header": {"name": "Arjun"}, "experience": EXPERIENCE}
    r = await api.client.put("/profile", json={"content": content}, headers=h)
    assert r.json()["row_version"] == 1
    again = await api.client.put("/profile", json={"content": content}, headers=h)
    assert again.status_code == 409  # create twice
    upd = await api.client.put("/profile", json={"content": content, "expected_version": 1},
                               headers=h)
    assert upd.json()["row_version"] == 2
    assert (await api.client.get("/me", headers=h)).json()["has_profile"] is True

    res = await _resume(api, h, mode="tailored")
    assert res["wizard_step"] == "done"  # A2 #6: returning users skip the wizard
    bullet = res["content"]["experience"][0]["bullets"][0]
    assert (bullet["origin"], bullet["locked"]) == ("profile", False)


async def test_templates_list(api):
    r = await api.client.get("/templates")
    assert [t["id"] for t in r.json()] == ["jake", "honne_professional"]
