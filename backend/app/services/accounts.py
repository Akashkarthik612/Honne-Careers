"""AccountService: /me, first-request account creation, account deletion (AUTH-3)."""

from collections import OrderedDict
from dataclasses import dataclass

import httpx
import psycopg

from app.core.errors import StorageFailed, Unauthorized
from app.core.logging import get_logger
from app.db.unit_of_work import UnitOfWorkFactory
from app.domain.auth import AuthUser
from app.policy.quota import QuotaGuard, Usage
from app.storage.file_store import CvFileStore

log = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class MeView:
    user_id: str
    email: str | None
    provider: str | None
    plan: str
    has_profile: bool


class SupabaseAdmin:
    """The only holder of the service-role key. Used for one thing: deleting the auth user."""

    def __init__(self, http: httpx.AsyncClient, supabase_url: str, service_role_key: str) -> None:
        self._http = http
        self._url = f"{supabase_url.rstrip('/')}/auth/v1/admin/users"
        self._key = service_role_key

    async def delete_user(self, user: AuthUser) -> None:
        try:
            response = await self._http.delete(
                f"{self._url}/{user.id}", timeout=15.0,
                headers={"Authorization": f"Bearer {self._key}", "apikey": self._key})
        except httpx.HTTPError as exc:
            log.error("auth_user_delete_failed", error_type=type(exc).__name__)
            raise StorageFailed("Couldn't delete the account, try again.") from exc
        if response.status_code >= 400:
            log.error("auth_user_delete_failed", status=response.status_code)
            raise StorageFailed("Couldn't delete the account, try again.")


class AccountService:
    _ENSURED_MAX = 10_000

    def __init__(self, uow: UnitOfWorkFactory, files: CvFileStore, admin: SupabaseAdmin,
                 quota: QuotaGuard) -> None:
        self._uow = uow
        self._files = files
        self._admin = admin
        self._quota = quota
        self._ensured: OrderedDict[str, None] = OrderedDict()  # bounded LRU of known users

    async def ensure(self, user: AuthUser) -> None:
        """Creates the account row once per user per process (one write, then a cache hit)."""
        key = str(user.id)
        if key in self._ensured:
            self._ensured.move_to_end(key)
            return
        try:
            async with self._uow(user.id) as uow:
                await uow.accounts.ensure(user.id)
        except psycopg.errors.ForeignKeyViolation as exc:
            # Token still valid but the auth user is gone (account deleted).
            raise Unauthorized(reason="user_deleted") from exc
        self._ensured[key] = None
        if len(self._ensured) > self._ENSURED_MAX:
            self._ensured.popitem(last=False)

    async def me(self, user: AuthUser) -> MeView:
        async with self._uow(user.id) as uow:
            account = await uow.accounts.get(user.id)
        if account is None:  # the dependency ensured it, so absence = deleted meanwhile
            raise Unauthorized(reason="user_deleted")
        return MeView(str(user.id), user.email, user.provider, account.plan, account.has_profile)

    async def usage(self, user: AuthUser) -> Usage:
        async with self._uow(user.id) as uow:
            return await self._quota.usage(uow, user.id)

    async def delete(self, user: AuthUser) -> None:
        """AUTH-3. Order: storage files -> auth user (DB rows cascade from auth.users).
        A failure stops the deletion loudly; re-running it is safe."""
        log.warning("account_delete_started")
        removed = await self._files.delete_prefix(user, str(user.id))
        await self._admin.delete_user(user)
        self._ensured.pop(str(user.id), None)
        log.warning("account_deleted", storage_objects=removed)
