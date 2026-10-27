"""CV layout: which template renders a resume and in what order its sections appear (PDF-1).

Layout never changes CV content: switching template or order costs 0 LLM calls and leaves
content_hash alone. The PDF cache key covers it instead (core/hashing.py: render_key).
"""

from enum import StrEnum
from typing import Annotated

from pydantic import AfterValidator, Field, StringConstraints

from app.domain.cv import Model


class SectionKey(StrEnum):
    """A major CV section a user can move. The header always comes first."""
    EXPERIENCE = "experience"
    PROJECTS = "projects"
    SKILLS = "skills"
    EDUCATION = "education"
    CERTIFICATIONS = "certifications"
    LANGUAGES = "languages"  # spoken languages


SectionOrder = tuple[SectionKey, ...]


def checked_order(keys: list[SectionKey] | tuple[SectionKey, ...]) -> SectionOrder:
    """Every section exactly once; raises ValueError (a 422 through Pydantic) otherwise."""
    if len(keys) != len(SectionKey) or set(keys) != set(SectionKey):
        raise ValueError("section_order must list every section exactly once")
    return tuple(keys)


TemplateId = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9_]{0,39}$")]


class LayoutPatch(Model):
    """PATCH /resumes/{id}/layout. section_order None = the template's default order."""
    expected_version: int = Field(ge=1)
    template: TemplateId
    section_order: Annotated[list[SectionKey], AfterValidator(checked_order)] | None = None
