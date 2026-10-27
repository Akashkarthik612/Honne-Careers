"""Day 3: custom agents + chat over real Postgres and RLS; only the model is faked.

Done-when (Day_3 §5): create / edit / delete / try an agent; chat answers built from the
user's own data with the rows it used; never another user's data; never writes; every turn
recorded; limits enforced with a clear code. BackgroundTasks run before the test client's
request returns, so a turn has finished by the time the 202 comes back.
"""

import asyncio
import json

import psycopg
import pytest

from app.agents.providers.base import LlmTransientError
from tests.fixtures import SAMPLE_JD
from tests.integration.test_tailoring_api import returning_user

pytestmark = pytest.mark.db

AGENT = {"handle": "@Follow-Up", "description": "Drafts follow-ups for silent applications",
         "instructions": "Look at applications with no reply for 7+ days and draft follow-ups.",
         "guardrails": "Never mention salary.", "knowledge": ["applications", "profile"]}


def uid(h) -> str:
    return h["Authorization"].removeprefix("Bearer user:")


def sql(api, query, *params):
    with psycopg.connect(api.admin_url, autocommit=True) as conn:
        cur = conn.execute(query, params)
        return cur.fetchall() if cur.description else None


async def add_app(api, h, company, notes=None, jd=None, status="applied"):
    body = {"company": company, "role": "SDE-2", "status": status}
    if notes:
        body["notes"] = notes
    if jd:
        body["jd_text"] = jd
    r = await api.client.post("/applications", json=body, headers=h)
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def make_agent(api, h, **over):
    r = await api.client.post("/agents", json={**AGENT, **over}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


def answer(content="Groww has had no reply [1].", cited=(1,), **extra):
    return [("submit_answer", {"content": content, "cited": list(cited), **extra})]


def agent_state_rows(api, mid):
    """Checkpoint rows of one turn's run (thread = the assistant message id)."""
    return sql(api, "select (select count(*) from agent_state.checkpoints where thread_id = %s)"
                    " + (select count(*) from agent_state.checkpoint_blobs where thread_id = %s)"
                    " + (select count(*) from agent_state.checkpoint_writes where thread_id = %s)",
               mid, mid, mid)[0][0]


def last_tool_result(messages):
    tool_msgs = [m for m in messages if m.role == "tool"]
    return tool_msgs[-1].tool_results[0].content


# ---------- agents: CRUD, versions, limits ----------

async def test_create_edit_version_and_archive_an_agent(api):
    h = api.new_user()
    agent = await make_agent(api, h)
    assert agent["handle"] == "follow-up" and agent["version"] == 1
    assert agent["knowledge"] == ["applications", "profile"]

    listing = (await api.client.get("/agents", headers=h)).json()
    assert [a["handle"] for a in listing["mine"]] == ["follow-up"]
    assert {b["handle"] for b in listing["builtin"]} == {
        "analyst", "advisor", "fit", "outreach", "strategist"}
    assert listing["limit"] == 10 and listing["count"] == 1

    r = await api.client.put(f"/agents/{agent['id']}", headers=h, json={
        **AGENT, "handle": "nudger", "instructions": "v2 instructions",
        "expected_version": agent["row_version"]})
    assert r.status_code == 200 and r.json()["version"] == 2 and r.json()["handle"] == "nudger"
    stale = await api.client.put(f"/agents/{agent['id']}", headers=h, json={
        **AGENT, "expected_version": agent["row_version"]})
    assert stale.status_code == 409 and stale.json()["error"]["code"] == "stale_version"
    versions = sql(api, "select version, instructions from app.chat_agent_versions "
                        "where agent_id = %s order by version", agent["id"])
    assert [v[0] for v in versions] == [1, 2] and versions[0][1] == AGENT["instructions"]

    assert (await api.client.delete(f"/agents/{agent['id']}", headers=h)).status_code == 204
    assert (await api.client.get(f"/agents/{agent['id']}", headers=h)).status_code == 404
    await make_agent(api, h, handle="nudger")  # an archived agent frees its handle


async def test_handle_rules(api):
    h = api.new_user()
    await make_agent(api, h)
    dup = await api.client.post("/agents", json=AGENT, headers=h)
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "handle_taken"
    for reserved in ("analyst", "@Auto", "cv-writer"):
        r = await api.client.post("/agents", json={**AGENT, "handle": reserved}, headers=h)
        assert r.json()["error"]["code"] == "handle_reserved", reserved
    bad = await api.client.post("/agents", json={**AGENT, "handle": "has space"}, headers=h)
    assert bad.status_code == 422
    sneaky = await api.client.post("/agents", json={**AGENT, "model": "gpt-5"}, headers=h)
    assert sneaky.status_code == 422  # extra="forbid": we set model and tools, not the user


async def test_agent_cap_holds_under_concurrent_creates(api):
    h = api.new_user()
    results = await asyncio.gather(*(
        api.client.post("/agents", json={**AGENT, "handle": f"agent-{i}"}, headers=h)
        for i in range(13)))
    codes = sorted(r.status_code for r in results)
    assert codes.count(201) == 10 and codes.count(409) == 3
    assert {r.json()["error"]["code"] for r in results if r.status_code == 409} == {
        "agent_limit_reached"}


async def test_another_users_agent_is_a_404_everywhere(api):
    a, b = api.new_user(), api.new_user()
    agent = await make_agent(api, a)
    assert (await api.client.get(f"/agents/{agent['id']}", headers=b)).status_code == 404
    put = await api.client.put(f"/agents/{agent['id']}", headers=b,
                               json={**AGENT, "expected_version": 1})
    assert put.status_code == 404
    assert (await api.client.delete(f"/agents/{agent['id']}", headers=b)).status_code == 404
    chat = await api.client.post("/chats/messages", headers=b,
                                 json={"message": "@follow-up hi"})
    assert chat.status_code == 404 and chat.json()["error"]["code"] == "agent_not_found"
    assert (await api.client.get("/agents", headers=b)).json()["mine"] == []


# ---------- chat: one turn end to end ----------

async def test_chat_turn_answers_from_the_users_own_data(api):
    h = api.new_user()
    agent = await make_agent(api, h)
    groww = await add_app(api, h, "Groww", notes="Recruiter: Priya", jd=SAMPLE_JD)
    await add_app(api, h, "Flipkart", status="interview")

    def open_first(messages):
        rows = last_tool_result(messages)["untrusted_data"]["applications"]
        return [("read_application", {"application_id": rows[-1]["application_id"]})]

    api.provider.push_turn(
        [("list_applications", {"status": ["applied"]})], open_first,
        answer(drafts=[{"to": "Recruiting, Groww", "subject": "Following up",
                        "body": "Hi, following up on my SDE-2 application."}]))
    r = await api.client.post("/chats/messages", headers=h,
                              json={"message": "@follow-up who hasn't replied?"})
    assert r.status_code == 202, r.text
    started = r.json()
    assert started["assistant_message"]["status"] == "running"
    assert started["assistant_message"]["agent"] == {"handle": "follow-up", "kind": "user"}

    msg = (await api.client.get(started["poll"], headers=h)).json()
    assert msg["status"] == "ok" and msg["content"].startswith("Groww")
    assert msg["sources"] == [{"ref": 1, "kind": "application", "id": groww,
                               "label": "Groww · SDE-2",
                               "meta": {"company": "Groww", "role": "SDE-2",
                                        "status": "applied", "referral": None,
                                        "sent": msg["sources"][0]["meta"]["sent"]}}]
    assert [s["tool"] for s in msg["steps"]] == ["list_applications", "read_application"]
    assert msg["steps"][0]["label"] == "Read your Database · 1 application"
    assert msg["drafts"][0]["to"] == "Recruiting, Groww"

    # The model saw only granted tools, and the JD as untrusted data, never in the prompt.
    first = api.provider.tool_calls[0]
    assert first["tools"] == ["read_profile", "list_applications", "read_application",
                              "submit_answer"]
    assert "Never mention salary." in first["system"]
    assert SAMPLE_JD[:40] not in first["system"]
    opened = last_tool_result(api.provider.tool_calls[2]["messages"])
    assert opened["untrusted_data"]["jd_text"].startswith(SAMPLE_JD[:40])

    chat = (await api.client.get(f"/chats/{started['chat']['id']}", headers=h)).json()
    assert [m["role"] for m in chat["messages"]] == ["user", "assistant"]
    assert chat["turn_count"] == 1 and chat["turns_max"] == 25 and not chat["running"]
    assert agent_state_rows(api, msg["id"]) == 0   # a finished turn keeps no run state
    assert chat["title"] == "who hasn't replied?"

    runs = sql(api, "select agent_id, agent_version, status, tool_calls, tool_names, entity_id "
                    "from app.agent_runs where user_id = %s", uid(h))
    assert runs == [(f"custom:{agent['id']}", 1, "succeeded", 2,
                     ["list_applications", "read_application"],
                     __import__("uuid").UUID(msg["id"]))]
    listing = (await api.client.get("/agents", headers=h)).json()
    assert listing["mine"][0]["chat_count"] == 1

    # Read-only (Day_3 §3.2): the turn changed no application.
    rows = sql(api, "select status, notes from app.applications where user_id = %s "
                    "order by company", uid(h))
    assert rows == [("interview", None), ("applied", "Recruiter: Priya")]


async def test_follow_up_turn_keeps_the_agent_and_sends_history(api):
    h = api.new_user()
    await make_agent(api, h)
    api.provider.push_turn(answer(content="First.", cited=()))
    first = (await api.client.post("/chats/messages", headers=h,
                                   json={"message": "@follow-up hello"})).json()
    cid = first["chat"]["id"]
    api.provider.push_turn(answer(content="Second.", cited=()))
    second = await api.client.post(f"/chats/{cid}/messages", headers=h,
                                   json={"message": "and now?"})
    assert second.json()["assistant_message"]["agent"]["handle"] == "follow-up"
    sent = api.provider.tool_calls[-1]["messages"]
    assert [(m.role, m.text) for m in sent] == [
        ("user", "@follow-up hello"), ("model", "First."), ("user", "and now?")]

    # One chat, many agents (Dust): @analyst sees the whole chat, the other agent's answers
    # as labelled notes in the user's turn, and the roles still alternate.
    api.provider.push_turn(answer(content="Analyst here.", cited=()))
    handoff = await api.client.post(f"/chats/{cid}/messages", headers=h,
                                    json={"message": "@analyst your view?"})
    assert handoff.json()["assistant_message"]["agent"] == {"handle": "analyst",
                                                            "kind": "builtin"}
    seen = api.provider.tool_calls[-1]["messages"]
    assert [m.role for m in seen] == ["user"]
    assert seen[0].text.count('<other_agent handle="@follow-up">') == 2
    assert "First." in seen[0].text and seen[0].text.endswith("@analyst your view?")
    runs = sql(api, "select agent_id from app.agent_runs where user_id = %s "
                    "order by created_at", uid(h))
    assert runs[-1] == ("builtin:analyst",)

    # No @: the agent that answered last; it sees @follow-up's answers as notes, its own as
    # its turn.
    api.provider.push_turn(answer(content="Still analyst.", cited=()))
    again = await api.client.post(f"/chats/{cid}/messages", headers=h,
                                  json={"message": "more?"})
    assert again.json()["assistant_message"]["agent"]["handle"] == "analyst"
    seen = api.provider.tool_calls[-1]["messages"]
    assert [(m.role, m.text) for m in seen[1:]] == [("model", "Analyst here."),
                                                   ("user", "more?")]


async def test_a_follow_up_finds_its_agent_by_id_after_a_rename(api):
    """Review #2: a renamed agent keeps its chats; a new agent reusing the old handle never
    takes them over; a deleted one gives a clear error."""
    h = api.new_user()
    agent = await make_agent(api, h)
    api.provider.push_turn(answer(content="First.", cited=()))
    cid = (await api.client.post("/chats/messages", headers=h,
                                 json={"message": "@follow-up hello"})).json()["chat"]["id"]
    r = await api.client.put(f"/agents/{agent['id']}", headers=h, json={
        **AGENT, "handle": "nudger", "expected_version": agent["row_version"]})
    assert r.status_code == 200
    await make_agent(api, h, instructions="An impostor reusing the old handle.")

    api.provider.push_turn(answer(content="Second.", cited=()))
    second = await api.client.post(f"/chats/{cid}/messages", headers=h,
                                   json={"message": "and now?"})
    assert second.status_code == 202, second.text
    assert second.json()["assistant_message"]["agent"] == {"handle": "nudger", "kind": "user"}
    assert "impostor" not in api.provider.tool_calls[-1]["system"]
    assert [m.role for m in api.provider.tool_calls[-1]["messages"]] == ["user", "model", "user"]

    assert (await api.client.delete(f"/agents/{agent['id']}", headers=h)).status_code == 204
    gone = await api.client.post(f"/chats/{cid}/messages", headers=h, json={"message": "x"})
    assert gone.status_code == 404 and gone.json()["error"]["code"] == "agent_gone"


async def test_a_message_needs_an_agent(api):
    h = api.new_user()
    r = await api.client.post("/chats/messages", headers=h, json={"message": "hello"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "agent_required"
    assert sql(api, "select count(*) from app.chats where user_id = %s", uid(h)) == [(0,)]


async def test_tools_cannot_read_another_users_rows(api):
    a, b = api.new_user(), api.new_user()
    theirs = await add_app(api, b, "SecretCo", notes="B's private note")
    await make_agent(api, a)
    api.provider.push_turn([("read_application", {"application_id": theirs})],
                           answer(content="Nothing found.", cited=()))
    r = await api.client.post("/chats/messages", headers=a,
                              json={"message": "@follow-up open it"})
    msg = (await api.client.get(r.json()["poll"], headers=a)).json()
    assert msg["status"] == "ok" and msg["sources"] == []
    seen = last_tool_result(api.provider.tool_calls[1]["messages"])
    assert seen["error"] == "not_found"
    assert "B's private note" not in json.dumps(
        [str(m) for c in api.provider.tool_calls for m in c["messages"]])


async def test_another_users_chat_is_a_404(api):
    a, b = api.new_user(), api.new_user()
    await make_agent(api, a)
    api.provider.push_turn(answer(content="Hi.", cited=()))
    started = (await api.client.post("/chats/messages", headers=a,
                                     json={"message": "@follow-up hi"})).json()
    cid = started["chat"]["id"]
    for path in (f"/chats/{cid}", started["poll"]):
        assert (await api.client.get(path, headers=b)).status_code == 404
    assert (await api.client.post(f"/chats/{cid}/messages", headers=b,
                                  json={"message": "@analyst x"})).status_code == 404
    assert (await api.client.delete(f"/chats/{cid}", headers=b)).status_code == 404
    assert (await api.client.get("/chats", headers=b)).json() == {
        "items": [], "retention_days": api.container.applications.window.days, "limit": 50}


# ---------- failures, retry, stale, busy ----------

async def test_failed_turn_keeps_the_message_and_retry_answers_in_place(api):
    h = api.new_user()
    await make_agent(api, h)
    api.provider.push_turn(LlmTransientError("503"), LlmTransientError("503"))
    started = (await api.client.post("/chats/messages", headers=h,
                                     json={"message": "@follow-up hi"})).json()
    failed = (await api.client.get(started["poll"], headers=h)).json()
    assert failed["status"] == "failed" and failed["error_code"] == "llm_unavailable"

    api.provider.push_turn(answer(content="Back.", cited=()))
    cid = started["chat"]["id"]
    retried = await api.client.post(f"/chats/{cid}/retry", headers=h)
    assert retried.status_code == 202
    assert retried.json()["assistant_message"]["id"] == failed["id"]
    chat = (await api.client.get(f"/chats/{cid}", headers=h)).json()
    assert [(m["role"], m["status"]) for m in chat["messages"]] == [("user", "ok"),
                                                                    ("assistant", "ok")]
    again = await api.client.post(f"/chats/{cid}/retry", headers=h)
    assert again.json()["error"]["code"] == "nothing_to_retry"


async def test_retry_resumes_the_run_from_its_checkpoint(api):
    """The tool round before the failure is not run again: the retried model call gets the
    saved tool result, the step stays on screen, and the run state is gone once it's ok."""
    h = api.new_user()
    await make_agent(api, h)
    await add_app(api, h, "Groww")
    api.provider.push_turn([("list_applications", {})],
                           LlmTransientError("503"), LlmTransientError("503"))
    started = (await api.client.post("/chats/messages", headers=h,
                                     json={"message": "@follow-up who?"})).json()
    failed = (await api.client.get(started["poll"], headers=h)).json()
    assert failed["status"] == "failed" and len(failed["steps"]) == 1
    assert agent_state_rows(api, failed["id"]) > 0
    calls_before = len(api.provider.tool_calls)

    api.provider.push_turn(answer(content="Groww [1].", cited=(1,)))
    cid = started["chat"]["id"]
    assert (await api.client.post(f"/chats/{cid}/retry", headers=h)).status_code == 202
    msg = (await api.client.get(started["poll"], headers=h)).json()
    assert msg["status"] == "ok" and msg["sources"][0]["label"] == "Groww · SDE-2"
    assert [s["tool"] for s in msg["steps"]] == ["list_applications"]   # not run twice
    resumed = api.provider.tool_calls[calls_before:]
    assert len(resumed) == 1 and resumed[0]["messages"][-1].role == "tool"
    assert agent_state_rows(api, msg["id"]) == 0


async def test_retry_after_an_invalid_answer_starts_fresh_f4(api, capsys):
    h = api.new_user()
    await make_agent(api, h)
    api.provider.push_turn([("submit_answer", {"content": ""})])   # fails ChatAnswer
    started = (await api.client.post("/chats/messages", headers=h,
                                     json={"message": "@follow-up hi"})).json()
    failed = (await api.client.get(started["poll"], headers=h)).json()
    assert failed["error_code"] == "llm_output_invalid"
    api.provider.push_turn(answer(content="Hi.", cited=()))
    cid = started["chat"]["id"]
    assert (await api.client.post(f"/chats/{cid}/retry", headers=h)).status_code == 202
    assert (await api.client.get(started["poll"], headers=h)).json()["status"] == "ok"
    assert [m.role for m in api.provider.tool_calls[-1]["messages"]] == ["user"]
    assert "reason=run_finished" in capsys.readouterr().out


async def test_run_state_is_dropped_with_the_chat_the_account_and_by_the_janitor(api):
    h = api.new_user()
    await make_agent(api, h)
    api.provider.push_turn(LlmTransientError("503"), LlmTransientError("503"))
    started = (await api.client.post("/chats/messages", headers=h,
                                     json={"message": "@follow-up hi"})).json()
    mid = started["assistant_message"]["id"]
    assert agent_state_rows(api, mid) > 0
    assert (await api.client.delete(f"/chats/{started['chat']['id']}",
                                    headers=h)).status_code == 204
    assert agent_state_rows(api, mid) == 0

    api.provider.push_turn(LlmTransientError("503"), LlmTransientError("503"))
    started = (await api.client.post("/chats/messages", headers=h,
                                     json={"message": "@follow-up hi"})).json()
    mid = started["assistant_message"]["id"]
    assert agent_state_rows(api, mid) > 0
    assert (await api.client.delete("/me", headers=h)).status_code == 204
    assert agent_state_rows(api, mid) == 0

    # F5: an orphan (a run that kept writing after its chat was deleted).
    sql(api, "insert into agent_state.checkpoints (thread_id, checkpoint_id, checkpoint) "
             "values ('00000000-0000-0000-0000-000000000001', 'c', '{}')")
    result = await api.container.janitor.run_once()
    assert result.agent_states_deleted >= 1
    assert agent_state_rows(api, "00000000-0000-0000-0000-000000000001") == 0


def test_the_saver_cannot_be_reached_by_app_users(api):
    for role in ("authenticated", "anon"):
        rows = sql(api, "select has_schema_privilege(%s, 'agent_state', 'usage')", role)
        assert rows == [(False,)], role


async def test_one_running_turn_per_chat_and_dead_turns_go_stale(api):
    h = api.new_user()
    await make_agent(api, h)
    api.provider.push_turn(answer(content="Hi.", cited=()))
    started = (await api.client.post("/chats/messages", headers=h,
                                     json={"message": "@follow-up hi"})).json()
    cid, mid = started["chat"]["id"], started["assistant_message"]["id"]
    sql(api, "update app.chat_messages set status = 'running', started_at = now() "
             "where id = %s", mid)  # as if the job were still going
    busy = await api.client.post(f"/chats/{cid}/messages", headers=h,
                                 json={"message": "again"})
    assert busy.status_code == 409 and busy.json()["error"]["code"] == "chat_busy"

    sql(api, "update app.chat_messages set started_at = now() - interval '1 hour' "
             "where id = %s", mid)  # the process died (Render restart)
    msg = (await api.client.get(f"/chats/{cid}/messages/{mid}", headers=h)).json()
    assert msg["status"] == "failed" and msg["error_code"] == "stale_job"


async def test_turn_and_quota_limits(api):
    h = api.new_user()
    await make_agent(api, h)
    api.provider.push_turn(answer(content="Hi.", cited=()))
    cid = (await api.client.post("/chats/messages", headers=h,
                                 json={"message": "@follow-up hi"})).json()["chat"]["id"]
    sql(api, "update app.chats set turn_count = 25 where id = %s", cid)   # 50 messages
    full = await api.client.post(f"/chats/{cid}/messages", headers=h, json={"message": "x"})
    assert full.status_code == 409 and full.json()["error"]["code"] == "chat_limit_reached"

    sql(api, "insert into app.usage_events (user_id, action) "
             "select %s, 'chat_message' from generate_series(1, 49)", uid(h))
    over = await api.client.post("/chats/messages", headers=h,
                                 json={"message": "@follow-up hi"})
    assert over.status_code == 429 and over.json()["error"]["code"] == "quota_exceeded"


# ---------- Try it (CUST-3) ----------

async def test_try_it_answers_without_saving_anything(api):
    h, _ = await returning_user(api)
    api.provider.push_turn([("read_profile", {})], answer(content="You know Java [1].",
                                                          cited=(1,)))
    r = await api.client.post("/agents/preview", headers=h, json={
        "agent": {**AGENT, "knowledge": ["profile"]}, "message": "what do I know?"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["sources"][0]["kind"] == "profile" and body["steps"][0]["tool"] == "read_profile"
    assert api.provider.tool_calls[0]["tools"] == ["read_profile", "submit_answer"]
    assert sql(api, "select count(*) from app.chat_agents where user_id = %s", uid(h)) == [(0,)]
    assert sql(api, "select count(*) from app.chats where user_id = %s", uid(h)) == [(0,)]
    assert sql(api, "select agent_id from app.agent_runs where user_id = %s", uid(h)) == [
        ("custom:preview",)]


# ---------- retention and account deletion ----------

async def test_old_chats_are_hidden_and_purged(api):
    h = api.new_user()
    await make_agent(api, h)
    api.provider.push_turn(answer(content="Hi.", cited=()))
    cid = (await api.client.post("/chats/messages", headers=h,
                                 json={"message": "@follow-up hi"})).json()["chat"]["id"]
    sql(api, "update app.chats set created_at = now() - make_interval(days => %s) where id = %s",
        api.container.applications.window.days + 1, cid)
    assert (await api.client.get(f"/chats/{cid}", headers=h)).status_code == 404
    assert (await api.client.get("/chats", headers=h)).json()["items"] == []
    result = await api.container.janitor.run_once()
    assert result.chats_deleted >= 1
    assert sql(api, "select count(*) from app.chat_messages where chat_id = %s", cid) == [(0,)]


async def test_deleting_the_account_deletes_agents_and_chats(api):
    h = api.new_user()
    await make_agent(api, h)
    api.provider.push_turn(answer(content="Hi.", cited=()))
    await api.client.post("/chats/messages", headers=h, json={"message": "@follow-up hi"})
    assert (await api.client.delete("/me", headers=h)).status_code == 204
    for table in ("chat_agents", "chat_agent_versions", "chats", "chat_messages"):
        assert sql(api, f"select count(*) from app.{table} where user_id = %s",  # noqa: S608
                   uid(h)) == [(0,)], table
