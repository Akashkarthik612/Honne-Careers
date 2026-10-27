"""HTTP request/response shapes. Responses expose content; never internal columns
like storage paths."""

from datetime import date, datetime
from typing import Annotated, Any, Literal

from pydantic import Field, StringConstraints, model_validator

from app.domain.applications import (
    NOTES_MAX,
    ApplicationStatus,
    RecordResult,
    Referral,
    RetentionWindow,
)
from app.domain.chat_agents import (
    MESSAGE_MAX,
    AgentSpec,
    ChatMessageRow,
    ChatRow,
    CustomAgentIn,
    CustomAgentRow,
    TurnResult,
)
from app.domain.cv import CvContentIn, Model
from app.domain.records import (
    AnalysisRow,
    ApplicationDetail,
    ApplicationSummary,
    JdRow,
    ProfileRow,
    ResumeRow,
    ResumeSummary,
    SettingsRow,
)
from app.policy.quota import Usage


class CreateResume(Model):
    template: Literal["jake"]
    mode: Literal["tailored", "scratch"]
    title: Annotated[str, StringConstraints(min_length=1, max_length=120)] | None = None


class SaveProfile(Model):
    expected_version: int | None = Field(default=None, ge=1)
    content: CvContentIn


JdMeta = Annotated[str, StringConstraints(min_length=1, max_length=120)]


class SetJd(Model):
    text: Annotated[str, StringConstraints(min_length=1, max_length=20000)]
    # SAVE-2: the user's correction wins over the first-line heuristic. Omitted = detect.
    company: JdMeta | None = None
    role: JdMeta | None = None


class ConfirmSkill(Model):
    """V4.1: confirm a JD skill from the resume's missing_skills. Name + category only; the
    server sets origin=user."""
    expected_version: int = Field(ge=1)
    name: Annotated[str, StringConstraints(min_length=1, max_length=60)]
    category: Literal["languages", "frameworks", "tools"]


class SaveSettings(Model):
    display_name: Annotated[str, StringConstraints(min_length=1, max_length=120)] | None = None
    ask_before_save: bool
    product_emails: bool


class ExpectedVersion(Model):
    expected_version: int | None = Field(default=None, ge=1)


AppText = Annotated[str, StringConstraints(min_length=1, max_length=200)]
Notes = Annotated[str, StringConstraints(max_length=NOTES_MAX)]


class AddApplication(Model):
    """IQ-3: an application made outside Honne. The JD is optional."""
    company: AppText
    role: AppText
    applied_on: date | None = None  # None = today
    status: ApplicationStatus = "applied"
    referral: Referral | None = None
    notes: Notes | None = None
    jd_text: Annotated[str, StringConstraints(min_length=1, max_length=20000)] | None = None


class ApplicationPatch(Model):
    """Only the fields sent are changed. referral/notes may be null (cleared)."""
    expected_version: int = Field(ge=1)
    status: ApplicationStatus | None = None
    referral: Referral | None = None
    notes: Notes | None = None
    company: AppText | None = None
    role: AppText | None = None
    applied_on: date | None = None

    @model_validator(mode="after")
    def _required_stay_set(self) -> "ApplicationPatch":
        for name in ("status", "company", "role", "applied_on"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} can't be cleared")
        return self

    def changes(self) -> dict[str, Any]:
        fields = {k: getattr(self, k) for k in self.model_fields_set if k != "expected_version"}
        if fields.get("notes") == "":
            fields["notes"] = None
        return fields


def summary_view(s: ResumeSummary) -> dict[str, Any]:
    return {"id": str(s.id), "title": s.title, "template": s.template, "mode": s.mode,
            "status": s.status, "wizard_step": s.wizard_step, "company": s.company,
            "role": s.role, "updated_at": s.updated_at.isoformat(),
            "content": s.content.model_dump(mode="json")}


def jd_view(jd: JdRow | None) -> dict[str, Any] | None:
    if jd is None:
        return None
    return {"id": str(jd.id), "company": jd.company, "role": jd.role,
            "word_count": jd.word_count, "text": jd.text}


def resume_view(r: ResumeRow, jd: JdRow | None = None) -> dict[str, Any]:
    return {
        "id": str(r.id), "title": r.title, "template": r.template, "mode": r.mode,
        "status": r.status, "job_step": r.job_step, "error_code": r.error_code,
        "wizard_step": r.wizard_step,
        "row_version": r.row_version, "content_hash": r.content_hash,
        "content": r.content.model_dump(mode="json"), "missing_skills": r.missing_skills,
        "gaps": r.jd_gaps, "tailor_report": r.tailor_report,
        "jd": jd_view(jd),
        "pdf": {"up_to_date": r.pdf_content_hash == r.content_hash,
                "page_count": r.page_count} if r.pdf_path else None,
        "updated_at": r.updated_at.isoformat(),
    }


def settings_view(s: SettingsRow) -> dict[str, Any]:
    return {"display_name": s.display_name, "ask_before_save": s.ask_before_save,
            "product_emails": s.product_emails}


def usage_view(u: Usage) -> dict[str, Any]:
    return {"items": [{"key": i.key, "used": i.used, "limit": i.limit, "daily": i.daily}
                      for i in u.items],
            "resets_at": u.resets_at.isoformat()}


