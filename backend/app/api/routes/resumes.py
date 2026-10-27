"""Profile, templates and resume CRUD routes (B8). HTTP in/out only."""

from uuid import UUID

from fastapi import APIRouter, Response

from app.api.deps import Deps, User
from app.api.schemas import (
    ConfirmSkill,
    CreateResume,
    SaveProfile,
    SetJd,
    jd_view,
    profile_view,
    resume_view,
    summary_view,
    template_view,
)
from app.container import Container
from app.domain.cv import ResumePatch
from app.domain.layout import LayoutPatch
from app.domain.records import JdRow, ResumeRow

router = APIRouter()


def _view(c: Container, row: ResumeRow, jd: JdRow | None = None) -> dict[str, object]:
    return resume_view(row, jd, pdf_current=c.templates.pdf_is_current(row))


@router.get("/templates", tags=["templates"])
async def templates(c: Deps) -> list[dict[str, object]]:
    return [template_view(t) for t in c.templates.all()]


@router.get("/profile", tags=["profile"])
async def get_profile(user: User, c: Deps) -> dict[str, object]:
    return profile_view(await c.profiles.get(user))


@router.put("/profile", tags=["profile"])
async def save_profile(body: SaveProfile, user: User, c: Deps) -> dict[str, int]:
    version = await c.profiles.save(user, body.content, body.expected_version)
    return {"row_version": version}


@router.get("/resumes", tags=["resumes"])
async def list_resumes(user: User, c: Deps) -> list[dict[str, object]]:
    return [summary_view(s) for s in await c.resumes.list(user)]


@router.post("/resumes", status_code=201, tags=["resumes"])
async def create_resume(body: CreateResume, user: User, c: Deps) -> dict[str, object]:
    return _view(c, await c.resumes.create(user, body.template, body.mode, body.title))


@router.get("/resumes/{resume_id}", tags=["resumes"])
async def get_resume(resume_id: UUID, user: User, c: Deps) -> dict[str, object]:
    row, jd = await c.resumes.get(user, resume_id)
    return _view(c, row, jd)


@router.patch("/resumes/{resume_id}", tags=["resumes"])
async def autosave(resume_id: UUID, body: ResumePatch, user: User, c: Deps
                   ) -> dict[str, object]:
    version, chash = await c.resumes.autosave(user, resume_id, body)
    return {"row_version": version, "content_hash": chash}


@router.post("/resumes/{resume_id}/skills/confirm", tags=["resumes"])
async def confirm_skill(resume_id: UUID, body: ConfirmSkill, user: User, c: Deps
                        ) -> dict[str, object]:
    row = await c.resumes.confirm_skill(user, resume_id, body.name, body.category,
                                        body.expected_version)
    return _view(c, row)


@router.patch("/resumes/{resume_id}/layout", tags=["resumes"])
async def set_layout(resume_id: UUID, body: LayoutPatch, user: User, c: Deps
                     ) -> dict[str, object]:
    return _view(c, await c.resumes.set_layout(user, resume_id, body))


@router.delete("/resumes/{resume_id}", status_code=204, tags=["resumes"])
async def delete_resume(resume_id: UUID, user: User, c: Deps) -> Response:
    await c.resumes.delete(user, resume_id)
    return Response(status_code=204)


@router.post("/resumes/{resume_id}/duplicate", status_code=201, tags=["resumes"])
async def duplicate_resume(resume_id: UUID, user: User, c: Deps) -> dict[str, object]:
    return _view(c, await c.resumes.duplicate(user, resume_id))


@router.put("/resumes/{resume_id}/jd", tags=["resumes"])
async def set_jd(resume_id: UUID, body: SetJd, user: User, c: Deps) -> dict[str, object]:
    jd = await c.resumes.set_jd(user, resume_id, body.text, body.company, body.role)
    return jd_view(jd) or {}
