"""CvFileStore: Supabase Storage adapter (B7). Uses the *user's* token, so storage RLS
(first folder = auth.uid()) applies on top of our own path building.

Paths are built here from the verified user id and server-generated ids only; a client
filename never becomes part of a path (security §1.4).
"""

from typing import Any
from uuid import UUID

import httpx

from app.core.errors import NotFound, StorageFailed
from app.core.logging import get_logger
from app.domain.auth import AuthUser

log = get_logger(__name__)

UPLOAD_EXTENSIONS = {"pdf": "application/pdf",
                     "docx": "application/vnd.openxmlformats-officedocument."
                             "wordprocessingml.document",
                     "tex": "text/plain"}


def upload_path(user_id: UUID, upload_id: UUID, ext: str) -> str:
    if ext not in UPLOAD_EXTENSIONS:
        raise ValueError(f"extension not allowed: {ext}")
    return f"{user_id}/uploads/{upload_id}.{ext}"


def resume_prefix(user_id: UUID, resume_id: UUID) -> str:
    return f"{user_id}/resumes/{resume_id}"


def pdf_path(user_id: UUID, resume_id: UUID, content_hash: str) -> str:
    if len(content_hash) != 64 or not all(c in "0123456789abcdef" for c in content_hash):
        raise ValueError("content hash must be sha256 hex")
    return f"{resume_prefix(user_id, resume_id)}/{content_hash}.pdf"


def application_prefix(user_id: UUID, application_id: UUID) -> str:
    return f"{user_id}/applications/{application_id}"


def application_pdf_path(user_id: UUID, application_id: UUID, content_hash: str) -> str:
    """Our own copy of a downloaded PDF (Day 2 §1). Outside resumes/, so it outlives the
    resume card and is removed with the application row."""
    if len(content_hash) != 64 or not all(c in "0123456789abcdef" for c in content_hash):
        raise ValueError("content hash must be sha256 hex")
    return f"{application_prefix(user_id, application_id)}/{content_hash}.pdf"


class CvFileStore:
    def __init__(self, http: httpx.AsyncClient, supabase_url: str, anon_key: str, bucket: str,
                 signed_url_ttl_s: int) -> None:
        self._http = http
        self._base = f"{supabase_url.rstrip('/')}/storage/v1"
        self._anon_key = anon_key
        self._bucket = bucket
        self._ttl = signed_url_ttl_s

    def _headers(self, user: AuthUser, extra: dict[str, str] | None = None) -> dict[str, str]:
        return {"Authorization": f"Bearer {user.access_token}", "apikey": self._anon_key,
                **(extra or {})}

    def _own(self, user: AuthUser, path: str) -> None:
        # Defence in depth: never touch a path outside the caller's folder.
        if not path.startswith(f"{user.id}/") or ".." in path:
            raise NotFound(reason="foreign_path")

    async def put(self, user: AuthUser, path: str, data: bytes, content_type: str) -> None:
        self._own(user, path)
        await self._call("upload", "POST", f"/object/{self._bucket}/{path}", user,
                         content=data,
                         headers={"Content-Type": content_type, "x-upsert": "true"})

    async def get(self, user: AuthUser, path: str) -> bytes:
        self._own(user, path)
        response = await self._call("download", "GET",
                                    f"/object/authenticated/{self._bucket}/{path}", user)
        return response.content

    async def signed_url(self, user: AuthUser, path: str) -> str:
        self._own(user, path)
        response = await self._call("sign", "POST", f"/object/sign/{self._bucket}/{path}", user,
                                    json={"expiresIn": self._ttl})
        return f"{self._base}{response.json()['signedURL']}"

    async def copy(self, user: AuthUser, source: str, dest: str) -> None:
        """Server-side copy inside the bucket: no bytes pass through the API. Overwrites, so a
        retried save that already copied succeeds (paths are content-addressed)."""
        self._own(user, source)
        self._own(user, dest)
        await self._call("copy", "POST", "/object/copy", user, headers={"x-upsert": "true"},
                         json={"bucketId": self._bucket, "sourceKey": source,
                               "destinationKey": dest})

    async def delete_paths(self, user: AuthUser, paths: list[str]) -> None:
        """Deletes exact objects; a path that is already gone is not an error."""
        for path in paths:
            self._own(user, path)
        for start in range(0, len(paths), 100):
            await self._call("delete", "DELETE", f"/object/{self._bucket}", user,
                             json={"prefixes": paths[start:start + 100]})

    async def delete_prefix(self, user: AuthUser, prefix: str) -> int:
        """Deletes every object under prefix (storage doesn't cascade, B12 #4)."""
        self._own(user, prefix + "/")
        paths = await self._list_recursive(user, prefix)
        for start in range(0, len(paths), 100):
            await self._call("delete", "DELETE", f"/object/{self._bucket}", user,
                             json={"prefixes": paths[start:start + 100]})
        log.info("storage_prefix_deleted", object_count=len(paths))
        return len(paths)

    async def _list_recursive(self, user: AuthUser, prefix: str, depth: int = 0) -> list[str]:
        if depth > 4:  # our layout is at most 3 levels deep
            raise StorageFailed(reason="listing_too_deep")
        response = await self._call("list", "POST", f"/object/list/{self._bucket}", user,
                                    json={"prefix": prefix, "limit": 1000, "offset": 0})
        paths: list[str] = []
        for entry in response.json():
            child = f"{prefix}/{entry['name']}"
            if entry.get("id") is None:  # a folder
                paths += await self._list_recursive(user, child, depth + 1)
            else:
                paths.append(child)
        return paths

    async def _call(self, op: str, method: str, url: str, user: AuthUser,
                    headers: dict[str, str] | None = None, **kwargs: Any) -> httpx.Response:
        try:
            response = await self._http.request(method, f"{self._base}{url}",
                                                headers=self._headers(user, headers),
                                                timeout=30.0, **kwargs)
        except httpx.HTTPError as exc:
            log.error("storage_call_failed", op=op, error_type=type(exc).__name__)
            raise StorageFailed(op=op) from exc
        if response.status_code in (400, 404) and op in ("download", "sign"):
            raise NotFound(reason="storage_object")
        if response.status_code >= 400:
            log.error("storage_call_failed", op=op, status=response.status_code)
            raise StorageFailed(op=op)
        return response
