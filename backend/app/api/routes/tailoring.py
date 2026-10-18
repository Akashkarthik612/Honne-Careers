"""Tailoring routes (B8): full tailor (202 + polling), per-bullet tailor, Keep/Revert."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Path

from app.api.deps import Deps, User
from app.domain.cv import ITEM_ID, Model

router = APIRouter(tags=["tailoring"])
BulletId = Annotated[str, Path(pattern=ITEM_ID)]


class TailorRequest(Model):
    scope: Literal["all", "experience_projects"] = "all"


class SettleRequest(Model):
    expected_version: int


@router.post("/resumes/{resume_id}/tailor", status_code=202)
async def tailor_all(resume_id: UUID, body: TailorRequest, user: User, c: Deps,
                     background: BackgroundTasks) -> dict[str, object]:
    started = await c.tailor.start(user, resume_id)
    background.add_task(c.tailor.run, user, resume_id, started, body.scope)
    return {"status": "tailoring", "poll": f"/resumes/{resume_id}"}


@router.post("/resumes/{resume_id}/pdf", tags=["pdf"])
async def build_pdf(resume_id: UUID, user: User, c: Deps) -> dict[str, object]:
    result = await c.pdf.build(user, resume_id)
    return {"url": result.url, "page_count": result.page_count, "reused": result.reused,
            "warning": result.warning}


@router.post("/resumes/{resume_id}/bullets/{bullet_id}/tailor")
async def tailor_bullet(resume_id: UUID, bullet_id: BulletId, user: User, c: Deps
                        ) -> dict[str, object]:
    bullet, version = await c.bullet_tailor.tailor(user, resume_id, bullet_id)
    return {"bullet": bullet.model_dump(mode="json"), "row_version": version}


@router.post("/resumes/{resume_id}/bullets/{bullet_id}/{action}")
async def settle_bullet(resume_id: UUID, bullet_id: BulletId,
                        action: Literal["keep", "revert"], body: SettleRequest, user: User,
                        c: Deps) -> dict[str, object]:
    bullet, version = await c.bullet_tailor.settle(user, resume_id, bullet_id, action,
                                                   body.expected_version)
    return {"bullet": bullet.model_dump(mode="json"), "row_version": version}
