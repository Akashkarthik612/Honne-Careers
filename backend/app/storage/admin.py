"""StorageAdmin: deletes application PDFs across users, for the daily clean-up only (Day 2 §4).

Uses the service-role key, which bypasses storage RLS, so it is deliberately narrow: one
method, and every path must match the application-PDF layout
`{user_id}/applications/{application_id}/{sha256}.pdf`. Never used on a request path.
"""

import re

import httpx

from app.core.errors import StorageFailed
from app.core.logging import get_logger

log = get_logger(__name__)

_UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
APPLICATION_PDF = re.compile(rf"^{_UUID}/applications/{_UUID}/[0-9a-f]{{64}}\.pdf$")


class StorageAdmin:
    def __init__(self, http: httpx.AsyncClient, supabase_url: str, service_role_key: str,
                 bucket: str) -> None:
        self._http = http
        self._url = f"{supabase_url.rstrip('/')}/storage/v1/object/{bucket}"
        self._key = service_role_key

    async def delete_paths(self, paths: list[str]) -> int:
        """Deletes in batches of 100. Already-gone paths are fine (idempotent). Any failure
        raises StorageFailed; the caller keeps the rows so the next run retries."""
        bad = [p for p in paths if not APPLICATION_PDF.match(p)]
        if bad:
            raise ValueError(f"{len(bad)} path(s) outside the application-PDF layout")
        for start in range(0, len(paths), 100):
            batch = paths[start:start + 100]
            try:
                response = await self._http.request(
                    "DELETE", self._url, json={"prefixes": batch}, timeout=30.0,
                    headers={"Authorization": f"Bearer {self._key}", "apikey": self._key})
            except httpx.HTTPError as exc:
                log.error("storage_admin_delete_failed", error_type=type(exc).__name__,
                          object_count=len(batch))
                raise StorageFailed(op="admin_delete") from exc
            if response.status_code >= 400:
                log.error("storage_admin_delete_failed", status=response.status_code,
                          object_count=len(batch))
                raise StorageFailed(op="admin_delete")
        return len(paths)
