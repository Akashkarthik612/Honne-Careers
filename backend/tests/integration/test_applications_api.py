"""Day 2: the application Database. Save on download (SAVE-1/3), the screens' endpoints
(IQ-1/2/3), retention (hidden at once, deleted by the daily clean-up) and isolation."""

from datetime import UTC, date, datetime, timedelta
from uuid import UUID

import psycopg
import pytest

from app.domain.applications import ApplicationFilter
from app.domain.auth import AuthUser
from tests.fixtures import SAMPLE_JD
from tests.integration.test_tailoring_api import returning_user

pytestmark = pytest.mark.db


def uid(h):
    return h["Authorization"].removeprefix("Bearer user:")


async def download(api, h, rid):
    """What the UI does on Download PDF: build, then record."""
    assert (await api.client.post(f"/resumes/{rid}/pdf", headers=h)).status_code == 200
    r = await api.client.post(f"/resumes/{rid}/application", headers=h)
    assert r.status_code == 200, r.text
    return r.json()


async def edit_name(api, h, rid, name):
    res = (await api.client.get(f"/resumes/{rid}", headers=h)).json()
    r = await api.client.patch(f"/resumes/{rid}", headers=h, json={
        "expected_version": res["row_version"],
        "change": {"section": "personal", "value": {"name": name}}})
    assert r.status_code == 200, r.text


def sql(api, query, params=()):
    with psycopg.connect(api.admin_url, autocommit=True) as conn:
        cur = conn.execute(query, params)
        return cur.fetchall() if cur.description else cur.rowcount


def past_window(api, extra=1) -> int:
    """Days old enough to be past the retention window (APPLICATION_RETENTION_DAYS)."""
    return api.container.applications.window.days + extra


def backdate(api, app_id, days):
    sql(api, "update app.applications set last_sent_at = now() - make_interval(days => %s)"
             " where id = %s", (days, app_id))


def app_pdfs(api, h):
    return sorted(p for p in api.files.objects if p.startswith(f"{uid(h)}/applications/"))


def deletes_on(api) -> str:
    return (date.today() + timedelta(days=api.container.applications.window.days)).isoformat()


# ---------- save on download ----------

async def test_download_saves_one_row_with_jd_cv_and_pdf(api):
    h, rid = await returning_user(api)
    saved = await download(api, h, rid)
    assert saved["saved"] is True
    assert saved["deletes_on"] == deletes_on(api)
    aid = saved["application_id"]

    listing = (await api.client.get("/applications", headers=h)).json()
    assert listing["retention_days"] == api.container.applications.window.days == 40
    [row] = listing["items"]
    assert row["id"] == aid and row["status"] == "applied" and row["source"] == "honne"
    assert (row["has_jd"], row["has_pdf"], row["referral"]) == (True, True, None)
    assert "jd_text" not in row and "cv_content" not in row and "notes" not in row

    detail = (await api.client.get(f"/applications/{aid}", headers=h)).json()
    assert detail["jd_text"] == SAMPLE_JD.strip()
    assert detail["cv_content"]["header"]["name"]
    assert detail["resume_id"] == rid
    assert [(e["from"], e["to"]) for e in detail["events"]] == [(None, "applied")]

    [pdf] = app_pdfs(api, h)
    assert pdf.startswith(f"{uid(h)}/applications/{aid}/")
    url = (await api.client.get(f"/applications/{aid}/pdf", headers=h)).json()["url"]
    assert pdf in url


async def test_same_cv_again_keeps_one_row_and_restarts_the_clock(api):
    h, rid = await returning_user(api)
    first = await download(api, h, rid)
    backdate(api, first["application_id"], 5)
    again = await download(api, h, rid)
    assert again["application_id"] == first["application_id"]
    [row] = (await api.client.get("/applications", headers=h)).json()["items"]
    assert row["deletes_on"] == deletes_on(api)
    assert len(app_pdfs(api, h)) == 1  # no second copy for the same CV


