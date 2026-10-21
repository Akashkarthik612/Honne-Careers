"""Day 2 pure pieces: the retention window, the PATCH shape, the admin path allowlist."""

import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.api.schemas import ApplicationPatch
from app.domain.applications import RetentionWindow
from app.storage.admin import APPLICATION_PDF
from app.storage.file_store import application_pdf_path


def test_retention_window_cutoff_and_deletes_on():
    w = RetentionWindow(20)
    now = datetime(2026, 10, 21, 12, tzinfo=UTC)
    assert w.cutoff(now) == datetime(2026, 10, 1, 12, tzinfo=UTC)
    assert w.deletes_on(now) == datetime(2026, 11, 10, 12, tzinfo=UTC)
    # Changing the number changes every row's date: nothing is stored per row.
    assert RetentionWindow(30).deletes_on(now) == datetime(2026, 11, 20, 12, tzinfo=UTC)


def test_patch_sends_only_the_fields_given_and_empty_notes_clear():
    p = ApplicationPatch.model_validate({"expected_version": 3, "notes": "", "referral": None})
    assert p.changes() == {"notes": None, "referral": None}


@pytest.mark.parametrize("field", ["status", "company", "role", "applied_on"])
def test_patch_cannot_clear_required_fields(field):
    with pytest.raises(ValidationError):
        ApplicationPatch.model_validate({"expected_version": 1, field: None})


def test_patch_rejects_unknown_fields():
    with pytest.raises(ValidationError):
        ApplicationPatch.model_validate({"expected_version": 1, "pdf_path": "x"})


def test_admin_deletes_only_application_pdfs():
    u, a = uuid.uuid4(), uuid.uuid4()
    assert APPLICATION_PDF.match(application_pdf_path(u, a, "b" * 64))
    for bad in [f"{u}/resumes/{a}/{'b' * 64}.pdf", f"{u}/uploads/{a}.pdf", f"{u}",
                f"{u}/applications/../{a}/{'b' * 64}.pdf", f"{u}/applications/{a}/x.pdf"]:
        assert not APPLICATION_PDF.match(bad), bad


def test_application_pdf_path_needs_a_sha256():
    with pytest.raises(ValueError):
        application_pdf_path(uuid.uuid4(), uuid.uuid4(), "../../x")


async def test_copy_and_admin_delete_send_the_right_storage_calls():
    import json

    import httpx

    from app.core.errors import NotFound, StorageFailed
    from app.domain.auth import AuthUser
    from app.storage.admin import StorageAdmin
    from app.storage.file_store import CvFileStore

    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path, json.loads(request.content or b"{}"),
                      request.headers.get("authorization")))
        status = 500 if b"boom" in request.content else 200
        return httpx.Response(status, json={})

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    user = AuthUser(id=uuid.uuid4(), email=None, provider="google", access_token="user-token")
    store = CvFileStore(http, "https://p.supabase.test", "anon", "cv-files", 300)
    src = f"{user.id}/resumes/{uuid.uuid4()}/{'a' * 64}.pdf"
    dest = application_pdf_path(user.id, uuid.uuid4(), "a" * 64)
    await store.copy(user, src, dest)
    assert calls[-1][:3] == ("POST", "/storage/v1/object/copy",
                             {"bucketId": "cv-files", "sourceKey": src, "destinationKey": dest})
    assert calls[-1][3] == "Bearer user-token"  # the user's token: storage RLS applies
    with pytest.raises(NotFound):
        await store.copy(user, src, f"{uuid.uuid4()}/applications/x.pdf")  # foreign folder

    admin = StorageAdmin(http, "https://p.supabase.test", "service-key", "cv-files")
    paths = [application_pdf_path(uuid.uuid4(), uuid.uuid4(), "c" * 64) for _ in range(150)]
    assert await admin.delete_paths(paths) == 150
    deletes = [c for c in calls if c[0] == "DELETE"]
    assert [len(c[2]["prefixes"]) for c in deletes] == [100, 50]
    assert deletes[0][3] == "Bearer service-key"
    with pytest.raises(ValueError):
        await admin.delete_paths([src])  # a resume PDF: never the janitor's to delete

    def failing(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    down = StorageAdmin(httpx.AsyncClient(transport=httpx.MockTransport(failing)),
                        "https://p.supabase.test", "k", "cv-files")
    with pytest.raises(StorageFailed):
        await down.delete_paths(paths[:1])
