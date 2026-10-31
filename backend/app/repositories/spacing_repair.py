"""Reads for the one-off spacing repair (scripts/repair_extraction_spacing.py, PROF-2).

Raw JSON on purpose: the repair must see stored rows exactly, and it never writes through
here (profile and resume writes go through their own repositories with row_version checks).
Runs inside a user session, so RLS applies like any request.
"""

from typing import Any
from uuid import UUID

from psycopg import AsyncConnection


class SpacingRepairReads:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def upload(self, user_id: UUID, upload_id: UUID) -> dict[str, Any] | None:
        cur = await self._conn.execute(
            """select id, source_type, storage_path, parsed from app.cv_uploads
                where user_id = %s and id = %s""", (user_id, upload_id))
        return await cur.fetchone()

    async def applications(self, user_id: UUID) -> list[dict[str, Any]]:
        """Every application row, regardless of the retention cut-off: this is an audit of
        what is stored, not a user-facing read."""
        cur = await self._conn.execute(
            "select id, cv_content from app.applications where user_id = %s order by id",
            (user_id,))
        return await cur.fetchall()
