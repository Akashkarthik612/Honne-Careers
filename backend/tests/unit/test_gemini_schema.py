"""Gemini gets agent schemas without list-size caps; the runner still enforces them."""

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.agents.providers.gemini import gemini_schema
from app.agents.registry import AgentRegistry

BACKEND = Path(__file__).resolve().parents[2]
REGISTRY = AgentRegistry.load(BACKEND / "agents", BACKEND)


def _keywords(node, found):
    if isinstance(node, dict):
        found.update(node)
        for value in node.values():
            _keywords(value, found)
    elif isinstance(node, list):
        for value in node:
            _keywords(value, found)
    return found


@pytest.mark.parametrize("agent_id", REGISTRY.ids())
def test_sent_schema_has_no_list_caps(agent_id):
    sent = gemini_schema(REGISTRY.get(agent_id).output_json_schema)
    assert not _keywords(sent, set()) & {"maxItems", "minItems"}


def test_original_schema_is_not_modified():
    original = REGISTRY.get("cv_parser").output_json_schema
    gemini_schema(original)
    assert "maxItems" in _keywords(original, set())


def test_other_constraints_are_kept():
    sent = gemini_schema(REGISTRY.get("cv_parser").output_json_schema)
    assert {"maxLength", "required", "$ref"} <= _keywords(sent, set())


def test_over_cap_reply_is_still_rejected():
    # The cap Gemini no longer sees is still checked when the reply is validated.
    parsed_cv = REGISTRY.get("cv_parser").output_model
    reply = {"header": {}, "skills": {"languages": [f"L{i}" for i in range(41)]}}
    with pytest.raises(ValidationError):
        parsed_cv.model_validate(reply)
