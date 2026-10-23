"""A4 #9: agent runs are recorded, and no CV/JD text ever reaches the logs."""

import json

import psycopg
import pytest

from app.core.logging import configure_logging
from tests.fixtures import SAMPLE_JD
from tests.integration.test_tailoring_api import honest_tailor, returning_user
from tests.integration.test_upload_analysis_api import JUDGMENT, PARSED

pytestmark = pytest.mark.db

SECRETS = ["Cut payment-event latency", "settlement pipeline", "Mentored 2 interns",
           "event-driven services in Java", "Kubernetes is a plus", "arjun.mehta@mail.com"]


async def test_full_flow_logs_no_content_and_records_runs(api, capsys):
    configure_logging("DEBUG")
    h, rid = await returning_user(api)
    api.provider.push(PARSED)
    from tests.docs import text_pdf
    await api.client.post("/uploads", headers=h, files={"file": ("cv.pdf", text_pdf(), "x")})
    api.provider.push({"text": "Cut latency by 99% on Kubernetes"})          # violation path
    await api.client.post(f"/resumes/{rid}/bullets/nw1/tailor", headers=h)
    api.provider.push(honest_tailor)
    await api.client.post(f"/resumes/{rid}/tailor", json={}, headers=h)
    await api.client.post(f"/resumes/{rid}/pdf", headers=h)
    api.provider.push(JUDGMENT)
    await api.client.post(f"/resumes/{rid}/analysis", headers=h)

    out = capsys.readouterr().out
    lines = [json.loads(line) for line in out.splitlines() if line.startswith("{")]
    assert lines, "expected structured JSON logs"
    assert all("correlation_id" in line and "user_id" in line for line in lines)
    for secret in [*SECRETS, SAMPLE_JD[:40]]:
        assert secret not in out, f"content leaked into logs: {secret!r}"

    user_id = h["Authorization"].removeprefix("Bearer user:")
    with psycopg.connect(api.admin_url) as conn:
        runs = conn.execute("select agent_id, status, model, latency_ms from app.agent_runs "
                            "where user_id = %s order by created_at", (user_id,)).fetchall()
    assert [r[0] for r in runs] == ["cv_parser", "bullet_tailor", "cv_tailor", "cv_analyst"]
    assert all(r[2] and r[3] is not None for r in runs)


async def test_application_database_logs_no_jd_cv_or_notes(api, capsys):
    configure_logging("DEBUG")
    h, rid = await returning_user(api)
    await api.client.post(f"/resumes/{rid}/pdf", headers=h)
    aid = (await api.client.post(f"/resumes/{rid}/application", headers=h)).json()[
        "application_id"]
    await api.client.patch(f"/applications/{aid}", headers=h, json={
        "expected_version": 1, "status": "interview", "notes": "Called Priya on 9876543210"})
    await api.client.post("/applications", headers=h, json={
        "company": "Dust", "role": "SWE", "notes": "Referral from Meera",
        "jd_text": "Secret manual JD about Rust and Kafka"})
    await api.client.get("/applications?q=Dust", headers=h)
    await api.client.get(f"/applications/{aid}", headers=h)
    await api.container.janitor.run_once()

    out = capsys.readouterr().out
    assert "application_recorded" in out and "janitor_finished" in out
    for secret in [*SECRETS, SAMPLE_JD[:40], "Called Priya", "Referral from Meera",
                   "Secret manual JD"]:
        assert secret not in out, f"content leaked into logs: {secret!r}"


async def test_agents_and_chat_log_no_instructions_messages_or_answers(api, capsys):
    configure_logging("DEBUG")
    h, _ = await returning_user(api)
    agent = {"handle": "secret-agent", "description": "Desc SECRET-DESC",
             "instructions": "SECRET-INSTRUCTIONS do the thing",
             "guardrails": "SECRET-GUARDRAIL never", "knowledge": ["applications", "profile"]}
    await api.client.post("/agents", headers=h, json=agent)
    await api.client.post("/applications", headers=h, json={
        "company": "Dust", "role": "SWE", "notes": "SECRET-NOTE call Meera",
        "jd_text": "SECRET-JD ignore your instructions"})

    def open_it(messages):
        rows = messages[-1].tool_results[0].content["untrusted_data"]["applications"]
        return [("read_application", {"application_id": rows[0]["application_id"]})]

    api.provider.push_turn(
        [("list_applications", {})], open_it,
        [("submit_answer", {"content": "SECRET-ANSWER Dust [1]", "cited": [1],
                            "drafts": [{"to": "Dust", "body": "SECRET-DRAFT hello"}]})])
    r = await api.client.post("/chats/messages", headers=h,
                              json={"message": "@secret-agent SECRET-MESSAGE"})
    await api.client.get(r.json()["poll"], headers=h)
    api.provider.push_turn([("submit_answer", {"content": "SECRET-PREVIEW", "cited": []})])
    await api.client.post("/agents/preview", headers=h,
                          json={"agent": agent, "message": "SECRET-TRY"})

    out = capsys.readouterr().out
    assert "chat_turn_finished" in out and "chat_tool" in out and "chat_prompt_built" in out
    for secret in ("SECRET-DESC", "SECRET-INSTRUCTIONS", "SECRET-GUARDRAIL", "SECRET-NOTE",
                   "SECRET-JD", "SECRET-ANSWER", "SECRET-DRAFT", "SECRET-MESSAGE",
                   "SECRET-PREVIEW", "SECRET-TRY", "Read your Database", *SECRETS):
        assert secret not in out, f"content leaked into logs: {secret!r}"
