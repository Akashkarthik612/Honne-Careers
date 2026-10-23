"""PdfService (B6, A4 #6): build or reuse the PDF, return a short-lived signed URL.

Unchanged content (pdf_content_hash == content_hash) reuses the stored file: 0 compiles.
"""

from dataclasses import dataclass
from uuid import UUID

from app.core.errors import NotFound
from app.core.logging import get_logger
from app.db.unit_of_work import UnitOfWorkFactory
from app.domain.auth import AuthUser
from app.policy.limits import DailyAction
from app.policy.quota import QuotaGuard
from app.render.compiler import LatexCompiler
from app.render.inspector import PdfInspector
from app.render.latex import LatexRenderer
from app.storage.file_store import pdf_path

log = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class PdfResult:
    url: str
    page_count: int
    reused: bool

    @property
    def warning(self) -> str | None:
        return "multiple_pages" if self.page_count > 1 else None  # TAIL-8: warn, don't fail


class PdfService:
    def __init__(self, uow: UnitOfWorkFactory, renderer: LatexRenderer, compiler: LatexCompiler,
                 inspector: PdfInspector, files, quota: QuotaGuard) -> None:
        self._uow = uow
        self._renderer = renderer
        self._compiler = compiler
        self._inspector = inspector
        self._files = files
        self._quota = quota

    async def build(self, user: AuthUser, resume_id: UUID) -> PdfResult:
        async with self._uow(user.id) as uow:
            row = await uow.resumes.get(user.id, resume_id)
            if row is None:
                raise NotFound(reason="resume")
            if row.pdf_path and row.pdf_content_hash == row.content_hash:
                reuse = True
            else:
                reuse = False
                await self._quota.consume(uow, user.id, DailyAction.PDF)
        if reuse:
            log.info("pdf_reused", resume_id=resume_id)
            return PdfResult(await self._files.signed_url(user, row.pdf_path),
                             row.page_count or 1, reused=True)

        tex = self._renderer.render(row.content)
        pdf = await self._compiler.compile(tex)
        pages = self._inspector.page_count(pdf)
        path = pdf_path(user.id, resume_id, row.content_hash)
        await self._files.put(user, path, pdf, "application/pdf")
        async with self._uow(user.id) as uow:
            current = await uow.resumes.set_pdf(user.id, resume_id, path, row.content_hash,
                                                pages)
        if not current:
            # Edited while compiling: this PDF matches what was asked for; not cached as current.
            log.warning("pdf_built_for_older_content", resume_id=resume_id)
        log.info("pdf_built", resume_id=resume_id, page_count=pages)
        return PdfResult(await self._files.signed_url(user, path), pages, reused=False)
