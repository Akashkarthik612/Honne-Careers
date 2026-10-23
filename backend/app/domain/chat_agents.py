"""Custom agents + chat data classes (Day 3: CUST-1..7). Plain data, no I/O.

An agent is data (Dust's agent_configuration): handle, description, instructions,
guardrails and the knowledge it may read. User agents are rows (one immutable version per
edit); built-in agents are config files. Both become an AgentSpec, so one runner serves both.
"""

import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import Field, StringConstraints, field_validator

from app.domain.cv import Model

HANDLE = r"^[a-z0-9][a-z0-9-]{1,29}$"
_HANDLE_RE = re.compile(HANDLE)
DESCRIPTION_MAX = 140   # DB checks in 20261023000001 match these
INSTRUCTIONS_MAX = 4000
GUARDRAILS_MAX = 1000
MESSAGE_MAX = 4000
DRAFTS_MAX = 5

AgentKind = Literal["user", "builtin"]
MessageRole = Literal["user", "assistant"]
MessageStatus = Literal["running", "ok", "failed"]


class Knowledge(StrEnum):
    """What an agent may read (CUST-6: it can only call the tools the user granted it)."""
    PROFILE = "profile"
    RESUMES = "resumes"
    APPLICATIONS = "applications"


def normalise_handle(value: str) -> str:
    """'  @Follow-Up ' -> 'follow-up'. Mirrored by normaliseHandle in agentsAdapter.js."""
    return value.strip().removeprefix("@").strip().lower()


def is_handle(value: str) -> bool:
    return bool(_HANDLE_RE.fullmatch(value))


# ---------- client input (ids + text only, extra="forbid") ----------

class CustomAgentIn(Model):
    handle: Annotated[str, StringConstraints(min_length=2, max_length=31)]
    description: Annotated[str, StringConstraints(min_length=1, max_length=DESCRIPTION_MAX)]
    instructions: Annotated[str, StringConstraints(min_length=1, max_length=INSTRUCTIONS_MAX)]
    guardrails: Annotated[str, StringConstraints(max_length=GUARDRAILS_MAX)] = ""
    knowledge: list[Knowledge] = Field(min_length=1, max_length=len(Knowledge))

    @field_validator("handle")
    @classmethod
    def _handle(cls, value: str) -> str:
        handle = normalise_handle(value)
        if not is_handle(handle):
            raise ValueError("lower case letters, digits and '-', 2 to 30 characters")
        return handle

    @field_validator("knowledge")
    @classmethod
    def _unique(cls, value: list[Knowledge]) -> list[Knowledge]:
        return sorted(set(value))


class ChatTurnIn(Model):
    message: Annotated[str, StringConstraints(min_length=1, max_length=MESSAGE_MAX)]
    # The agent called with "@handle". Omitted = the agent that answered last in this chat.
    agent: Annotated[str, StringConstraints(min_length=2, max_length=31)] | None = None

    @field_validator("agent")
    @classmethod
    def _agent(cls, value: str | None) -> str | None:
        if value is None:
            return None
        handle = normalise_handle(value)
        if not is_handle(handle):
            raise ValueError("not an agent handle")
        return handle


# ---------- what the runner sees ----------

@dataclass(frozen=True, slots=True)
class AgentSpec:
    """One agent, user-made or built-in, at one version. The runner reads only this."""
    handle: str
    kind: AgentKind
    description: str
    instructions: str
    guardrails: str
    knowledge: frozenset[Knowledge]
    version: int
    agent_id: UUID | None = None      # user agents
    version_id: UUID | None = None    # user agents: the chat_agent_versions row


# ---------- rows ----------

