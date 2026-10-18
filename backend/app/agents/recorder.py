from uuid import UUID

from app.db.unit_of_work import UnitOfWorkFactory
from app.domain.agents import AgentRunRecord


class DbAgentRunRecorder:
    """Writes agent_runs in its own short transaction, under the run's user (RLS)."""

    def __init__(self, uow: UnitOfWorkFactory) -> None:
        self._uow = uow

    async def record(self, run: AgentRunRecord) -> UUID:
        async with self._uow(run.user_id) as uow:
            return await uow.agent_runs.insert(run)
