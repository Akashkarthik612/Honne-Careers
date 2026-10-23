"""ApplicationRepository: the only SQL for app.applications, application_events and
storage_trash. Every statement pins user_id; every user-facing read also takes the retention
cut-off, so rows past it are hidden at once (Day 2 §4, layer 1).

Two read shapes: summaries never select notes, JD or CV text (large values stay out-of-line
in TOAST and are only read when one row is opened).
"""

from datetime import date, datetime
from typing import Any
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from app.domain.applications import ApplicationFilter
from app.domain.cv import CvContent
from app.domain.records import ApplicationDetail, ApplicationRow, ApplicationSummary, StatusEvent

# Constant column lists interpolated into SQL (S608/B608 suppressed); values are bound params.
_SUMMARY = """a.id, a.source, a.company, a.role, a.applied_on, a.status, a.referral,
              a.jd_id is not null as has_jd, a.pdf_path is not null as has_pdf,
              coalesce(a.notes, '') <> '' as has_notes, a.last_sent_at, a.row_version"""
_ROW = "id, jd_id, status, cv_content_hash, pdf_path, last_sent_at, row_version"
# PATCH may set only these (mass-assignment allowlist; names are constants, never client keys).
EDITABLE = ("status", "referral", "notes", "company", "role", "applied_on")


def _like(query: str) -> str:
    escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


class ApplicationRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    # ---------- reads ----------

    async def list_summaries(self, user_id: UUID, cutoff: datetime, flt: ApplicationFilter,
                             limit: int) -> list[ApplicationSummary]:
        """Newest first. Uses (user_id, last_sent_at desc); O(rows in the window)."""
        where = ["a.user_id = %s", "a.last_sent_at >= %s"]
        params: list[Any] = [user_id, cutoff]
        if flt.statuses:
            where.append("a.status = any(%s)")
            params.append(sorted(flt.statuses))
        if flt.query:
            where.append("(a.company ilike %s or a.role ilike %s)")
            params += [_like(flt.query)] * 2
        if flt.referral == "none":
            where.append("a.referral is null")
        elif flt.referral:
            where.append("a.referral = %s")
            params.append(flt.referral)
        if flt.sent_after:
            where.append("a.applied_on >= %s")
            params.append(flt.sent_after)
        if flt.sent_before:
            where.append("a.applied_on <= %s")
            params.append(flt.sent_before)
        params.append(limit)
        cur = await self._conn.execute(
            f"""select {_SUMMARY} from app.applications a
                 where {' and '.join(where)}
                 order by a.last_sent_at desc
                 limit %s""",  # noqa: S608  # nosec B608
            params)
        return [ApplicationSummary(**row) for row in await cur.fetchall()]

    async def get_detail(self, user_id: UUID, app_id: UUID, cutoff: datetime
                         ) -> ApplicationDetail | None:
        cur = await self._conn.execute(
            f"""select {_SUMMARY}, a.notes, a.cv_content, a.page_count, a.resume_id,
                       j.text as jd_text
                  from app.applications a
                  left join app.job_descriptions j on j.user_id = a.user_id and j.id = a.jd_id
                 where a.user_id = %s and a.id = %s and a.last_sent_at >= %s""",  # noqa: S608  # nosec B608
            (user_id, app_id, cutoff))
        row = await cur.fetchone()
        if row is None:
            return None
        events = await self._conn.execute(
            """select from_status, to_status, created_at as at from app.application_events
                where user_id = %s and application_id = %s order by created_at""",
            (user_id, app_id))
        extra = {k: row.pop(k) for k in ("notes", "cv_content", "page_count", "resume_id",
                                         "jd_text")}
        cv = extra["cv_content"]
        return ApplicationDetail(
            summary=ApplicationSummary(**row), jd_text=extra["jd_text"],
            cv_content=CvContent.model_validate(cv) if cv is not None else None,
            notes=extra["notes"], page_count=extra["page_count"],
            resume_id=extra["resume_id"],
            events=[StatusEvent(**e) for e in await events.fetchall()])

    async def get_row(self, user_id: UUID, app_id: UUID, cutoff: datetime, *,
                      for_update: bool = False) -> ApplicationRow | None:
        lock = " for update" if for_update else ""
        cur = await self._conn.execute(
            f"""select {_ROW} from app.applications
                 where user_id = %s and id = %s and last_sent_at >= %s{lock}""",  # noqa: S608  # nosec B608
            (user_id, app_id, cutoff))
        row = await cur.fetchone()
        return ApplicationRow(**row) if row else None

    async def get_row_by_jd(self, user_id: UUID, jd_id: UUID, *, for_update: bool = False
                            ) -> ApplicationRow | None:
        """No cut-off: the recorder must also see an expired row it is about to replace."""
        lock = " for update" if for_update else ""
        cur = await self._conn.execute(
            f"select {_ROW} from app.applications where user_id = %s and jd_id = %s{lock}",  # noqa: S608  # nosec B608
            (user_id, jd_id))
        row = await cur.fetchone()
        return ApplicationRow(**row) if row else None

    # ---------- writes ----------

    async def insert_download(self, user_id: UUID, app_id: UUID, jd_id: UUID, resume_id: UUID,
                              company: str | None, role: str | None, cv: CvContent,
                              cv_hash: str, pdf_path: str, page_count: int | None) -> bool:
        """SAVE-1. False = a row for this JD appeared meanwhile (one JD = one row)."""
        cur = await self._conn.execute(
            """insert into app.applications
                   (id, user_id, jd_id, resume_id, source, company, role, cv_content,
                    cv_content_hash, pdf_path, page_count)
               values (%s, %s, %s, %s, 'honne', %s, %s, %s, %s, %s, %s)
               on conflict (user_id, jd_id) do nothing""",
            (app_id, user_id, jd_id, resume_id, company, role,
             Jsonb(cv.model_dump(mode="json")), cv_hash, pdf_path, page_count))
        return cur.rowcount == 1

    async def replace_download(self, user_id: UUID, app_id: UUID, resume_id: UUID,
                               cv: CvContent, cv_hash: str, pdf_path: str,
                               page_count: int | None) -> int:
        """Re-download for the same JD: latest CV + PDF, clock restarts. Status, referral,
        notes, company and role stay. Bumps row_version so an open side panel reloads."""
        cur = await self._conn.execute(
            """update app.applications
                  set resume_id = %s, cv_content = %s, cv_content_hash = %s, pdf_path = %s,
                      page_count = %s, last_sent_at = now(), applied_on = current_date,
                      row_version = row_version + 1
                where user_id = %s and id = %s
            returning row_version""",
            (resume_id, Jsonb(cv.model_dump(mode="json")), cv_hash, pdf_path, page_count,
             user_id, app_id))
        return (await cur.fetchone())["row_version"]

    async def insert_manual(self, user_id: UUID, jd_id: UUID | None, company: str, role: str,
                            applied_on: date, status: str, referral: str | None,
                            notes: str | None) -> UUID | None:
        """IQ-3. None = this JD already has a row."""
        cur = await self._conn.execute(
            """insert into app.applications
                   (user_id, jd_id, source, company, role, applied_on, status, referral, notes)
               values (%s, %s, 'manual', %s, %s, %s, %s, %s, %s)
               on conflict (user_id, jd_id) do nothing
               returning id""",
            (user_id, jd_id, company, role, applied_on, status, referral, notes))
        row = await cur.fetchone()
        return row["id"] if row else None

    async def update_fields(self, user_id: UUID, app_id: UUID, expected_version: int,
                            fields: dict[str, Any]) -> int | None:
        """PATCH. None = stale version (another tab saved first)."""
        unknown = fields.keys() - set(EDITABLE)
        if unknown:
            raise ValueError(f"not editable: {sorted(unknown)}")
        sets = ", ".join(f"{name} = %s" for name in fields)
        cur = await self._conn.execute(
            f"""update app.applications set {sets}, row_version = row_version + 1
                 where user_id = %s and id = %s and row_version = %s
             returning row_version""",  # noqa: S608  # nosec B608
            (*fields.values(), user_id, app_id, expected_version))
        row = await cur.fetchone()
        return row["row_version"] if row else None

    async def add_event(self, user_id: UUID, app_id: UUID, from_status: str | None,
                        to_status: str) -> None:
        await self._conn.execute(
            """insert into app.application_events (user_id, application_id, from_status,
                                                   to_status)
               values (%s, %s, %s, %s)""",
            (user_id, app_id, from_status, to_status))

    async def delete(self, user_id: UUID, app_id: UUID) -> tuple[bool, UUID | None]:
        """Events cascade. Returns (deleted, the row's JD id)."""
        cur = await self._conn.execute(
            "delete from app.applications where user_id = %s and id = %s returning jd_id",
            (user_id, app_id))
        row = await cur.fetchone()
        return (True, row["jd_id"]) if row else (False, None)

    async def delete_unused_jd(self, user_id: UUID, jd_id: UUID) -> bool:
        """Removes the JD text once no application and no resume uses it."""
        cur = await self._conn.execute(
            """delete from app.job_descriptions j
                where j.user_id = %s and j.id = %s
                  and not exists (select 1 from app.applications a
                                   where a.user_id = j.user_id and a.jd_id = j.id)
                  and not exists (select 1 from app.resumes r
                                   where r.user_id = j.user_id and r.jd_id = j.id)""",
            (user_id, jd_id))
        return cur.rowcount == 1

    # ---------- storage trash (PDFs whose delete failed; the daily clean-up retries) ----------

    async def trash(self, user_id: UUID, path: str) -> UUID:
        cur = await self._conn.execute(
            "insert into app.storage_trash (user_id, path) values (%s, %s) returning id",
            (user_id, path))
        return (await cur.fetchone())["id"]

    async def untrash(self, user_id: UUID, trash_id: UUID) -> None:
        await self._conn.execute(
            "delete from app.storage_trash where user_id = %s and id = %s", (user_id, trash_id))
