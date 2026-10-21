"""Application Database services (Day 2).

ApplicationRecorder: on Download PDF, saves the JD + CV sent (JSON) + our own PDF copy as one
row (SAVE-1/3). ApplicationService: what the Database screens do (list, open, add by hand,
update, delete). Both hide rows past the retention cut-off on every read.

No transaction is held across a storage call: short UoW -> storage -> short UoW.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID, uuid4

from app.core.errors import (
    ApplicationExists,
    InvalidInput,
    NotFound,
    PdfOutdated,
    SaveConflict,
    StaleVersion,
    StorageFailed,
)
from app.core.hashing import text_hash
from app.core.logging import get_logger
from app.db.unit_of_work import UnitOfWorkFactory
from app.domain.applications import ApplicationFilter, RecordResult, RetentionWindow
from app.domain.auth import AuthUser
from app.domain.records import ApplicationDetail, ApplicationSummary
from app.services.resumes import checked_jd
from app.storage.file_store import application_pdf_path, application_prefix

log = get_logger(__name__)


def _now() -> datetime:
    return datetime.now(UTC)


class ApplicationRecorder:
    """SAVE-1: the CV downloaded for a JD is the CV used for that JD. Idempotent (SAVE-3):
    the same CV again only restarts the 20-day clock; a changed CV replaces CV + PDF and the
    old PDF is deleted. Status, referral and notes are never touched here."""

    def __init__(self, uow: UnitOfWorkFactory, files, window: RetentionWindow) -> None:
        self._uow = uow
        self._files = files
        self._window = window

    async def record(self, user: AuthUser, resume_id: UUID) -> RecordResult:
        async with self._uow(user.id) as uow:
            resume = await uow.resumes.get(user.id, resume_id)
            if resume is None:
                raise NotFound(reason="resume")
            if resume.jd_id is None:  # built from scratch: no job to attach it to (Day 2 Q1)
                log.info("application_not_saved", resume_id=resume_id, reason="no_jd")
                return RecordResult(saved=False, reason="no_jd")
            if resume.pdf_path is None or resume.pdf_content_hash != resume.content_hash:
                raise PdfOutdated(resume_id=str(resume_id))
            jd = await uow.jds.get(user.id, resume.jd_id)
            existing = await uow.applications.get_row_by_jd(user.id, resume.jd_id)
        if jd is None:  # FK keeps it; absence means it was deleted between the two reads
            raise NotFound(reason="jd")

        now = _now()
        cutoff = self._window.cutoff(now)
        live = existing if existing and existing.last_sent_at >= cutoff else None
        app_id = live.id if live else uuid4()
        dest = application_pdf_path(user.id, app_id, resume.content_hash)
        if live is None or live.pdf_path != dest:
            await self._files.copy(user, resume.pdf_path, dest)  # inside storage, no bytes here

        stale_paths: list[tuple[UUID, str]] = []  # (trash id, path) to delete after commit
        conflict = False
        async with self._uow(user.id) as uow:
            current = await uow.applications.get_row_by_jd(user.id, jd.id, for_update=True)
            if current is not None and current.last_sent_at < cutoff:
                # Expired but not yet cleaned up: start a fresh row, never revive old notes.
                await uow.applications.delete(user.id, current.id)
                if current.pdf_path:
                    stale_paths.append((await uow.applications.trash(user.id, current.pdf_path),
                                        current.pdf_path))
                current = None
            if current is None and live is None:
                inserted = await uow.applications.insert_download(
                    user.id, app_id, jd.id, resume_id, jd.company, jd.role, resume.content,
                    resume.content_hash, dest, resume.page_count)
                if inserted:
                    await uow.applications.add_event(user.id, app_id, None, "applied")
                conflict = not inserted
            elif current is not None and current.id == app_id:
                await uow.applications.replace_download(
                    user.id, app_id, resume_id, resume.content, resume.content_hash, dest,
                    resume.page_count)
                if current.pdf_path and current.pdf_path != dest:
                    stale_paths.append((await uow.applications.trash(user.id, current.pdf_path),
                                        current.pdf_path))
            else:  # the row changed between the two transactions (another save, or a delete)
                conflict = True

        if conflict:
            async with self._uow(user.id) as uow:
                trash_id = await uow.applications.trash(user.id, dest)
            await self._delete_now(user, [(trash_id, dest)])
            log.warning("application_save_conflict", resume_id=resume_id, jd_id=jd.id)
            raise SaveConflict(resume_id=str(resume_id))

        await self._delete_now(user, stale_paths)
        log.info("application_recorded", application_id=app_id, resume_id=resume_id,
                 jd_id=jd.id, replaced=live is not None)
        return RecordResult(saved=True, application_id=app_id,
                            deletes_on=self._window.deletes_on(now))

    async def _delete_now(self, user: AuthUser, items: list[tuple[UUID, str]]) -> None:
        """Old PDFs are deleted at once. Their paths were put in storage_trash in the same
        transaction, so a failed delete (or a crash) is retried by the daily clean-up
        (approved fallback A); the user's save still succeeds."""
        if not items:
            return
        try:
            await self._files.delete_paths(user, [path for _, path in items])
        except StorageFailed:
            log.warning("application_old_pdf_delete_failed", object_count=len(items),
                        fallback="daily_cleanup")
            return
        async with self._uow(user.id) as uow:
            for trash_id, _ in items:
                await uow.applications.untrash(user.id, trash_id)


