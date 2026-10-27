"""TemplateRegistry (B7, PDF-1): the one list of CV templates.

Adding a template = one renderer module in this package + one entry below. Nothing else
changes: the DB checks only the id's shape, the PDF cache key includes `revision`, and the
Docker image warms every registered template (docker/warm_cache.py loops over `all()`).
Bump `revision` whenever a template's output changes, so stored PDFs rebuild.
"""

from dataclasses import dataclass
from typing import Protocol

from app.core.errors import InvalidInput, RenderFailed
from app.core.hashing import render_key
from app.core.logging import get_logger
from app.domain.cv import CvContent
from app.domain.layout import SectionKey, SectionOrder
from app.domain.records import ResumeRow
from app.render.templates.jake import JakeRenderer
from app.render.templates.professional import ProfessionalRenderer

log = get_logger(__name__)

S = SectionKey


class TemplateRenderer(Protocol):
    def render(self, cv: CvContent, order: SectionOrder) -> str: ...


@dataclass(frozen=True, slots=True)
class TemplateInfo:
    id: str
    name: str
    description: str
    revision: int                # part of the PDF cache key (core/hashing.py: render_key)
    default_order: SectionOrder  # used while a resume has no section_order of its own
    renderer: TemplateRenderer


class TemplateRegistry:
    def __init__(self) -> None:
        templates = [
            TemplateInfo("jake", "Jake's Resume", "For entry-level candidates", 1,
                         (S.EDUCATION, S.EXPERIENCE, S.PROJECTS, S.SKILLS, S.CERTIFICATIONS,
                          S.LANGUAGES), JakeRenderer()),
            TemplateInfo("honne_professional", "Honne Professional",
                         "For experienced professionals", 1,
                         (S.EXPERIENCE, S.PROJECTS, S.SKILLS, S.EDUCATION, S.CERTIFICATIONS,
                          S.LANGUAGES), ProfessionalRenderer()),
        ]
        self._templates = {t.id: t for t in templates}

    def all(self) -> list[TemplateInfo]:
        return list(self._templates.values())

    def require(self, template_id: str) -> TemplateInfo:
        """A template a client asked for: unknown -> 422."""
        try:
            return self._templates[template_id]
        except KeyError as exc:
            raise InvalidInput("Unknown template.", reason="template") from exc

    def stored(self, template_id: str) -> TemplateInfo:
        """A resume's stored template: unknown means a template was removed from the code
        while rows still use it. Fails loudly; never falls back to another template."""
        try:
            return self._templates[template_id]
        except KeyError as exc:
            log.error("template_unknown", template=template_id)
            raise RenderFailed(reason="unknown_template") from exc

    def layout_of(self, row: ResumeRow) -> tuple[TemplateInfo, SectionOrder]:
        """The template a stored resume renders with, and its effective section order."""
        info = self.stored(row.template)
        return info, row.section_order or info.default_order

    def render_key_of(self, row: ResumeRow) -> str:
        info, order = self.layout_of(row)
        return render_key(row.content_hash, info.id, info.revision, tuple(k.value for k in order))

    def pdf_is_current(self, row: ResumeRow) -> bool:
        """The one freshness check for a resume's stored PDF (PdfService, ApplicationRecorder,
        the API's pdf.up_to_date)."""
        return row.pdf_path is not None and row.pdf_render_key == self.render_key_of(row)
