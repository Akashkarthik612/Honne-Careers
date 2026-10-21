"""Fresh database per test session: stub Supabase, apply every migration, two users.

DATABASE_URL_TEST must point at a throwaway Postgres as a superuser (CI service
container). Unset locally -> db tests are skipped with a clear reason.
"""

import os
import uuid
from collections.abc import AsyncIterator, Iterator
from dataclasses import dataclass
from pathlib import Path

import httpx
import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from app.agents.providers.fake import FakeProvider
from app.container import Container, build_container
from app.core.config import Settings
from app.main import create_app
from tests.fakes import (
    FakeAdmin,
    FakeFileStore,
    FakeLatexCompiler,
    FakeStorageAdmin,
    FakeVerifier,
)

ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = sorted((ROOT / "supabase" / "migrations").glob("*.sql"))
STUB = Path(__file__).resolve().parents[1] / "sql" / "supabase_stub.sql"
BACKEND_PASSWORD = "backend-test-only"

ADMIN_URL = os.environ.get("DATABASE_URL_TEST")


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    if ADMIN_URL:
        return
    if os.environ.get("CI"):
        # In CI a missing DB must fail the run, never silently skip the RLS suite.
        raise pytest.UsageError("DATABASE_URL_TEST is required in CI")
    skip = pytest.mark.skip(reason="DATABASE_URL_TEST not set; RLS tests run in CI")
    for item in items:
        if "db" in item.keywords:
            item.add_marker(skip)


@pytest.fixture(scope="session")
def database() -> Iterator[str]:
    """Creates a uniquely named database, migrates it, yields the backend-role URL."""
    assert ADMIN_URL
    name = f"honne_test_{uuid.uuid4().hex[:8]}"
    with psycopg.connect(ADMIN_URL, autocommit=True) as admin:
        admin.execute(sql.SQL("create database {}").format(sql.Identifier(name)))
    params = conninfo_to_dict(ADMIN_URL)
    test_admin_url = make_conninfo(**{**params, "dbname": name})
    with psycopg.connect(test_admin_url, autocommit=True) as conn:
        conn.execute(STUB.read_text(encoding="utf-8"))
        for migration in MIGRATIONS:
            conn.execute(migration.read_text(encoding="utf-8"))
        conn.execute(sql.SQL("alter role honne_backend password {}").format(
            sql.Literal(BACKEND_PASSWORD)))
    host, port = params.get("host", "localhost"), params.get("port", "5432")
    yield f"postgresql://honne_backend:{BACKEND_PASSWORD}@{host}:{port}/{name}"
    with psycopg.connect(ADMIN_URL, autocommit=True) as admin:
        admin.execute(sql.SQL("drop database {} with (force)").format(sql.Identifier(name)))


@pytest.fixture(scope="session")
def admin_url(database: str) -> str:
    params = conninfo_to_dict(ADMIN_URL or "")
    return make_conninfo(**{**params, "dbname": conninfo_to_dict(database)["dbname"]})


def _new_auth_user(admin_url: str) -> uuid.UUID:
    uid = uuid.uuid4()
    with psycopg.connect(admin_url, autocommit=True) as conn:
        conn.execute("insert into auth.users (id, email) values (%s, %s)",
                     (uid, f"{uid.hex[:6]}@example.test"))
    return uid


@pytest.fixture(scope="session")
def users(admin_url: str) -> tuple[uuid.UUID, uuid.UUID]:
    return _new_auth_user(admin_url), _new_auth_user(admin_url)


# ---------- API harness: real Postgres + RLS, fakes only at the edges ----------

@dataclass
class Api:
    client: httpx.AsyncClient
    container: Container
    provider: FakeProvider
    files: FakeFileStore
    compiler: FakeLatexCompiler
    admin_url: str
    storage_admin: FakeStorageAdmin

    def new_user(self) -> dict[str, str]:
        """Auth headers for a brand-new user."""
        return {"Authorization": f"Bearer user:{_new_auth_user(self.admin_url)}"}


def make_settings(database_url: str) -> Settings:
    return Settings(
        _env_file=None, env="test", database_url=database_url,
        supabase_url="https://proj.supabase.test", supabase_anon_key="anon",
        supabase_service_role_key="service", cors_origins="https://app.test",
        llm_strong="fake:strong", llm_light="fake:light", gemini_api_key="unused",
        llm_backoff_base_s=0.001, janitor_enabled=False,  # tests call the janitor directly
    )


@pytest.fixture
async def api(database: str, admin_url: str) -> AsyncIterator[Api]:
    provider, files, compiler = FakeProvider(), FakeFileStore(), FakeLatexCompiler()
    storage_admin = FakeStorageAdmin(files)
    container = build_container(make_settings(database), providers={"fake": provider},
                                jwt_verifier=FakeVerifier(), files=files,
                                admin=FakeAdmin(admin_url), compiler=compiler,
                                storage_admin=storage_admin)
    await container.start()
    app = create_app(container)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://api.test") as client:
        yield Api(client, container, provider, files, compiler, admin_url, storage_admin)
    await container.stop()
