"""ChatAgentRunner: answers one chat turn with one agent (Day_3 §3.1).

AgentSpec (user-made or built-in, the runner can't tell) -> the tools its knowledge grants
-> the stacked system prompt -> TurnGraph. Each turn is one tracer span and one agent_runs
row (tokens summed over rounds, tool names), recorded whether it succeeds or fails.
A chat turn runs on a checkpointed thread (the assistant message id) so Retry can resume
it; Try it runs with no thread.
"""

import time
from collections.abc import Callable
from datetime import UTC, date, datetime
from uuid import UUID

from app.agents.chat.graph import OnStep, ResumePoint, TurnContext, TurnGraph, Usage
from app.agents.chat.prompt import BUILDER_VERSION, ChatPromptBuilder
from app.agents.chat.tools import KnowledgeTools
from app.agents.registry import ModelResolver, ProviderFactory
from app.agents.runner import AgentRunRecorder
from app.agents.tracing import Tracer
from app.core import context
from app.core.errors import AppError
from app.core.logging import get_logger
from app.domain.agents import AgentRunRecord, LlmMessage
from app.domain.auth import AuthUser
from app.domain.chat_agents import AgentSpec, TurnResult

log = get_logger(__name__)
CHAT_TIER = "strong"  # Day_3 Q3: one fixed strong model for every agent


class TurnGone(Exception):  # noqa: N818  # a signal, not an error
    """The turn stopped being live mid-run (marked stale, retried or its chat deleted)."""


def run_agent_id(spec: AgentSpec) -> str:
    """agent_runs.agent_id: the built-in's handle, or the user agent's id (never its text).
    An unsaved agent (Try it) has no id yet."""
    if spec.kind == "builtin":
        return f"builtin:{spec.handle}"
    return f"custom:{spec.agent_id}" if spec.agent_id else "custom:preview"


def spec_key(spec: AgentSpec) -> str:
    """Which agent version (and prompt builder) started a run. A resumed run must match (F4)."""
    who = spec.handle if spec.kind == "builtin" else str(spec.agent_id)
    return f"{spec.kind}:{who}:v{spec.version}:{BUILDER_VERSION}"


class ChatAgentRunner:
    def __init__(self, resolver: ModelResolver, providers: ProviderFactory,
                 tools: KnowledgeTools, graph: TurnGraph, recorder: AgentRunRecorder,
                 tracer: Tracer,
                 today: Callable[[], date] = lambda: datetime.now(UTC).date()) -> None:
        self._resolver = resolver
        self._providers = providers
        self._tools = tools
        self._graph = graph
        self._recorder = recorder
        self._tracer = tracer
        self._today = today

    async def resume_point(self, thread: UUID, spec: AgentSpec) -> ResumePoint:
        return await self._graph.resume_point(str(thread), spec_key(spec))

    async def answer(self, user: AuthUser, spec: AgentSpec, history: list[LlmMessage],
                     message: str, *, entity_id: UUID | None, on_step: OnStep,
                     thread: UUID | None = None, resume: bool = False) -> TurnResult:
        model = self._resolver.resolve(CHAT_TIER)
        provider = self._providers.get(model.provider)
        tools = self._tools.for_agent(user, spec.knowledge)
        prompt = ChatPromptBuilder.build(spec, KnowledgeTools.guides(tools), self._today())
        agent = run_agent_id(spec)
        usage = Usage()
        started = time.monotonic()
        error_code: str | None = None
        result: TurnResult | None = None
        async with self._tracer.span("chat_turn", "llm", user_id=user.id, entity_id=entity_id,
                                     agent=agent, agent_version=spec.version,
                                     prompt_hash=prompt.content_hash) as span:
            try:
                ctx = TurnContext(
                    provider=provider, model=model.model_id, system=prompt.text,
                    tools={t.name: t for t in tools}, decls=TurnGraph.declarations(tools),
                    on_step=on_step, usage=usage, agent=agent, entity_id=entity_id)
                result = await self._graph.run(
                    ctx, [*history, LlmMessage(role="user", text=message)],
                    spec_key=spec_key(spec), thread=str(thread) if thread else None,
                    resume=resume)
            except AppError as exc:
                error_code = exc.code
                raise
            except Exception as exc:  # recorded, then re-raised to the job boundary
                error_code = "turn_gone" if isinstance(exc, TurnGone) else "internal_error"
                raise
            finally:
                latency_ms = int((time.monotonic() - started) * 1000)
                status = "succeeded" if result is not None else "failed"
                run_id = await self._recorder.record(AgentRunRecord(
                    user_id=user.id, agent_id=agent, agent_version=spec.version,
                    provider=model.provider, model=model.model_id, status=status,
                    attempts=max(usage.attempts.n, 1),
                    input_tokens=usage.input_tokens or None,
                    output_tokens=usage.output_tokens or None, latency_ms=latency_ms,
                    error_code=error_code, entity_id=entity_id,
                    correlation_id=context.correlation_id.get(),
                    tool_calls=len(usage.tool_names), tool_names=tuple(usage.tool_names)))
                span.update(status=status, attempts=usage.attempts.n, latency_ms=latency_ms,
                            error_code=error_code, input_tokens=usage.input_tokens,
                            output_tokens=usage.output_tokens,
                            tool_calls=len(usage.tool_names), run_id=run_id)
                log.info("chat_turn_run", agent=agent, version=spec.version,
                         model=model.model_id, status=status, attempts=usage.attempts.n,
                         latency_ms=latency_ms, tool_calls=len(usage.tool_names),
                         tools=sorted(set(usage.tool_names)), input_tokens=usage.input_tokens,
                         output_tokens=usage.output_tokens, entity_id=entity_id)
        return result
