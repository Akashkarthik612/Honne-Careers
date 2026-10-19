"""Row records returned by repositories. Plain data, no behaviour."""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal
from uuid import UUID

from app.domain.cv import CvContent
from app.domain.tailoring import PrefillCv

ResumeStatus = Literal["draft", "tailoring", "ready", "failed"]
JobStep = Literal["reading", "rewriting", "checking"]  # TAIL-3, set while status = tailoring
ResumeMode = Literal["tailored", "scratch"]


@dataclass(frozen=True, slots=True)
class AccountRow:
    user_id: UUID
    plan: str
    has_profile: bool


@dataclass(frozen=True, slots=True)
class ProfileRow:
    content: CvContent
    content_hash: str
    row_version: int
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class JdRow:
    id: UUID
    text: str
    word_count: int
    content_hash: str
    company: str | None
    role: str | None


@dataclass(frozen=True, slots=True)
class ResumeSummary:
    id: UUID
    title: str
    template: str
    mode: ResumeMode
    status: ResumeStatus
    wizard_step: str
    company: str | None
    role: str | None
    updated_at: datetime
    content: CvContent  # dashboard thumbnails; one query, no per-card fetch


@dataclass(frozen=True, slots=True)
class ResumeRow:
    id: UUID
    title: str
    template: str
    mode: ResumeMode
    jd_id: UUID | None
    content: CvContent
    missing_skills: list[str]
    tailor_report: dict[str, object] | None
    wizard_step: str
    status: ResumeStatus
    job_step: JobStep | None
    job_started_at: datetime | None
    row_version: int
    content_hash: str
    pdf_path: str | None
    pdf_content_hash: str | None
    page_count: int | None
    error_code: str | None
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class UploadRow:
    id: UUID
    source_type: str
    filename: str
    storage_path: str
    parsed: PrefillCv | None


@dataclass(frozen=True, slots=True)
class AnalysisRow:
    id: UUID
    keyword_score: int
    experience_score: int
    narrative_score: int
    details: dict[str, object]


@dataclass(frozen=True, slots=True)
class SettingsRow:
    display_name: str | None  # None = use the sign-in provider's name
    ask_before_save: bool
    product_emails: bool
