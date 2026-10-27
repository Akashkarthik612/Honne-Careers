"""FakeProvider: scripted replies for tests. CI never calls a real model (A4 #10)."""

import json
from collections import deque
from collections.abc import Callable
from typing import Any

from app.domain.agents import LlmMessage, LlmResult, ToolCall, ToolDecl, ToolTurn

Reply = str | dict[str, Any] | Exception | Callable[[str], str | dict[str, Any]]
# A scripted function-calling round: tool calls as (name, args), plain text (the model
# ignoring mode ANY), an exception, or a callable that sees the messages sent so far.
TurnReply = (list[tuple[str, dict[str, Any]]] | str | Exception
             | Callable[[list[LlmMessage]], "TurnReply"])


class FakeProvider:
    name = "fake"

    def __init__(self) -> None:
        self._queue: deque[Reply] = deque()
        self._turns: deque[TurnReply] = deque()
        self.calls: list[dict[str, Any]] = []
        self.tool_calls: list[dict[str, Any]] = []  # one entry per generate_with_tools call

    def push(self, *replies: Reply) -> None:
        self._queue.extend(replies)

    def push_turn(self, *turns: TurnReply) -> None:
        self._turns.extend(turns)

    async def generate(self, *, system: str, user: str, schema: dict[str, Any], model: str,
                       temperature: float, max_output_tokens: int) -> LlmResult:
        self.calls.append({"system": system, "user": user, "model": model})
        if not self._queue:
            raise AssertionError("FakeProvider: no scripted reply left")
        reply = self._queue.popleft()
        if isinstance(reply, Exception):
            raise reply
        if callable(reply):
            reply = reply(user)
        text = reply if isinstance(reply, str) else json.dumps(reply)
        return LlmResult(text=text, input_tokens=len(user) // 4, output_tokens=len(text) // 4)

    async def generate_with_tools(self, *, system: str, messages: list[LlmMessage],
                                  tools: list[ToolDecl], model: str, temperature: float,
                                  max_output_tokens: int, thinking_budget: int) -> ToolTurn:
        self.tool_calls.append({"system": system, "messages": list(messages), "model": model,
                                "max_output_tokens": max_output_tokens,
                                "thinking_budget": thinking_budget,
                                "tools": [t.name for t in tools],
                                "declared": [{"name": t.name, "parameters": t.parameters}
                                             for t in tools]})
        if not self._turns:
            raise AssertionError("FakeProvider: no scripted tool turn left")
        reply = self._turns.popleft()
        while callable(reply) and not isinstance(reply, Exception):
            reply = reply(list(messages))
        if isinstance(reply, Exception):
            raise reply
        size = sum(len(str(m.text or m.tool_results or m.tool_calls)) for m in messages)
        if isinstance(reply, str):
            return ToolTurn(tool_calls=(), text=reply, input_tokens=size // 4,
                            output_tokens=len(reply) // 4)
        calls = tuple(ToolCall(id=f"call-{len(self.tool_calls)}-{i}", name=name, args=args)
                      for i, (name, args) in enumerate(reply))
        return ToolTurn(tool_calls=calls, text=None, input_tokens=size // 4,
                        output_tokens=len(json.dumps(reply)) // 4)

    def raw_to_wire(self, raw: Any) -> Any:
        return raw  # scripted turns carry plain JSON (or nothing) as raw

    def raw_from_wire(self, data: Any) -> Any:
        return data
