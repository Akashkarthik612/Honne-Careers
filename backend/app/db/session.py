"""UserScopedSession: one transaction per unit of work, with RLS bound to one user.

`SET LOCAL` scopes the role and claims to the transaction, so a pooled connection
never carries one user's identity into the next request (security §1.4).
The login role (honne_backend) owns nothing; without the role switch every query
fails with "permission denied".
"""

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from app.core.logging import get_logger

log = get_logger(__name__)

SET_ROLE_SQL = "set local role authenticated"
SET_CLAIMS_SQL = "select set_config('request.jwt.claims', %s, true)"


def claims_json(user_id: UUID) -> str:
    return json.dumps({"sub": str(user_id), "role": "authenticated"})


class Database:
    """Owns the connection pool. Created once at startup, closed at shutdown."""

    def __init__(self, dsn: str, min_size: int, max_size: int) -> None:
        self._pool = AsyncConnectionPool(
            dsn, min_size=min_size, max_size=max_size, open=False,
            kwargs={"row_factory": dict_row, "prepare_threshold": None},  # pgbouncer-safe
        )

    async def open(self) -> None:
        await self._pool.open(wait=True, timeout=10)

    async def close(self) -> None:
        await self._pool.close()

    @asynccontextmanager
    async def user_session(self, user_id: UUID) -> AsyncIterator[AsyncConnection]:
        """Yields a connection inside a transaction where auth.uid() = user_id.

        Commits on success, rolls back on any exception (which then propagates).
        """
        async with self._pool.connection() as conn, conn.transaction():
            await conn.execute(SET_ROLE_SQL)
            await conn.execute(SET_CLAIMS_SQL, (claims_json(user_id),))
            yield conn

    @asynccontextmanager
    async def maintenance_session(self) -> AsyncIterator[AsyncConnection]:
        """A transaction as honne_backend itself, for the daily clean-up only (Day 2 §4).
        That role owns nothing and has no table grants: all it can do here is call the
        app.janitor_* functions granted to it."""
        async with self._pool.connection() as conn, conn.transaction():
            yield conn

    async def ping(self) -> None:
        async with self._pool.connection() as conn:
            await conn.execute("select 1")
