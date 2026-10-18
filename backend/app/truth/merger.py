"""ResumeMerger: applies AI output to content (B5, B6, B11 #4). Pure functions.

  * Locked bullets are never changed, whatever the model returned.
  * Bullets with a truth violation keep their original text (full tailor, B11 #4).
  * Changed bullets become `proposed` with their original kept, so Keep/Revert works.
Time O(bullets); space O(content).
"""

from dataclasses import dataclass

from app.domain.cv import (
    SKILL_CATEGORIES,
    Bullet,
    CvContent,
    ExperienceItem,
    Origin,
    ProjectItem,
    Skills,
    TailorState,
)
from app.domain.tailoring import ItemOut, TailorOutput
from app.domain.truth import TruthReport


@dataclass(frozen=True, slots=True)
class MergeResult:
    content: CvContent
    changed: int          # bullets now proposed
    dropped_locked: int   # model edits to locked bullets, ignored
    kept_original: int    # bullets that violated the truth check, left as they were


def propose(bullet: Bullet, text: str) -> Bullet:
    """AI text becomes a proposal; the pre-AI text and origin are kept for Revert."""
    first = bullet.tailor_state is TailorState.PROPOSED
    return Bullet(
        id=bullet.id, text=text, origin=Origin.AI, locked=False,
        original_text=bullet.original_text if first else bullet.text,
        original_origin=bullet.original_origin if first else bullet.origin,
        tailor_state=TailorState.PROPOSED,
    )


def keep(bullet: Bullet) -> Bullet:
    if bullet.tailor_state is not TailorState.PROPOSED:
        return bullet
    return bullet.model_copy(update={"tailor_state": TailorState.KEPT,
                                     "original_text": None, "original_origin": None})


def revert(bullet: Bullet) -> Bullet:
    if bullet.tailor_state is not TailorState.PROPOSED or bullet.original_text is None:
        return bullet
    origin = bullet.original_origin or Origin.USER
    return Bullet(id=bullet.id, text=bullet.original_text, origin=origin,
                  locked=origin is Origin.USER, tailor_state=TailorState.NONE)


def replace_bullet(content: CvContent, bullet_id: str, new: Bullet) -> CvContent:
    def swap(item):
        bullets = [new if b.id == bullet_id else b for b in item.bullets]
        return item.model_copy(update={"bullets": bullets})

    return content.model_copy(update={
        "experience": [swap(i) for i in content.experience],
        "projects": [swap(i) for i in content.projects],
    })


class ResumeMerger:
    def merge_tailor(self, content: CvContent, output: TailorOutput, report: TruthReport,
                     scope: str) -> MergeResult:
        bad_paths = report.violating_paths()
        by_id = {i.id: i for i in output.items}
        counters = {"changed": 0, "dropped": 0, "kept": 0}

        def merge_item(item: ExperienceItem | ProjectItem, kind: str):
            out_item = by_id.get(item.id)
            if out_item is None or f"{kind}[{item.id}]" in bad_paths \
                    or f"items[{item.id}]" in bad_paths:
                return item
            return item.model_copy(update={
                "bullets": self._merge_bullets(item, out_item, kind, bad_paths, counters)})

        experience = [merge_item(i, "experience") for i in content.experience]
        projects = [merge_item(i, "projects") for i in content.projects]

        if "experience_order" not in bad_paths:
            position = {item_id: n for n, item_id in enumerate(output.experience_order)}
            experience.sort(key=lambda i: position[i.id])

        skills = content.skills
        if scope == "all":
            skills = _reorder_skills(content.skills, output, bad_paths)

        merged = content.model_copy(update={"experience": experience, "projects": projects,
                                            "skills": skills})
        return MergeResult(merged, counters["changed"], counters["dropped"], counters["kept"])

    @staticmethod
    def _merge_bullets(item, out_item: ItemOut, kind: str, bad_paths: frozenset[str],
                       counters: dict[str, int]) -> list[Bullet]:
        current = {b.id: b for b in item.bullets}
        merged: list[Bullet] = []
        for out in out_item.bullets:
            bullet = current[out.id]
            path = f"{kind}[{item.id}].bullets[{out.id}]"
            if out.text == bullet.text:
                merged.append(bullet)
            elif bullet.locked:
                counters["dropped"] += 1
                merged.append(bullet)
            elif path in bad_paths:
                counters["kept"] += 1
                merged.append(bullet)
            else:
                counters["changed"] += 1
                merged.append(propose(bullet, out.text))
        return merged


def _reorder_skills(skills: Skills, output: TailorOutput, bad_paths: frozenset[str]) -> Skills:
    updates = {}
    for category in SKILL_CATEGORIES:
        if f"skills.{category}" in bad_paths:
            continue
        current = {s.name.lower(): s for s in getattr(skills, category)}
        updates[category] = [current[name.lower()] for name in getattr(output.skills, category)]
    return skills.model_copy(update=updates)
