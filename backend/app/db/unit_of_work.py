"""UnitOfWork: one RLS-scoped transaction exposing every repository.

Services ask the factory for a unit of work, do their DB work, and leave the block
before any slow call (LLM, LaTeX, storage), so no transaction is held open while
waiting on the network.
"""

from collections.abc import AsyncIterator
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from typing import Protocol
from uuid import UUID

from psycopg import AsyncConnection

from app.db.session import Database
from app.repositories.accounts import AccountRepository
from app.repositories.applications import ApplicationRepository
from app.repositories.chat_agents import CustomAgentRepository
from app.repositories.chats import ChatRepository
from app.repositories.job_descriptions import JobDescriptionRepository
from app.repositories.misc import (
    AgentRunRepository,
    AnalysisRepository,
    UploadRepository,
    UsageRepository,
)
from app.repositories.profiles import ProfileRepository
from app.repositories.resumes import ResumeRepository
from app.repositories.settings import SettingsRepository


class UnitOfWork:
    def __init__(self, conn: AsyncConnection) -> None:
        self.accounts = AccountRepository(conn)
        self.profiles = ProfileRepository(conn)
        self.resumes = ResumeRepository(conn)
        self.jds = JobDescriptionRepository(conn)
        self.uploads = UploadRepository(conn)
        self.analyses = AnalysisRepository(conn)
        self.agent_runs = AgentRunRepository(conn)
        self.usage = UsageRepository(conn)
        self.settings = SettingsRepository(conn)
        self.applications = ApplicationRepository(conn)
        self.agents = CustomAgentRepository(conn)
        self.chats = ChatRepository(conn)


class UnitOfWorkFactory(Protocol):
    def __call__(self, user_id: UUID) -> AbstractAsyncContextManager[UnitOfWork]: ...


def make_uow_factory(db: Database) -> UnitOfWorkFactory:
    @asynccontextmanager
    async def factory(user_id: UUID) -> AsyncIterator[UnitOfWork]:
        async with db.user_session(user_id) as conn:
            yield UnitOfWork(conn)

    return factory
