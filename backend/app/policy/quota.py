"""QuotaGuard (PLAN-2, B11 #8): daily per-user limits from env. Every attempt counts,
including ones that later fail, so failing requests can't be used to burn LLM calls."""

from uuid import UUID

from app.core.errors import QuotaExceeded
from app.core.logging import get_logger
from app.db.unit_of_work import UnitOfWork

log = get_logger(__name__)


class QuotaGuard:
    def __init__(self, limits: dict[str, int]) -> None:
        self._limits = limits

    async def consume(self, uow: UnitOfWork, user_id: UUID, action: str) -> None:
        """Checks and records one use inside the caller's transaction. O(1) indexed count."""
        limit = self._limits[action]
        await uow.usage.lock(user_id, action)
        used = await uow.usage.count_today(user_id, action)
        if used >= limit:
            log.warning("quota_exceeded", action=action, limit=limit)
            raise QuotaExceeded(action=action, limit=limit)
        await uow.usage.record(user_id, action)
