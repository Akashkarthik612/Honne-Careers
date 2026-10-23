"""Agent-layer data classes (Day_1 B3). An agent is data, not a class."""

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AgentConfig(BaseModel):
    """One YAML file in backend/agents/. Validated at startup (AgentRegistry)."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(pattern=r"^[a-z][a-z0-9_]{1,40}$")
    version: int = Field(ge=1)
    description: str = Field(max_length=200)
    model_tier: Literal["strong", "light"]
    temperature: float = Field(ge=0, le=1)
    max_output_tokens: int = Field(ge=64, le=32768)
    instructions: Path
    input_schema: str
    output_schema: str
    tools: list[str] = Field(default_factory=list, max_length=0)  # P1 agents have no tools
    timeout_s: int = Field(ge=5, le=120)
    max_retries: int = Field(ge=0, le=5)


@dataclass(frozen=True, slots=True)
class ModelSpec:
    provider: str
    model_id: str


@dataclass(frozen=True, slots=True)
class LlmResult:
    """Raw provider reply: JSON text plus usage. Validated by AgentRunner, not the provider."""

    text: str
    input_tokens: int | None
    output_tokens: int | None


# ---------- function calling (Day 3 chat agents), provider-neutral ----------

@dataclass(frozen=True, slots=True)
class ToolDecl:
    """A tool the model may call: name, what it does, JSON schema of its arguments."""

    name: str
    description: str
    parameters: dict[str, Any]


@dataclass(frozen=True, slots=True)
class ToolCall:
    id: str | None
    name: str
    args: dict[str, Any]


@dataclass(frozen=True, slots=True)
class ToolResult:
    call_id: str | None
    name: str
    content: dict[str, Any]


@dataclass(frozen=True, slots=True)
class LlmMessage:
    """One turn sent to the model. `raw` is the provider's own copy of a model turn, sent
    back unchanged (Gemini needs its thought signatures returned with the function calls)."""

    role: Literal["user", "model", "tool"]
    text: str | None = None
    tool_calls: tuple[ToolCall, ...] = ()
    tool_results: tuple[ToolResult, ...] = ()
    raw: Any = None

    def to_wire(self, raw_to_wire: Callable[[Any], Any]) -> dict[str, Any]:
        """JSON form, for the run's checkpoint. `raw` goes through the provider, which alone
        knows its type (Gemini: a Content with bytes thought signatures)."""
        return {"role": self.role, "text": self.text,
                "tool_calls": [{"id": c.id, "name": c.name, "args": c.args}
                               for c in self.tool_calls],
                "tool_results": [{"call_id": r.call_id, "name": r.name, "content": r.content}
                                 for r in self.tool_results],
                "raw": None if self.raw is None else raw_to_wire(self.raw)}

    @classmethod
    def from_wire(cls, data: dict[str, Any], raw_from_wire: Callable[[Any], Any]
                  ) -> "LlmMessage":
        return cls(role=data["role"], text=data["text"],
                   tool_calls=tuple(ToolCall(**c) for c in data["tool_calls"]),
                   tool_results=tuple(ToolResult(**r) for r in data["tool_results"]),
                   raw=None if data["raw"] is None else raw_from_wire(data["raw"]))


@dataclass(frozen=True, slots=True)
class ToolTurn:
    """Raw reply of one function-calling round. Validated by ToolLoop, not the provider."""

    tool_calls: tuple[ToolCall, ...]
    text: str | None
    input_tokens: int | None
    output_tokens: int | None
    raw: Any = None


@dataclass(frozen=True, slots=True)
class AgentRunRecord:
    """Mirror of app.agent_runs. No prompt, input or output content (guardrails §4)."""

    user_id: UUID
    agent_id: str
    agent_version: int
    provider: str
    model: str
    status: Literal["succeeded", "failed"]
    attempts: int
    input_tokens: int | None
    output_tokens: int | None
    latency_ms: int
    error_code: str | None
    entity_id: UUID | None
    correlation_id: str | None
    tool_calls: int | None = None             # chat turns only (Day_3 §3.1)
    tool_names: tuple[str, ...] | None = None  # names only, never arguments
