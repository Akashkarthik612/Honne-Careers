from uuid import UUID

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from app.domain.cv import CvContent
from app.domain.records import ProfileRow


class ProfileRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def get(self, user_id: UUID) -> ProfileRow | None:
        cur = await self._conn.execute(
            """select content, content_hash, row_version, updated_at
                 from app.personal_profiles where user_id = %s""",
            (user_id,))
        row = await cur.fetchone()
        if row is None:
            return None
        return ProfileRow(content=CvContent.model_validate(row["content"]),
                          content_hash=row["content_hash"], row_version=row["row_version"],
                          updated_at=row["updated_at"])

    async def create(self, user_id: UUID, content: CvContent, chash: str) -> int | None:
        """Returns the new version, or None if a profile already exists (caller -> 409)."""
        cur = await self._conn.execute(
            """insert into app.personal_profiles (user_id, content, content_hash)
               values (%s, %s, %s) on conflict (user_id) do nothing
               returning row_version""",
            (user_id, Jsonb(content.model_dump(mode="json")), chash))
        row = await cur.fetchone()
        return row["row_version"] if row else None

    async def update(self, user_id: UUID, content: CvContent, chash: str,
                     expected_version: int) -> int | None:
        """Optimistic concurrency: returns the new version, or None when stale."""
        cur = await self._conn.execute(
            """update app.personal_profiles
                  set content = %s, content_hash = %s, row_version = row_version + 1
                where user_id = %s and row_version = %s
            returning row_version""",
            (Jsonb(content.model_dump(mode="json")), chash, user_id, expected_version))
        row = await cur.fetchone()
        return row["row_version"] if row else None
