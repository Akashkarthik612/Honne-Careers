"""Career stage from experience dates (TAIL-8, tailor prompts v3). Pure Python, no I/O.

Years are counted here, never by the model: the stage only changes how the tailor agents
word bullets (fresher: professional rewrite; senior: never condense, no one-page squeeze).
Overlapping roles count once; "Present" or an empty end = today. Internships count
towards the fresher limit but not towards senior.
"""

import re
from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from app.domain.cv import CvContent, ExperienceItem

FRESHER_MAX_MONTHS = 24   # under 2 years, internships included
SENIOR_MIN_MONTHS = 96    # strictly more than 8 years, internships excluded

_MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
_DATE = re.compile(r"(?:(?P<mon>[A-Za-z]{3})[a-z]*\.?\s+)?(?P<year>(?:19|20)\d{2})")
_INTERN = re.compile(r"\bintern(ship)?s?\b", re.IGNORECASE)


class CareerStage(StrEnum):
    FRESHER = "fresher"
    EXPERIENCED = "experienced"
    SENIOR = "senior"


@dataclass(frozen=True, slots=True)
class ExperienceSpan:
    months: int                 # union of every readable role
    months_excl_interns: int    # same, internships left out
    roles: int
    unreadable: int             # roles whose start/end can't be read: not counted


def parse_month(text: str, *, today: date) -> tuple[int, int] | None:
    if text.strip().lower() in ("present", "current", "now", ""):
        return (today.year, today.month) if text.strip() else None
    match = _DATE.search(text)
    if not match:
        return None
    month = _MONTHS.get((match.group("mon") or "").lower()[:3], 1)
    return int(match.group("year")), month


def _interval(role: ExperienceItem, today: date) -> tuple[int, int] | None:
    start = parse_month(role.start, today=today)
    end = parse_month(role.end or "present", today=today)
    if not (start and end):
        return None
    # Inclusive: "Aug 2020 - Jun 2021" is 11 months, so the end month counts.
    a, b = start[0] * 12 + start[1], end[0] * 12 + end[1] + 1
    return (a, b) if b > a else None


def _union_months(spans: list[tuple[int, int]]) -> int:
    """Overlaps counted once. O(r log r)."""
    total, cur_a, cur_b = 0, 0, None
    for a, b in sorted(spans):
        if cur_b is None or a > cur_b:
            if cur_b is not None:
                total += cur_b - cur_a
            cur_a, cur_b = a, b
        else:
            cur_b = max(cur_b, b)
    return total + (cur_b - cur_a if cur_b is not None else 0)


def experience_span(cv: CvContent, *, today: date) -> ExperienceSpan:
    """O(r log r) time, O(r) space, r <= 15 roles."""
    all_spans: list[tuple[int, int]] = []
    work_spans: list[tuple[int, int]] = []
    unreadable = 0
    for role in cv.experience:
        span = _interval(role, today)
        if span is None:
            unreadable += 1
            continue
        all_spans.append(span)
        if not _INTERN.search(role.role):
            work_spans.append(span)
    return ExperienceSpan(_union_months(all_spans), _union_months(work_spans),
                          len(cv.experience), unreadable)


def career_stage(span: ExperienceSpan) -> CareerStage:
    if span.roles == 0:
        return CareerStage.FRESHER
    if span.unreadable == span.roles:
        # Fallback F1 (agreed): no date readable -> today's behaviour; the caller logs a WARNING.
        return CareerStage.EXPERIENCED
    if span.months < FRESHER_MAX_MONTHS:
        return CareerStage.FRESHER
    if span.months_excl_interns > SENIOR_MIN_MONTHS:
        return CareerStage.SENIOR
    return CareerStage.EXPERIENCED
