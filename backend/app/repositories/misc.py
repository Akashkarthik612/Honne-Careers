"""Small repositories: uploads, analyses, agent runs, usage events."""

from typing import Any
from uuid import UUID

from psycopg import AsyncConnection
from psycopg.types.json import Jsonb

from app.domain.agents import AgentRunRecord
from app.domain.records import AnalysisRow, UploadRow
from app.domain.tailoring import PrefillCv


class UploadRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def create(self, user_id: UUID, upload_id: UUID, source_type: str, filename: str,
                     storage_path: str, parsed: PrefillCv) -> None:
        await self._conn.execute(
            """insert into app.cv_uploads
                   (id, user_id, source_type, filename, storage_path, parsed)
               values (%s, %s, %s, %s, %s, %s)""",
            (upload_id, user_id, source_type, filename, storage_path,
             Jsonb(parsed.model_dump(mode="json"))))

    async def list_parsed(self, user_id: UUID, limit: int = 5) -> list[UploadRow]:
        cur = await self._conn.execute(
            """select id, source_type, filename, storage_path, parsed from app.cv_uploads
                where user_id = %s order by created_at desc limit %s""",
            (user_id, limit))
        return [_upload(row) for row in await cur.fetchall()]


def _upload(row: dict[str, Any]) -> UploadRow:
    parsed = PrefillCv.model_validate(row["parsed"]) if row["parsed"] else None
    return UploadRow(**{**row, "parsed": parsed})


class AnalysisRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def get_cached(self, user_id: UUID, resume_id: UUID, chash: str, jd_hash: str
                         ) -> AnalysisRow | None:
        cur = await self._conn.execute(
            """select id, keyword_score, experience_score, narrative_score, details
                 from app.cv_analyses
                where user_id = %s and resume_id = %s and content_hash = %s
                  and jd_content_hash = %s""",
            (user_id, resume_id, chash, jd_hash))
        row = await cur.fetchone()
        return AnalysisRow(**row) if row else None

    async def insert(self, user_id: UUID, resume_id: UUID, chash: str, jd_hash: str,
                     keyword: int, experience: int, narrative: int, details: dict[str, Any],
                     agent_run_id: UUID | None) -> AnalysisRow:
        """Concurrent identical requests: the second insert is a no-op and reads the first."""
        cur = await self._conn.execute(
            """insert into app.cv_analyses
                   (user_id, resume_id, content_hash, jd_content_hash, keyword_score,
                    experience_score, narrative_score, details, agent_run_id)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               on conflict (resume_id, content_hash, jd_content_hash) do nothing
               returning id, keyword_score, experience_score, narrative_score, details""",
            (user_id, resume_id, chash, jd_hash, keyword, experience, narrative,
             Jsonb(details), agent_run_id))
        row = await cur.fetchone()
        if row is not None:
            return AnalysisRow(**row)
        existing = await self.get_cached(user_id, resume_id, chash, jd_hash)
        if existing is None:  # conflict without a visible row would mean an RLS bug
            raise RuntimeError("analysis insert conflicted but no row is visible")
        return existing


class AgentRunRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def insert(self, r: AgentRunRecord) -> UUID:
        cur = await self._conn.execute(
            """insert into app.agent_runs
                   (user_id, agent_id, agent_version, provider, model, status, attempts,
                    input_tokens, output_tokens, latency_ms, error_code, entity_id,
                    correlation_id)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               returning id""",
            (r.user_id, r.agent_id, r.agent_version, r.provider, r.model, r.status, r.attempts,
             r.input_tokens, r.output_tokens, r.latency_ms, r.error_code, r.entity_id,
             r.correlation_id))
        return (await cur.fetchone())["id"]


class UsageRepository:
    def __init__(self, conn: AsyncConnection) -> None:
        self._conn = conn

    async def lock(self, user_id: UUID, action: str) -> None:
        """Serialises count+record per (user, action) so parallel requests can't overshoot."""
        await self._conn.execute("select pg_advisory_xact_lock(hashtextextended(%s, 0))",
                                 (f"{user_id}:{action}",))

    async def count_today(self, user_id: UUID, action: str) -> int:
        """Uses the (user_id, action, created_at) index. 'Today' = UTC day."""
        cur = await self._conn.execute(
            """select count(*) as n from app.usage_events
                where user_id = %s and action = %s
                  and created_at >= date_trunc('day', now() at time zone 'utc')
                                    at time zone 'utc'""",
            (user_id, action))
        return (await cur.fetchone())["n"]

    async def record(self, user_id: UUID, action: str) -> None:
        await self._conn.execute(
            "insert into app.usage_events (user_id, action) values (%s, %s)", (user_id, action))
