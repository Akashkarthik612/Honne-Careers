"""Application Database routes (Day 2). HTTP in/out only."""

from datetime import UTC, datetime
from typing import Annotated, get_args
from uuid import UUID

from fastapi import APIRouter, Query, Response

from app.api.deps import Deps, User
from app.api.schemas import (
    AddApplication,
    ApplicationPatch,
    application_view,
    applications_view,
    record_view,
)
from app.core.errors import InvalidInput
from app.domain.applications import ApplicationFilter, ApplicationStatus
from app.services.applications import ManualApplication

router = APIRouter(tags=["applications"])
_STATUSES = frozenset(get_args(ApplicationStatus))


@router.post("/resumes/{resume_id}/application")
async def record_application(resume_id: UUID, user: User, c: Deps) -> dict[str, object]:
    """SAVE-1: called by the UI right after Download PDF. Safe to repeat (SAVE-3)."""
    return record_view(await c.recorder.record(user, resume_id))


@router.get("/applications")
async def list_applications(
        user: User, c: Deps,
        status: Annotated[str | None, Query(max_length=100)] = None,
        q: Annotated[str | None, Query(max_length=100)] = None) -> dict[str, object]:
    statuses = frozenset(s for s in (status or "").split(",") if s)
    if statuses - _STATUSES:
        raise InvalidInput(reason="status")
    flt = ApplicationFilter(statuses=statuses, query=(q or "").strip() or None)
    return applications_view(await c.applications.list(user, flt), c.applications.window)


@router.post("/applications", status_code=201)
async def add_application(body: AddApplication, user: User, c: Deps) -> dict[str, object]:
    data = ManualApplication(
        company=body.company, role=body.role,
        applied_on=body.applied_on or datetime.now(UTC).date(), status=body.status,
        referral=body.referral, notes=body.notes or None, jd_text=body.jd_text)
    return application_view(await c.applications.add_manual(user, data), c.applications.window)


@router.get("/applications/{app_id}")
async def get_application(app_id: UUID, user: User, c: Deps) -> dict[str, object]:
    return application_view(await c.applications.get(user, app_id), c.applications.window)


@router.patch("/applications/{app_id}")
async def patch_application(app_id: UUID, body: ApplicationPatch, user: User, c: Deps
                            ) -> dict[str, object]:
    detail = await c.applications.patch(user, app_id, body.expected_version, body.changes())
    return application_view(detail, c.applications.window)


@router.get("/applications/{app_id}/pdf")
async def application_pdf(app_id: UUID, user: User, c: Deps) -> dict[str, str]:
    return {"url": await c.applications.pdf_url(user, app_id)}


@router.delete("/applications/{app_id}", status_code=204)
async def delete_application(app_id: UUID, user: User, c: Deps) -> Response:
    await c.applications.delete(user, app_id)
    return Response(status_code=204)
