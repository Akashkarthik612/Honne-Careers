"""LlmProvider: the contract every model adapter follows (Adapter pattern, DIP/LSP).

Providers only transport: they send text + a JSON schema and return raw JSON text.
They classify failures as transient (worth a retry) or permanent. They never retry
themselves; AgentRunner owns the bounded retry policy (guardrails §3).
"""

from typing import Any, Protocol

from app.domain.agents import LlmResult


class LlmTransientError(Exception):
    """429, 5xx, timeout, connection reset. AgentRunner may retry."""


class LlmPermanentError(Exception):
    """Bad request, auth, safety block, empty reply. Never retried."""


class LlmProvider(Protocol):
    name: str

    async def generate(self, *, system: str, user: str, schema: dict[str, Any], model: str,
                       temperature: float, max_output_tokens: int) -> LlmResult: ...
