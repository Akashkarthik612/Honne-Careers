"""Usage limits per plan (PLAN-1, PLAN-2, CUST-4), read from config/limits.yaml.

The numbers live only in that file. Code asks a LimitPolicy for a plan's limits, so new
plans are YAML blocks (OCP) and services depend on the port, not the file (DIP).
Any bad value stops the app at startup (ConfigError), never at request time.
"""

from enum import StrEnum
from pathlib import Path
from typing import Annotated, Protocol

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from app.core.errors import ConfigError


class DailyAction(StrEnum):
    """Counted per user per UTC day in app.usage_events (same values as its check)."""
    FULL_TAILOR = "full_tailor"
    BULLET_TAILOR = "bullet_tailor"
    PDF = "pdf"
    ANALYSIS = "analysis"
    UPLOAD = "upload"
    CHAT_START = "chat_start"
    CHAT_MESSAGE = "chat_message"


class TotalLimit(StrEnum):
    """Counted from live rows; never reset."""
    CUSTOM_AGENTS = "custom_agents"


Count = Annotated[int, Field(ge=0)]
# user_accounts.plan values (DB check). With use_account_plan, each needs a block.
ACCOUNT_PLANS = frozenset({"free", "plus", "pro", "pro_plus"})


class _Frozen(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class PlanLimits(_Frozen):
    daily: dict[DailyAction, Count]
    total: dict[TotalLimit, Count]

    @model_validator(mode="after")
    def _complete(self) -> "PlanLimits":
        missing = ([a.value for a in DailyAction if a not in self.daily]
                   + [t.value for t in TotalLimit if t not in self.total])
        if missing:
            raise ValueError(f"missing limits: {', '.join(missing)}")
        return self


class LimitsConfig(_Frozen):
    version: int = Field(ge=1)
    default_plan: str
    use_account_plan: bool
    plans: dict[str, PlanLimits] = Field(min_length=1)

    @model_validator(mode="after")
    def _plans_exist(self) -> "LimitsConfig":
        if self.default_plan not in self.plans:
            raise ValueError(f"default_plan '{self.default_plan}' has no block under plans")
        missing = ACCOUNT_PLANS - self.plans.keys() if self.use_account_plan else set()
        if missing:
            raise ValueError(f"use_account_plan needs a block for: {', '.join(sorted(missing))}")
        return self

    @classmethod
    def load(cls, path: Path) -> "LimitsConfig":
        try:
            return cls.model_validate(yaml.safe_load(path.read_text("utf-8")))
        except (OSError, yaml.YAMLError, ValidationError) as exc:
            raise ConfigError(f"invalid limits file {path.name}: {exc}") from exc


class LimitPolicy(Protocol):
    @property
    def needs_account_plan(self) -> bool: ...

    def limits_for(self, plan: str | None) -> PlanLimits: ...


class ConfiguredLimitPolicy:
    """Beta: everyone gets default_plan. With use_account_plan, the account's own plan
    (every DB plan has a block, checked at load); anything else raises (no fallback)."""

    def __init__(self, config: LimitsConfig) -> None:
        self._config = config

    @property
    def needs_account_plan(self) -> bool:
        return self._config.use_account_plan

    def limits_for(self, plan: str | None) -> PlanLimits:
        if not self._config.use_account_plan:
            return self._config.plans[self._config.default_plan]
        if plan is None or plan not in self._config.plans:
            raise ConfigError(f"no limits for plan '{plan}' in the limits file")
        return self._config.plans[plan]
