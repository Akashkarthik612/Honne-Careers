"""Copy content between profile and resume with the right origins (B5)."""

from app.domain.cv import Bullet, CvContent, Origin, SkillItem, Skills, TailorState


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
