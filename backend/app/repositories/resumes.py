"""ResumeRepository: the only SQL for app.resumes. Every statement also pins user_id."""

from typing import Any
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from app.domain.cv import CvContent
from app.domain.layout import SectionKey, SectionOrder, checked_order
from app.domain.records import JobStep, ResumeMode, ResumeRow, ResumeSummary

# Constant column list interpolated into SQL (S608/B608 suppressed); values are bound params.
_COLUMNS = """id, title, template, mode, jd_id, content, missing_skills, jd_gaps, tailor_report,
              wizard_step, status, job_step,
              job_started_at, row_version, content_hash, pdf_path, pdf_render_key,
              page_count, error_code, updated_at, section_order"""


def _order(stored: list[str] | None) -> SectionOrder | None:
    """text[] -> SectionOrder. The API validated it on write; a bad stored value raises."""
    return checked_order(tuple(SectionKey(k) for k in stored)) if stored else None


def _db_order(order: SectionOrder | None) -> list[str] | None:
    return [k.value for k in order] if order else None  # values, never enum names


def _row(row: dict[str, Any]) -> ResumeRow:
    return ResumeRow(**{**row, "content": CvContent.model_validate(row["content"]),
                        "section_order": _order(row["section_order"])})


def _summary(row: dict[str, Any]) -> ResumeSummary:
    return ResumeSummary(**{**row, "content": CvContent.model_validate(row["content"]),
                            "section_order": _order(row["section_order"])})


def _json(content: CvContent) -> Jsonb:
    return Jsonb(content.model_dump(mode="json"))


class ResumeRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def list_summaries(self, user_id: UUID) -> list[ResumeSummary]:
        """Dashboard: summary columns + content (thumbnails), one query with the JD join.
        Space O(resumes x content), capped at 200 rows x 256 KB by the table checks."""
        cur = await self._conn.execute(
            """select r.id, r.title, r.template, r.mode, r.status, r.wizard_step,
                      j.company, j.role, r.updated_at, r.content, r.section_order
                 from app.resumes r
                 left join app.job_descriptions j
                   on j.user_id = r.user_id and j.id = r.jd_id
                where r.user_id = %s
                order by r.updated_at desc
                limit 200""",
            (user_id,))
        return [_summary(row) for row in await cur.fetchall()]

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
                     jd_gaps, wizard_step, content_hash, section_order)
                select user_id, %s, template, mode, jd_id, content, missing_skills,
                       jd_gaps, wizard_step, content_hash, section_order
                  from app.resumes where user_id = %s and id = %s
                returning {_COLUMNS}""",  # noqa: S608  # nosec B608
            (title, user_id, resume_id))
        row = await cur.fetchone()
        return _row(row) if row else None

    async def update_content(self, user_id: UUID, resume_id: UUID, content: CvContent,
                             chash: str, expected_version: int, wizard_step: str | None,
                             missing_skills: list[str] | None = None) -> int | None:
        """Autosave. Returns the new version, or None if stale or a tailor job is running.
        missing_skills None = leave the JD-skill suggestions as they are."""
        cur = await self._conn.execute(
            """update app.resumes
                  set content = %s, content_hash = %s, row_version = row_version + 1,
                      wizard_step = coalesce(%s, wizard_step),
                      missing_skills = coalesce(%s, missing_skills)
                where user_id = %s and id = %s and row_version = %s
                  and status <> 'tailoring'
            returning row_version""",
            (_json(content), chash, wizard_step,
             Jsonb(missing_skills) if missing_skills is not None else None,
             user_id, resume_id, expected_version))
        row = await cur.fetchone()
        return row["row_version"] if row else None

    async def update_skills(self, user_id: UUID, resume_id: UUID, content: CvContent,
                            chash: str, missing_skills: list[str], expected_version: int
                            ) -> int | None:
        """Confirm a JD skill: content + suggestions in one write. None =
        stale or a tailor job is running."""
        cur = await self._conn.execute(
            """update app.resumes
                  set content = %s, content_hash = %s, missing_skills = %s,
                      row_version = row_version + 1
                where user_id = %s and id = %s and row_version = %s
                  and status <> 'tailoring'
            returning row_version""",
            (_json(content), chash, Jsonb(missing_skills), user_id, resume_id,
             expected_version))
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
                  set status = 'tailoring', job_step = 'reading', job_started_at = now(),
                      error_code = null
                where user_id = %s and id = %s
                  and (status <> 'tailoring'
                       or job_started_at < now() - make_interval(secs => %s))
            returning row_version""",
            (user_id, resume_id, timeout_s))
        row = await cur.fetchone()
        return row["row_version"] if row else None

    async def finish_tailoring(self, user_id: UUID, resume_id: UUID, content: CvContent,
                               chash: str, missing_skills: list[str],
                               gaps: list[dict[str, str]], report: dict[str, object],
                               started_version: int) -> int | None:
        cur = await self._conn.execute(
            """update app.resumes
                  set content = %s, content_hash = %s, missing_skills = %s, jd_gaps = %s,
                      tailor_report = %s,
                      status = 'ready', job_step = null, job_started_at = null,
                      error_code = null,
                      row_version = row_version + 1
                where user_id = %s and id = %s and status = 'tailoring'
                  and row_version = %s
            returning row_version""",
            (_json(content), chash, Jsonb(missing_skills), Jsonb(gaps), Jsonb(report),
             user_id, resume_id, started_version))
        row = await cur.fetchone()
        return row["row_version"] if row else None

    async def fail_tailoring(self, user_id: UUID, resume_id: UUID, error_code: str) -> bool:
        cur = await self._conn.execute(
            """update app.resumes
                  set status = 'failed', job_step = null, job_started_at = null,
                      error_code = %s
                where user_id = %s and id = %s and status = 'tailoring'""",
            (error_code, user_id, resume_id))
        return cur.rowcount == 1

    async def set_job_step(self, user_id: UUID, resume_id: UUID, step: JobStep) -> bool:
        """TAIL-3 progress. Only while the job is live; False = job gone (failed/deleted)."""
        cur = await self._conn.execute(
            """update app.resumes set job_step = %s
                where user_id = %s and id = %s and status = 'tailoring'""",
            (step, user_id, resume_id))
        return cur.rowcount == 1

    async def mark_stale(self, user_id: UUID, resume_id: UUID, timeout_s: int) -> bool:
        """B9: a job past its timeout (Render sleep/restart) becomes failed/stale_job."""
        cur = await self._conn.execute(
            """update app.resumes
                  set status = 'failed', job_step = null, job_started_at = null,
                      error_code = 'stale_job'
                where user_id = %s and id = %s and status = 'tailoring'
                  and job_started_at < now() - make_interval(secs => %s)""",
            (user_id, resume_id, timeout_s))
        return cur.rowcount == 1

    async def set_pdf(self, user_id: UUID, resume_id: UUID, pdf_path: str, key: str,
                      page_count: int, built_from: ResumeRow) -> bool:
        """Records the PDF only if content, template and order are still what it was built
        from. False = edited or re-laid-out while compiling (the PDF is not current)."""
        order = _db_order(built_from.section_order)
        cur = await self._conn.execute(
            """update app.resumes
                  set pdf_path = %s, pdf_render_key = %s, page_count = %s
                where user_id = %s and id = %s and content_hash = %s and template = %s
                  and section_order is not distinct from %s::text[]""",
            (pdf_path, key, page_count, user_id, resume_id, built_from.content_hash,
             built_from.template, order))
        return cur.rowcount == 1

    async def set_layout(self, user_id: UUID, resume_id: UUID, template: str,
                         section_order: SectionOrder | None, expected_version: int
                         ) -> int | None:
        """Template + section order (PDF-1). Content is untouched, so content_hash stays.
        None = stale version or a tailor job is running."""
        cur = await self._conn.execute(
            """update app.resumes
                  set template = %s, section_order = %s::text[], row_version = row_version + 1
                where user_id = %s and id = %s and row_version = %s
                  and status <> 'tailoring'
            returning row_version""",
            (template, _db_order(section_order), user_id, resume_id,
             expected_version))
        row = await cur.fetchone()
        return row["row_version"] if row else None

    async def delete(self, user_id: UUID, resume_id: UUID) -> bool:
        cur = await self._conn.execute(
            "delete from app.resumes where user_id = %s and id = %s", (user_id, resume_id))
        return cur.rowcount == 1
