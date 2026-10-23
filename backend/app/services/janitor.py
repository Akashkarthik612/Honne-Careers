"""Daily clean-up of the application Database (Day 2 §4, layer 2).

RetentionJanitor deletes, in batches: first PDFs in storage_trash, then rows past the
cut-off (files first, then rows + history + JDs nothing else uses). If a file delete fails,
the batch's rows stay (already hidden from every read) and the next run retries them
(approved fallback B). JanitorLoop runs it at most once per JANITOR_EVERY_H across instances;
on Render's free plan that means "on the first tick after the service wakes".
"""

import asyncio
import contextlib
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import psycopg

from app.core.errors import AppError, StorageFailed
from app.core.logging import get_logger
from app.db.session import Database
from app.domain.applications import PurgeResult, RetentionWindow
from app.repositories.janitor import JanitorRepository
from app.storage.admin import StorageAdmin

log = get_logger(__name__)

JOB = "application_retention"


class RetentionJanitor:
    def __init__(self, db: Database, admin: StorageAdmin, window: RetentionWindow,
                 every: timedelta, batch: int, max_batches: int,
                 now: Callable[[], datetime] = lambda: datetime.now(UTC)) -> None:
        self._db = db
        self._admin = admin
        self._window = window
        self._every = every
        self._batch = batch
        self._max_batches = max_batches
        self._now = now

    async def run_if_due(self) -> PurgeResult | None:
        async with self._db.maintenance_session() as conn:
            claimed = await JanitorRepository(conn).claim(JOB, self._every)
        if not claimed:
            return None
        return await self.run_once()

    async def run_once(self) -> PurgeResult:
        result = PurgeResult()
        cutoff = self._window.cutoff(self._now())
        log.info("janitor_started", retention_days=self._window.days)
        await self._empty_trash(result)
        for batch_no in range(self._max_batches):
            async with self._db.maintenance_session() as conn:
                rows = await JanitorRepository(conn).expired(cutoff, self._batch)
            if not rows:
                break
            result.batches += 1
            paths = [r.pdf_path for r in rows if r.pdf_path]
            try:
                result.files_deleted += await self._admin.delete_paths(paths)
            except StorageFailed:
                result.failed_batches.append(batch_no)
                log.warning("janitor_files_failed", batch=batch_no, row_count=len(rows),
                            fallback="rows_kept_hidden_retry_next_run")
                break
            async with self._db.maintenance_session() as conn:
                n_rows, n_jds = await JanitorRepository(conn).purge([r.id for r in rows],
                                                                   cutoff)
            result.rows_deleted += n_rows
            result.jds_deleted += n_jds
        await self._purge_chats(cutoff, result)
        await self._purge_agent_state(result)
        level = log.warning if result.failed_batches else log.info
        level("janitor_finished", rows_deleted=result.rows_deleted,
              files_deleted=result.files_deleted, jds_deleted=result.jds_deleted,
              trash_cleared=result.trash_cleared, chats_deleted=result.chats_deleted,
              agent_states_deleted=result.agent_states_deleted,
              batches=result.batches,
              failed_batches=result.failed_batches)
        return result

    async def _purge_chats(self, cutoff: datetime, result: PurgeResult) -> None:
        """Day 3: chats go on the same clock as the Database (no files to delete first)."""
        for _ in range(self._max_batches):
            async with self._db.maintenance_session() as conn:
                n = await JanitorRepository(conn).purge_chats(cutoff, self._batch)
            result.chats_deleted += n
            if n < self._batch:
                return

    async def _purge_agent_state(self, result: PurgeResult) -> None:
        """F5 backstop: run state left by a turn that kept writing after its chat was deleted.
        Finished and deleted turns drop their own (trigger in 20261024000001)."""
        for _ in range(self._max_batches):
            async with self._db.maintenance_session() as conn:
                n = await JanitorRepository(conn).purge_agent_state(self._batch)
            result.agent_states_deleted += n
            if n < self._batch:
                return

    async def _empty_trash(self, result: PurgeResult) -> None:
        for _ in range(self._max_batches):
            async with self._db.maintenance_session() as conn:
                items = await JanitorRepository(conn).trash(self._batch)
            if not items:
                return
            try:
                await self._admin.delete_paths([i.path for i in items])
            except StorageFailed:
                log.warning("janitor_trash_failed", object_count=len(items),
                            fallback="retry_next_run")
                return
            async with self._db.maintenance_session() as conn:
                result.trash_cleared += await JanitorRepository(conn).trash_done(
                    [i.id for i in items])


class JanitorLoop:
    """Background task owned by the Container: started at startup, cancelled at shutdown."""

    def __init__(self, janitor: RetentionJanitor, tick_s: int, start_delay_s: int) -> None:
        self._janitor = janitor
        self._tick_s = tick_s
        self._start_delay_s = start_delay_s
        self._task: asyncio.Task[None] | None = None

    def start(self) -> None:
        self._task = asyncio.create_task(self._run(), name="retention_janitor")
        self._task.add_done_callback(_log_if_crashed)

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self._task

    async def _run(self) -> None:
        await asyncio.sleep(self._start_delay_s)
        while True:
            try:
                await self._janitor.run_if_due()
            except (AppError, psycopg.Error, ValueError) as exc:
                # The run is already claimed for today, so it is retried by tomorrow's claim
                # (approved fallback B). Loud, with the cause; the loop keeps going.
                log.error("janitor_run_failed", error_type=type(exc).__name__,
                          fallback="retry_next_day")
            await asyncio.sleep(self._tick_s)


def _log_if_crashed(task: asyncio.Task[None]) -> None:
    if not task.cancelled() and task.exception() is not None:
        exc = task.exception()
        log.error("janitor_loop_crashed", error_type=type(exc).__name__, exc_info=exc)
