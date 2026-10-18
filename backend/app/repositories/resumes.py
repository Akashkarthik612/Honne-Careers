"""ResumeRepository: the only SQL for app.resumes. Every statement also pins user_id."""

from typing import Any
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from app.domain.cv import CvContent
from app.domain.records import ResumeMode, ResumeRow, ResumeSummary

# Constant column list interpolated into SQL (S608/B608 suppressed); values are bound params.
_COLUMNS = """id, title, template, mode, jd_id, content, missing_skills, tailor_report,
              wizard_step, status,
              job_started_at, row_version, content_hash, pdf_path, pdf_content_hash,
              page_count, error_code, updated_at"""


def _row(row: dict[str, Any]) -> ResumeRow:
    return ResumeRow(**{**row, "content": CvContent.model_validate(row["content"])})


def _json(content: CvContent) -> Jsonb:
    return Jsonb(content.model_dump(mode="json"))


class ResumeRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def list_summaries(self, user_id: UUID) -> list[ResumeSummary]:
        """Dashboard: summary columns only (no content), one query with the JD join."""
        cur = await self._conn.execute(
            """select r.id, r.title, r.template, r.mode, r.status, r.wizard_step,
                      j.company, j.role, r.updated_at
                 from app.resumes r
                 left join app.job_descriptions j
                   on j.user_id = r.user_id and j.id = r.jd_id
                where r.user_id = %s
                order by r.updated_at desc
                limit 200""",
            (user_id,))
        return [ResumeSummary(**row) for row in await cur.fetchall()]

    async def get(self, user_id: UUID, resume_id: UUID, *, for_update: bool = False
                  ) -> ResumeRow | None:
        lock = " for update" if for_update else ""
        cur = await self._conn.execute(
            f"select {_COLUMNS} from app.resumes where user_id = %s and id = %s{lock}",  # noqa: S608  # nosec B608
            (user_id, resume_id))
        row = await cur.fetchone()
        return _row(row) if row else None

    async def create(self, user_id: UUID, title: str, template: str, mode: ResumeMode,
                     content: CvContent, chash: str, wizard_step: str) -> ResumeRow:
        cur = await self._conn.execute(
            f"""insert into app.resumes
                    (user_id, title, template, mode, content, content_hash, wizard_step)
                values (%s, %s, %s, %s, %s, %s, %s)
                returning {_COLUMNS}""",  # noqa: S608  # nosec B608
            (user_id, title, template, mode, _json(content), chash, wizard_step))
        return _row(await cur.fetchone())

    async def duplicate(self, user_id: UUID, resume_id: UUID, title: str) -> ResumeRow | None:
        """Copies content and JD; not the PDF, analyses or job state."""
        cur = await self._conn.execute(
            f"""insert into app.resumes
                    (user_id, title, template, mode, jd_id, content, missing_skills,
                     wizard_step, content_hash)
                select user_id, %s, template, mode, jd_id, content, missing_skills,
                       wizard_step, content_hash
                  from app.resumes where user_id = %s and id = %s
                returning {_COLUMNS}""",  # noqa: S608  # nosec B608
            (title, user_id, resume_id))
        row = await cur.fetchone()
        return _row(row) if row else None

    async def update_content(self, user_id: UUID, resume_id: UUID, content: CvContent,
                             chash: str, expected_version: int, wizard_step: str | None
                             ) -> int | None:
        """Autosave. Returns the new version, or None if stale or a tailor job is running."""
        cur = await self._conn.execute(
            """update app.resumes
                  set content = %s, content_hash = %s, row_version = row_version + 1,
                      wizard_step = coalesce(%s, wizard_step)
                where user_id = %s and id = %s and row_version = %s
                  and status <> 'tailoring'
            returning row_version""",
            (_json(content), chash, wizard_step, user_id, resume_id, expected_version))
        row = await cur.fetchone()
        return row["row_version"] if row else None

    async def set_jd(self, user_id: UUID, resume_id: UUID, jd_id: UUID) -> bool:
        cur = await self._conn.execute(
            """update app.resumes set jd_id = %s
                where user_id = %s and id = %s and status <> 'tailoring'""",
            (jd_id, user_id, resume_id))
        return cur.rowcount == 1

    async def start_tailoring(self, user_id: UUID, resume_id: UUID, timeout_s: int
                              ) -> int | None:
        """Atomic guard: only one job per resume. A job older than timeout counts as dead.
        Returns the row_version the job started from, or None if a live job exists."""
        cur = await self._conn.execute(
            """update app.resumes
                  set status = 'tailoring', job_started_at = now(), error_code = null
                where user_id = %s and id = %s
                  and (status <> 'tailoring'
                       or job_started_at < now() - make_interval(secs => %s))
            returning row_version""",
            (user_id, resume_id, timeout_s))
        row = await cur.fetchone()
        return row["row_version"] if row else None

    async def finish_tailoring(self, user_id: UUID, resume_id: UUID, content: CvContent,
                               chash: str, missing_skills: list[str],
                               report: dict[str, object], started_version: int
                               ) -> int | None:
        cur = await self._conn.execute(
            """update app.resumes
                  set content = %s, content_hash = %s, missing_skills = %s, tailor_report = %s,
                      status = 'ready', job_started_at = null, error_code = null,
                      row_version = row_version + 1
                where user_id = %s and id = %s and status = 'tailoring'
                  and row_version = %s
            returning row_version""",
            (_json(content), chash, Jsonb(missing_skills), Jsonb(report), user_id, resume_id,
             started_version))
        row = await cur.fetchone()
        return row["row_version"] if row else None

    async def fail_tailoring(self, user_id: UUID, resume_id: UUID, error_code: str) -> bool:
        cur = await self._conn.execute(
            """update app.resumes
                  set status = 'failed', job_started_at = null, error_code = %s
                where user_id = %s and id = %s and status = 'tailoring'""",
            (error_code, user_id, resume_id))
        return cur.rowcount == 1

    async def mark_stale(self, user_id: UUID, resume_id: UUID, timeout_s: int) -> bool:
        """B9: a job past its timeout (Render sleep/restart) becomes failed/stale_job."""
        cur = await self._conn.execute(
            """update app.resumes
                  set status = 'failed', job_started_at = null, error_code = 'stale_job'
                where user_id = %s and id = %s and status = 'tailoring'
                  and job_started_at < now() - make_interval(secs => %s)""",
            (user_id, resume_id, timeout_s))
        return cur.rowcount == 1

    async def set_pdf(self, user_id: UUID, resume_id: UUID, pdf_path: str, pdf_hash: str,
                      page_count: int) -> bool:
        cur = await self._conn.execute(
            """update app.resumes
                  set pdf_path = %s, pdf_content_hash = %s, page_count = %s
                where user_id = %s and id = %s and content_hash = %s""",
            (pdf_path, pdf_hash, page_count, user_id, resume_id, pdf_hash))
        return cur.rowcount == 1

    async def delete(self, user_id: UUID, resume_id: UUID) -> bool:
        cur = await self._conn.execute(
            "delete from app.resumes where user_id = %s and id = %s", (user_id, resume_id))
        return cur.rowcount == 1
