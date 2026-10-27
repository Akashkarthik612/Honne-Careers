"""Content hashes: sha256 over canonical JSON. Drives PDF reuse and the analysis cache."""

import hashlib
import json

from pydantic import BaseModel


def content_hash(model: BaseModel) -> str:
    canonical = json.dumps(model.model_dump(mode="json"), sort_keys=True, separators=(",", ":"),
                           ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def render_key(chash: str, template: str, revision: int, order: tuple[str, ...]) -> str:
    """PDF cache key: everything that changes the PDF. Switching template or section order,
    or a template revision bump, gives a new key, so an old PDF is never served (PDF-1)."""
    parts = json.dumps([chash, template, revision, list(order)], separators=(",", ":"))
    return hashlib.sha256(parts.encode("utf-8")).hexdigest()
