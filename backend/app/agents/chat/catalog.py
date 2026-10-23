"""AgentCatalog: "@handle" -> AgentSpec (Day 3).

Built-in chat agents (@analyst, @advisor) are config files, like the CV agents: a YAML in
backend/agents/chat/ plus a Markdown prompt. Adding one = adding files (OCP). A bad file
stops the app at startup (ConfigError). A handle is looked up among the built-ins first,
then among the user's active agents; built-in handles and a few words are reserved, so a
user agent can never shadow ours.
"""

from pathlib import Path
from uuid import UUID

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.core.errors import AgentGone, AgentNotFound, ConfigError
from app.db.unit_of_work import UnitOfWork
from app.domain.chat_agents import (
    DESCRIPTION_MAX,
    GUARDRAILS_MAX,
    HANDLE,
    INSTRUCTIONS_MAX,
    AgentSpec,
    Knowledge,
    Speaker,
)

# Words the UI uses (Auto) or may use (@all), and the built-ins the UI shows that aren't
# chat agents yet (@cv-writer opens the tailor flow; @strategist is coming).
RESERVED = frozenset({"auto", "honne", "all", "here", "everyone", "me", "you",
                      "cv-writer", "strategist"})


class BuiltinAgentConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    handle: str = Field(pattern=HANDLE)
    version: int = Field(ge=1)
    description: str = Field(min_length=1, max_length=DESCRIPTION_MAX)
    instructions: Path
    guardrails: str = Field(default="", max_length=GUARDRAILS_MAX)
    knowledge: list[Knowledge] = Field(min_length=1)


class AgentCatalog:
    def __init__(self, builtins: dict[str, AgentSpec]) -> None:
        self._builtins = builtins

    @classmethod
    def load(cls, agents_dir: Path, base_dir: Path) -> "AgentCatalog":
        builtins: dict[str, AgentSpec] = {}
        for path in sorted(agents_dir.glob("*.yaml")):
            try:
                cfg = BuiltinAgentConfig.model_validate(yaml.safe_load(path.read_text("utf-8")))
            except (yaml.YAMLError, ValidationError) as exc:
                raise ConfigError(f"invalid chat agent file {path.name}: {exc}") from exc
            if cfg.handle != path.stem:
                raise ConfigError(f"{path.name}: handle '{cfg.handle}' must match the file name")
            prompt = (base_dir / cfg.instructions).resolve()
            if base_dir.resolve() not in prompt.parents or not prompt.is_file():
                raise ConfigError(f"{path.name}: prompt file missing or outside backend/")
            text = prompt.read_text("utf-8").strip()
            if not 0 < len(text) <= INSTRUCTIONS_MAX:
                raise ConfigError(f"{path.name}: prompt must be 1..{INSTRUCTIONS_MAX} chars")
            builtins[cfg.handle] = AgentSpec(
                handle=cfg.handle, kind="builtin", description=cfg.description,
                instructions=text, guardrails=cfg.guardrails,
                knowledge=frozenset(cfg.knowledge), version=cfg.version)
        if not builtins:
            raise ConfigError(f"no chat agents found in {agents_dir}")
        return cls(builtins)

    def builtins(self) -> list[AgentSpec]:
        return [self._builtins[h] for h in sorted(self._builtins)]

    def is_reserved(self, handle: str) -> bool:
        return handle in RESERVED or handle in self._builtins

    async def resolve(self, uow: UnitOfWork, user_id: UUID, handle: str) -> AgentSpec:
        """O(1) for a built-in, one indexed query for a user agent."""
        if handle in self._builtins:
            return self._builtins[handle]
        row = await uow.agents.get_by_handle(user_id, handle)
        if row is None:
            raise AgentNotFound(handle=handle)
        return row.spec()

    async def resolve_speaker(self, uow: UnitOfWork, user_id: UUID, who: Speaker
                              ) -> AgentSpec:
        """The agent that answered a message, by identity, at its current version: a renamed
        agent is still found, and a new agent reusing an old handle never takes over its chats.
        O(1) for a built-in, one indexed query for a user agent."""
        if who.kind == "builtin":
            spec = self._builtins.get(who.key)
            if spec is None:
                raise AgentGone(kind="builtin")
            return spec
        row = await uow.agents.get(user_id, UUID(who.key))
        if row is None:  # archived (deleted) since it answered
            raise AgentGone(kind="user")
        return row.spec()
