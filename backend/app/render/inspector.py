"""PdfInspector: page count (B6: >1 page is a warning, not a failure)."""

from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.core.errors import RenderFailed


class PdfInspector:
    def page_count(self, pdf: bytes) -> int:
        try:
            return len(PdfReader(BytesIO(pdf)).pages)
        except PdfReadError as exc:
            raise RenderFailed(reason="unreadable_output") from exc