async def test_changed_cv_replaces_cv_and_pdf_and_keeps_status_referral_notes(api):
    h, rid = await returning_user(api)
    aid = (await download(api, h, rid))["application_id"]
    v = (await api.client.get(f"/applications/{aid}", headers=h)).json()["row_version"]
    r = await api.client.patch(f"/applications/{aid}", headers=h, json={
        "expected_version": v, "status": "interview", "referral": "asked",
        "notes": "Spoke to Priya"})
    assert r.status_code == 200, r.text
    old_pdf = app_pdfs(api, h)

    await edit_name(api, h, rid, "Arjun M.")
    assert (await download(api, h, rid))["application_id"] == aid

    detail = (await api.client.get(f"/applications/{aid}", headers=h)).json()
    assert detail["cv_content"]["header"]["name"] == "Arjun M."
    assert (detail["status"], detail["referral"], detail["notes"]) == (
        "interview", "asked", "Spoke to Priya")
    assert detail["row_version"] > r.json()["row_version"]  # an open side panel must reload
    new_pdf = app_pdfs(api, h)
    assert len(new_pdf) == 1 and new_pdf != old_pdf  # the old copy was deleted at once
    assert sql(api, "select count(*) from app.storage_trash where user_id = %s",
               (uid(h),))[0][0] == 0


async def test_old_pdf_delete_failure_still_saves_and_cleanup_removes_it(api):
    h, rid = await returning_user(api)
    await download(api, h, rid)
    await edit_name(api, h, rid, "Arjun M.")
    api.files.fail_deletes = True
    assert (await download(api, h, rid))["saved"] is True
    assert len(app_pdfs(api, h)) == 2
    [(path,)] = sql(api, "select path from app.storage_trash where user_id = %s", (uid(h),))

    result = await api.container.janitor.run_once()
    assert result.trash_cleared >= 1
    assert path not in api.files.objects and len(app_pdfs(api, h)) == 1


async def test_scratch_cv_without_jd_saves_nothing(api):
    h = api.new_user()
    await api.client.put("/profile", headers=h, json={"content": {"header": {"name": "A"}}})
    rid = (await api.client.post("/resumes", headers=h,
                                 json={"template": "jake", "mode": "scratch"})).json()["id"]
    r = await download(api, h, rid)
    assert (r["saved"], r["reason"]) == (False, "no_jd")
    assert (await api.client.get("/applications", headers=h)).json()["items"] == []


async def test_cv_edited_after_build_is_refused(api):
    h, rid = await returning_user(api)
    await api.client.post(f"/resumes/{rid}/pdf", headers=h)
    await edit_name(api, h, rid, "Changed")
    r = await api.client.post(f"/resumes/{rid}/application", headers=h)
    assert r.status_code == 409 and r.json()["error"]["code"] == "pdf_outdated"


async def test_deleting_the_resume_card_keeps_the_application_and_its_pdf(api):
    h, rid = await returning_user(api)
    aid = (await download(api, h, rid))["application_id"]
    assert (await api.client.delete(f"/resumes/{rid}", headers=h)).status_code == 204
    detail = (await api.client.get(f"/applications/{aid}", headers=h)).json()
    assert detail["resume_id"] is None and detail["jd_text"]
    assert len(app_pdfs(api, h)) == 1
    assert (await api.client.get(f"/applications/{aid}/pdf", headers=h)).status_code == 200


# ---------- the Database screens ----------

async def test_status_change_is_logged_and_two_tabs_cannot_overwrite(api):
    h, rid = await returning_user(api)
    aid = (await download(api, h, rid))["application_id"]
    v = (await api.client.get(f"/applications/{aid}", headers=h)).json()["row_version"]
    first = await api.client.patch(f"/applications/{aid}", headers=h,
                                   json={"expected_version": v, "status": "rejected"})
    assert first.status_code == 200
    second = await api.client.patch(f"/applications/{aid}", headers=h,
                                    json={"expected_version": v, "notes": "stale tab"})
    assert second.status_code == 409 and second.json()["error"]["code"] == "stale_version"
    events = first.json()["events"]
    assert [(e["from"], e["to"]) for e in events] == [(None, "applied"), ("applied", "rejected")]

    same = await api.client.patch(f"/applications/{aid}", headers=h, json={
        "expected_version": first.json()["row_version"], "status": "rejected"})
    assert len(same.json()["events"]) == 2  # no event when the status didn't change


@pytest.mark.parametrize("body", [{"company": None}, {"status": "referral_asked"},
                                  {"origin": "user"}, {"notes": "x" * 5001}])
async def test_patch_rejects_bad_fields(api, body):
    h, rid = await returning_user(api)
    aid = (await download(api, h, rid))["application_id"]
    r = await api.client.patch(f"/applications/{aid}", headers=h,
                               json={"expected_version": 1, **body})
    assert r.status_code == 422


