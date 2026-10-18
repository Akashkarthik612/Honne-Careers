"""FakeProvider: scripted replies for tests. CI never calls a real model (A4 #10)."""

import json
from collections import deque
from collections.abc import Callable
from typing import Any

from app.domain.agents import LlmResult

Reply = str | dict[str, Any] | Exception | Callable[[str], str | dict[str, Any]]


class FakeProvider:
    name = "fake"

    def __init__(self) -> None:
        self._queue: deque[Reply] = deque()
        self.calls: list[dict[str, Any]] = []

    def push(self, *replies: Reply) -> None:
        self._queue.extend(replies)

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
