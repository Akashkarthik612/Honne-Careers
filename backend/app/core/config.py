"""Settings: read env once at startup; a missing or malformed value stops the app.

No defaults for secrets or endpoints (guardrails §3: fail loudly, no silent fallback).
Limits that Day_1 B11 fixed have defaults equal to the approved values.
"""

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, HttpUrl, PostgresDsn, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", frozen=True)

    env: str = Field(pattern="^(dev|test|prod)$")

    # Database: low-privilege login role that may only SET ROLE authenticated (security §1.4).
    database_url: PostgresDsn
    db_pool_min: int = Field(default=1, ge=1)
    db_pool_max: int = Field(default=5, ge=1, le=20)

    # Supabase
    supabase_url: HttpUrl
    supabase_anon_key: SecretStr
    # Used only by AccountService to delete the auth user (AUTH-3). Never on a request path.
    supabase_service_role_key: SecretStr
    jwt_audience: str = "authenticated"
    jwks_cache_ttl_s: int = Field(default=600, ge=60)
    jwt_leeway_s: int = Field(default=30, ge=0, le=120)
    storage_bucket: str = "cv-files"
    signed_url_ttl_s: int = Field(default=300, ge=30, le=3600)

    # HTTP
    cors_origins: Annotated[list[str], NoDecode]
    max_request_bytes: int = Field(default=6 * 1024 * 1024, ge=1024)

    # LLM: tier -> "provider:model_id" (Day_1 B3). Agent files never name a model.
    llm_strong: str = Field(pattern=r"^[a-z]+:.+$")
    llm_light: str = Field(pattern=r"^[a-z]+:.+$")
    gemini_api_key: SecretStr
    llm_backoff_base_s: float = Field(default=1.0, gt=0)

    # LangSmith tracing (metadata only, app/agents/tracing.py). Off unless asked for.
    langsmith_tracing: bool = False
    langsmith_api_key: SecretStr | None = None
    langsmith_project: str = Field(default="honne-careers-dev", min_length=1)
    langsmith_endpoint: str | None = None  # None = LangSmith's default (US) endpoint

    # PDF (B11 #6)
    tectonic_bin: str = "tectonic"
    latex_timeout_s: int = Field(default=20, ge=5, le=120)
    latex_max_concurrent: int = Field(default=1, ge=1, le=4)
    latex_max_waiting: int = Field(default=5, ge=0, le=50)       # plan §1.5b
    latex_queue_wait_s: float = Field(default=30, gt=0, le=120)
    # Address-space cap for the child (RLIMIT_AS). Virtual, so above real RSS; measure.
    latex_memory_mb: int = Field(default=1536, ge=256)
    tectonic_cache_dir: str | None = None  # baked package cache in the image

    # Uploads (B11 #9)
    upload_max_bytes: int = Field(default=5 * 1024 * 1024, ge=1024)
    upload_max_pages: int = Field(default=4, ge=1)
    docx_max_uncompressed_bytes: int = Field(default=20 * 1024 * 1024, ge=1024)
    parse_timeout_s: int = Field(default=15, ge=1)

    # Tailor job (B9: stale job)
    tailor_job_timeout_s: int = Field(default=180, ge=30)

    # Entitlements (PLAN-1). Usage limits per plan live in the limits file, not env.
    beta_free_tailoring: bool = True
    limits_file: Path = BACKEND_DIR / "config" / "limits.yaml"

    # Custom agents + chat (Day 3). Text lengths are fixed by the DB checks, not here.
    chat_turns_max: int = Field(default=25, ge=2, le=100)              # 50 messages
    chat_long_warn_turns: int = Field(default=20, ge=1, le=100)        # "getting long" banner
    chat_history_turns: int = Field(default=25, ge=1, le=50)           # turns sent: whole chat
    agent_state_pool_max: int = Field(default=4, ge=1, le=32)          # AgentStateStore
    chat_list_max: int = Field(default=50, ge=1, le=500)
    chat_concurrent_turns_max: int = Field(default=4, ge=1, le=32)     # per process
    agent_tool_rounds_max: int = Field(default=4, ge=1, le=10)
    agent_tool_calls_max: int = Field(default=6, ge=1, le=20)
    agent_tool_timeout_s: int = Field(default=10, ge=1, le=60)
    agent_tool_text_max_chars: int = Field(default=6000, ge=500, le=50000)
    agent_llm_timeout_s: int = Field(default=30, ge=5, le=120)         # per model call
    agent_llm_max_retries: int = Field(default=1, ge=0, le=5)
    agent_temperature: float = Field(default=0.3, ge=0, le=1)
    agent_max_output_tokens: int = Field(default=4096, ge=256, le=32768)

    # Application Database (Day 2 §4). The one place the number of days lives: reads hide
    # older rows at once and the daily clean-up deletes them. Changing it needs no migration.
    application_retention_days: int = Field(default=20, ge=1, le=3650)
    application_list_max: int = Field(default=500, ge=1, le=5000)
    janitor_enabled: bool = True
    janitor_every_h: int = Field(default=24, ge=1)          # one run per day across instances
    janitor_tick_s: int = Field(default=3600, ge=10)        # how often a woken instance checks
    janitor_start_delay_s: int = Field(default=60, ge=0)    # don't slow a cold start
    janitor_batch: int = Field(default=200, ge=1, le=1000)
    janitor_max_batches: int = Field(default=50, ge=1)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [o.strip() for o in value.split(",") if o.strip()]
        return value

    @field_validator("cors_origins")
    @classmethod
    def _no_wildcard(cls, value: list[str]) -> list[str]:
        if not value or "*" in value:
            raise ValueError("CORS_ORIGINS must be an explicit allowlist, never '*'")
        return value

    @model_validator(mode="after")
    def _chat_limits_consistent(self) -> "Settings":
        if self.chat_long_warn_turns > self.chat_turns_max:
            raise ValueError("CHAT_LONG_WARN_TURNS must not exceed CHAT_TURNS_MAX")
        return self

    @model_validator(mode="after")
    def _tracing_needs_key(self) -> "Settings":
        if self.langsmith_tracing and self.langsmith_api_key is None:
            raise ValueError("LANGSMITH_TRACING=true needs LANGSMITH_API_KEY")
        return self

    @property
    def chat_turn_timeout_s(self) -> int:
        """A running turn older than this is dead (Render restart/sleep): marked failed on
        read, like the tailor job's stale_job (B9). Worst case: every round uses every retry
        with its backoff sleeps, every tool call hits its timeout, plus 60s for step writes."""
        retries = self.agent_llm_max_retries
        backoff = self.llm_backoff_base_s * (2 ** retries - 1)
        per_call = self.agent_llm_timeout_s * (retries + 1) + backoff
        tools = self.agent_tool_calls_max * self.agent_tool_timeout_s
        return int((self.agent_tool_rounds_max + 1) * per_call + tools + 60)

    @property
    def jwt_issuer(self) -> str:
        return f"{str(self.supabase_url).rstrip('/')}/auth/v1"

    @property
    def jwks_url(self) -> str:
        return f"{self.jwt_issuer}/.well-known/jwks.json"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from env