async def test_add_by_hand_with_and_without_jd(api):
    h = api.new_user()
    plain = await api.client.post("/applications", headers=h, json={
        "company": "Dust", "role": "Backend Engineer", "applied_on": "2026-10-10",
        "status": "no_reply", "referral": "yes"})
    assert plain.status_code == 201, plain.text
    p = plain.json()
    assert (p["source"], p["has_jd"], p["has_pdf"], p["applied_on"]) == (
        "manual", False, False, "2026-10-10")
    assert [(e["from"], e["to"]) for e in p["events"]] == [(None, "no_reply")]
    assert (await api.client.get(f"/applications/{p['id']}/pdf", headers=h)).status_code == 404

    with_jd = await api.client.post("/applications", headers=h, json={
        "company": "Zoho", "role": "MTS", "jd_text": SAMPLE_JD})
    assert with_jd.status_code == 201 and with_jd.json()["jd_text"] == SAMPLE_JD.strip()
    dup = await api.client.post("/applications", headers=h, json={
        "company": "Zoho", "role": "MTS", "jd_text": SAMPLE_JD})
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "application_exists"

    future = await api.client.post("/applications", headers=h, json={
        "company": "X", "role": "Y", "applied_on": (date.today() + timedelta(days=3)).isoformat()})
    assert future.status_code == 422


async def test_list_filters_by_status_and_search(api):
    h = api.new_user()
    for company, role, status in [("Razorpay", "Backend Engineer", "interview"),
                                  ("Freshworks", "SDE-2", "applied"),
                                  ("Zoho", "100%_Remote dev", "offer")]:
        await api.client.post("/applications", headers=h,
                              json={"company": company, "role": role, "status": status})

    def names(r):
        return sorted(i["company"] for i in r.json()["items"])

    assert names(await api.client.get("/applications?status=interview,offer", headers=h)) == [
        "Razorpay", "Zoho"]
    assert names(await api.client.get("/applications?q=backend", headers=h)) == ["Razorpay"]
    assert names(await api.client.get("/applications?q=100%25_", headers=h)) == ["Zoho"]
    assert (await api.client.get("/applications?status=bogus", headers=h)).status_code == 422


async def test_agent_filters_run_in_sql_before_the_row_cap(api):
    """Referral and sent-date filters (used by the agents' list_applications tool) are SQL
    filters, so a match older than the newest `limit` rows is still found."""
    h = api.new_user()
    today = date.today()
    for company, referral, days_ago in [("Old", None, 9), ("Mid", "yes", 5), ("New", None, 1)]:
        await api.client.post("/applications", headers=h, json={
            "company": company, "role": "SDE", "referral": referral,
            "applied_on": (today - timedelta(days=days_ago)).isoformat()})
    user = AuthUser(id=UUID(uid(h)), email=None, provider=None, access_token=h["Authorization"])
    repo_limit = 1
    async with api.container.uow(user.id) as uow:
        def names(flt):
            return uow.applications.list_summaries(
                user.id, datetime.now(UTC) - timedelta(days=past_window(api, 0)), flt, repo_limit)
        old = await names(ApplicationFilter(referral="none",
                                            sent_before=today - timedelta(days=7)))
        mid = await names(ApplicationFilter(referral="yes"))
        none = await names(ApplicationFilter(sent_after=today, sent_before=today))
    assert [s.company for s in old] == ["Old"]
    assert [s.company for s in mid] == ["Mid"]
    assert none == []


async def test_delete_removes_row_history_pdf_and_unused_jd(api):
    h, rid = await returning_user(api)
    aid = (await download(api, h, rid))["application_id"]
    [(jd_id,)] = sql(api, "select jd_id from app.applications where id = %s", (aid,))
    assert (await api.client.delete(f"/applications/{aid}", headers=h)).status_code == 204
    assert app_pdfs(api, h) == []
    assert sql(api, "select count(*) from app.application_events where application_id = %s",
               (aid,))[0][0] == 0
    # The resume still uses the JD, so it stays.
    assert sql(api, "select count(*) from app.job_descriptions where id = %s", (jd_id,))[0][0] == 1
    assert (await api.client.get(f"/applications/{aid}", headers=h)).status_code == 404

    manual = (await api.client.post("/applications", headers=h, json={
        "company": "Zoho", "role": "MTS", "jd_text": "Build things in Java " * 3})).json()
    [(m_jd,)] = sql(api, "select jd_id from app.applications where id = %s", (manual["id"],))
    await api.client.delete(f"/applications/{manual['id']}", headers=h)
    assert sql(api, "select count(*) from app.job_descriptions where id = %s", (m_jd,))[0][0] == 0


