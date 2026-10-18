"""FastAPI dependencies: the signed-in user and the services, from the Container."""

from typing import Annotated

from fastapi import Depends, Request

from app.auth.dependencies import get_current_user
from app.container import Container
from app.domain.auth import AuthUser


def get_container(request: Request) -> Container:
    return request.app.state.container


async def get_user(user: Annotated[AuthUser, Depends(get_current_user)],
                   container: Annotated[Container, Depends(get_container)]) -> AuthUser:
    """Verified user whose account row exists (created on first request, B1)."""
    await container.accounts.ensure(user)
    return user


User = Annotated[AuthUser, Depends(get_user)]
Deps = Annotated[Container, Depends(get_container)]
