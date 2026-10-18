"""Test doubles for the edges: token verifier, storage, Supabase admin, LaTeX compiler."""

import uuid
from io import BytesIO

import psycopg
from pypdf import PdfWriter

from app.core.errors import NotFound, Unauthorized
from app.domain.auth import AuthUser


class FakeVerifier:
    """Accepts 'user:<uuid>' tokens. Signature checks are covered by test_jwt_verifier."""

    async def verify(self, token: str) -> AuthUser:
        if not token.startswith("user:"):
            raise Unauthorized(reason="invalid")
        return AuthUser(id=uuid.UUID(token[5:]), email=None, provider="google",
                        access_token=token)


class FakeFileStore:
    """In-memory storage that enforces the same own-folder rule as storage RLS."""

    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def _own(self, user: AuthUser, path: str) -> None:
        if not path.startswith(f"{user.id}/"):
            raise NotFound(reason="foreign_path")

    async def put(self, user, path, data, content_type):
        self._own(user, path)
        self.objects[path] = data

    async def get(self, user, path):
        self._own(user, path)
        if path not in self.objects:
            raise NotFound(reason="storage_object")
        return self.objects[path]

    async def signed_url(self, user, path):
        self._own(user, path)
        return f"https://storage.test/sign/{path}?token=t"

    async def delete_prefix(self, user, prefix):
        self._own(user, prefix + "/")
        doomed = [p for p in self.objects if p.startswith(prefix + "/")]
        for p in doomed:
            del self.objects[p]
        return len(doomed)


class FakeLatexCompiler:
    """Returns a real (blank) PDF with `pages` pages and records each .tex it was given."""

    def __init__(self, pages: int = 1) -> None:
        self.pages = pages
        self.sources: list[str] = []

    async def compile(self, tex: str) -> bytes:
        self.sources.append(tex)
        writer = PdfWriter()
        for _ in range(self.pages):
            writer.add_blank_page(width=612, height=792)
        out = BytesIO()
        writer.write(out)
        return out.getvalue()


class FakeAdmin:
    """Deletes the auth user directly, so the DB cascade runs as in Supabase."""

    def __init__(self, admin_url: str) -> None:
        self._url = admin_url

    async def delete_user(self, user: AuthUser) -> None:
        with psycopg.connect(self._url, autocommit=True) as conn:
            conn.execute("delete from auth.users where id = %s", (user.id,))
