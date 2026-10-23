"""TurnGraph: one chat turn's function-calling loop as a LangGraph graph (Day_3 §3.1, replaces
the hand-written ToolLoop). Graph: START -> model -> (tools -> model)* -> END.

Every round the model must call a tool (mode ANY). Data tools run and their results go back
as tool messages; `submit_answer` ends the turn, its arguments validated as ChatAnswer.
Bounded: at most rounds_max rounds and calls_max tool calls per turn, each tool call under
a timeout, each model call under RetryingCall's bounded retries (the one retry policy: no
LangGraph RetryPolicy).

State (TurnState) is plain JSON so AsyncPostgresSaver can checkpoint it after every node,
keyed by thread = the assistant message id. A chat turn's checkpoint holds only the run in
progress: chat memory is app.chat_messages, and the database drops the checkpoint when the
message turns 'ok' or is deleted (migration 20261024000001). Run-time dependencies
(provider, tools, callbacks) travel in TurnContext, which is never saved. Try it runs the
same graph with no checkpointer.

Approved fallbacks (plan §2, logged at WARNING):
  F1  round cap hit without an answer -> one last call where submit_answer is the only tool.
  F2  expected tool failures (ToolError) -> {"error": code} to the model; the loop goes on.
  F3  a cited ref that matches no row -> that cite is dropped, the answer kept.
  F4  Retry with no usable checkpoint (none, run finished, agent changed) -> a fresh run.
No fallback: a plain-text reply or an invalid answer -> LlmOutputInvalid; a tool timeout or
any other tool exception -> the turn fails.

LangSmith: LangGraph would trace every node's inputs and outputs (CV/JD text) on its own when
LANGSMITH_TRACING is on. Runs are wrapped in tracing_context(enabled=False); our Tracer span
(metadata only) is the one trace.
"""

import asyncio
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Literal, TypedDict
from uuid import UUID

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.runtime import Runtime
from langsmith import tracing_context
from pydantic import ValidationError

from app.agents.chat.prompt import SUBMIT_TOOL
from app.agents.chat.tools import KnowledgeTools, SourceBook, Tool, ToolError
from app.agents.providers.base import LlmProvider
from app.agents.retry import Attempts, RetryingCall
from app.core.errors import AgentToolFailed, LlmOutputInvalid
from app.core.logging import get_logger
from app.domain.agents import LlmMessage, ToolCall, ToolDecl, ToolResult, ToolTurn
from app.domain.chat_agents import ChatAnswer, StepRecord, TurnResult

log = get_logger(__name__)

_CITE = re.compile(r"\[(\d{1,3})\]")
SUBMIT_DECL = ToolDecl(
    name=SUBMIT_TOOL,
    description="Give the final answer to the user. Call this once, last.",
    parameters=ChatAnswer.model_json_schema())

OnStep = Callable[[StepRecord], Awaitable[None]]
ResumeCheck = Literal["resume", "no_checkpoint", "run_finished", "agent_changed"]


@dataclass(frozen=True, slots=True)
class LoopLimits:
    rounds_max: int
    calls_max: int
    tool_timeout_s: int
    llm_timeout_s: int
    llm_max_retries: int
    temperature: float
    max_output_tokens: int


@dataclass
class Usage:
    """Filled in as the turn runs, so the run record is right even when the turn fails.
    Counts this run only (a resumed run records its own calls)."""
    attempts: Attempts = field(default_factory=Attempts)
    input_tokens: int = 0
    output_tokens: int = 0
    tool_names: list[str] = field(default_factory=list)


