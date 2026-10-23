"""Career stage (TAIL-8, tailor v3): fresher < 2 yrs, senior > 8 yrs, dates never guessed."""

from datetime import date

import pytest

from app.domain.career import CareerStage, career_stage, experience_span
from app.domain.cv import ExperienceItem
from tests.fixtures import sample_cv

TODAY = date(2026, 10, 1)


def _cv(*roles: tuple[str, str, str]):
    """roles: (title, start, end)."""
    return sample_cv().model_copy(update={"experience": [
        ExperienceItem(id=f"r{n}", role=role, company="Acme", start=start, end=end)
        for n, (role, start, end) in enumerate(roles)]})


def _stage(*roles: tuple[str, str, str]) -> CareerStage:
    return career_stage(experience_span(_cv(*roles), today=TODAY))


def test_no_experience_is_fresher():
    assert _stage() is CareerStage.FRESHER


@pytest.mark.parametrize("start,end,stage", [
    ("Nov 2024", "Sep 2026", CareerStage.FRESHER),       # 23 months
    ("Oct 2024", "Sep 2026", CareerStage.EXPERIENCED),   # 24 months: not under 2 years
    ("Oct 2018", "Sep 2026", CareerStage.EXPERIENCED),   # 96 months: exactly 8, not senior
    ("Sep 2018", "Sep 2026", CareerStage.SENIOR),        # 97 months
    ("2013", "Present", CareerStage.SENIOR),             # year only, Present = today
])
def test_boundaries(start, end, stage):
    assert _stage(("Engineer", start, end)) is stage


def test_overlapping_roles_count_once():
    span = experience_span(_cv(("Engineer", "Jan 2020", "Dec 2020"),
                               ("Consultant", "Jun 2020", "Dec 2021")), today=TODAY)
    assert span.months == 24


def test_internships_count_for_fresher_but_not_senior():
    # 1 yr internship + 1.5 yrs job: 2.5 yrs in all, so not a fresher
    assert _stage(("Software Intern", "Jan 2023", "Dec 2023"),
                  ("Engineer", "Apr 2025", "Sep 2026")) is CareerStage.EXPERIENCED
    # 2 yrs of internships + 7 yrs work: 9 yrs in all but only 7 count for senior
    assert _stage(("Research Internship", "Oct 2017", "Sep 2019"),
                  ("Engineer", "Oct 2019", "Sep 2026")) is CareerStage.EXPERIENCED


def test_unreadable_dates_are_skipped_not_guessed():
    span = experience_span(_cv(("Engineer", "Summer", ""), ("Engineer", "Jan 2026", "")),
                           today=TODAY)
    assert (span.unreadable, span.months) == (1, 10)
    assert career_stage(span) is CareerStage.FRESHER


def test_all_dates_unreadable_falls_back_to_experienced():
    # Fallback F1: today's behaviour, the service logs a WARNING.
    assert _stage(("Engineer", "Summer", "Winter")) is CareerStage.EXPERIENCED
