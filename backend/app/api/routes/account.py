from dataclasses import asdict

from fastapi import APIRouter, Response

from app.api.deps import Deps, User
from app.api.schemas import SaveSettings, settings_view, usage_view
from app.domain.records import SettingsRow

router = APIRouter(tags=["account"])


@router.get("/health")
async def health(c: Deps) -> dict[str, str]:
    """No auth. Checks the DB pool answers, nothing else."""
    await c.db.ping()
    return {"status": "ok"}


@router.get("/me")
async def me(user: User, c: Deps) -> dict[str, object]:
    return asdict(await c.accounts.me(user))


@router.get("/me/usage")
async def my_usage(user: User, c: Deps) -> dict[str, object]:
    """Today's usage against the user's limits (config/limits.yaml), for Settings."""
    return usage_view(await c.accounts.usage(user))


@router.delete("/me", status_code=204)
async def delete_me(user: User, c: Deps) -> Response:
    """AUTH-3: removes storage files, then the auth user; every row cascades."""
    await c.accounts.delete(user)
    return Response(status_code=204)


@router.get("/settings")
async def get_settings(user: User, c: Deps) -> dict[str, object]:
    return settings_view(await c.user_settings.get(user))


@router.put("/settings")
async def save_settings(body: SaveSettings, user: User, c: Deps) -> dict[str, object]:
    row = SettingsRow(display_name=body.display_name, ask_before_save=body.ask_before_save,
                      product_emails=body.product_emails)
    return settings_view(await c.user_settings.save(user, row))
