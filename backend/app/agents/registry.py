"""AgentRegistry, ModelResolver, ProviderFactory (Day_1 B3).

Adding an agent = adding a YAML + prompt file (OCP). Adding a provider = one adapter
class + one factory entry + an env change; agent files don't change.
Any bad config stops the app at startup (ConfigError), never at request time.
"""

from pathlib import Path

import yaml
from pydantic import BaseModel, ValidationError

from app.agents.providers.base import LlmProvider
from app.core.errors import ConfigError
from app.domain.agents import AgentConfig, ModelSpec
from app.domain.analysis import AnalysisJudgment, AnalystInput
from app.domain.tailoring import (
    BulletTailorInput,
    BulletTailorOutput,
    ParsedCv,
    ParserInput,
    TailorInput,
    TailorOutput,
)

# Schema names a YAML may reference. Explicit allowlist: config can't import arbitrary code.
SCHEMAS: dict[str, type[BaseModel]] = {
    cls.__name__: cls
    for cls in (TailorInput, TailorOutput, BulletTailorInput, BulletTailorOutput,
                ParserInput, ParsedCv, AnalystInput, AnalysisJudgment)
}


class LoadedAgent:
    """An AgentConfig with its prompt text and schema classes resolved."""

    def __init__(self, config: AgentConfig, instructions: str,
                 input_model: type[BaseModel], output_model: type[BaseModel]) -> None:
        self.config = config
        self.instructions = instructions
        self.input_model = input_model
        self.output_model = output_model
        self.output_json_schema = output_model.model_json_schema()


class AgentRegistry:
    def __init__(self, agents: dict[str, LoadedAgent]) -> None:
        self._agents = agents

    @classmethod
    def load(cls, agents_dir: Path, base_dir: Path) -> "AgentRegistry":
        agents: dict[str, LoadedAgent] = {}
        for path in sorted(agents_dir.glob("*.yaml")):
            try:
                config = AgentConfig.model_validate(yaml.safe_load(path.read_text("utf-8")))
            except (yaml.YAMLError, ValidationError) as exc:
                raise ConfigError(f"invalid agent file {path.name}: {exc}") from exc
            if config.id != path.stem:
                raise ConfigError(f"{path.name}: id '{config.id}' must match the file name")
            prompt_path = (base_dir / config.instructions).resolve()
            if base_dir.resolve() not in prompt_path.parents or not prompt_path.is_file():
                raise ConfigError(f"{path.name}: prompt file missing or outside backend/")
            for name in (config.input_schema, config.output_schema):
                if name not in SCHEMAS:
                    raise ConfigError(f"{path.name}: unknown schema '{name}'")
            agents[config.id] = LoadedAgent(config, prompt_path.read_text("utf-8"),
                                            SCHEMAS[config.input_schema],
                                            SCHEMAS[config.output_schema])
        if not agents:
            raise ConfigError(f"no agents found in {agents_dir}")
        return cls(agents)

    def get(self, agent_id: str) -> LoadedAgent:
        try:
            return self._agents[agent_id]
        except KeyError as exc:
            raise ConfigError(f"unknown agent '{agent_id}'") from exc

    def ids(self) -> list[str]:
        return sorted(self._agents)


class ModelResolver:
    """tier -> ModelSpec, from env (LLM_STRONG / LLM_LIGHT = 'provider:model_id')."""

    def __init__(self, tiers: dict[str, str]) -> None:
        self._specs: dict[str, ModelSpec] = {}
        for tier, value in tiers.items():
            provider, _, model_id = value.partition(":")
            if not provider or not model_id:
                raise ConfigError(f"LLM tier '{tier}' must be 'provider:model_id'")
            self._specs[tier] = ModelSpec(provider=provider, model_id=model_id)

    def resolve(self, tier: str) -> ModelSpec:
        try:
            return self._specs[tier]
        except KeyError as exc:
            raise ConfigError(f"no model configured for tier '{tier}'") from exc

    def providers(self) -> set[str]:
        return {spec.provider for spec in self._specs.values()}


class ProviderFactory:
    def __init__(self, providers: dict[str, LlmProvider]) -> None:
        self._providers = providers

    def get(self, name: str) -> LlmProvider:
        try:
            return self._providers[name]
        except KeyError as exc:
            raise ConfigError(f"no adapter for provider '{name}'") from exc
