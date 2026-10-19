"""Copy content between profile and resume with the right origins (B5)."""

from app.core.errors import FactMissing
from app.domain.cv import Bullet, CvContent, Origin, SkillItem, Skills, TailorState


def fact_text(bullet: Bullet) -> str:
    """The user's fact behind a bullet: its text, or for AI wording the original it came
    from. Raises FactMissing rather than ever treating AI wording as a fact (TRUTH-1)."""
    if bullet.origin is not Origin.AI:
        return bullet.text
    if bullet.original_text is None:
        raise FactMissing(reason="ai_bullet_without_original", bullet_id=bullet.id)
    return bullet.original_text


def facts_only(content: CvContent) -> CvContent:
    """Save to profile (B6): every AI-worded bullet goes back to the fact it came from, so
    the profile never absorbs tailored wording. O(bullets)."""

    def items(section):
        return [i.model_copy(update={"bullets": [
            b.model_copy(update={"text": fact_text(b)}) for b in i.bullets]})
            for i in section]

    return content.model_copy(update={"experience": items(content.experience),
                                      "projects": items(content.projects)})


def as_origin(content: CvContent, origin: Origin) -> CvContent:
    """Every bullet and skill gets `origin`; proposals are settled; lock = (origin is USER).

    profile -> resume: Origin.PROFILE (facts the AI may reword, not locked).
    resume -> profile (save to profile): Origin.USER (the user adopted it as their facts).
    """

    def bullet(b: Bullet) -> Bullet:
        return Bullet(id=b.id, text=b.text, origin=origin, locked=origin is Origin.USER,
                      tailor_state=TailorState.NONE)

    def items(section):
        return [i.model_copy(update={"bullets": [bullet(b) for b in i.bullets]})
                for i in section]

    skills = Skills(**{
        cat: [SkillItem(name=s.name, origin=origin) for s in getattr(content.skills, cat)]
        for cat in ("languages", "frameworks", "tools")
    })
    return content.model_copy(update={"experience": items(content.experience),
                                      "projects": items(content.projects), "skills": skills})
