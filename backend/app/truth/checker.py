"""TruthChecker: deterministic check of AI output against the user's facts (TRUTH-1..4, B5).

Runs on AI output only, never on user text. For each AI-written bullet:
  * every number must be in that item's facts (metrics can't move between jobs)
  * every year must be a known date
  * every recognised skill must be one of the user's skills
  * no JD skill the user lacks (missing_skills) may appear
  * no new capitalised name (employer, product, team) may appear
  * **bold** is well formed, at most 3 spans of at most 4 words, each holding one of the
    user's skills or one of this item's numbers (the checks above read the plain text)
Structure: same item ids, same bullet ids and counts, skills reordered only.
Time O(output text + facts); space O(facts). No I/O.
"""

from app.domain.cv import SKILL_CATEGORIES, CvContent
from app.domain.markup import MalformedMarkup, parse, plain
from app.domain.tailoring import SkillsView, TailorOutput
from app.domain.truth import FactSet, Rule, TruthReport, Violation
from app.truth.text import (
    COMMON_CAPITALISED,
    mentions,
    name_candidates,
    norm_skill,
    numbers_in,
    skills_in,
    years_in,
)

MAX_BOLD_SPANS = 3
MAX_BOLD_WORDS = 4


class TruthChecker:
    def __init__(self, facts: FactSet) -> None:
        self._facts = facts

    def check_bullet(self, item_id: str, path: str, text: str,
                     missing_skills: list[str] | None = None) -> list[Violation]:
        facts = self._facts
        item_numbers = facts.numbers_by_item.get(item_id, frozenset())
        out = self._check_bold(item_numbers, path, text)
        text = plain(text)
        out += [Violation(path, n, Rule.UNKNOWN_NUMBER)
                for n in sorted(numbers_in(text) - item_numbers)]
        out += [Violation(path, y, Rule.UNKNOWN_DATE)
                for y in sorted(years_in(text) - facts.dates)]
        out += [Violation(path, s, Rule.UNKNOWN_SKILL)
                for s in sorted(skills_in(text) - facts.skills)]
        for skill in missing_skills or []:
            if norm_skill(skill) not in facts.skills and mentions(text, skill):
                out.append(Violation(path, skill, Rule.MISSING_SKILL_USED))
        known_skill_words = {w for s in facts.skills for w in s.split()}
        for name in name_candidates(text):
            key = name.lower()
            if (key in facts.vocabulary or key in COMMON_CAPITALISED
                    or key in known_skill_words or skills_in(name)):
                continue  # user's own word, generic acronym, or a skill (checked above)
            out.append(Violation(path, name, Rule.UNKNOWN_NAME))
        return out

    def _check_bold(self, item_numbers: frozenset[str], path: str,
                    text: str) -> list[Violation]:
        """Bold may only mark the user's own skills or this item's metrics (cv_tailor v2)."""
        try:
            spans = [s.text for s in parse(text) if s.bold]
        except MalformedMarkup:
            return [Violation(path, "**", Rule.BAD_BOLD)]
        if len(spans) > MAX_BOLD_SPANS:
            return [Violation(path, str(len(spans)), Rule.BAD_BOLD)]
        out: list[Violation] = []
        for span in spans:
            is_fact = bool(numbers_in(span) & item_numbers
                           or skills_in(span) & self._facts.skills)
            if len(span.split()) > MAX_BOLD_WORDS or not is_fact:
                out.append(Violation(path, span, Rule.BAD_BOLD))
        return out

    def check_tailor(self, content: CvContent, output: TailorOutput,
                     missing_skills: list[str], scope: str) -> TruthReport:
        violations: list[Violation] = []
        items = {i.id: i for i in (*content.experience, *content.projects)}
        exp_ids = [e.id for e in content.experience]

        if sorted(output.experience_order) != sorted(exp_ids):
            violations.append(Violation("experience_order", "", Rule.UNKNOWN_ID))

        seen: set[str] = set()
        for out_item in output.items:
            item = items.get(out_item.id)
            if item is None or out_item.id in seen:
                violations.append(Violation(f"items[{out_item.id}]", out_item.id,
                                            Rule.UNKNOWN_ID))
                continue
            seen.add(out_item.id)
            kind = "experience" if out_item.id in exp_ids else "projects"
            before = {b.id: b for b in item.bullets}
            if sorted(b.id for b in out_item.bullets) != sorted(before):
                violations.append(Violation(f"{kind}[{item.id}]", "", Rule.COUNT_CHANGED))
                continue
            for bullet in out_item.bullets:
                if bullet.text == before[bullet.id].text:
                    continue  # unchanged text is the user's own fact
                path = f"{kind}[{item.id}].bullets[{bullet.id}]"
                violations += self.check_bullet(item.id, path, bullet.text, missing_skills)

        if scope == "all":
            violations += _check_skills(content, output.skills)
        return TruthReport(tuple(violations))


def _check_skills(content: CvContent, skills: SkillsView) -> list[Violation]:
    out: list[Violation] = []
    for category in SKILL_CATEGORIES:
        before = [s.name for s in getattr(content.skills, category)]
        after = list(getattr(skills, category))
        if len(before) != len(after):
            out.append(Violation(f"skills.{category}", "", Rule.COUNT_CHANGED))
        elif sorted(map(str.lower, before)) != sorted(map(str.lower, after)):
            out.append(Violation(f"skills.{category}", "", Rule.SKILL_SET_CHANGED))
    return out
