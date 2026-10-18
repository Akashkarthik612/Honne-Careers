"""HTTP edge: correlation id, body size cap, security headers, error mapping.

Pure ASGI middlewares (no BaseHTTPMiddleware) so streaming bodies are counted
as they arrive, not after they are buffered.
"""

import re
import uuid
from collections.abc import Awaitable, Callable, MutableMapping
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core import context
from app.core.errors import AppError
from app.core.logging import get_logger

log = get_logger(__name__)

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]

_CORRELATION_HEADER = b"x-correlation-id"
_SAFE_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")


class CorrelationIdMiddleware:
    """Takes a well-formed X-Correlation-Id from the client or makes one; echoes it back."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        incoming = dict(scope["headers"]).get(_CORRELATION_HEADER, b"").decode("latin-1")
        cid = incoming if _SAFE_ID.match(incoming) else uuid.uuid4().hex
        token_cid = context.correlation_id.set(cid)
        token_uid = context.user_id.set(None)

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", []).append((_CORRELATION_HEADER, cid.encode()))
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            context.correlation_id.reset(token_cid)
            context.user_id.reset(token_uid)


class BodySizeLimitMiddleware:
    """Rejects bodies over max_bytes with 413, whether or not Content-Length is sent."""

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        declared = dict(scope["headers"]).get(b"content-length")
        if declared is not None and declared.isdigit() and int(declared) > self.max_bytes:
            await _too_large(send)
            return

        received = 0

        async def counting_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _BodyTooLarge
            return message

        try:
            await self.app(scope, counting_receive, send)
        except _BodyTooLarge:
            log.warning("request_body_too_large", limit=self.max_bytes)
            await _too_large(send)


class _BodyTooLarge(Exception):
    pass


async def _too_large(send: Send) -> None:
    body = b'{"error":{"code":"payload_too_large","message":"Request is too large."}}'
    await send({"type": "http.response.start", "status": 413,
                "headers": [(b"content-type", b"application/json")]})
    await send({"type": "http.response.body", "body": body})


_SECURITY_HEADERS = [
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"no-referrer"),
    (b"strict-transport-security", b"max-age=63072000; includeSubDomains"),
    (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"),
    (b"cache-control", b"no-store"),  # responses carry personal data
]


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                message.setdefault("headers", []).extend(_SECURITY_HEADERS)
            await send(message)

        await self.app(scope, receive, send_with_headers)


def _error_body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message,
                             "correlation_id": context.correlation_id.get()}
    if details:
        error["details"] = details
    return {"error": error}


def install_error_handlers(app: FastAPI) -> None:
    """ErrorMapper: domain exception -> status + stable code. No stack traces leave the server."""

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        level = log.error if exc.status_code >= 500 else log.info
        level("request_failed", code=exc.code, status=exc.status_code, **exc.details)
        return JSONResponse(status_code=exc.status_code,
                            content=_error_body(exc.code, exc.message, exc.details or None))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Field locations and error types only; never echo the submitted values.
        fields = [{"loc": [str(p) for p in e["loc"]], "type": e["type"]} for e in exc.errors()]
        log.info("request_invalid", fields=fields)
        return JSONResponse(status_code=422,
                            content=_error_body("invalid_input", "Some fields are invalid.",
                                                {"fields": fields}))

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
        # Logged loudly with the traceback, then a generic 500. This is the boundary, not a
        # fallback: the request has already failed.
        log.exception("unhandled_error", error_type=type(exc).__name__)
        return JSONResponse(status_code=500,
                            content=_error_body("internal_error", "Something went wrong."))