@dataclass(frozen=True, slots=True)
class ManualApplication:
    company: str
    role: str
    applied_on: date
    status: str
    referral: str | None
    notes: str | None
    jd_text: str | None


class ApplicationService:
    def __init__(self, uow: UnitOfWorkFactory, files, window: RetentionWindow,
                 list_max: int) -> None:
        self._uow = uow
        self._files = files
        self._window = window
        self._list_max = list_max

    @property
    def window(self) -> RetentionWindow:
        return self._window

    def _cutoff(self) -> datetime:
        return self._window.cutoff(_now())

    async def list(self, user: AuthUser, flt: ApplicationFilter) -> list[ApplicationSummary]:
        async with self._uow(user.id) as uow:
            return await uow.applications.list_summaries(user.id, self._cutoff(), flt,
                                                         self._list_max)

    async def get(self, user: AuthUser, app_id: UUID) -> ApplicationDetail:
        async with self._uow(user.id) as uow:
            detail = await uow.applications.get_detail(user.id, app_id, self._cutoff())
        if detail is None:
            raise NotFound(reason="application")
        return detail

    async def pdf_url(self, user: AuthUser, app_id: UUID) -> str:
        async with self._uow(user.id) as uow:
            row = await uow.applications.get_row(user.id, app_id, self._cutoff())
        if row is None:
            raise NotFound(reason="application")
        if row.pdf_path is None:  # added by hand: there is no PDF
            raise NotFound(reason="no_pdf")
        return await self._files.signed_url(user, row.pdf_path)

    async def add_manual(self, user: AuthUser, data: ManualApplication) -> ApplicationDetail:
        """IQ-3: an application made outside Honne, with or without its JD."""
        if data.applied_on > _now().date():
            raise InvalidInput("The date sent can't be in the future.", reason="applied_on")
        async with self._uow(user.id) as uow:
            jd_id = None
            if data.jd_text:
                text, words = checked_jd(data.jd_text)
                jd = await uow.jds.upsert(user.id, text, words, text_hash(text), data.company,
                                          data.role)
                existing = await uow.applications.get_row_by_jd(user.id, jd.id,
                                                                for_update=True)
                if existing is not None:
                    if existing.last_sent_at >= self._cutoff():
                        raise ApplicationExists(application_id=str(existing.id))
                    # Expired, not yet cleaned up: replace it; its PDF goes to the trash,
                    # which the daily clean-up empties.
                    await uow.applications.delete(user.id, existing.id)
                    if existing.pdf_path:
                        await uow.applications.trash(user.id, existing.pdf_path)
                jd_id = jd.id
            app_id = await uow.applications.insert_manual(
                user.id, jd_id, data.company, data.role, data.applied_on, data.status,
                data.referral, data.notes)
            if app_id is None:  # a concurrent add for the same JD won
                raise ApplicationExists(reason="concurrent_add")
            await uow.applications.add_event(user.id, app_id, None, data.status)
        log.info("application_added", application_id=app_id, has_jd=jd_id is not None)
        return await self.get(user, app_id)

    async def patch(self, user: AuthUser, app_id: UUID, expected_version: int,
                    fields: dict[str, Any]) -> ApplicationDetail:
        """Status, referral, notes, company, role, date sent. Two tabs: the stale one gets
        409 (no silent overwrite). A real status change is logged as an event (IQ-2)."""
        if fields:
            async with self._uow(user.id) as uow:
                row = await uow.applications.get_row(user.id, app_id, self._cutoff(),
                                                     for_update=True)
                if row is None:
                    raise NotFound(reason="application")
                if row.row_version != expected_version:
                    raise StaleVersion(reason="application", current_version=row.row_version)
                version = await uow.applications.update_fields(user.id, app_id,
                                                               expected_version, fields)
                if version is None:  # row is locked FOR UPDATE, so this means a logic bug
                    raise StaleVersion(reason="application")
                new_status = fields.get("status")
                if new_status is not None and new_status != row.status:
                    await uow.applications.add_event(user.id, app_id, row.status, new_status)
            log.info("application_updated", application_id=app_id, fields=sorted(fields),
                     row_version=version)
        return await self.get(user, app_id)

    async def delete(self, user: AuthUser, app_id: UUID) -> None:
        """Files first (fails loudly, the row stays), then the row and its history, then the
        JD text if nothing else uses it."""
        async with self._uow(user.id) as uow:
            if await uow.applications.get_row(user.id, app_id, self._cutoff()) is None:
                raise NotFound(reason="application")
        removed = await self._files.delete_prefix(user, application_prefix(user.id, app_id))
        async with self._uow(user.id) as uow:
            deleted, jd_id = await uow.applications.delete(user.id, app_id)
            jd_deleted = bool(jd_id) and await uow.applications.delete_unused_jd(user.id, jd_id)
        if not deleted:
            raise NotFound(reason="application")
        log.info("application_deleted", application_id=app_id, storage_objects=removed,
                 jd_deleted=jd_deleted)
