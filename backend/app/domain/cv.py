"""CV data classes (Day_1 B2). One shape for profile, resume, upload pre-fill and the renderer.

Two families:
  * Stored shapes (`CvContent`, `Bullet`, `SkillItem`...) carry server-owned metadata:
    origin, locked, original_text, tailor_state.
  * Input shapes (`*In`) are what clients may send: ids and text only. The server stamps
    origin/locked (B5), so a crafted request cannot claim AI text as user-owned or unlock
    a bullet (mass-assignment defence).
Every string is length-capped; every list is size-capped.
"""

import re
from enum import StrEnum
from typing import Annotated, Literal
from urllib.parse import urlparse

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

from app.domain.markup import well_formed

ITEM_ID = r"^[A-Za-z0-9_-]{1,40}$"


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, frozen=True)


ItemId = Annotated[str, StringConstraints(pattern=ITEM_ID)]
Short = Annotated[str, StringConstraints(max_length=120)]
Required = Annotated[str, StringConstraints(min_length=1, max_length=120)]
DateText = Annotated[str, StringConstraints(max_length=30)]
BulletText = Annotated[str, StringConstraints(min_length=1, max_length=600)]
SkillName = Annotated[str, StringConstraints(min_length=1, max_length=60)]
_EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$")


def _http_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("links must be http(s) URLs")
    return value


def _email(value: str) -> str:
    if value and not _EMAIL.match(value):
        raise ValueError("invalid email")
    return value


def _optional_http_url(value: str) -> str:
    return value and _http_url(value)


Url = Annotated[str, StringConstraints(max_length=300), AfterValidator(_http_url)]
OptionalUrl = Annotated[str, StringConstraints(max_length=300), AfterValidator(_optional_http_url)]
Email = Annotated[str, StringConstraints(max_length=254), AfterValidator(_email)]


class Origin(StrEnum):
    USER = "user"        # typed by the user in this resume: a fact, locked (B5)
    PROFILE = "profile"  # copied from the saved profile: a fact, AI may reword
    IMPORT = "import"    # parsed from an upload: a fact, AI may reword
    AI = "ai"            # written by a model: never a fact


class TailorState(StrEnum):
    NONE = "none"
    PROPOSED = "proposed"
    KEPT = "kept"


