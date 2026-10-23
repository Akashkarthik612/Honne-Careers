from uuid import UUID

from psycopg import AsyncConnection

from app.domain.records import AccountRow


class AccountRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def ensure(self, user_id: UUID) -> None:
        """Creates the account row on first request (B1). Idempotent."""
        await self._conn.execute(
            "insert into app.user_accounts (user_id) values (%s) on conflict do nothing",
            (user_id,))

    async def plan_of(self, user_id: UUID) -> str | None:
        """The account's plan (limits per plan). One primary-key read."""
        cur = await self._conn.execute(
            "select plan from app.user_accounts where user_id = %s", (user_id,))
        row = await cur.fetchone()
        return row["plan"] if row else None

    async def get(self, user_id: UUID) -> AccountRow | None:
        cur = await self._conn.execute(
            """select a.user_id, a.plan,
                      exists (select 1 from app.personal_profiles p
                              where p.user_id = a.user_id) as has_profile
                 from app.user_accounts a
                where a.user_id = %s""",
            (user_id,))
        row = await cur.fetchone()
        return AccountRow(**row) if row else None
