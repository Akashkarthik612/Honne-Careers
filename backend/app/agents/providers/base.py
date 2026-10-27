"""LlmProvider: the contract every model adapter follows (Adapter pattern, DIP/LSP).

Providers only transport: they send text + a JSON schema and return raw JSON text.
They classify failures as transient (worth a retry) or permanent. They never retry
themselves; AgentRunner owns the bounded retry policy (guardrails §3).
"""

from typing import Any, Protocol

from app.domain.agents import LlmMessage, LlmResult, ToolDecl, ToolTurn


class LlmTransientError(Exception):
    """429, 5xx, timeout, connection reset. AgentRunner may retry."""


class LlmPermanentError(Exception):
    """Bad request, auth, safety block, empty reply. Never retried."""


class LlmProvider(Protocol):
    name: str

    async def generate(self, *, system: str, user: str, schema: dict[str, Any], model: str,
                       temperature: float, max_output_tokens: int) -> LlmResult: ...

    async def generate_with_tools(self, *, system: str, messages: list[LlmMessage],
                                  tools: list[ToolDecl], model: str, temperature: float,
                                  max_output_tokens: int, thinking_budget: int) -> ToolTurn:
        """One function-calling round (Day 3 chat agents). The model must call a tool
        (mode ANY); a plain-text reply comes back as ToolTurn.text and is TurnGraph's call.
        max_output_tokens caps the writing and thinking_budget the thinking, separately."""
        ...

    def raw_to_wire(self, raw: Any) -> Any:
        """ToolTurn.raw -> JSON, so a running turn can be checkpointed."""
        ...

    def raw_from_wire(self, data: Any) -> Any:
        """The inverse of raw_to_wire: what generate_with_tools accepts back as LlmMessage.raw."""
        ...
