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
