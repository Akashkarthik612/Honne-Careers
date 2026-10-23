"""AgentStateStore: LangGraph's AsyncPostgresSaver on its own small pool (Adapter, ISP).

The saver needs autocommit connections (it writes outside any transaction we own) and
unqualified table names, so this pool is separate from Database's: autocommit, dict rows,
no prepared statements (pgbouncer-safe, as Database), search_path = agent_state. It connects
as honne_backend, the only role granted on agent_state (migration 20261024000001); a thread
id is always an assistant message id the app read through UnitOfWork (RLS) first.

The tables come from our migration, never the saver's setup(). open() fails loudly if the
installed saver expects more migrations than the database has: upgrading
langgraph-checkpoint-postgres needs a new migration first.
"""

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from app.core.errors import ConfigError
from app.core.logging import get_logger

log = get_logger(__name__)
SCHEMA = "agent_state"


async def _configure(conn: AsyncConnection) -> None:
    await conn.execute(f"set search_path to {SCHEMA}")  # constant, not input


class AgentStateStore:
    def __init__(self, dsn: str, max_size: int) -> None:
        self._pool = AsyncConnectionPool(
            dsn, min_size=1, max_size=max_size, open=False, configure=_configure,
            kwargs={"autocommit": True, "row_factory": dict_row, "prepare_threshold": None})
        self._saver: AsyncPostgresSaver | None = None

    async def open(self) -> None:
        await self._pool.open(wait=True, timeout=10)
        async with self._pool.connection() as conn:
            cur = await conn.execute("select max(v) as v from checkpoint_migrations")
            row = await cur.fetchone()
        have, need = row["v"] if row else None, len(AsyncPostgresSaver.MIGRATIONS) - 1
        if have != need:
            raise ConfigError(f"{SCHEMA} schema is at migration {have}, the installed "
                              f"langgraph-checkpoint-postgres needs {need}: add a migration")
        self._saver = AsyncPostgresSaver(self._pool)  # needs the running loop
        log.info("agent_state_ready", migration=have)

    async def close(self) -> None:
        await self._pool.close()

    def saver(self) -> AsyncPostgresSaver:
        if self._saver is None:
            raise RuntimeError("AgentStateStore.open() was not called")
        return self._saver
