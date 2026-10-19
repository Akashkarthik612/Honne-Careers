"""SettingsService: Settings page preferences (display name, ask-before-save, emails)."""

from app.core.logging import get_logger
from app.db.unit_of_work import UnitOfWorkFactory
from app.domain.auth import AuthUser
from app.domain.records import SettingsRow

log = get_logger(__name__)

# The table defaults (20261019000001). No row yet = the user never changed a setting.
DEFAULT_SETTINGS = SettingsRow(display_name=None, ask_before_save=True, product_emails=False)


class SettingsService:
    def __init__(self, uow: UnitOfWorkFactory) -> None:
        self._uow = uow

    async def get(self, user: AuthUser) -> SettingsRow:
        async with self._uow(user.id) as uow:
            return await uow.settings.get(user.id) or DEFAULT_SETTINGS

    async def save(self, user: AuthUser, settings: SettingsRow) -> SettingsRow:
        async with self._uow(user.id) as uow:
            saved = await uow.settings.upsert(user.id, settings)
        log.info("settings_saved", product_emails=saved.product_emails,
                 ask_before_save=saved.ask_before_save)
        return saved
