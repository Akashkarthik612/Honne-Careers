"""Analysis data classes (ANA-1..4). The model judges; Python computes percentages."""

from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.domain.cv import Model, SkillName

Sentence = Annotated[str, StringConstraints(max_length=400)]
Level = Literal["yes", "strong", "partial", "none"]


class Requirement(Model):
    text: Sentence
    level: Level
    evidence: Sentence = ""


class NarrativeSubScores(Model):
    relevance: int = Field(ge=0, le=5)
    ordering: int = Field(ge=0, le=5)
    ownership: int = Field(ge=0, le=5)
    impact: int = Field(ge=0, le=5)
    clarity: int = Field(ge=0, le=5)


class Narrative(Model):
    sub_scores: NarrativeSubScores
    jd_story: Sentence
    cv_story: Sentence
    suggestion: Sentence


class AnalysisJudgment(Model):
    """cv_analyst output. No percentages: those are ScoreCalculator's job."""

    jd_skills: list[SkillName] = Field(max_length=60)
    requirements: list[Requirement] = Field(max_length=25)
    min_years: int | None = Field(default=None, ge=0, le=40)
    narrative: Narrative


class AnalystInput(Model):
    jd_text: Annotated[str, StringConstraints(min_length=1, max_length=20000)]
    cv_text: Annotated[str, StringConstraints(min_length=1, max_length=40000)]


class CvScores(Model):
    keyword: int = Field(ge=0, le=100)
    experience: int = Field(ge=0, le=100)
    narrative: int = Field(ge=0, le=100)
    details: dict[str, object]
