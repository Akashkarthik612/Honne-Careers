"""HTTP request/response shapes. Responses expose content; never internal columns
like storage paths."""

from typing import Annotated, Any, Literal

from pydantic import Field, StringConstraints

from app.domain.cv import CvContentIn, Model
from app.domain.records import JdRow, ResumeRow, ResumeSummary


class CreateResume(Model):
    template: Literal["jake"]
    mode: Literal["tailored", "scratch"]
    title: Annotated[str, StringConstraints(min_length=1, max_length=120)] | None = None


class SaveProfile(Model):
    expected_version: int | None = Field(default=None, ge=1)
    content: CvContentIn


class SetJd(Model):
    text: Annotated[str, StringConstraints(min_length=1, max_length=20000)]


class ExpectedVersion(Model):
    expected_version: int | None = Field(default=None, ge=1)


def summary_view(s: ResumeSummary) -> dict[str, Any]:
    return {"id": str(s.id), "title": s.title, "template": s.template, "mode": s.mode,
            "status": s.status, "wizard_step": s.wizard_step, "company": s.company,
            "role": s.role, "updated_at": s.updated_at.isoformat()}


def jd_view(jd: JdRow | None) -> dict[str, Any] | None:
    if jd is None:
        return None
    return {"id": str(jd.id), "company": jd.company, "role": jd.role,
            "word_count": jd.word_count, "text": jd.text}


def resume_view(r: ResumeRow, jd: JdRow | None = None) -> dict[str, Any]:
    return {
        "id": str(r.id), "title": r.title, "template": r.template, "mode": r.mode,
        "status": r.status, "error_code": r.error_code, "wizard_step": r.wizard_step,
        "row_version": r.row_version, "content_hash": r.content_hash,
        "content": r.content.model_dump(mode="json"), "missing_skills": r.missing_skills,
        "tailor_report": r.tailor_report,
        "jd": jd_view(jd),
        "pdf": {"up_to_date": r.pdf_content_hash == r.content_hash,
                "page_count": r.page_count} if r.pdf_path else None,
        "updated_at": r.updated_at.isoformat(),
    }
