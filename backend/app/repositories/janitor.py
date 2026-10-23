"""JanitorRepository: the daily clean-up's only SQL. Calls the app.janitor_* SECURITY DEFINER
functions (migrations 20261021000001, 20261023000001), which are the one way across tenants
and can only delete rows past the cut-off."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from psycopg import AsyncConnection


@dataclass(frozen=True, slots=True)
class ExpiredRow:
    id: UUID
    user_id: UUID
    pdf_path: str | None


@dataclass(frozen=True, slots=True)
class TrashItem:
    id: UUID
    path: str


class JanitorRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def claim(self, job: str, every: timedelta) -> bool:
        """True for exactly one caller per `every`, across instances and restarts."""
        cur = await self._conn.execute("select app.janitor_claim(%s, %s) as claimed",
                                       (job, every))
        return (await cur.fetchone())["claimed"]

    async def expired(self, cutoff: datetime, limit: int) -> list[ExpiredRow]:
        cur = await self._conn.execute(
            "select id, user_id, pdf_path from app.janitor_expired_applications(%s, %s)",
            (cutoff, limit))
        return [ExpiredRow(**row) for row in await cur.fetchall()]

    async def purge(self, ids: list[UUID], cutoff: datetime) -> tuple[int, int]:
        """Deletes those rows still past the cut-off, then JDs nothing uses. (rows, jds)."""
        cur = await self._conn.execute(
            "select rows_deleted, jds_deleted from app.janitor_purge_applications(%s, %s)",
            (ids, cutoff))
        row = await cur.fetchone()
        return row["rows_deleted"], row["jds_deleted"]

    async def trash(self, limit: int) -> list[TrashItem]:
        cur = await self._conn.execute("select id, path from app.janitor_trash(%s)", (limit,))
        return [TrashItem(**row) for row in await cur.fetchall()]

    async def trash_done(self, ids: list[UUID]) -> int:
        cur = await self._conn.execute("select app.janitor_trash_done(%s) as n", (ids,))
        return (await cur.fetchone())["n"]

    async def purge_agent_state(self, limit: int) -> int:
        """Run state whose message is gone or finished (F5). Up to `limit` threads."""
        cur = await self._conn.execute("select app.janitor_purge_agent_state(%s) as n",
                                       (limit,))
        return (await cur.fetchone())["n"]

    async def purge_chats(self, cutoff: datetime, limit: int) -> int:
        """Day 3: chats created before the cut-off (their messages cascade). Up to `limit`."""
        cur = await self._conn.execute("select app.janitor_purge_chats(%s, %s) as n",
                                       (cutoff, limit))
        return (await cur.fetchone())["n"]
