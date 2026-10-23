"""CustomAgentRepository: the only SQL for app.chat_agents and app.chat_agent_versions.
Every statement pins user_id. An agent is read joined with its current version; editing
adds a version row (versions are never updated)."""

from typing import Any
from uuid import UUID

from psycopg import AsyncConnection

from app.domain.chat_agents import CustomAgentIn, CustomAgentRow, Knowledge

# Constant SQL fragments interpolated into queries (S608/B608 suppressed); values are bound.
_COLUMNS = """a.id, a.handle, a.current_version, a.row_version, a.created_at, a.updated_at,
               v.id as version_id, v.description, v.instructions, v.guardrails, v.knowledge"""
_FROM = """from app.chat_agents a
            join app.chat_agent_versions v
              on v.user_id = a.user_id and v.agent_id = a.id and v.version = a.current_version"""
_SELECT = f"select {_COLUMNS} {_FROM}"


def _row(row: dict[str, Any]) -> CustomAgentRow:
    return CustomAgentRow(**{**row, "knowledge": tuple(Knowledge(k) for k in row["knowledge"])})


class CustomAgentRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def lock(self, user_id: UUID) -> None:
        """Serialises count + create per user, so two tabs can't pass the agent cap."""
        await self._conn.execute("select pg_advisory_xact_lock(hashtextextended(%s, 0))",
                                 (f"{user_id}:chat_agents",))

    async def count_active(self, user_id: UUID) -> int:
        cur = await self._conn.execute(
            "select count(*) as n from app.chat_agents where user_id = %s and archived_at is null",
            (user_id,))
        return (await cur.fetchone())["n"]

    async def list_active(self, user_id: UUID) -> list[CustomAgentRow]:
        """With usage for the cards: chats it answered in, last answer. O(agents + messages
        of those agents); both bounded (10 agents, chats deleted after the window)."""
        cur = await self._conn.execute(
            f"""select {_COLUMNS}, s.chat_count, s.last_used_at {_FROM}
                left join lateral (
                  select count(distinct m.chat_id) as chat_count, max(m.created_at) as last_used_at
                    from app.chat_messages m
                    join app.chat_agent_versions u
                      on u.user_id = m.user_id and u.id = m.agent_version_id
                   where m.user_id = a.user_id and u.agent_id = a.id
                ) s on true
               where a.user_id = %s and a.archived_at is null
               order by a.handle""",  # noqa: S608  # nosec B608
            (user_id,))
        return [_row(row) for row in await cur.fetchall()]

    async def get(self, user_id: UUID, agent_id: UUID) -> CustomAgentRow | None:
        cur = await self._conn.execute(
            f"{_SELECT} where a.user_id = %s and a.id = %s and a.archived_at is null",  # noqa: S608  # nosec B608
            (user_id, agent_id))
        row = await cur.fetchone()
        return _row(row) if row else None

    async def get_by_handle(self, user_id: UUID, handle: str) -> CustomAgentRow | None:
        cur = await self._conn.execute(
            f"{_SELECT} where a.user_id = %s and a.handle = %s and a.archived_at is null",  # noqa: S608  # nosec B608
            (user_id, handle))
        row = await cur.fetchone()
        return _row(row) if row else None

    async def create(self, user_id: UUID, data: CustomAgentIn) -> UUID:
        """Raises psycopg UniqueViolation if the handle is in use (the service maps it)."""
        cur = await self._conn.execute(
            "insert into app.chat_agents (user_id, handle) values (%s, %s) returning id",
            (user_id, data.handle))
        agent_id = (await cur.fetchone())["id"]
        await self._insert_version(user_id, agent_id, 1, data)
        return agent_id

    async def add_version(self, user_id: UUID, agent_id: UUID, expected_version: int,
                          data: CustomAgentIn) -> bool:
        """Optimistic concurrency on row_version. False = changed in another tab, or gone."""
        cur = await self._conn.execute(
            """update app.chat_agents
                  set handle = %s, current_version = current_version + 1,
                      row_version = row_version + 1
                where user_id = %s and id = %s and row_version = %s and archived_at is null
            returning current_version""",
            (data.handle, user_id, agent_id, expected_version))
        row = await cur.fetchone()
        if row is None:
            return False
        await self._insert_version(user_id, agent_id, row["current_version"], data)
        return True

    async def archive(self, user_id: UUID, agent_id: UUID) -> bool:
        cur = await self._conn.execute(
            """update app.chat_agents set archived_at = now(), row_version = row_version + 1
                where user_id = %s and id = %s and archived_at is null returning id""",
            (user_id, agent_id))
        return await cur.fetchone() is not None

    async def _insert_version(self, user_id: UUID, agent_id: UUID, version: int,
                              data: CustomAgentIn) -> None:
        await self._conn.execute(
            """insert into app.chat_agent_versions
                   (user_id, agent_id, version, description, instructions, guardrails, knowledge)
               values (%s, %s, %s, %s, %s, %s, %s)""",
            (user_id, agent_id, version, data.description, data.instructions, data.guardrails,
             [k.value for k in data.knowledge]))
