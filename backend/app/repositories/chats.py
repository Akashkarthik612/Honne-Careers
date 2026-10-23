"""ChatRepository: the only SQL for app.chats and app.chat_messages. Every statement pins
user_id; every user-facing read also takes the retention cut-off (chats.created_at), so a chat
past it is hidden at once and deleted by the daily clean-up.

An assistant message is the background job of one turn: inserted 'running', given steps as
tools run, then finished ('ok') or failed. Each transition only applies to a running message,
so a job that lost a race (stale, retried, chat deleted) can't overwrite a newer state.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from app.domain.chat_agents import AgentKind, ChatMessageRow, ChatRow, MessageRole

# Constant column lists interpolated into SQL (S608/B608 suppressed); values are bound params.
_MESSAGE = """id, chat_id, seq, role, status, content, agent_handle, agent_kind, sources, drafts,
              steps, error_code, started_at, finished_at, created_at,
              (select v.agent_id from app.chat_agent_versions v
                where v.user_id = chat_messages.user_id and v.id = chat_messages.agent_version_id
              ) as agent_id"""
_CHAT = "c.id, c.title, c.turn_count, c.last_message_at, c.created_at"


class ChatRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    # ---------- chats ----------

    async def create(self, user_id: UUID, title: str) -> ChatRow:
        cur = await self._conn.execute(
            f"""insert into app.chats as c (user_id, title) values (%s, %s)
                returning {_CHAT}""",  # noqa: S608  # nosec B608
            (user_id, title))
        return ChatRow(**await cur.fetchone())

    async def get(self, user_id: UUID, chat_id: UUID, cutoff: datetime, *,
                  for_update: bool = False) -> ChatRow | None:
        lock = " for update" if for_update else ""
        cur = await self._conn.execute(
            f"""select {_CHAT} from app.chats c
                 where c.user_id = %s and c.id = %s and c.created_at >= %s{lock}""",  # noqa: S608  # nosec B608
            (user_id, chat_id, cutoff))
        row = await cur.fetchone()
        return ChatRow(**row) if row else None

    async def list_recent(self, user_id: UUID, cutoff: datetime, limit: int) -> list[ChatRow]:
        """Newest first, with a running flag for the sidebar spinner. Uses
        (user_id, last_message_at desc) and the one-running partial index."""
        cur = await self._conn.execute(
            f"""select {_CHAT},
                       exists (select 1 from app.chat_messages m
                                where m.chat_id = c.id and m.status = 'running') as running
                  from app.chats c
                 where c.user_id = %s and c.created_at >= %s
                 order by c.last_message_at desc
                 limit %s""",  # noqa: S608  # nosec B608
            (user_id, cutoff, limit))
        return [ChatRow(**row) for row in await cur.fetchall()]

    async def touch(self, user_id: UUID, chat_id: UUID, *, new_turn: bool) -> None:
        await self._conn.execute(
            """update app.chats
                  set last_message_at = now(),
                      turn_count = turn_count + case when %s then 1 else 0 end
                where user_id = %s and id = %s""",
            (new_turn, user_id, chat_id))

    async def delete(self, user_id: UUID, chat_id: UUID) -> bool:
        cur = await self._conn.execute(
            "delete from app.chats where user_id = %s and id = %s returning id",
            (user_id, chat_id))
        return await cur.fetchone() is not None

    # ---------- messages ----------

    async def messages(self, user_id: UUID, chat_id: UUID) -> list[ChatMessageRow]:
        """The whole chat, oldest first. Bounded by CHAT_TURNS_MAX (2 rows per turn)."""
        cur = await self._conn.execute(
            f"""select {_MESSAGE} from app.chat_messages
                 where user_id = %s and chat_id = %s order by seq""",  # noqa: S608  # nosec B608
            (user_id, chat_id))
        return [ChatMessageRow(**row) for row in await cur.fetchall()]

    async def message(self, user_id: UUID, chat_id: UUID, message_id: UUID
                      ) -> ChatMessageRow | None:
        cur = await self._conn.execute(
            f"""select {_MESSAGE} from app.chat_messages
                 where user_id = %s and chat_id = %s and id = %s""",  # noqa: S608  # nosec B608
            (user_id, chat_id, message_id))
        row = await cur.fetchone()
        return ChatMessageRow(**row) if row else None

    async def insert(self, user_id: UUID, chat_id: UUID, role: MessageRole, *,
                     content: str = "", status: str = "ok", agent_handle: str | None = None,
                     agent_kind: AgentKind | None = None, agent_version_id: UUID | None = None,
                     builtin_version: int | None = None) -> ChatMessageRow:
        """Next seq in the chat; the caller holds the chat row lock (for_update), so seq can't
        collide. A second running turn raises UniqueViolation (the service maps it)."""
        cur = await self._conn.execute(
            f"""insert into app.chat_messages
                    (user_id, chat_id, seq, role, status, content, agent_handle, agent_kind,
                     agent_version_id, builtin_version, started_at)
                select %s, %s, coalesce(max(seq), 0) + 1, %s, %s, %s, %s, %s, %s, %s,
                       case when %s = 'running' then now() end
                  from app.chat_messages where user_id = %s and chat_id = %s
                returning {_MESSAGE}""",  # noqa: S608  # nosec B608
            (user_id, chat_id, role, status, content, agent_handle, agent_kind,
             agent_version_id, builtin_version, status, user_id, chat_id))
        return ChatMessageRow(**await cur.fetchone())

    async def restart(self, user_id: UUID, message_id: UUID, *,
                      steps: list[dict[str, Any]] | None = None) -> bool:
        """Retry: a failed assistant message runs again in place. `steps` = the steps of the
        checkpoint a resumed run continues from (a fresh run starts with none)."""
        cur = await self._conn.execute(
            """update app.chat_messages
                  set status = 'running', error_code = null, steps = %s, content = '',
                      sources = '[]', drafts = '[]', started_at = now(), finished_at = null
                where user_id = %s and id = %s and role = 'assistant' and status = 'failed'
            returning id""",
            (Jsonb(steps or []), user_id, message_id))
        return await cur.fetchone() is not None

    async def add_step(self, user_id: UUID, message_id: UUID, step: dict[str, Any]) -> bool:
        """Live progress. False = the turn is no longer running (stale or retried)."""
        cur = await self._conn.execute(
            """update app.chat_messages set steps = steps || %s
                where user_id = %s and id = %s and status = 'running' returning id""",
            (Jsonb([step]), user_id, message_id))
        return await cur.fetchone() is not None

    async def finish(self, user_id: UUID, message_id: UUID, content: str,
                     sources: list[dict[str, Any]], drafts: list[dict[str, Any]]) -> bool:
        cur = await self._conn.execute(
            """update app.chat_messages
                  set status = 'ok', content = %s, sources = %s, drafts = %s,
                      finished_at = now()
                where user_id = %s and id = %s and status = 'running' returning id""",
            (content, Jsonb(sources), Jsonb(drafts), user_id, message_id))
        return await cur.fetchone() is not None

    async def fail(self, user_id: UUID, message_id: UUID, code: str) -> bool:
        cur = await self._conn.execute(
            """update app.chat_messages
                  set status = 'failed', error_code = %s, finished_at = now()
                where user_id = %s and id = %s and status = 'running' returning id""",
            (code, user_id, message_id))
        return await cur.fetchone() is not None

    async def mark_stale(self, user_id: UUID, chat_id: UUID, timeout_s: int) -> int:
        """B9 for chat turns: a turn running longer than any live job could (Render restart or
        sleep killed it) becomes failed/stale_job, so the UI offers Retry."""
        cur = await self._conn.execute(
            """update app.chat_messages
                  set status = 'failed', error_code = 'stale_job', finished_at = now()
                where user_id = %s and chat_id = %s and status = 'running'
                  and started_at < now() - make_interval(secs => %s)
            returning id""",
            (user_id, chat_id, timeout_s))
        return len(await cur.fetchall())
