"""Beta limits from config/limits.yaml (PLAN-2, CUST-4): 3 CV tailorings and 5 new AI chats
per day, 2 custom agents per user. Every attempt counts; the numbers come from the file."""

import pytest

from tests.fixtures import SAMPLE_JD
from tests.integration.test_agents_api import AGENT, answer, make_agent, sql, uid
from tests.integration.test_tailoring_api import honest_tailor, profile_in

pytestmark = pytest.mark.db


async def used_today(api, h, action, n):
    """n uses of `action` already today (the account row is made on the first request)."""
    await api.client.get("/me", headers=h)
    sql(api, "insert into app.usage_events (user_id, action) "
             "select %s, %s from generate_series(1, %s)", uid(h), action, n)


async def usage(api, h):
    body = (await api.client.get("/me/usage", headers=h)).json()
    return {i["key"]: (i["used"], i["limit"]) for i in body["items"]}, body["resets_at"]


async def test_three_cv_tailorings_a_day(beta_api):
    api = beta_api
    h = api.new_user()
    await api.client.put("/profile", json={"content": profile_in()}, headers=h)
    rid = (await api.client.post("/resumes", json={"template": "jake", "mode": "tailored"},
                                 headers=h)).json()["id"]
    await api.client.put(f"/resumes/{rid}/jd", json={"text": SAMPLE_JD}, headers=h)
    await used_today(api, h, "full_tailor", 2)
    api.provider.push(honest_tailor)
    assert (await api.client.post(f"/resumes/{rid}/tailor", json={},
                                  headers=h)).status_code == 202   # the 3rd
    over = await api.client.post(f"/resumes/{rid}/tailor", json={}, headers=h)
    err = over.json()["error"]
    assert over.status_code == 429 and err["code"] == "quota_exceeded"
    assert err["details"] == {"action": "full_tailor", "limit": 3}
    assert "3 CV tailorings" in err["message"]
    assert (await usage(api, h))[0]["full_tailor"] == (3, 3)


async def test_five_new_chats_a_day_but_open_chats_keep_going(beta_api):
    api = beta_api
    h = api.new_user()
    api.provider.push_turn(answer(content="Hi.", cited=()))
    cid = (await api.client.post("/chats/messages", headers=h,
                                 json={"message": "@analyst hi"})).json()["chat"]["id"]
    await used_today(api, h, "chat_start", 4)   # 5 started

    over = await api.client.post("/chats/messages", headers=h, json={"message": "@analyst new"})
    assert over.status_code == 429
    assert over.json()["error"]["details"] == {"action": "chat_start", "limit": 5}

    api.provider.push_turn(answer(content="Still here.", cited=()))
    more = await api.client.post(f"/chats/{cid}/messages", headers=h, json={"message": "and?"})
    assert more.status_code == 202, more.text
    assert (await usage(api, h))[0]["chat_start"] == (5, 5)


async def test_try_it_counts_as_a_new_chat(beta_api):
    api = beta_api
    h = api.new_user()
    await used_today(api, h, "chat_start", 5)
    r = await api.client.post("/agents/preview", headers=h,
                              json={"agent": AGENT, "message": "hello"})
    assert r.status_code == 429
    assert r.json()["error"]["details"]["action"] == "chat_start"


async def test_two_custom_agents_per_user(beta_api):
    api = beta_api
    h = api.new_user()
    await make_agent(api, h)
    second = await make_agent(api, h, handle="nudger")
    third = await api.client.post("/agents", json={**AGENT, "handle": "third"}, headers=h)
    assert third.status_code == 409
    assert third.json()["error"]["code"] == "agent_limit_reached"
    assert third.json()["error"]["details"]["limit"] == 2
    listing = (await api.client.get("/agents", headers=h)).json()
    assert (listing["limit"], listing["count"]) == (2, 2)

    assert (await api.client.delete(f"/agents/{second['id']}", headers=h)).status_code == 204
    await make_agent(api, h, handle="third")   # deleting one frees a place


async def test_usage_is_per_user_and_lists_every_limit(beta_api):
    api = beta_api
    a, b = api.new_user(), api.new_user()
    await used_today(api, a, "full_tailor", 2)
    await make_agent(api, a)
    items, resets_at = await usage(api, a)
    assert items == {"full_tailor": (2, 3), "chat_start": (0, 5), "chat_message": (0, 125),
                     "bullet_tailor": (0, 150), "pdf": (0, 40), "analysis": (0, 40),
                     "upload": (0, 20), "custom_agents": (1, 2)}
    assert resets_at.endswith("T00:00:00+00:00")
    other, _ = await usage(api, b)   # RLS + user filter: b sees none of a's usage
    assert other["full_tailor"] == (0, 3) and other["custom_agents"] == (0, 2)