class LanguageLevel(StrEnum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    PROFESSIONAL = "professional"
    NATIVE = "native"


# ---------- stored shapes ----------

class Link(Model):
    label: Short = ""
    url: Url


class Header(Model):
    name: Short = ""
    location: Short = ""
    email: Email = ""
    phone: Annotated[str, StringConstraints(max_length=30)] = ""
    links: list[Link] = Field(default_factory=list, max_length=5)


class Bullet(Model):
    id: ItemId
    text: BulletText
    origin: Origin
    locked: bool  # invariant: locked => AI never writes it
    original_text: BulletText | None = None   # the fact before AI wording (proposed or kept)
    original_origin: Origin | None = None     # its origin before AI wording
    tailor_state: TailorState = TailorState.NONE


class SkillItem(Model):
    name: SkillName
    origin: Origin


class ExperienceItem(Model):
    id: ItemId
    role: Short = ""
    company: Required
    location: Short = ""
    start: Annotated[str, StringConstraints(min_length=1, max_length=30)]
    end: DateText = ""
    bullets: list[Bullet] = Field(default_factory=list, max_length=12)


class ProjectItem(Model):
    id: ItemId
    name: Required
    tech: list[SkillName] = Field(default_factory=list, max_length=15)
    date: DateText = ""
    link: OptionalUrl = ""  # deployed / demo URL, printed as "Click here"
    bullets: list[Bullet] = Field(default_factory=list, max_length=12)


class EducationItem(Model):
    id: ItemId
    school: Required
    degree: Short = ""
    years: DateText = ""
    location: Short = ""


class Skills(Model):
    languages: list[SkillItem] = Field(default_factory=list, max_length=40)
    frameworks: list[SkillItem] = Field(default_factory=list, max_length=40)
    tools: list[SkillItem] = Field(default_factory=list, max_length=40)


SKILL_CATEGORIES: tuple[str, ...] = ("languages", "frameworks", "tools")


class SpokenLanguage(Model):
    """A human language (not a programming one: those are skills.languages). Typed by the
    user, so it is stored as sent: the same shape in and out."""
    name: Annotated[str, StringConstraints(min_length=1, max_length=60)]
    level: LanguageLevel | None = None


SpokenLanguages = Annotated[list[SpokenLanguage], Field(max_length=10)]


class Certification(Model):
    """A certification or award the user holds. Typed by the user, so it is a fact and the
    AI never writes it (merger and tailor copy it through). Same shape in and out."""
    name: Required
    issuer: Short = ""
    date: DateText = ""


Certifications = Annotated[list[Certification], Field(max_length=15)]


class CvContent(Model):
    header: Header = Field(default_factory=Header)
    experience: list[ExperienceItem] = Field(default_factory=list, max_length=15)
    projects: list[ProjectItem] = Field(default_factory=list, max_length=15)
    education: list[EducationItem] = Field(default_factory=list, max_length=10)
    skills: Skills = Field(default_factory=Skills)
    spoken_languages: SpokenLanguages = Field(default_factory=list)
    certifications: Certifications = Field(default_factory=list)

    def bullet_owners(self) -> dict[str, ExperienceItem | ProjectItem]:
        """bullet id -> the experience/project item that holds it."""
        owners: dict[str, ExperienceItem | ProjectItem] = {}
        for item in (*self.experience, *self.projects):
            for bullet in item.bullets:
                owners[bullet.id] = item
        return owners


# ---------- input shapes (what clients may send) ----------

class BulletIn(Model):
    id: ItemId
    text: Annotated[BulletText, AfterValidator(well_formed)]  # **bold** is the only markup


class ExperienceIn(Model):
    id: ItemId
    role: Short = ""
    company: Required
    location: Short = ""
    start: Annotated[str, StringConstraints(min_length=1, max_length=30)]
    end: DateText = ""
    bullets: list[BulletIn] = Field(default_factory=list, max_length=12)


class ProjectIn(Model):
    id: ItemId
    name: Required
    tech: list[SkillName] = Field(default_factory=list, max_length=15)
    date: DateText = ""
    link: OptionalUrl = ""
    bullets: list[BulletIn] = Field(default_factory=list, max_length=12)


class SkillsIn(Model):
    languages: list[SkillName] = Field(default_factory=list, max_length=40)
    frameworks: list[SkillName] = Field(default_factory=list, max_length=40)
    tools: list[SkillName] = Field(default_factory=list, max_length=40)


class CvContentIn(Model):
    header: Header = Field(default_factory=Header)
    experience: list[ExperienceIn] = Field(default_factory=list, max_length=15)
    projects: list[ProjectIn] = Field(default_factory=list, max_length=15)
    education: list[EducationItem] = Field(default_factory=list, max_length=10)
    skills: SkillsIn = Field(default_factory=SkillsIn)
    spoken_languages: SpokenLanguages = Field(default_factory=list)
    certifications: Certifications = Field(default_factory=list)


# ---------- autosave unit (one wizard step) ----------

class PersonalPatch(Model):
    section: Literal["personal"]
    value: Header


class ExperiencePatch(Model):
    section: Literal["experience"]
    value: list[ExperienceIn] = Field(max_length=15)


class ProjectsPatch(Model):
    section: Literal["projects"]
    value: list[ProjectIn] = Field(max_length=15)


class EducationPatch(Model):
    section: Literal["education"]
    value: list[EducationItem] = Field(max_length=10)


class SkillsPatch(Model):
    section: Literal["skills"]
    value: SkillsIn


class SpokenLanguagesPatch(Model):
    section: Literal["spoken_languages"]  # saved with the Skills step
    value: SpokenLanguages


class CertificationsPatch(Model):
    section: Literal["certifications"]  # saved with the Skills step
    value: Certifications


SectionPatch = Annotated[
    PersonalPatch | ExperiencePatch | ProjectsPatch | EducationPatch | SkillsPatch
    | SpokenLanguagesPatch | CertificationsPatch,
    Field(discriminator="section"),
]

WizardStep = Literal["personal", "experience", "projects", "education", "skills", "done"]


class ResumePatch(Model):
    expected_version: int = Field(ge=1)
    change: SectionPatch
    wizard_step: WizardStep | None = None


class CvChange(Model):
    field_path: str
    before: str
    after: str
