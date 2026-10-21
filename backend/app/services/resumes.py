"""ResumeService: dashboard, open, autosave, duplicate, delete, set JD (B6, B8)."""

import re
from datetime import UTC, datetime
from uuid import UUID

from app.core.errors import InvalidInput, JobAlreadyRunning, NotFound, StaleVersion
from app.core.hashing import content_hash, text_hash
from app.core.logging import get_logger
from app.db.unit_of_work import UnitOfWorkFactory
from app.domain.auth import AuthUser
from app.domain.cv import CvContent, Origin, ResumePatch
from app.domain.records import JdRow, ResumeMode, ResumeRow, ResumeSummary
from app.render.templates import TemplateRegistry
from app.truth.copying import as_origin
from app.truth.stamper import EditStamper

log = get_logger(__name__)

JD_MAX_WORDS = 1000  # TAIL-1


class ResumeService:
    def __init__(self, uow: UnitOfWorkFactory, templates: TemplateRegistry, files,
                 tailor_job_timeout_s: int) -> None:
        self._uow = uow
        self._templates = templates
        self._files = files
        self._stamper = EditStamper(Origin.USER)
        self._job_timeout_s = tailor_job_timeout_s

    async def list(self, user: AuthUser) -> list[ResumeSummary]:
        async with self._uow(user.id) as uow:
            return await uow.resumes.list_summaries(user.id)

    async def create(self, user: AuthUser, template: str, mode: ResumeMode,
                     title: str | None) -> ResumeRow:
        """Returning users start pre-filled from their profile (A2 #6), unlocked so the AI
        may reword it; first-time users start empty at the wizard's first step."""
        self._templates.require(template)
        async with self._uow(user.id) as uow:
            profile = await uow.profiles.get(user.id)
            content = as_origin(profile.content, Origin.PROFILE) if profile else CvContent()
            row = await uow.resumes.create(
                user.id, title or _default_title(), template, mode, content,
                content_hash(content), wizard_step="done" if profile else "personal")
        log.info("resume_created", resume_id=row.id, mode=mode, from_profile=bool(profile))
        return row

    async def get(self, user: AuthUser, resume_id: UUID) -> tuple[ResumeRow, JdRow | None]:
        async with self._uow(user.id) as uow:
            if await uow.resumes.mark_stale(user.id, resume_id, self._job_timeout_s):
                log.warning("tailor_job_stale", resume_id=resume_id)  # B9: stale_job
            row = await uow.resumes.get(user.id, resume_id)
            if row is None:
                raise NotFound(reason="resume")
            jd = await uow.jds.get(user.id, row.jd_id) if row.jd_id else None
        return row, jd

    async def autosave(self, user: AuthUser, resume_id: UUID, patch: ResumePatch
                       ) -> tuple[int, str]:
        """One wizard step. Stale version -> 409; running tailor job -> 409."""
        async with self._uow(user.id) as uow:
            row = await uow.resumes.get(user.id, resume_id, for_update=True)
            if row is None:
                raise NotFound(reason="resume")
            if row.status == "tailoring":
                raise JobAlreadyRunning(reason="autosave_during_tailor")
            if row.row_version != patch.expected_version:
                raise StaleVersion(reason="resume", current_version=row.row_version)
            content = self._stamper.apply_patch(row.content, patch.change)
            chash = content_hash(content)
            version = await uow.resumes.update_content(
                user.id, resume_id, content, chash, patch.expected_version, patch.wizard_step)
            if version is None:  # row is locked FOR UPDATE, so this means a logic bug
                raise StaleVersion(reason="resume")
        log.info("resume_autosaved", resume_id=resume_id, section=patch.change.section,
                 row_version=version)
        return version, chash

    async def duplicate(self, user: AuthUser, resume_id: UUID) -> ResumeRow:
        async with self._uow(user.id) as uow:
            source = await uow.resumes.get(user.id, resume_id)
            if source is None:
                raise NotFound(reason="resume")
            copy = await uow.resumes.duplicate(user.id, resume_id,
                                               f"{source.title[:110]} (copy)")
        if copy is None:
            raise NotFound(reason="resume")
        log.info("resume_duplicated", resume_id=resume_id, new_resume_id=copy.id)
        return copy

    async def delete(self, user: AuthUser, resume_id: UUID) -> None:
        """Files first (idempotent), then the row; analyses cascade (B12 #4)."""
        async with self._uow(user.id) as uow:
            if await uow.resumes.get(user.id, resume_id) is None:
                raise NotFound(reason="resume")
        removed = await self._files.delete_prefix(user, f"{user.id}/resumes/{resume_id}")
        async with self._uow(user.id) as uow:
            await uow.resumes.delete(user.id, resume_id)
        log.info("resume_deleted", resume_id=resume_id, storage_objects=removed)

    async def set_jd(self, user: AuthUser, resume_id: UUID, text: str,
                     company: str | None = None, role: str | None = None) -> JdRow:
        """company/role from the client are the user's correction (SAVE-2) and replace what
        the heuristic or an earlier paste stored; omitted ones keep the stored/detected value."""
        text, words = checked_jd(text)
        detected_company, detected_role = _detect_company_role(text)
        async with self._uow(user.id) as uow:
            jd = await uow.jds.upsert(user.id, text, words, text_hash(text),
                                      company or detected_company, role or detected_role)
            if (company and company != jd.company) or (role and role != jd.role):
                jd = await uow.jds.set_meta(user.id, jd.id, company or jd.company,
                                            role or jd.role)
            if not await uow.resumes.set_jd(user.id, resume_id, jd.id):
                if await uow.resumes.get(user.id, resume_id) is None:
                    raise NotFound(reason="resume")
                raise JobAlreadyRunning(reason="set_jd_during_tailor")
        log.info("resume_jd_set", resume_id=resume_id, jd_id=jd.id, word_count=words)
        return jd


def checked_jd(text: str) -> tuple[str, int]:
    """TAIL-1: 1..1000 words. Returns the stripped text and its word count."""
    text = text.strip()
    words = len(text.split())
    if not 1 <= words <= JD_MAX_WORDS:
        raise InvalidInput(f"Paste a job description of 1 to {JD_MAX_WORDS} words.",
                           reason="jd_length", word_count=words)
    return text, words


def _default_title() -> str:
    return f"Resume {datetime.now(UTC):%d %b %Y}"


_ROLE_HINT = re.compile(r"\b(engineer|developer|sde|manager|analyst|designer|scientist|"
                        r"architect|lead|intern|consultant|specialist)\b", re.IGNORECASE)


def _detect_company_role(text: str) -> tuple[str | None, str | None]:
    """Deterministic, conservative: the first short line that names a role. Company is left
    for the user to fill (SAVE-2 lets them correct both). No LLM call (B10)."""
    for line in text.splitlines()[:5]:
        line = line.strip(" •-\t")
        if line and len(line) <= 120 and _ROLE_HINT.search(line):
            return None, line.split("·")[0].strip()[:120] or None
    return None, None