def profile_view(p: ProfileRow) -> dict[str, Any]:
    return {"content": p.content.model_dump(mode="json"), "row_version": p.row_version,
            "updated_at": p.updated_at.isoformat()}


def analysis_view(row: AnalysisRow, cached: bool) -> dict[str, Any]:
    return {"keyword": row.keyword_score, "experience": row.experience_score,
            "narrative": row.narrative_score, "details": row.details, "cached": cached}


def application_summary_view(s: ApplicationSummary, window: RetentionWindow) -> dict[str, Any]:
    return {"id": str(s.id), "source": s.source, "company": s.company, "role": s.role,
            "applied_on": s.applied_on.isoformat(), "status": s.status,
            "referral": s.referral, "has_jd": s.has_jd, "has_pdf": s.has_pdf,
            "has_notes": s.has_notes, "last_sent_at": s.last_sent_at.isoformat(),
            "deletes_on": window.deletes_on(s.last_sent_at).date().isoformat(),
            "row_version": s.row_version}


def applications_view(items: list[ApplicationSummary], window: RetentionWindow
                      ) -> dict[str, Any]:
    return {"retention_days": window.days,
            "items": [application_summary_view(s, window) for s in items]}


def application_view(d: ApplicationDetail, window: RetentionWindow) -> dict[str, Any]:
    return {**application_summary_view(d.summary, window),
            "jd_text": d.jd_text,
            "cv_content": d.cv_content.model_dump(mode="json") if d.cv_content else None,
            "notes": d.notes, "page_count": d.page_count,
            "resume_id": str(d.resume_id) if d.resume_id else None,
            "events": [{"from": e.from_status, "to": e.to_status, "at": e.at.isoformat()}
                       for e in d.events]}


def record_view(r: RecordResult) -> dict[str, Any]:
    return {"saved": r.saved, "reason": r.reason,
            "application_id": str(r.application_id) if r.application_id else None,
            "deletes_on": r.deletes_on.date().isoformat() if r.deletes_on else None}


# ---------- custom agents + chat (Day 3) ----------

class UpdateAgent(CustomAgentIn):
    """PUT /agents/{id}: the whole agent again (a new version) + optimistic concurrency."""
    expected_version: int = Field(ge=1)


class PreviewAgent(Model):
    """CUST-3: try an unsaved agent with one message."""
    agent: CustomAgentIn
    message: Annotated[str, StringConstraints(min_length=1, max_length=MESSAGE_MAX)]


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def agent_view(a: CustomAgentRow) -> dict[str, Any]:
    return {"id": str(a.id), "kind": "user", "handle": a.handle,
            "description": a.description, "instructions": a.instructions,
            "guardrails": a.guardrails, "knowledge": [k.value for k in a.knowledge],
            "version": a.current_version, "row_version": a.row_version,
            "chat_count": a.chat_count, "last_used_at": _iso(a.last_used_at),
            "created_at": a.created_at.isoformat(), "updated_at": a.updated_at.isoformat()}


def builtin_agent_view(s: AgentSpec) -> dict[str, Any]:
    return {"kind": "builtin", "handle": s.handle, "description": s.description,
            "knowledge": sorted(k.value for k in s.knowledge)}


def agents_view(mine: list[CustomAgentRow], builtin: list[AgentSpec], limit: int
                ) -> dict[str, Any]:
    return {"mine": [agent_view(a) for a in mine],
            "builtin": [builtin_agent_view(s) for s in builtin],
            "limit": limit, "count": len(mine)}


def chat_summary_view(c: ChatRow) -> dict[str, Any]:
    return {"id": str(c.id), "title": c.title, "turn_count": c.turn_count,
            "last_message_at": c.last_message_at.isoformat(),
            "created_at": c.created_at.isoformat(), "running": c.running}


def message_view(m: ChatMessageRow) -> dict[str, Any]:
    return {"id": str(m.id), "seq": m.seq, "role": m.role, "status": m.status,
            "content": m.content,
            "agent": ({"handle": m.agent_handle, "kind": m.agent_kind}
                      if m.agent_handle else None),
            "sources": m.sources, "drafts": m.drafts, "steps": m.steps,
            "error_code": m.error_code, "created_at": m.created_at.isoformat(),
            "finished_at": _iso(m.finished_at)}


def chat_view(c: ChatRow, messages: list[ChatMessageRow], turns_max: int,
              long_warn_turns: int, window: RetentionWindow) -> dict[str, Any]:
    return {**chat_summary_view(c),
            "running": any(m.status == "running" for m in messages),
            "turns_max": turns_max, "long_warn_turns": long_warn_turns,
            "deletes_on": window.deletes_on(c.created_at).date().isoformat(),
            "messages": [message_view(m) for m in messages]}


def turn_view(chat: ChatRow, user_message: ChatMessageRow, answer: ChatMessageRow
              ) -> dict[str, Any]:
    return {"chat": {**chat_summary_view(chat), "running": True},
            "user_message": message_view(user_message),
            "assistant_message": message_view(answer),
            "poll": f"/chats/{chat.id}/messages/{answer.id}"}


def preview_view(r: TurnResult) -> dict[str, Any]:
    return {"content": r.answer.content, "note": r.answer.note,
            "sources": [s.to_json() for s in r.sources],
            "drafts": [d.model_dump(mode="json") for d in r.answer.drafts],
            "steps": [s.to_json() for s in r.steps]}
