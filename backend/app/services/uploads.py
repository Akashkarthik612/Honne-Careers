"""UploadService (B6/B8, PROF-2..5): upload or pasted LaTeX -> cv_parser -> pre-fill.

The original file is stored privately (PROF-3); the parsed pre-fill is returned for the
user to review in the wizard (PROF-4) and kept as a fact source for the truth check.
"""

import re
import uuid
from dataclasses import dataclass

from app.agents.runner import AgentRunner
from app.core.logging import get_logger
from app.db.unit_of_work import UnitOfWorkFactory
from app.domain.auth import AuthUser
from app.domain.tailoring import (
    ParsedCv,
    ParserInput,
    PrefillBullet,
    PrefillCv,
    PrefillEducation,
    PrefillExperience,
    PrefillProject,
)
from app.ingest.extractors import Extracted, TextExtractor
from app.policy.quota import QuotaGuard
from app.storage.file_store import UPLOAD_EXTENSIONS, upload_path

log = get_logger(__name__)
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._ -]")


@dataclass(frozen=True, slots=True)
class UploadResult:
    upload_id: uuid.UUID
    filename: str
    prefill: PrefillCv


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


def _bullets(texts: list[str]) -> list[PrefillBullet]:
    return [PrefillBullet(id=_new_id(), text=t) for t in texts]


def to_prefill(parsed: ParsedCv) -> PrefillCv:
    """Assigns ids in Python (mechanics, not judgment)."""
    bullets = _bullets
    return PrefillCv(
        header=parsed.header,
        experience=[PrefillExperience(**e.model_dump(exclude={"bullets"}), id=_new_id(),
                                      bullets=bullets(e.bullets)) for e in parsed.experience],
        projects=[PrefillProject(**p.model_dump(exclude={"bullets"}), id=_new_id(),
                                 bullets=bullets(p.bullets)) for p in parsed.projects],
        education=[PrefillEducation(**e.model_dump(), id=_new_id()) for e in parsed.education],
        skills=parsed.skills,
    )


class UploadService:
    def __init__(self, uow: UnitOfWorkFactory, extractor: TextExtractor, runner: AgentRunner,
                 files, quota: QuotaGuard) -> None:
        self._uow = uow
        self._extractor = extractor
        self._runner = runner
        self._files = files
        self._quota = quota

    async def upload(self, user: AuthUser, filename: str, data: bytes,
                     source_type: str | None = None) -> UploadResult:
        extracted = await self._extractor.extract(data, source_type)  # fails before quota
        async with self._uow(user.id) as uow:
            await self._quota.consume(uow, user.id, "upload")

        upload_id = uuid.uuid4()
        run = await self._runner.run("cv_parser", ParserInput(text=extracted.text[:40000]),
                                     ParsedCv, user_id=user.id, entity_id=upload_id)
        prefill = to_prefill(run.output)
        path = upload_path(user.id, upload_id, extracted.ext)
        await self._files.put(user, path, data, UPLOAD_EXTENSIONS[extracted.ext])
        display_name = _display_name(filename, extracted)
        async with self._uow(user.id) as uow:
            await uow.uploads.create(user.id, upload_id, extracted.source_type, display_name,
                                     path, prefill)
        log.info("upload_parsed", upload_id=upload_id, source_type=extracted.source_type,
                 experience=len(prefill.experience), projects=len(prefill.projects))
        return UploadResult(upload_id, display_name, prefill)


def _display_name(filename: str, extracted: Extracted) -> str:
    """Shown in the UI only ("Profile: CV_Arjun_2026.pdf"); never part of a storage path."""
    name = _SAFE_NAME.sub("_", (filename or "").split("/")[-1].split("\\")[-1])[:120].strip()
    return name or f"cv.{extracted.ext}"
