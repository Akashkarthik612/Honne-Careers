"""EditStamper: turns client input into stored content, stamping server-owned metadata (B5).

Rules:
  * A bullet whose text is new or changed is the user's: origin=user, locked=true.
  * A bullet sent back unchanged keeps its stored metadata (origin, proposal state).
  * A skill that wasn't there before is the user's: origin=user.
The client never chooses origin/locked. Text is stored exactly as typed.
Time O(items + bullets); space O(content).
"""

from app.core.errors import InvalidInput
from app.domain.cv import (
    SKILL_CATEGORIES,
    Bullet,
    BulletIn,
    CvContent,
    CvContentIn,
    EducationPatch,
    ExperienceIn,
    ExperienceItem,
    ExperiencePatch,
    Origin,
    PersonalPatch,
    ProjectIn,
    ProjectItem,
    ProjectsPatch,
    SectionPatch,
    SkillItem,
    Skills,
    SkillsIn,
    SkillsPatch,
)


class EditStamper:
    def __init__(self, new_origin: Origin = Origin.USER) -> None:
        self._origin = new_origin

    def apply_patch(self, content: CvContent, patch: SectionPatch) -> CvContent:
        match patch:
            case PersonalPatch():
                updated = content.model_copy(update={"header": patch.value})
            case ExperiencePatch():
                updated = content.model_copy(update={
                    "experience": self._experience(patch.value, content)})
            case ProjectsPatch():
                updated = content.model_copy(update={
                    "projects": self._projects(patch.value, content)})
            case EducationPatch():
                updated = content.model_copy(update={"education": patch.value})
            case SkillsPatch():
                updated = content.model_copy(update={
                    "skills": self._skills(patch.value, content.skills)})
        check_unique_ids(updated)
        return updated

    def stamp_full(self, incoming: CvContentIn, previous: CvContent | None) -> CvContent:
        previous = previous or CvContent()
        content = CvContent(
            header=incoming.header,
            experience=self._experience(incoming.experience, previous),
            projects=self._projects(incoming.projects, previous),
            education=incoming.education,
            skills=self._skills(incoming.skills, previous.skills),
        )
        check_unique_ids(content)
        return content

    def _bullets(self, incoming: list[BulletIn], old: dict[str, Bullet]) -> list[Bullet]:
        out = []
        for b in incoming:
            prior = old.get(b.id)
            if prior is not None and prior.text == b.text:
                out.append(prior)
            else:
                out.append(Bullet(id=b.id, text=b.text, origin=self._origin,
                                  locked=self._origin is Origin.USER))
        return out

    def _experience(self, items: list[ExperienceIn], content: CvContent) -> list[ExperienceItem]:
        old = _bullets_by_id(content)
        return [ExperienceItem(**i.model_dump(exclude={"bullets"}),
                               bullets=self._bullets(i.bullets, old)) for i in items]

    def _projects(self, items: list[ProjectIn], content: CvContent) -> list[ProjectItem]:
        old = _bullets_by_id(content)
        return [ProjectItem(**i.model_dump(exclude={"bullets"}),
                            bullets=self._bullets(i.bullets, old)) for i in items]

    def _skills(self, incoming: SkillsIn, old: Skills) -> Skills:
        out = {}
        for category in SKILL_CATEGORIES:
            prior = {s.name.lower(): s for s in getattr(old, category)}
            seen: set[str] = set()
            items = []
            for name in getattr(incoming, category):
                key = name.lower()
                if key in seen:
                    continue  # duplicate chip: one entry
                seen.add(key)
                items.append(prior.get(key) or SkillItem(name=name, origin=self._origin))
            out[category] = items
        return Skills(**out)


def _bullets_by_id(content: CvContent) -> dict[str, Bullet]:
    return {b.id: b for item in (*content.experience, *content.projects) for b in item.bullets}


def check_unique_ids(content: CvContent) -> None:
    """Bullet and item ids address rows in the API, so they must be unique per CV."""
    item_ids = [i.id for i in (*content.experience, *content.projects, *content.education)]
    bullet_ids = [b.id for i in (*content.experience, *content.projects) for b in i.bullets]
    if len(set(item_ids)) != len(item_ids) or len(set(bullet_ids)) != len(bullet_ids):
        raise InvalidInput("Duplicate ids in the CV.", reason="duplicate_ids")
