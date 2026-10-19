"""Uploads, analysis and save-to-profile routes (B8)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, UploadFile
from pydantic import StringConstraints

from app.api.deps import Deps, User
from app.api.schemas import ExpectedVersion, analysis_view
from app.core.errors import InvalidInput
from app.domain.cv import Model

router = APIRouter()


class LatexPaste(Model):
    text: Annotated[str, StringConstraints(min_length=1, max_length=100_000)]


def _upload_view(result) -> dict[str, object]:
    return {"upload_id": str(result.upload_id), "filename": result.filename,
            "prefill": result.prefill.model_dump(mode="json")}


@router.post("/uploads", status_code=201, tags=["uploads"])
async def upload_cv(user: User, c: Deps, file: Annotated[UploadFile, File()]
                    ) -> dict[str, object]:
    limit = c.settings.upload_max_bytes
    data = await file.read(limit + 1)  # read at most one byte past the cap
    if len(data) > limit:
        raise InvalidInput(f"Files up to {limit // (1024 * 1024)} MB, please.",
                           reason="too_large")
    return _upload_view(await c.uploads.upload(user, file.filename or "", data))


@router.post("/uploads/latex", status_code=201, tags=["uploads"])
async def paste_latex(body: LatexPaste, user: User, c: Deps) -> dict[str, object]:
    return _upload_view(await c.uploads.upload(user, "pasted.tex", body.text.encode("utf-8"),
                                               source_type="latex"))


@router.post("/resumes/{resume_id}/analysis", tags=["analysis"])
async def analyse(resume_id: UUID, user: User, c: Deps) -> dict[str, object]:
    row, cached = await c.analysis.analyse(user, resume_id)
    return analysis_view(row, cached)


@router.post("/resumes/{resume_id}/save-to-profile", tags=["profile"])
async def save_to_profile(resume_id: UUID, body: ExpectedVersion, user: User, c: Deps
                          ) -> dict[str, int]:
    row, _ = await c.resumes.get(user, resume_id)
    version = await c.profiles.replace_with(user, row.content, body.expected_version)
    return {"row_version": version}
