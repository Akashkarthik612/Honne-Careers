"""ScoreCalculator (B7, ANA-1..4) and CvTextRenderer. Pure Python, no I/O.

Keyword %    = JD skills found in the CV / JD skills.
Experience % = mean requirement level (yes/strong 1, partial 0.5, none 0); when the JD states
               minimum years: 80% level + 20% min(1, CV years / required years).
Narrative %  = mean of the five 0-5 sub-scores x 20.
A JD with no skills or no requirements gives 0 with a reason, never a made-up number.
"""

import re
from datetime import date

from app.domain.analysis import AnalysisJudgment, CvScores
from app.domain.cv import CvContent
from app.truth.text import mentions, norm_skill, skills_in

LEVEL_WEIGHT = {"strong": 1.0, "yes": 1.0, "partial": 0.5, "none": 0.0}
_MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
_DATE = re.compile(r"(?:(?P<mon>[A-Za-z]{3})[a-z]*\.?\s+)?(?P<year>(?:19|20)\d{2})")


class CvTextRenderer:
    """Deterministic plain text of a CV: the analyst's input and the keyword haystack."""

    def to_text(self, cv: CvContent) -> str:
        lines = [cv.header.name]
        for e in cv.experience:
            lines.append(f"{e.role} at {e.company} ({e.start} - {e.end or 'Present'})")
            lines += [f"- {b.text}" for b in e.bullets]
        for p in cv.projects:
            lines.append(f"Project: {p.name} [{', '.join(p.tech)}] {p.date}")
            lines += [f"- {b.text}" for b in p.bullets]
        for ed in cv.education:
            lines.append(f"{ed.degree}, {ed.school} {ed.years}")
        for label, items in (("Languages", cv.skills.languages),
                             ("Frameworks", cv.skills.frameworks),
                             ("Tools", cv.skills.tools)):
            if items:
                lines.append(f"{label}: {', '.join(s.name for s in items)}")
        return "\n".join(line for line in lines if line.strip())


def parse_month(text: str, *, today: date) -> tuple[int, int] | None:
    if text.strip().lower() in ("present", "current", "now", ""):
        return (today.year, today.month) if text.strip() else None
    match = _DATE.search(text)
    if not match:
        return None
    month = _MONTHS.get((match.group("mon") or "").lower()[:3], 1)
    return int(match.group("year")), month


def years_of_experience(cv: CvContent, *, today: date) -> float:
    """Union of role intervals in months (overlaps counted once). O(r log r)."""
    spans: list[tuple[int, int]] = []
    for e in cv.experience:
        start = parse_month(e.start, today=today)
        end = parse_month(e.end or "present", today=today)
        if start and end:
            # Inclusive: "Aug 2020 - Jun 2021" is 11 months, so the end month counts.
            a, b = start[0] * 12 + start[1], end[0] * 12 + end[1] + 1
            if b > a:
                spans.append((a, b))
    spans.sort()
    total, cur_a, cur_b = 0, None, None
    for a, b in spans:
        if cur_b is None or a > cur_b:
            if cur_b is not None:
                total += cur_b - cur_a
            cur_a, cur_b = a, b
        else:
            cur_b = max(cur_b, b)
    if cur_b is not None:
        total += cur_b - cur_a
    return round(total / 12, 1)


class ScoreCalculator:
    def __init__(self, today: date | None = None) -> None:
        self._today = today

    def compute(self, judgment: AnalysisJudgment, cv: CvContent) -> CvScores:
        today = self._today or date.today()
        text = CvTextRenderer().to_text(cv)
        cv_skills = {norm_skill(s.name) for cat in ("languages", "frameworks", "tools")
                     for s in getattr(cv.skills, cat)}
        cv_skills |= {norm_skill(t) for p in cv.projects for t in p.tech} | skills_in(text)

        jd_skills = list(dict.fromkeys(judgment.jd_skills))
        matched = [s for s in jd_skills if norm_skill(s) in cv_skills or mentions(text, s)]
        missing = [s for s in jd_skills if s not in matched]
        keyword = round(100 * len(matched) / len(jd_skills)) if jd_skills else 0

        reqs = judgment.requirements
        level = sum(LEVEL_WEIGHT[r.level] for r in reqs) / len(reqs) if reqs else 0.0
        cv_years = years_of_experience(cv, today=today)
        if judgment.min_years:
            years_factor = min(1.0, cv_years / judgment.min_years)
            experience = round(100 * (0.8 * level + 0.2 * years_factor)) if reqs else 0
        else:
            experience = round(100 * level)

        sub = judgment.narrative.sub_scores
        narrative = round(20 * (sub.relevance + sub.ordering + sub.ownership + sub.impact
                                + sub.clarity) / 5)

        details: dict[str, object] = {
            "keyword": {"matched": matched, "missing": missing,
                        "missing_note": "Not in your profile, so we didn't add it."},
            "experience": {"requirements": [r.model_dump() for r in reqs],
                           "cv_years": cv_years, "min_years": judgment.min_years},
            "narrative": judgment.narrative.model_dump(),
        }
        if not jd_skills:
            details["keyword"]["reason"] = "no_skills_in_jd"  # type: ignore[index]
        if not reqs:
            details["experience"]["reason"] = "no_requirements_in_jd"  # type: ignore[index]
        return CvScores(keyword=keyword, experience=experience, narrative=narrative,
                        details=details)
