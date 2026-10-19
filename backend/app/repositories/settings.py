"""SettingsRepository: the only SQL for app.user_settings. Every statement pins user_id."""

from uuid import UUID

from psycopg import AsyncConnection

from app.domain.records import SettingsRow


class SettingsRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def get(self, user_id: UUID) -> SettingsRow | None:
        cur = await self._conn.execute(
            """select display_name, ask_before_save, product_emails
                 from app.user_settings where user_id = %s""",
            (user_id,))
        row = await cur.fetchone()
        return SettingsRow(**row) if row else None

    async def upsert(self, user_id: UUID, settings: SettingsRow) -> SettingsRow:
        """Last write wins: three independent toggles, no merge conflict worth a 409."""
        cur = await self._conn.execute(
            """insert into app.user_settings
                   (user_id, display_name, ask_before_save, product_emails)
               values (%s, %s, %s, %s)
               on conflict (user_id) do update
                  set display_name = excluded.display_name,
                      ask_before_save = excluded.ask_before_save,
                      product_emails = excluded.product_emails
               returning display_name, ask_before_save, product_emails""",
            (user_id, settings.display_name, settings.ask_before_save,
             settings.product_emails))
        return SettingsRow(**await cur.fetchone())
