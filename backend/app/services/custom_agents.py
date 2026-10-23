"""CustomAgentService: the user's own agents (Day 3: CUST-1, CUST-3, CUST-4).

Create checks the cap under a per-user lock; edit adds a version (old chats keep the one
that answered them) with optimistic concurrency; delete archives. Try it runs an unsaved
agent once through the same runner, saves no chat rows, and counts against the daily quota
like any message. Logs carry ids and counts, never instructions or guardrails.
"""

from uuid import UUID

import psycopg

from app.agents.chat.catalog import AgentCatalog
from app.agents.chat.runner import ChatAgentRunner
from app.core.errors import (
    AgentLimitReached,
    AgentNotFound,
    HandleReserved,
    HandleTaken,
    StaleVersion,
)
from app.core.logging import get_logger
from app.db.unit_of_work import UnitOfWorkFactory
from app.domain.auth import AuthUser
from app.domain.chat_agents import AgentSpec, CustomAgentIn, CustomAgentRow, StepRecord, TurnResult
from app.policy.limits import DailyAction, TotalLimit
from app.policy.quota import QuotaGuard
from app.policy.slots import TurnSlots

log = get_logger(__name__)


class CustomAgentService:
    def __init__(self, uow: UnitOfWorkFactory, catalog: AgentCatalog, runner: ChatAgentRunner,
                 quota: QuotaGuard, slots: TurnSlots) -> None:
        self._uow = uow
        self._catalog = catalog
        self._runner = runner
        self._quota = quota
        self._slots = slots

    @property
    def catalog(self) -> AgentCatalog:
        return self._catalog

    async def list(self, user: AuthUser) -> tuple[list[CustomAgentRow], int]:
        """The user's active agents and how many they may have (CUST-4, limits.yaml)."""
        async with self._uow(user.id) as uow:
            rows = await uow.agents.list_active(user.id)
            limit = await self._quota.total_limit(uow, user.id, TotalLimit.CUSTOM_AGENTS)
        return rows, limit

    async def get(self, user: AuthUser, agent_id: UUID) -> CustomAgentRow:
        async with self._uow(user.id) as uow:
            row = await uow.agents.get(user.id, agent_id)
        if row is None:
            raise AgentNotFound(reason="agent")
        return row

    async def create(self, user: AuthUser, data: CustomAgentIn) -> CustomAgentRow:
        self._check_handle(data.handle)
        try:
            async with self._uow(user.id) as uow:
                await uow.agents.lock(user.id)
                limit = await self._quota.total_limit(uow, user.id, TotalLimit.CUSTOM_AGENTS)
                if await uow.agents.count_active(user.id) >= limit:
                    log.warning("agent_limit_reached", limit=limit)
                    raise AgentLimitReached(limit=limit)
                agent_id = await uow.agents.create(user.id, data)
                row = await uow.agents.get(user.id, agent_id)
        except psycopg.errors.UniqueViolation as exc:  # partial unique (user_id, handle)
            raise HandleTaken(field="handle") from exc
        if row is None:  # just inserted under RLS: invisible would be a policy bug
            raise RuntimeError("created agent is not visible")
        log.info("agent_created", agent_id=agent_id, knowledge=[k.value for k in data.knowledge])
        return row

    async def update(self, user: AuthUser, agent_id: UUID, expected_version: int,
                     data: CustomAgentIn) -> CustomAgentRow:
        """A new version row; the agent's chats keep the versions that answered them."""
        self._check_handle(data.handle)
        try:
            async with self._uow(user.id) as uow:
                if not await uow.agents.add_version(user.id, agent_id, expected_version, data):
                    if await uow.agents.get(user.id, agent_id) is None:
                        raise AgentNotFound(reason="agent")
                    raise StaleVersion(agent_id=str(agent_id))
                row = await uow.agents.get(user.id, agent_id)
        except psycopg.errors.UniqueViolation as exc:
            raise HandleTaken(field="handle") from exc
        if row is None:
            raise RuntimeError("updated agent is not visible")
        log.info("agent_updated", agent_id=agent_id, version=row.current_version)
        return row

    async def delete(self, user: AuthUser, agent_id: UUID) -> None:
        async with self._uow(user.id) as uow:
            if not await uow.agents.archive(user.id, agent_id):
                raise AgentNotFound(reason="agent")
        log.info("agent_archived", agent_id=agent_id)

    async def preview(self, user: AuthUser, data: CustomAgentIn, message: str) -> TurnResult:
        """CUST-3: try an agent before saving it. Nothing is persisted except the quota use
        and the agent_runs audit row."""
        spec = AgentSpec(handle=data.handle, kind="user", description=data.description,
                         instructions=data.instructions, guardrails=data.guardrails,
                         knowledge=frozenset(data.knowledge), version=0)
        slot = self._slots.acquire()
        try:
            async with self._uow(user.id) as uow:
                # Each Try it message counts as a new chat too, so it isn't a way around the
                # daily chat limit (PLAN-2).
                await self._quota.consume(uow, user.id, DailyAction.CHAT_START)
                await self._quota.consume(uow, user.id, DailyAction.CHAT_MESSAGE)
            return await self._runner.answer(user, spec, [], message, entity_id=None,
                                             on_step=_ignore_step)
        finally:
            self._slots.release(slot)

    def _check_handle(self, handle: str) -> None:
        if self._catalog.is_reserved(handle):
            raise HandleReserved(field="handle")


async def _ignore_step(step: StepRecord) -> None:
    """Try it answers in one response; steps come back with the answer, not live."""
