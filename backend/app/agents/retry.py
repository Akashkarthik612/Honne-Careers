"""RetryingCall: the one bounded retry policy for model calls (B9, approved fallback).

Retry only transient errors (LlmTransientError or a timeout), at most max_retries times,
exponential backoff, each retry logged at WARNING. Permanent errors and the last failure
raise LlmUnavailable. Used by AgentRunner (one call per run) and ToolLoop (one call per
round of a chat turn).
"""

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from uuid import UUID

from app.agents.providers.base import LlmPermanentError, LlmTransientError
from app.core.errors import LlmUnavailable
from app.core.logging import get_logger

log = get_logger(__name__)


@dataclass
class Attempts:
    """Counts model calls across retries, so the run record is right even when it fails."""
    n: int = 0


class RetryingCall:
    def __init__(self, backoff_base_s: float) -> None:
        self._backoff_base_s = backoff_base_s

    async def __call__[T](self, fn: Callable[[], Awaitable[T]], *, timeout_s: float,
                          max_retries: int, attempts: Attempts, agent: str,
                          entity_id: UUID | None) -> T:
        tries = 0
        while True:
            tries += 1
            attempts.n += 1
            try:
                async with asyncio.timeout(timeout_s):
                    return await fn()
            except (LlmTransientError, TimeoutError) as exc:
                if tries > max_retries:
                    log.error("agent_call_failed", agent=agent, attempts=tries,
                              cause=str(exc) or type(exc).__name__, entity_id=entity_id)
                    raise LlmUnavailable from exc
                delay = self._backoff_base_s * 2 ** (tries - 1)
                log.warning("agent_call_retry", agent=agent, attempt=tries, delay_s=delay,
                            cause=str(exc) or type(exc).__name__, entity_id=entity_id)
                await asyncio.sleep(delay)
            except LlmPermanentError as exc:
                log.error("agent_call_rejected", agent=agent, cause=str(exc),
                          entity_id=entity_id)
                raise LlmUnavailable from exc
