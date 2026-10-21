"""App factory. `uvicorn app.main:app` in production; tests call create_app(container)."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import account, applications, resumes, tailoring, uploads
from app.container import Container, build_container
from app.core.config import get_settings
from app.core.http import (
    BodySizeLimitMiddleware,
    CorrelationIdMiddleware,
    SecurityHeadersMiddleware,
    install_error_handlers,
)
from app.core.logging import configure_logging, get_logger

log = get_logger(__name__)
ROUTERS = [account.router, applications.router, resumes.router, tailoring.router,
           uploads.router]


def create_app(container: Container) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        await container.start()
        log.info("app_started", env=container.settings.env)
        try:
            yield
        finally:
            await container.stop()

    prod = container.settings.env == "prod"
    app = FastAPI(title="Honne Careers API", lifespan=lifespan,
                  docs_url=None if prod else "/docs", redoc_url=None,
                  openapi_url=None if prod else "/openapi.json")
    app.state.container = container
    install_error_handlers(app)
    for router in ROUTERS:
        app.include_router(router)

    # Order: last added runs first. Correlation id wraps everything so even 413s carry it.
    app.add_middleware(CORSMiddleware, allow_origins=container.settings.cors_origins,
                       allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
                       allow_headers=["Authorization", "Content-Type", "X-Correlation-Id"],
                       expose_headers=["X-Correlation-Id"], allow_credentials=False,
                       max_age=600)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=container.settings.max_request_bytes)
    app.add_middleware(CorrelationIdMiddleware)
    return app


def _production_app() -> FastAPI:
    settings = get_settings()
    configure_logging()
    return create_app(build_container(settings))


def __getattr__(name: str) -> FastAPI:
    # `uvicorn app.main:app` builds the real app lazily, so importing this module in
    # tests doesn't require production env vars.
    if name == "app":
        return _production_app()
    raise AttributeError(name)
