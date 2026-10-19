from uuid import UUID

from psycopg import AsyncConnection

from app.domain.records import JdRow

# Constant column list interpolated into SQL (S608/B608 suppressed); values are bound params.
_COLUMNS = "id, text, word_count, content_hash, company, role"


class JobDescriptionRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def upsert(self, user_id: UUID, text: str, word_count: int, chash: str,
                     company: str | None, role: str | None) -> JdRow:
        """Same JD pasted twice = one row (unique user_id, content_hash)."""
        cur = await self._conn.execute(
            f"""insert into app.job_descriptions
                    (user_id, text, word_count, content_hash, company, role)
                values (%s, %s, %s, %s, %s, %s)
                on conflict (user_id, content_hash) do update
                   set company = coalesce(app.job_descriptions.company, excluded.company),
                       role = coalesce(app.job_descriptions.role, excluded.role)
                returning {_COLUMNS}""",  # noqa: S608  # nosec B608
            (user_id, text, word_count, chash, company, role))
        return JdRow(**await cur.fetchone())

    async def set_meta(self, user_id: UUID, jd_id: UUID, company: str | None,
                       role: str | None) -> JdRow:
        """SAVE-2: the user's correction of company/role (column grant: company, role only)."""
        cur = await self._conn.execute(
            f"""update app.job_descriptions set company = %s, role = %s
                 where user_id = %s and id = %s
             returning {_COLUMNS}""",  # noqa: S608  # nosec B608
            (company, role, user_id, jd_id))
        return JdRow(**await cur.fetchone())

    async def get(self, user_id: UUID, jd_id: UUID) -> JdRow | None:
        cur = await self._conn.execute(
            f"select {_COLUMNS} from app.job_descriptions where user_id = %s and id = %s",  # noqa: S608  # nosec B608
            (user_id, jd_id))
        row = await cur.fetchone()
        return JdRow(**row) if row else None
