"""Truth-check data classes (B2, B5, TRUTH-1..4)."""

from dataclasses import dataclass, field
from enum import StrEnum


class Rule(StrEnum):
    UNKNOWN_NUMBER = "unknown_number"          # number not in this item's facts
    UNKNOWN_SKILL = "unknown_skill"            # skill not in the user's facts
    UNKNOWN_DATE = "unknown_date"              # year / month-year not in the facts
    UNKNOWN_NAME = "unknown_name"              # new capitalised name (employer, product...)
    MISSING_SKILL_USED = "missing_skill_used"  # a JD skill the user lacks, written in anyway
    COUNT_CHANGED = "count_changed"            # bullets per item / skills per category
    SKILL_SET_CHANGED = "skill_set_changed"    # pre-v4.1 reports only; no longer emitted
    SKILL_REMOVED = "skill_removed"            # an existing skill dropped from Skills
    UNKNOWN_ID = "unknown_id"                  # output refers to an id that wasn't sent
    BAD_BOLD = "bad_bold"                      # malformed **, too many/long spans, or not a fact


@dataclass(frozen=True, slots=True)
class FactSet:
    """Everything the user owns, normalised. Hash sets: O(1) membership checks.

    numbers_by_item is item-scoped so a metric cannot move from one job to another.
    """

    skills: frozenset[str]
    vocabulary: frozenset[str]          # every lowercased word the user wrote
    dates: frozenset[str]               # years and "mon yyyy" forms
    numbers_by_item: dict[str, frozenset[str]] = field(default_factory=dict)
    # Evidence a skill may be *added* to Skills from (V4.1): only the user's experience and
    # project text in the profile and resume (non-AI), never the JD or an unreviewed upload.
    experience_skills: frozenset[str] = frozenset()   # norm_skill names: lexicon + tech
    evidence: tuple[str, ...] = ()                    # plain texts, for phrase mentions


@dataclass(frozen=True, slots=True)
class Violation:
    field_path: str   # e.g. "experience[exp1].bullets[b3]"
    value: str        # the offending token only, never the whole text
    rule: Rule


@dataclass(frozen=True, slots=True)
class TruthReport:
    violations: tuple[Violation, ...] = ()

    @property
    def passed(self) -> bool:
        return not self.violations

    def violating_paths(self) -> frozenset[str]:
        return frozenset(v.field_path for v in self.violations)
