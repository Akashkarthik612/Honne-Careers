"""QuotaGuard (PLAN-2, B11 #8): per-user limits from config/limits.yaml via a LimitPolicy.
Every attempt counts, including ones that later fail, so failing requests can't be used to
burn LLM calls. Callers name an action; the numbers and plans live in the YAML only."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from app.core.errors import QuotaExceeded
from app.core.logging import get_logger
from app.db.unit_of_work import UnitOfWork
from app.policy.limits import DailyAction, LimitPolicy, PlanLimits, TotalLimit

log = get_logger(__name__)

# What the user reads when a daily limit is hit. No plan or price wording (beta).
_MESSAGES: dict[DailyAction, str] = {
    DailyAction.FULL_TAILOR: "You've used today's {limit} CV tailorings. You can tailor again "
                             "tomorrow.",
    DailyAction.CHAT_START: "You've started today's {limit} AI chats. You can keep going in "
                            "the chats you have, or start a new one tomorrow.",
    DailyAction.CHAT_MESSAGE: "You've reached today's limit of {limit} AI answers. Try again "
                              "tomorrow.",
    DailyAction.BULLET_TAILOR: "You've reached today's limit of {limit} bullet rewrites. Try "
                               "again tomorrow.",
    DailyAction.PDF: "You've built today's {limit} PDFs. Try again tomorrow.",
    DailyAction.ANALYSIS: "You've run today's {limit} analyses. Try again tomorrow.",
    DailyAction.UPLOAD: "You've uploaded today's {limit} CVs. Try again tomorrow.",
}


@dataclass(frozen=True, slots=True)
class UsageItem:
    key: str      # a DailyAction or TotalLimit value
    used: int
    limit: int
    daily: bool
    resets_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class Usage:
    items: list[UsageItem]
    resets_at: datetime  # next UTC midnight: when the daily counts start again


class QuotaGuard:
    def __init__(self, policy: LimitPolicy) -> None:
        self._policy = policy

    async def consume(self, uow: UnitOfWork, user_id: UUID, action: DailyAction) -> None:
        """Checks and records one use inside the caller's transaction. O(1) indexed count."""
        limits = await self._limits(uow, user_id)
        weekly = action in limits.weekly
        limit = limits.weekly[action] if weekly else limits.daily[action]
        await uow.usage.lock(user_id, action)
        used = await uow.usage.count_period(user_id, action, "week" if weekly else "day")
        if used >= limit:
            message = (f"You've used this week's {limit} CV tailorings. The limit resets on Monday."
                       if weekly else _MESSAGES[action].format(limit=limit))
            log.warning("quota_exceeded", action=action.value, limit=limit)
            raise QuotaExceeded(message, action=action.value, limit=limit)
        await uow.usage.record(user_id, action)

    async def total_limit(self, uow: UnitOfWork, user_id: UUID, limit: TotalLimit) -> int:
        """The cap on a never-reset count (the caller counts its own rows, under its lock)."""
        return (await self._limits(uow, user_id)).total[limit]

    async def usage(self, uow: UnitOfWork, user_id: UUID) -> Usage:
        """Current counts and reset dates for the Settings panel."""
        limits = await self._limits(uow, user_id)
        today = await uow.usage.counts_today(user_id)
        totals = {TotalLimit.CUSTOM_AGENTS: await uow.agents.count_active(user_id)}
        items = [UsageItem(a.value, today.get(a.value, 0), n, True)
                 for a, n in limits.daily.items()]
        items += [UsageItem(t.value, totals[t], n, False) for t, n in limits.total.items()]
        midnight = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        next_week = midnight + timedelta(days=7 - midnight.weekday())
        for action, limit in limits.weekly.items():
            used = await uow.usage.count_period(user_id, action, "week")
            items.append(UsageItem(action.value, used, limit, False, next_week))
        return Usage(items, midnight + timedelta(days=1))

    async def _limits(self, uow: UnitOfWork, user_id: UUID) -> PlanLimits:
        plan = await uow.accounts.plan_of(user_id) if self._policy.needs_account_plan else None
        return self._policy.limits_for(plan)
