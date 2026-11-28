"""FastAPI dependencies: the signed-in user and the services, from the Container."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, Request

from app.auth.dependencies import get_current_user
from app.container import Container
from app.core.errors import BetaUnavailable
from app.domain.auth import AuthUser


def get_container(request: Request) -> Container:
    return request.app.state.container


async def get_user(user: Annotated[AuthUser, Depends(get_current_user)],
                   container: Annotated[Container, Depends(get_container)]) -> AuthUser:
    """Verified user whose account row exists (created on first request, B1)."""
    settings = container.settings
    if settings.closed_beta:
        now = datetime.now(UTC)
        if now < datetime.fromisoformat(settings.beta_starts_at):
            raise BetaUnavailable("The Honne Careers beta hasn’t opened yet.")
        if now >= datetime.fromisoformat(settings.beta_ends_at):
            raise BetaUnavailable("The beta has ended. The full version launches December 7.")
        invites = {email.strip().casefold() for email in settings.beta_invite_emails.split(",")}
        if not user.email or user.email.casefold() not in invites:
            raise BetaUnavailable()
    await container.accounts.ensure(user)
    return user


User = Annotated[AuthUser, Depends(get_user)]
Deps = Annotated[Container, Depends(get_container)]
