"""Day_1 A4 #8: as user B, nothing of user A's is readable or writable, in any table or in
storage. Uses the exact SQL that UserScopedSession runs in production.
"""

import hashlib
import json
import uuid
from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
import pytest
from psycopg import errors

from app.db.session import SET_CLAIMS_SQL, SET_ROLE_SQL, claims_json

pytestmark = pytest.mark.db

TABLES = ["user_accounts", "personal_profiles", "cv_uploads", "job_descriptions",
          "agent_runs", "resumes", "cv_analyses", "usage_events"]
H = hashlib.sha256(b"x").hexdigest()


@contextmanager
def as_user(url: str, uid: uuid.UUID) -> Iterator[psycopg.Connection]:
    with psycopg.connect(url) as conn, conn.transaction():
        conn.execute(SET_ROLE_SQL)
        conn.execute(SET_CLAIMS_SQL, (claims_json(uid),))
        yield conn


@pytest.fixture(scope="module")
def a_rows(database: str, users: tuple[uuid.UUID, uuid.UUID]) -> dict[str, uuid.UUID]:
    """User A owns one row in every table and one storage object."""
    a, _ = users
    with as_user(database, a) as c:
        c.execute("insert into app.user_accounts (user_id) values (%s)", (a,))
        c.execute("insert into app.personal_profiles (user_id, content, content_hash) "
                  "values (%s, '{}', %s)", (a, H))
        up = c.execute("insert into app.cv_uploads (user_id, source_type, filename, storage_path)"
                       " values (%s, 'pdf', 'a.pdf', 'x') returning id", (a,)).fetchone()[0]
        jd = c.execute("insert into app.job_descriptions (user_id, text, word_count, content_hash)"
                       " values (%s, 'jd', 1, %s) returning id", (a, H)).fetchone()[0]
        run = c.execute("insert into app.agent_runs (user_id, agent_id, agent_version, provider,"
                        " model, status, attempts, latency_ms) values"
                        " (%s, 'cv_tailor', 1, 'fake', 'm', 'succeeded', 1, 5) returning id",
                        (a,)).fetchone()[0]
        res = c.execute("insert into app.resumes (user_id, title, template, mode, jd_id, content,"
                        " content_hash) values (%s, 't', 'jake', 'tailored', %s, '{}', %s)"
                        " returning id", (a, jd, H)).fetchone()[0]
        c.execute("insert into app.cv_analyses (user_id, resume_id, content_hash, jd_content_hash,"
                  " keyword_score, experience_score, narrative_score, details, agent_run_id)"
                  " values (%s, %s, %s, %s, 1, 1, 1, '{}', %s)", (a, res, H, H, run))
        c.execute("insert into app.usage_events (user_id, action) values (%s, 'pdf')", (a,))
        c.execute("insert into storage.objects (bucket_id, name) values ('cv-files', %s)",
                  (f"{a}/resumes/{res}/{H}.pdf",))
    return {"upload": up, "jd": jd, "run": run, "resume": res}


@pytest.mark.parametrize("table", TABLES)
def test_owner_sees_own_rows(database, users, a_rows, table):
    a, _ = users
    with as_user(database, a) as c:
        assert c.execute(f"select count(*) from app.{table}").fetchone()[0] == 1  # noqa: S608


@pytest.mark.parametrize("table", TABLES)
def test_other_user_reads_nothing(database, users, a_rows, table):
    _, b = users
    with as_user(database, b) as c:
        assert c.execute(f"select count(*) from app.{table}").fetchone()[0] == 0  # noqa: S608


@pytest.mark.parametrize("table", ["personal_profiles", "resumes"])
def test_other_user_cannot_update_or_delete(database, users, a_rows, table):
    a, b = users
    with as_user(database, b) as c:
        assert c.execute(f"update app.{table} set row_version = 99").rowcount == 0  # noqa: S608
        assert c.execute(f"delete from app.{table}").rowcount == 0  # noqa: S608
    with as_user(database, a) as c:
        assert c.execute(f"select row_version from app.{table}").fetchone()[0] == 1  # noqa: S608


def test_other_user_cannot_insert_as_owner(database, users, a_rows):
    a, b = users
    with pytest.raises(errors.InsufficientPrivilege), as_user(database, b) as c:
        c.execute("insert into app.usage_events (user_id, action) values (%s, 'pdf')", (a,))


def test_cannot_reference_another_users_row(database, users, a_rows):
    """Composite FK: B's resume cannot point at A's JD even with a known id."""
    _, b = users
    with as_user(database, b) as c:
        c.execute("insert into app.user_accounts (user_id) values (%s) on conflict do nothing",
                  (b,))
    with pytest.raises(errors.ForeignKeyViolation), as_user(database, b) as c:
        c.execute("insert into app.resumes (user_id, title, template, mode, jd_id, content,"
                  " content_hash) values (%s, 't', 'jake', 'tailored', %s, '{}', %s)",
                  (b, a_rows["jd"], H))


def test_user_cannot_change_own_plan(database, users, a_rows):
    a, _ = users
    with pytest.raises(errors.InsufficientPrivilege), as_user(database, a) as c:
        c.execute("update app.user_accounts set plan = 'pro'")


def test_agent_runs_are_append_only(database, users, a_rows):
    a, _ = users
    with pytest.raises(errors.InsufficientPrivilege), as_user(database, a) as c:
        c.execute("delete from app.agent_runs")


def test_backend_role_without_role_switch_is_denied(database, a_rows):
    with pytest.raises(errors.InsufficientPrivilege), psycopg.connect(database) as c:
        c.execute("select count(*) from app.resumes")


def test_claims_do_not_survive_the_transaction(database, users, a_rows):
    a, _ = users
    with psycopg.connect(database) as conn:
        with conn.transaction():
            conn.execute(SET_ROLE_SQL)
            conn.execute(SET_CLAIMS_SQL, (claims_json(a),))
        assert conn.execute("select current_user").fetchone()[0] == "honne_backend"
        claims = conn.execute("select current_setting('request.jwt.claims', true)").fetchone()[0]
        assert not claims or json.loads(claims) == {}


def test_storage_other_user_sees_and_writes_nothing(database, users, a_rows):
    a, b = users
    with as_user(database, b) as c:
        assert c.execute("select count(*) from storage.objects").fetchone()[0] == 0
        assert c.execute("delete from storage.objects").rowcount == 0
    with pytest.raises(errors.InsufficientPrivilege), as_user(database, b) as c:
        c.execute("insert into storage.objects (bucket_id, name) values ('cv-files', %s)",
                  (f"{a}/uploads/evil.pdf",))
    with as_user(database, a) as c:
        assert c.execute("select count(*) from storage.objects").fetchone()[0] == 1
