"""Settings: read env once at startup; a missing or malformed value stops the app.

No defaults for secrets or endpoints (guardrails §3: fail loudly, no silent fallback).
Limits that Day_1 B11 fixed have defaults equal to the approved values.
"""

from functools import lru_cache
from typing import Annotated

from pydantic import Field, HttpUrl, PostgresDsn, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


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

    # Entitlements and quotas (B11 #8, PLAN-1/2)
    beta_free_tailoring: bool = True
    quota_full_tailor_per_day: int = Field(default=20, ge=0)
    quota_bullet_tailor_per_day: int = Field(default=150, ge=0)
    quota_pdf_per_day: int = Field(default=40, ge=0)
    quota_analysis_per_day: int = Field(default=40, ge=0)
    quota_upload_per_day: int = Field(default=20, ge=0)

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

    @property
    def jwt_issuer(self) -> str:
        return f"{str(self.supabase_url).rstrip('/')}/auth/v1"

    @property
    def jwks_url(self) -> str:
        return f"{self.jwt_issuer}/.well-known/jwks.json"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from env
