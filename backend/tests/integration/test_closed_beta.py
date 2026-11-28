import asyncio
from collections.abc import AsyncIterator
from dataclasses import replace

import pytest

from tests.fakes import FakeVerifier
from tests.fixtures import SAMPLE_JD
from tests.integration.conftest import BETA_LIMITS, Api, _harness, make_settings
from tests.integration.test_agents_api import sql, uid
from tests.integration.test_tailoring_api import honest_tailor, profile_in

pytestmark = pytest.mark.db


class InviteVerifier(FakeVerifier):
    async def verify(self, token):
        user = await super().verify(token)
        return replace(user, email="tester@example.test" if getattr(self, "invite", True)
                       else "other@example.test")


@pytest.fixture
async def closed_beta(database, admin_url) -> AsyncIterator[tuple[Api, InviteVerifier]]:
    settings = make_settings(database, BETA_LIMITS).model_copy(update={
        "closed_beta": True, "beta_invite_emails": "tester@example.test",
        "beta_starts_at": "2020-01-01T00:00:00+05:30",
        "beta_ends_at": "2099-01-01T00:00:00+05:30",
    })
    verifier = InviteVerifier()
    async for api in _harness(database, admin_url, BETA_LIMITS,
                              settings=settings, verifier=verifier):
        yield api, verifier


async def test_closed_beta_requires_an_invite_and_enforces_daily_cap(closed_beta):
    api, verifier = closed_beta
    h = api.new_user()
    verifier.invite = False
    assert (await api.client.get("/me/usage", headers=h)).status_code == 403
    verifier.invite = True

    r = await api.client.get("/me/usage", headers=h)
    assert r.status_code == 200
    limits = {i["key"]: i["limit"] for i in r.json()["items"]}
    assert [limits[k] for k in ("full_tailor", "analysis", "chat_message")] == [5, 5, 3]
    assert r.json()["resets_at"].endswith("T00:00:00+05:30")

    assert (await api.client.put("/profile", json={"content": profile_in()},
                                 headers=h)).status_code == 200
    ids = []
    for _ in range(2):
        r = await api.client.post("/resumes", json={"template": "jake", "mode": "tailored"},
                                  headers=h)
        rid = r.json()["id"]
        ids.append(rid)
        await api.client.put(f"/resumes/{rid}/jd", json={"text": SAMPLE_JD}, headers=h)

    sql(api, """insert into app.beta_cv_jobs (user_id, resume_id, job_version, completed)
                select %s, gen_random_uuid(), 1, true from generate_series(1, 4)""", uid(h))
    api.provider.push(honest_tailor)
    responses = await asyncio.gather(*[
        api.client.post(f"/resumes/{rid}/tailor", json={}, headers=h) for rid in ids
    ])
    assert sorted(r.status_code for r in responses)[0] == 202
    assert sorted(r.status_code for r in responses)[1] in (409, 429)
    r = await api.client.get("/me/usage", headers=h)
    assert next(i for i in r.json()["items"] if i["key"] == "full_tailor")["used"] == 5
    assert (await api.client.post(f"/resumes/{ids[0]}/tailor",
                                  json={}, headers=h)).status_code == 429
