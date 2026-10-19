"""GeminiProvider: google-genai adapter. JSON output forced by response_json_schema."""

from typing import Any

import httpx
from google import genai
from google.genai import errors, types

from app.agents.providers.base import LlmPermanentError, LlmTransientError
from app.domain.agents import LlmResult

_TRANSIENT_STATUS = frozenset({408, 429, 500, 502, 503, 504})

# Gemini rejects (400 INVALID_ARGUMENT) schemas that are too complex for constrained decoding;
# list-size caps on nested arrays (cv_parser, cv_tailor) push them over. The caps stay enforced:
# AgentRunner validates every reply against the full Pydantic model -> llm_output_invalid.
_UNSENT_KEYWORDS = frozenset({"maxItems", "minItems"})


def gemini_schema(schema: Any) -> Any:
    """Copy of `schema` without the keywords Gemini can't take; the input is not modified."""
    if isinstance(schema, dict):
        return {k: gemini_schema(v) for k, v in schema.items() if k not in _UNSENT_KEYWORDS}
    if isinstance(schema, list):
        return [gemini_schema(v) for v in schema]
    return schema


class GeminiProvider:
    name = "gemini"

    def __init__(self, api_key: str) -> None:
        # SDK retries off: AgentRunner owns retries so each one is counted and logged.
        self._client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(retry_options=types.HttpRetryOptions(attempts=1)),
        )

    async def generate(self, *, system: str, user: str, schema: dict[str, Any], model: str,
                       temperature: float, max_output_tokens: int) -> LlmResult:
        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            response_mime_type="application/json",
            response_json_schema=gemini_schema(schema),
        )
        try:
            response = await self._client.aio.models.generate_content(
                model=model, contents=user, config=config)
        except errors.APIError as exc:
            if exc.code in _TRANSIENT_STATUS:
                raise LlmTransientError(f"gemini status {exc.code}") from exc
            raise LlmPermanentError(f"gemini status {exc.code}") from exc
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise LlmTransientError(type(exc).__name__) from exc

        text = response.text
        if not text:
            # Safety block or MAX_TOKENS with no JSON: retrying the same input won't help.
            reason = response.candidates[0].finish_reason if response.candidates else None
            raise LlmPermanentError(f"empty reply, finish_reason={reason}")
        usage = response.usage_metadata
        return LlmResult(
            text=text,
            input_tokens=usage.prompt_token_count if usage else None,
            output_tokens=usage.candidates_token_count if usage else None,
        )
