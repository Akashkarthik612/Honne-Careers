"""ProfileService: the saved profile (PROF-1, PROF-4), optimistic concurrency."""

from app.core.errors import NotFound, StaleVersion
from app.core.hashing import content_hash
from app.core.logging import get_logger
from app.db.unit_of_work import UnitOfWorkFactory
from app.domain.auth import AuthUser
from app.domain.cv import CvContent, CvContentIn, Origin
from app.domain.records import ProfileRow
from app.truth.copying import as_origin
from app.truth.stamper import EditStamper

log = get_logger(__name__)


class ProfileService:
    def __init__(self, uow: UnitOfWorkFactory) -> None:
        self._uow = uow
        self._stamper = EditStamper(Origin.USER)

    async def get(self, user: AuthUser) -> ProfileRow:
        async with self._uow(user.id) as uow:
            profile = await uow.profiles.get(user.id)
        if profile is None:
            raise NotFound("No saved profile yet.", reason="no_profile")
        return profile

    async def save(self, user: AuthUser, incoming: CvContentIn,
                   expected_version: int | None) -> int:
        """expected_version None = create; otherwise update or 409."""
        async with self._uow(user.id) as uow:
            current = await uow.profiles.get(user.id)
            content = self._stamper.stamp_full(incoming, current.content if current else None)
            version = await self._write(uow, user, content, expected_version)
        log.info("profile_saved", row_version=version)
        return version

    async def replace_with(self, user: AuthUser, content: CvContent,
                           expected_version: int | None) -> int:
        """Save to profile (B6): the resume's content becomes the user's own facts."""
        adopted = as_origin(content, Origin.USER)
        async with self._uow(user.id) as uow:
            version = await self._write(uow, user, adopted, expected_version)
        log.info("profile_replaced_from_resume", row_version=version)
        return version

    @staticmethod
    async def _write(uow, user: AuthUser, content: CvContent,
                     expected_version: int | None) -> int:
        chash = content_hash(content)
        if expected_version is None:
            version = await uow.profiles.create(user.id, content, chash)
        else:
            version = await uow.profiles.update(user.id, content, chash, expected_version)
        if version is None:
            raise StaleVersion(reason="profile")
        return version
