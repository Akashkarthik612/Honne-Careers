"""Agent I/O schemas for tailoring and parsing (Day_1 B2, B3).

These are the *model-facing* shapes. They are deliberately narrower than CvContent:
the model sees ids + text and may return only bullet text, ordering and skill ordering.
It cannot touch employers, titles, dates, schools or the header, so those can never be
invented (TRUTH-1). Python maps the output back by id (ResumeMerger).
"""

from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.domain.career import CareerStage
from app.domain.cv import BulletText, ItemId, Model, Short, SkillName, SpokenLanguages

JdText = Annotated[str, StringConstraints(min_length=1, max_length=20000)]


# ---------- cv_tailor ----------

class BulletView(Model):
    id: ItemId
    text: BulletText
    editable: bool  # False for locked (user-edited) bullets: shown for context only


class ItemView(Model):
    id: ItemId
    kind: Literal["experience", "project"]
    title: Short          # role or project name (read-only)
    context: Short        # company or tech list (read-only)
    bullets: list[BulletView] = Field(max_length=12)


class SkillsView(Model):
    languages: list[SkillName] = Field(default_factory=list, max_length=40)
    frameworks: list[SkillName] = Field(default_factory=list, max_length=40)
    tools: list[SkillName] = Field(default_factory=list, max_length=40)


class TailorInput(Model):
    jd_text: JdText
    scope: Literal["all", "experience_projects"]
    career_stage: CareerStage   # computed in Python from dates (app/domain/career.py)
    items: list[ItemView] = Field(max_length=30)
    skills: SkillsView


class BulletOut(Model):
    id: ItemId
    text: BulletText


class ItemOut(Model):
    id: ItemId
    bullets: list[BulletOut] = Field(max_length=12)


GapKind = Literal["qualification", "experience", "language"]


class Gap(Model):
    """A JD requirement that is not a technical skill (degree, years, spoken language).
    Shown to the user as a gap; never confirmable into Skills (TAIL-6)."""
    kind: GapKind
    text: Short


class TailorOutput(Model):
    experience_order: list[ItemId] = Field(max_length=15)   # TAIL-5: most relevant first
    items: list[ItemOut] = Field(max_length=30)
    # Every existing skill, reordered, plus additions evidenced in the user's own experience
    # or project text (cv_tailor v4). Checked per added skill by TruthChecker.
    skills: SkillsView
    missing_skills: list[SkillName] = Field(default_factory=list, max_length=30)  # TAIL-6
    gaps: list[Gap] = Field(default_factory=list, max_length=10)


# ---------- bullet_tailor ----------

class BulletTailorInput(Model):
    jd_text: JdText
    item_title: Short
    item_context: Short
    item_facts: list[BulletText] = Field(default_factory=list, max_length=12)  # siblings
    bullet_text: BulletText
    career_stage: CareerStage


class BulletTailorOutput(Model):
    text: BulletText


# ---------- cv_parser ----------

class ParserInput(Model):
    text: Annotated[str, StringConstraints(min_length=1, max_length=40000)]


class ParsedExperience(Model):
    role: Short = ""
    company: Short = ""
    location: Short = ""
    start: Annotated[str, StringConstraints(max_length=30)] = ""
    end: Annotated[str, StringConstraints(max_length=30)] = ""
    bullets: list[BulletText] = Field(default_factory=list, max_length=12)


class ParsedProject(Model):
    name: Short = ""
    tech: list[SkillName] = Field(default_factory=list, max_length=15)
    date: Annotated[str, StringConstraints(max_length=30)] = ""
    bullets: list[BulletText] = Field(default_factory=list, max_length=12)


class ParsedEducation(Model):
    school: Short = ""
    degree: Short = ""
    years: Annotated[str, StringConstraints(max_length=30)] = ""
    location: Short = ""


class ParsedHeader(Model):
    name: Short = ""
    location: Short = ""
    email: Annotated[str, StringConstraints(max_length=254)] = ""
    phone: Annotated[str, StringConstraints(max_length=30)] = ""
    links: list[Annotated[str, StringConstraints(max_length=300)]] = Field(
        default_factory=list, max_length=5)


class ParsedCv(Model):
    header: ParsedHeader
    experience: list[ParsedExperience] = Field(default_factory=list, max_length=15)
    projects: list[ParsedProject] = Field(default_factory=list, max_length=15)
    education: list[ParsedEducation] = Field(default_factory=list, max_length=10)
    skills: SkillsView
    spoken_languages: SpokenLanguages = Field(default_factory=list)  # cv_parser v2


# ---------- upload pre-fill (stored in cv_uploads.parsed) ----------
# Lenient on purpose: a parsed CV may lack a company or start date. The user reviews it in
# the wizard (PROF-4), whose autosave applies the strict CvContent rules. Ids are assigned
# by Python so pre-filled items keep them in the resume (item-scoped facts).

class PrefillBullet(Model):
    id: ItemId
    text: BulletText


class PrefillExperience(ParsedExperience):
    id: ItemId
    bullets: list[PrefillBullet] = Field(default_factory=list, max_length=12)  # type: ignore[assignment]


class PrefillProject(ParsedProject):
    id: ItemId
    bullets: list[PrefillBullet] = Field(default_factory=list, max_length=12)  # type: ignore[assignment]


class PrefillEducation(ParsedEducation):
    id: ItemId


class PrefillCv(Model):
    header: ParsedHeader
    experience: list[PrefillExperience] = Field(default_factory=list, max_length=15)
    projects: list[PrefillProject] = Field(default_factory=list, max_length=15)
    education: list[PrefillEducation] = Field(default_factory=list, max_length=10)
    skills: SkillsView
    spoken_languages: SpokenLanguages = Field(default_factory=list)