class TurnState(TypedDict):
    """What a checkpoint holds. JSON only; every node returns whole new values (no reducers)."""
    messages: list[dict[str, Any]]      # LlmMessage.to_wire: history + this turn's traffic
    pending: list[dict[str, Any]]       # tool calls of the last model turn, not yet run
    submission: dict[str, Any] | None   # the submit_answer call's arguments
    tool_names: list[str]               # every data-tool call so far (the calls_max cap)
    book: list[dict[str, Any]]          # SourceBook.to_state: refs stay stable on resume
    steps: list[dict[str, Any]]         # StepRecord.to_json, as shown live
    rounds: int
    forced: bool                        # F1: the next model call may only answer
    spec_key: str                       # which agent version started the run (F4)


@dataclass(frozen=True, slots=True)
class TurnContext:
    """Run-time dependencies, never checkpointed."""
    provider: LlmProvider
    model: str
    system: str
    tools: dict[str, Tool]
    decls: list[ToolDecl]               # granted data tools + submit_answer
    on_step: OnStep
    usage: Usage
    agent: str
    entity_id: UUID | None


@dataclass(frozen=True, slots=True)
class ResumePoint:
    check: ResumeCheck
    steps: list[dict[str, Any]]         # what the run already showed (empty unless resume)


class TurnGraph:
    """Builds the graph once per checkpointer (Builder). SRP: the loop only; prompts, tools
    and records belong to ChatAgentRunner. DIP: it talks to LlmProvider, not LangChain."""

    def __init__(self, retrying: RetryingCall, limits: LoopLimits,
                 checkpointer: Callable[[], BaseCheckpointSaver] | None = None) -> None:
        self._retrying = retrying
        self._limits = limits
        self._checkpointer = checkpointer   # lazy: the saver needs the running event loop
        self._ephemeral = self._build(None)
        self._durable: CompiledStateGraph | None = None

    @property
    def limits(self) -> LoopLimits:
        return self._limits

    @staticmethod
    def declarations(tools: list[Tool]) -> list[ToolDecl]:
        return [*(ToolDecl(t.name, t.description, t.parameters()) for t in tools), SUBMIT_DECL]

    def _build(self, checkpointer: BaseCheckpointSaver | None) -> CompiledStateGraph:
        g = StateGraph(TurnState, context_schema=TurnContext)
        g.add_node("model", self._model_node)
        g.add_node("tools", self._tools_node)
        g.add_edge(START, "model")
        g.add_conditional_edges("model", _after_model, {"tools": "tools", END: END})
        g.add_edge("tools", "model")
        return g.compile(checkpointer=checkpointer)

    def _graph(self, thread: str | None) -> CompiledStateGraph:
        if thread is None:
            return self._ephemeral
        if self._checkpointer is None:
            raise RuntimeError("TurnGraph has no checkpointer; a thread needs one")
        if self._durable is None:
            self._durable = self._build(self._checkpointer())
        return self._durable

    def _config(self, thread: str | None) -> dict[str, Any]:
        # model + tools per round, the forced round, and slack. O(rounds_max).
        config: dict[str, Any] = {"recursion_limit": 2 * self._limits.rounds_max + 4}
        if thread is not None:
            config["configurable"] = {"thread_id": thread}
        return config

    async def resume_point(self, thread: str, spec_key: str) -> ResumePoint:
        """Whether Retry can continue a failed run. One indexed read of the latest checkpoint."""
        snap = await self._graph(thread).aget_state(self._config(thread))
        if not snap.values:
            return ResumePoint("no_checkpoint", [])
        if not snap.next:
            return ResumePoint("run_finished", [])   # failed after the graph (answer invalid)
        if snap.values.get("spec_key") != spec_key:
            return ResumePoint("agent_changed", [])
        return ResumePoint("resume", list(snap.values.get("steps", [])))

    async def run(self, ctx: TurnContext, messages: list[LlmMessage], *, spec_key: str,
                  thread: str | None = None, resume: bool = False) -> TurnResult:
        graph = self._graph(thread)
        config = self._config(thread)
        if resume:
            state_in: TurnState | None = None
            log.info("chat_turn_resumed", agent=ctx.agent, entity_id=ctx.entity_id)
        else:
            if thread is not None and self._checkpointer is not None:
                await self._checkpointer().adelete_thread(thread)  # a fresh run, F4
            to_wire = ctx.provider.raw_to_wire
            state_in = TurnState(messages=[m.to_wire(to_wire) for m in messages], pending=[],
                                 submission=None, tool_names=[], book=[], steps=[], rounds=0,
                                 forced=False, spec_key=spec_key)
        kwargs: dict[str, Any] = {"durability": "sync"} if thread is not None else {}
        with tracing_context(enabled=False):
            state = await graph.ainvoke(state_in, config, context=ctx, **kwargs)
        return self._finish(state, ctx)

    # ---------- nodes ----------

    async def _model_node(self, state: TurnState, runtime: Runtime[TurnContext]
                          ) -> dict[str, Any]:
        ctx, lim = runtime.context, self._limits
        forced = state["forced"]
        if forced:  # F1: out of rounds. One last call that can only answer.
            log.warning("chat_loop_forced_submit", agent=ctx.agent, rounds=lim.rounds_max,
                        calls=len(state["tool_names"]), entity_id=ctx.entity_id)
        decls = [SUBMIT_DECL] if forced else ctx.decls
        messages = [LlmMessage.from_wire(m, ctx.provider.raw_from_wire)
                    for m in state["messages"]]
        turn = await self._call(ctx, messages, decls)
        rounds = state["rounds"] + 1
        submission = _submission(turn)
        if submission is not None:      # submit wins even if other calls came with it
            return {"submission": submission.args, "rounds": rounds}
        if forced:
            log.error("chat_loop_no_answer", agent=ctx.agent, entity_id=ctx.entity_id)
            raise LlmOutputInvalid(reason="no_answer")
        if not turn.tool_calls:
            log.error("chat_loop_plain_text", agent=ctx.agent, round=rounds,
                      entity_id=ctx.entity_id)
            raise LlmOutputInvalid(reason="no_tool_call")
        model_msg = LlmMessage(role="model", tool_calls=turn.tool_calls, raw=turn.raw)
        return {"messages": [*state["messages"], model_msg.to_wire(ctx.provider.raw_to_wire)],
                "pending": [{"id": c.id, "name": c.name, "args": c.args}
                            for c in turn.tool_calls],
                "rounds": rounds}

    async def _tools_node(self, state: TurnState, runtime: Runtime[TurnContext]
                          ) -> dict[str, Any]:
        ctx, lim = runtime.context, self._limits
        book = SourceBook.from_state(state["book"])
        names, steps = list(state["tool_names"]), list(state["steps"])
        results: list[ToolResult] = []
        for raw in state["pending"]:    # sequential: each call is a short DB read
            tc = ToolCall(**raw)
            if len(names) >= lim.calls_max:
                content: dict[str, Any] = {
                    "error": "call_limit",
                    "message": f"Tool call limit reached for this turn; call "
                               f"{SUBMIT_TOOL} now with what you have."}
                log.warning("chat_tool_call_limit", agent=ctx.agent, entity_id=ctx.entity_id,
                            calls=len(names))
            else:
                names.append(tc.name)
                ctx.usage.tool_names.append(tc.name)
                content, step = await self._execute(ctx, tc, book)
                if step is not None:
                    steps.append(step.to_json())
                    await ctx.on_step(step)
            results.append(ToolResult(call_id=tc.id, name=tc.name, content=content))
        tool_msg = LlmMessage(role="tool", tool_results=tuple(results))
        return {"messages": [*state["messages"], tool_msg.to_wire(ctx.provider.raw_to_wire)],
                "pending": [], "tool_names": names, "book": book.to_state(), "steps": steps,
                "forced": state["rounds"] >= lim.rounds_max}

    # ---------- helpers ----------

    async def _call(self, ctx: TurnContext, messages: list[LlmMessage],
                    decls: list[ToolDecl]) -> ToolTurn:
        lim = self._limits
        turn = await self._retrying(
            lambda: ctx.provider.generate_with_tools(
                system=ctx.system, messages=messages, tools=decls, model=ctx.model,
                temperature=lim.temperature, max_output_tokens=lim.max_output_tokens),
            timeout_s=lim.llm_timeout_s, max_retries=lim.llm_max_retries,
            attempts=ctx.usage.attempts, agent=ctx.agent, entity_id=ctx.entity_id)
        ctx.usage.input_tokens += turn.input_tokens or 0
        ctx.usage.output_tokens += turn.output_tokens or 0
        return turn

    async def _execute(self, ctx: TurnContext, tc: ToolCall, book: SourceBook
                       ) -> tuple[dict[str, Any], StepRecord | None]:
        tool = ctx.tools.get(tc.name)
        if tool is None:  # not granted, or made up: the model hears it, never the data
            log.warning("chat_tool_unknown", agent=ctx.agent, tool=tc.name[:64],
                        entity_id=ctx.entity_id)
            return {"error": "unknown_tool", "message": f"There is no tool '{tc.name}'."}, None
        try:
            args = KnowledgeTools.parse(tool, tc.args)
            async with asyncio.timeout(self._limits.tool_timeout_s):
                data, outcome = await tool.run(args, book)
        except ToolError as exc:  # F2
            log.info("chat_tool", agent=ctx.agent, tool=tool.name, error_code=exc.code,
                     entity_id=ctx.entity_id)
            return {"error": exc.code, "message": exc.message}, None
        except TimeoutError as exc:
            log.error("chat_tool_timeout", agent=ctx.agent, tool=tool.name,
                      timeout_s=self._limits.tool_timeout_s, entity_id=ctx.entity_id)
            raise AgentToolFailed(tool=tool.name) from exc
        log.info("chat_tool", agent=ctx.agent, tool=tool.name,
                 result_count=outcome.result_count, entity_id=ctx.entity_id)
        return data, StepRecord(tool=tool.name, label=outcome.label,
                                count=outcome.result_count)

    @staticmethod
    def _finish(state: dict[str, Any], ctx: TurnContext) -> TurnResult:
        steps = [StepRecord(**s) for s in state["steps"]]
        try:
            answer = ChatAnswer.model_validate(state["submission"])
        except ValidationError as exc:
            # Locations/types only: the arguments hold the answer text.
            log.error("chat_answer_invalid", agent=ctx.agent, entity_id=ctx.entity_id,
                      errors=[{"loc": e["loc"], "type": e["type"]} for e in exc.errors()][:10])
            raise LlmOutputInvalid(reason="answer_schema") from exc
        book = SourceBook.from_state(state["book"])
        in_text = [int(n) for n in _CITE.findall(answer.content)]
        sources, invalid = book.cited([*answer.cited, *in_text])
        content = answer.content
        if invalid:  # F3
            log.warning("chat_cite_invalid", agent=ctx.agent, refs=invalid,
                        entity_id=ctx.entity_id)
            bad = set(invalid)
            content = _CITE.sub(lambda m: "" if int(m.group(1)) in bad else m.group(0),
                                content)
        answer = answer.model_copy(update={"content": content,
                                           "cited": [s.ref for s in sources]})
        log.info("chat_loop_done", agent=ctx.agent, rounds=state["rounds"],
                 forced_submit=state["forced"], steps=len(steps), sources=len(sources),
                 drafts=len(answer.drafts), entity_id=ctx.entity_id)
        return TurnResult(answer=answer, sources=sources, steps=steps,
                          rounds=state["rounds"], forced_submit=state["forced"])


def _after_model(state: TurnState) -> str:
    return END if state["submission"] is not None else "tools"


def _submission(turn: ToolTurn) -> ToolCall | None:
    return next((c for c in turn.tool_calls if c.name == SUBMIT_TOOL), None)