async def test_another_user_gets_404_everywhere(api):
    h, rid = await returning_user(api)
    aid = (await download(api, h, rid))["application_id"]
    other = api.new_user()
    assert (await api.client.get("/applications", headers=other)).json()["items"] == []
    for method, path, body in [("GET", f"/applications/{aid}", None),
                               ("GET", f"/applications/{aid}/pdf", None),
                               ("PATCH", f"/applications/{aid}",
                                {"expected_version": 1, "status": "offer"}),
                               ("DELETE", f"/applications/{aid}", None),
                               ("POST", f"/resumes/{rid}/application", None)]:
        r = await api.client.request(method, path, headers=other, json=body)
        assert r.status_code == 404, (method, path, r.status_code)
    assert len(app_pdfs(api, h)) == 1


# ---------- retention ----------

async def test_rows_past_the_cutoff_are_hidden_at_once(api):
    h, rid = await returning_user(api)
    aid = (await download(api, h, rid))["application_id"]
    backdate(api, aid, past_window(api))
    assert (await api.client.get("/applications", headers=h)).json()["items"] == []
    assert (await api.client.get(f"/applications/{aid}", headers=h)).status_code == 404
    r = await api.client.patch(f"/applications/{aid}", headers=h,
                               json={"expected_version": 1, "status": "offer"})
    assert r.status_code == 404


async def test_redownload_after_expiry_starts_a_fresh_row(api):
    h, rid = await returning_user(api)
    old = (await download(api, h, rid))["application_id"]
    await api.client.patch(f"/applications/{old}", headers=h,
                           json={"expected_version": 1, "notes": "old notes"})
    backdate(api, old, past_window(api))
    new = (await download(api, h, rid))["application_id"]
    assert new != old
    detail = (await api.client.get(f"/applications/{new}", headers=h)).json()
    assert detail["notes"] is None and detail["status"] == "applied"


async def test_cleanup_deletes_expired_rows_files_and_jds_but_not_fresh_ones(api):
    h, rid = await returning_user(api)
    expired = (await download(api, h, rid))["application_id"]
    manual = (await api.client.post("/applications", headers=h, json={
        "company": "Zoho", "role": "MTS", "jd_text": "Old JD text for an old job"})).json()
    fresh = (await api.client.post("/applications", headers=h, json={
        "company": "Dust", "role": "SWE"})).json()
    backdate(api, expired, past_window(api, 5))
    backdate(api, manual["id"], past_window(api, 5))
    [(m_jd,)] = sql(api, "select jd_id from app.applications where id = %s", (manual["id"],))
    [(r_jd,)] = sql(api, "select jd_id from app.applications where id = %s", (expired,))

    result = await api.container.janitor.run_once()
    assert result.rows_deleted >= 2 and not result.failed_batches
    left = {r[0] for r in sql(api, "select id::text from app.applications where user_id = %s",
                              (uid(h),))}
    assert left == {fresh["id"]}
    assert app_pdfs(api, h) == []
    assert sql(api, "select count(*) from app.application_events where application_id = %s",
               (expired,))[0][0] == 0
    assert sql(api, "select count(*) from app.job_descriptions where id = %s", (m_jd,))[0][0] == 0
    # The resume still points at its JD, so that one stays.
    assert sql(api, "select count(*) from app.job_descriptions where id = %s", (r_jd,))[0][0] == 1


async def test_cleanup_keeps_rows_when_files_cannot_be_deleted(api):
    h, rid = await returning_user(api)
    aid = (await download(api, h, rid))["application_id"]
    backdate(api, aid, past_window(api, 5))
    api.storage_admin.fail = True
    result = await api.container.janitor.run_once()
    assert result.failed_batches == [0]
    assert sql(api, "select count(*) from app.applications where id = %s", (aid,))[0][0] == 1
    assert len(app_pdfs(api, h)) == 1  # no row deleted before its file: no orphan
    api.storage_admin.fail = False
    await api.container.janitor.run_once()
    assert sql(api, "select count(*) from app.applications where id = %s", (aid,))[0][0] == 0
    assert app_pdfs(api, h) == []


async def test_cleanup_runs_once_per_day(api):
    sql(api, "delete from app.maintenance_runs")
    janitor = api.container.janitor
    assert await janitor.run_if_due() is not None
    assert await janitor.run_if_due() is None
    sql(api, "update app.maintenance_runs set last_run_at = now() - interval '25 hours'")
    assert await janitor.run_if_due() is not None


async def test_account_delete_removes_application_pdfs(api):
    h, rid = await returning_user(api)
    await download(api, h, rid)
    assert app_pdfs(api, h)
    assert (await api.client.delete("/me", headers=h)).status_code == 204
    assert app_pdfs(api, h) == []
    assert sql(api, "select count(*) from app.applications where user_id = %s",
               (uid(h),))[0][0] == 0
