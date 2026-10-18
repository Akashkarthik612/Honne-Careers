"""JwtVerifier: accepts only valid Supabase user tokens (Day_1 A4 #1, B7).

Checks, in order: algorithm allowlist (asymmetric only, so a leaked anon key can't
forge tokens and "none"/HS256 confusion is impossible), key id present in the
project's JWKS, signature, exp/iat/aud/iss, role == authenticated, not an
anonymous sign-in, sub is a UUID.

JWKS cache: dict kid -> key, refreshed after its TTL. An unknown kid triggers at most
one refresh per `_MIN_REFRESH_S`, so random kids can't make us hammer Supabase.
"""

import time
from typing import Any
from uuid import UUID

import httpx
import jwt

from app.core.errors import AppError, Unauthorized
from app.core.logging import get_logger
from app.domain.auth import AuthUser

log = get_logger(__name__)

ALLOWED_ALGORITHMS = frozenset({"ES256", "RS256"})
_MIN_REFRESH_S = 30.0


class AuthUnavailable(AppError):
    status_code, code, message = 503, "auth_unavailable", "Sign-in is unavailable, try again."


class JwtVerifier:
    def __init__(self, http: httpx.AsyncClient, jwks_url: str, issuer: str, audience: str,
                 leeway_s: int, cache_ttl_s: int) -> None:
        self._http = http
        self._jwks_url = jwks_url
        self._issuer = issuer
        self._audience = audience
        self._leeway_s = leeway_s
        self._cache_ttl_s = cache_ttl_s
        self._keys: dict[str, Any] = {}
        self._fetched_at = 0.0

    async def verify(self, token: str) -> AuthUser:
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as exc:
            raise Unauthorized(reason="malformed") from exc

        alg, kid = header.get("alg"), header.get("kid")
        if alg not in ALLOWED_ALGORITHMS:
            raise Unauthorized(reason="algorithm")
        if not isinstance(kid, str):
            raise Unauthorized(reason="no_kid")

        key = await self._key_for(kid)
        try:
            claims = jwt.decode(
                token, key, algorithms=[alg], audience=self._audience, issuer=self._issuer,
                leeway=self._leeway_s,
                options={"require": ["exp", "iat", "sub", "aud", "iss", "role"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise Unauthorized(reason="expired") from exc
        except jwt.PyJWTError as exc:
            raise Unauthorized(reason="invalid") from exc

        if claims.get("role") != "authenticated" or claims.get("is_anonymous") is True:
            raise Unauthorized(reason="role")
        try:
            user_id = UUID(claims["sub"])
        except (ValueError, TypeError) as exc:
            raise Unauthorized(reason="sub") from exc

        app_meta = claims.get("app_metadata") or {}
        return AuthUser(id=user_id, email=claims.get("email"),
                        provider=app_meta.get("provider"), access_token=token)

    async def _key_for(self, kid: str) -> Any:
        now = time.monotonic()
        stale = now - self._fetched_at > self._cache_ttl_s
        unknown_kid_may_refresh = (kid not in self._keys
                                   and now - self._fetched_at > _MIN_REFRESH_S)
        if stale or unknown_kid_may_refresh:
            await self._refresh()
        key = self._keys.get(kid)
        if key is None:
            raise Unauthorized(reason="unknown_kid")
        return key

    async def _refresh(self) -> None:
        try:
            response = await self._http.get(self._jwks_url, timeout=5.0)
            response.raise_for_status()
            keys = {
                jwk["kid"]: jwt.PyJWK(jwk).key
                for jwk in response.json().get("keys", [])
                if jwk.get("kid") and jwk.get("alg") in ALLOWED_ALGORITHMS
            }
        except (httpx.HTTPError, ValueError, jwt.PyJWTError) as exc:
            log.error("jwks_fetch_failed", error_type=type(exc).__name__,
                      cached_keys=len(self._keys))
            raise AuthUnavailable from exc
        if not keys:
            # Project still on legacy HS256 secrets: refuse loudly rather than accept HS256.
            log.error("jwks_empty", hint="enable asymmetric JWT signing keys in Supabase")
            raise AuthUnavailable
        self._keys = keys
        self._fetched_at = time.monotonic()
        log.info("jwks_refreshed", key_count=len(keys))
