"""Application Database data classes (Day 2: SAVE-1/2/3, IQ-1/2/3). Plain data, no I/O.

Retention: a row holds only `last_sent_at`; the number of days is a setting, so changing it
needs no migration and applies to every row that still exists.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Literal
from uuid import UUID

ApplicationStatus = Literal["applied", "interview", "offer", "rejected", "no_reply"]
Referral = Literal["yes", "asked", "no"]          # None = "—"
ApplicationSource = Literal["honne", "manual"]

NOTES_MAX = 5000


@dataclass(frozen=True, slots=True)
class RetentionWindow:
    """How long a row stays (APPLICATION_RETENTION_DAYS). Rows older than the cut-off are
    hidden on every read and deleted by the daily clean-up."""
    days: int

    def cutoff(self, now: datetime) -> datetime:
        return now - timedelta(days=self.days)

    def deletes_on(self, last_sent_at: datetime) -> datetime:
        return last_sent_at + timedelta(days=self.days)


@dataclass(frozen=True, slots=True)
class RecordResult:
    """Outcome of saving a download to the Database."""
    saved: bool
    reason: str | None = None            # "no_jd" when nothing is saved
    application_id: UUID | None = None
    deletes_on: datetime | None = None


@dataclass(frozen=True, slots=True)
class ApplicationFilter:
    statuses: frozenset[str] = frozenset()   # empty = every status
    query: str | None = None                 # company or role contains, case-insensitive


@dataclass(slots=True)
class PurgeResult:
    """One clean-up run, for the log. Ids and counts only."""
    rows_deleted: int = 0
    files_deleted: int = 0
    jds_deleted: int = 0
    trash_cleared: int = 0
    batches: int = 0
    failed_batches: list[int] = field(default_factory=list)
