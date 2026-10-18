"""get_current_user: Authorization header -> verified AuthUser, or 401."""

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt_verifier import JwtVerifier
from app.core import context
from app.core.errors import Unauthorized
from app.domain.auth import AuthUser

_bearer = HTTPBearer(auto_error=False)


def get_jwt_verifier(request: Request) -> JwtVerifier:
    return request.app.state.container.jwt_verifier


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    verifier: Annotated[JwtVerifier, Depends(get_jwt_verifier)],
) -> AuthUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise Unauthorized(reason="missing")
    if len(credentials.credentials) > 8192:
        raise Unauthorized(reason="oversized")
    user = await verifier.verify(credentials.credentials)
    context.user_id.set(str(user.id))
    return user


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
