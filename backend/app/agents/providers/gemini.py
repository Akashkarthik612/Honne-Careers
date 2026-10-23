"""GeminiProvider: google-genai adapter. JSON output forced by response_json_schema;
chat agents use native function calling (mode ANY: every reply is a tool call)."""

from typing import Any

import httpx
from google import genai
from google.genai import errors, types

from app.agents.providers.base import LlmPermanentError, LlmTransientError
from app.domain.agents import LlmMessage, LlmResult, ToolCall, ToolDecl, ToolTurn

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


def inline_refs(schema: dict[str, Any]) -> dict[str, Any]:
    """Pydantic puts nested models in $defs and points at them with $ref. Function
    declarations get a self-contained copy (Gemini's function schemas are a JSON Schema
    subset). Our schemas aren't recursive, so this terminates."""
    defs = schema.get("$defs", {})

    def walk(node: Any) -> Any:
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str) and ref.startswith("#/$defs/"):
                return walk(defs[ref.removeprefix("#/$defs/")])
            return {k: walk(v) for k, v in node.items() if k != "$defs"}
        if isinstance(node, list):
            return [walk(v) for v in node]
        return node

    return walk(schema)


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
        response = await self._send(model, user, config)
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

    async def generate_with_tools(self, *, system: str, messages: list[LlmMessage],
                                  tools: list[ToolDecl], model: str, temperature: float,
                                  max_output_tokens: int) -> ToolTurn:
        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            tools=[types.Tool(function_declarations=[
                types.FunctionDeclaration(name=t.name, description=t.description,
                                          parameters_json_schema=gemini_schema(inline_refs(t.parameters)))
                for t in tools])],
            tool_config=types.ToolConfig(function_calling_config=types.FunctionCallingConfig(
                mode=types.FunctionCallingConfigMode.ANY)),
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )
        response = await self._send(model, [_content(m) for m in messages], config)
        candidate = response.candidates[0] if response.candidates else None
        calls = tuple(ToolCall(id=c.id, name=c.name or "", args=dict(c.args or {}))
                      for c in (response.function_calls or []))
        if not calls and not response.text:
            reason = candidate.finish_reason if candidate else None
            raise LlmPermanentError(f"empty reply, finish_reason={reason}")
        usage = response.usage_metadata
        return ToolTurn(
            tool_calls=calls, text=None if calls else response.text,
            input_tokens=usage.prompt_token_count if usage else None,
            output_tokens=usage.candidates_token_count if usage else None,
            raw=candidate.content if candidate else None,  # keeps thought signatures
        )

    def raw_to_wire(self, raw: Any) -> Any:
        if not isinstance(raw, types.Content):
            raise TypeError(f"not a Gemini Content: {type(raw).__name__}")
        return raw.model_dump(mode="json", exclude_none=True)  # bytes -> base64

    def raw_from_wire(self, data: Any) -> Any:
        return types.Content.model_validate(data)

    async def _send(self, model: str, contents: Any,
                    config: types.GenerateContentConfig) -> types.GenerateContentResponse:
        try:
            return await self._client.aio.models.generate_content(
                model=model, contents=contents, config=config)
        except errors.APIError as exc:
            if exc.code in _TRANSIENT_STATUS:
                raise LlmTransientError(f"gemini status {exc.code}") from exc
            raise LlmPermanentError(f"gemini status {exc.code}") from exc
        except (httpx.TimeoutException, httpx.TransportError) as exc:
            raise LlmTransientError(type(exc).__name__) from exc


def _content(m: LlmMessage) -> types.Content:
    """LlmMessage -> Gemini Content. A model turn is re-sent as the SDK returned it."""
    if m.role == "model":
        if isinstance(m.raw, types.Content):
            return m.raw
        parts = [types.Part(function_call=types.FunctionCall(id=c.id, name=c.name, args=c.args))
                 for c in m.tool_calls] or [types.Part(text=m.text or "")]
        return types.Content(role="model", parts=parts)
    if m.role == "tool":
        return types.Content(role="user", parts=[
            types.Part(function_response=types.FunctionResponse(id=r.call_id, name=r.name,
                                                                response=r.content))
            for r in m.tool_results])
    return types.Content(role="user", parts=[types.Part(text=m.text or "")])
