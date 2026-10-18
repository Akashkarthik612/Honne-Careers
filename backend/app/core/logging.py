"""Structured JSON logs with correlation id and user id on every line.

Never pass CV/JD text, tokens or keys as log fields. `_redact` is a last line of
defence for field names that look sensitive, not a licence to log content.
"""

import logging
import sys
from typing import Any

import structlog

from app.core import context

_SENSITIVE_KEYS = frozenset(
    {"authorization", "token", "access_token", "jwt", "password", "api_key", "secret",
     "jd_text", "text", "content", "cv", "prompt", "tex"}
)


def _add_context(_: Any, __: str, event: dict[str, Any]) -> dict[str, Any]:
    event.setdefault("correlation_id", context.correlation_id.get())
    event.setdefault("user_id", context.user_id.get())
    return event


def _redact(_: Any, __: str, event: dict[str, Any]) -> dict[str, Any]:
    for key in list(event):
        if key.lower() in _SENSITIVE_KEYS:
            event[key] = "[redacted]"
    return event


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=level)
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            _add_context,
            _redact,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(level)),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
