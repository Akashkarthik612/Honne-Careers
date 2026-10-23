"""TurnSlots: per-process cap on chat turns running at once (Day 3, plan §3 #4).

Render's free plan has 0.1 CPU; background turns and a tailor job share it. Over the cap the
request fails loudly with AgentsBusy (429): no queue, no silent wait. One event loop per
process, so a dict is enough (no lock needed between awaits).

A slot is held from the request that starts a turn until the background job ends. If the job
never runs (the client went away before the 202 was sent, so Starlette skipped it), its slot
would leak; slots therefore expire after `ttl_s` (the turn timeout), logged at WARNING.
"""

import itertools
import time
from collections.abc import Callable

from app.core.errors import AgentsBusy
from app.core.logging import get_logger

log = get_logger(__name__)


class TurnSlots:
    def __init__(self, limit: int, ttl_s: float,
                 clock: Callable[[], float] = time.monotonic) -> None:
        self._limit = limit
        self._ttl_s = ttl_s
        self._clock = clock
        self._held: dict[int, float] = {}       # token -> when it was taken
        self._tokens = itertools.count(1)

    def acquire(self) -> int:
        self._expire()
        if len(self._held) >= self._limit:
            log.warning("chat_turns_busy", running=len(self._held), limit=self._limit)
            raise AgentsBusy(limit=self._limit)
        token = next(self._tokens)
        self._held[token] = self._clock()
        return token

    def release(self, token: int) -> None:
        self._held.pop(token, None)

    @property
    def running(self) -> int:
        self._expire()
        return len(self._held)

    def _expire(self) -> None:
        now = self._clock()
        old = [t for t, at in self._held.items() if now - at > self._ttl_s]
        for t in old:
            del self._held[t]
        if old:
            log.warning("chat_turn_slots_expired", count=len(old),
                        fallback="slot freed; the turn itself is marked stale on read")
