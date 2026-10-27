"""FactSetBuilder: collects every fact the user owns (B5).

Sources: the saved profile, parsed uploads, and the resume itself, where only
non-AI values count (origin=ai is never a fact, so AI text can't vouch for AI text).
Time O(total text length); space O(distinct facts + experience/project text).
"""

import re
from collections import defaultdict
from collections.abc import Iterable

from app.domain.cv import CvContent, ExperienceItem, Origin, ProjectItem
from app.domain.markup import plain
from app.domain.tailoring import PrefillCv
from app.domain.truth import FactSet
from app.truth.text import mentions, norm_skill, numbers_in, skills_in, words_in, years_in

SHORT_SKILL = 2  # "Go", "R", "C": matched case-sensitively, so "go-to-market" isn't Go


class FactSetBuilder:
    def build(self, sources: list[CvContent], resume: CvContent,
              prefills: Iterable[PrefillCv] = ()) -> FactSet:
        skills: set[str] = set()
        vocabulary: set[str] = set()
        dates: set[str] = set()
        numbers: dict[str, set[str]] = defaultdict(set)
        experience_skills: set[str] = set()
        evidence: list[str] = []

        def add_evidence(text: str) -> None:
            text = plain(text)
            experience_skills.update(skills_in(text))
            evidence.append(text)

        def add_text(text: str, item_id: str | None = None) -> None:
            text = plain(text)  # **bold** markers are formatting, not facts
            vocabulary.update(words_in(text))
            dates.update(years_in(text))
            skills.update(skills_in(text))
            if item_id is not None:
                numbers[item_id].update(numbers_in(text))

        for content in (*sources, resume):
            header = content.header
            for text in (header.name, header.location):
                add_text(text)
            for category in (content.skills.languages, content.skills.frameworks,
                             content.skills.tools):
                for skill in category:
                    if skill.origin is not Origin.AI:
                        skills.add(norm_skill(skill.name))
                        add_text(skill.name)
            for edu in content.education:
                for text in (edu.school, edu.degree, edu.years, edu.location):
                    add_text(text)
            for item in (*content.experience, *content.projects):
                for text in _item_fields(item):
                    add_text(text, item.id)
                if isinstance(item, ProjectItem):
                    skills.update(norm_skill(t) for t in item.tech)
                    experience_skills.update(norm_skill(t) for t in item.tech)
                    evidence.extend(item.tech)
                for bullet in item.bullets:
                    if bullet.origin is not Origin.AI:
                        add_text(bullet.text, item.id)
                        add_evidence(bullet.text)
                    if bullet.original_text and bullet.original_origin is not Origin.AI:
                        add_text(bullet.original_text, item.id)
                        add_evidence(bullet.original_text)

        for prefill in prefills:  # parsed uploads: copied from the user's own CV
            add_text(prefill.header.name)
            add_text(prefill.header.location)
            for category in (prefill.skills.languages, prefill.skills.frameworks,
                             prefill.skills.tools):
                for name in category:
                    skills.add(norm_skill(name))
                    add_text(name)
            for edu in prefill.education:
                for text in (edu.school, edu.degree, edu.years, edu.location):
                    add_text(text)
            for exp in prefill.experience:
                for text in (exp.role, exp.company, exp.location, exp.start, exp.end,
                             *(b.text for b in exp.bullets)):
                    add_text(text, exp.id)
            for proj in prefill.projects:
                skills.update(norm_skill(t) for t in proj.tech)
                for text in (proj.name, proj.date, *proj.tech, *(b.text for b in proj.bullets)):
                    add_text(text, proj.id)

        return FactSet(
            skills=frozenset(skills), vocabulary=frozenset(vocabulary), dates=frozenset(dates),
            numbers_by_item={k: frozenset(v) for k, v in numbers.items()},
            experience_skills=frozenset(experience_skills), evidence=tuple(evidence),
        )


def evidenced(facts: FactSet, name: str) -> bool:
    """V4.1: may `name` be added to Skills? Only if the user's own experience or project
    text shows it (a lexicon skill, a project tech entry, or the phrase itself). The JD is
    never evidence. Time O(evidence text)."""
    if norm_skill(name) in facts.experience_skills:
        return True
    term = name.strip()
    if len(term) <= SHORT_SKILL:
        pattern = re.compile(rf"(?<![\w+#.]){re.escape(term)}(?![\w+#-])")
        return any(pattern.search(text) for text in facts.evidence)
    return any(mentions(text, term) for text in facts.evidence)


def _item_fields(item: ExperienceItem | ProjectItem) -> list[str]:
    if isinstance(item, ExperienceItem):
        return [item.role, item.company, item.location, item.start, item.end]
    return [item.name, item.date, *item.tech]
