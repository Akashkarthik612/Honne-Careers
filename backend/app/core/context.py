"""Per-request context carried into every log line (guardrails §4)."""

from contextvars import ContextVar

correlation_id: ContextVar[str | None] = ContextVar("correlation_id", default=None)
user_id: ContextVar[str | None] = ContextVar("user_id", default=None)
