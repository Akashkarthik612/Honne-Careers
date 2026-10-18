"""Agent-layer data classes (Day_1 B3). An agent is data, not a class."""

from dataclasses import dataclass
from pathlib import Path
from typing import Literal
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