@dataclass(frozen=True, slots=True)
class CustomAgentRow:
    """An active agent joined with its current version (+ usage, for the list)."""
    id: UUID
    handle: str
    current_version: int
    row_version: int
    version_id: UUID
    description: str
    instructions: str
    guardrails: str
    knowledge: tuple[Knowledge, ...]
    created_at: datetime
    updated_at: datetime
    chat_count: int = 0
    last_used_at: datetime | None = None

    def spec(self) -> AgentSpec:
        return AgentSpec(handle=self.handle, kind="user", description=self.description,
                         instructions=self.instructions, guardrails=self.guardrails,
                         knowledge=frozenset(self.knowledge), version=self.current_version,
                         agent_id=self.id, version_id=self.version_id)


@dataclass(frozen=True, slots=True)
class ChatRow:
    id: UUID
    title: str
    turn_count: int
    last_message_at: datetime
    created_at: datetime
    running: bool = False


@dataclass(frozen=True, slots=True)
class ChatMessageRow:
    id: UUID
    chat_id: UUID
    seq: int
    role: MessageRole
    status: MessageStatus
    content: str
    agent_handle: str | None
    agent_kind: AgentKind | None
    sources: list[dict[str, Any]]
    drafts: list[dict[str, Any]]
    steps: list[dict[str, Any]]
    error_code: str | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    agent_id: UUID | None = None          # user agents: who answered, stable across renames


@dataclass(frozen=True, slots=True)
class Speaker:
    """Who answered a message, as an identity rather than a handle (a handle can be renamed or
    reused). Built-ins: kind + handle. User agents: kind + agent id."""
    kind: AgentKind
    key: str

    @classmethod
    def of_spec(cls, spec: "AgentSpec") -> "Speaker":
        return cls(spec.kind, str(spec.agent_id) if spec.kind == "user" else spec.handle)

    @classmethod
    def of_message(cls, m: ChatMessageRow) -> "Speaker | None":
        if m.agent_kind == "builtin" and m.agent_handle:
            return cls("builtin", m.agent_handle)
        if m.agent_kind == "user" and m.agent_id:
            return cls("user", str(m.agent_id))
        return None


# ---------- model output (the submit_answer tool's arguments) ----------

class Draft(Model):
    """A message the user may send themselves (CUST-5: drafts only, never sent)."""
    to: Annotated[str, StringConstraints(min_length=1, max_length=120)]
    subject: Annotated[str, StringConstraints(max_length=160)] = ""
    body: Annotated[str, StringConstraints(min_length=1, max_length=3000)]


class ChatAnswer(Model):
    content: Annotated[str, StringConstraints(min_length=1, max_length=8000)] = Field(
        description="The full answer in Markdown. Cite data with [n], n = the item's ref.")
    cited: list[int] = Field(default_factory=list, max_length=30,
                             description="The ref numbers cited in content.")
    drafts: list[Draft] = Field(default_factory=list, max_length=DRAFTS_MAX,
                                description="Emails or messages drafted for the user.")
    note: Annotated[str, StringConstraints(max_length=300)] | None = Field(
        default=None, description="What you could not find, if anything.")


# ---------- one turn ----------

@dataclass(frozen=True, slots=True)
class SourceRef:
    """A row an answer used. `ref` is the number the model cites as [ref]."""
    ref: int
    kind: Literal["application", "resume", "profile"]
    id: str
    label: str
    meta: dict[str, Any] = field(default_factory=dict)  # company, role, status, sent

    def to_json(self) -> dict[str, Any]:
        return {"ref": self.ref, "kind": self.kind, "id": self.id, "label": self.label,
                **({"meta": self.meta} if self.meta else {})}


@dataclass(frozen=True, slots=True)
class StepRecord:
    """A live step shown under the agent ("Read your Database · 6 applications").
    `label` is user data shown in the UI; logs only ever get `tool` and `count`."""
    tool: str
    label: str
    count: int | None = None

    def to_json(self) -> dict[str, Any]:
        return {"tool": self.tool, "label": self.label, "count": self.count}


@dataclass(frozen=True, slots=True)
class TurnResult:
    answer: ChatAnswer
    sources: list[SourceRef]       # only those cited, in ref order
    steps: list[StepRecord]
    rounds: int
    forced_submit: bool
