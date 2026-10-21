"""Tracer: one span per agent run and per tailor job, sent to LangSmith (metadata only).

Port + adapters (DIP): AgentRunner and the tailor services see `Tracer`; the container picks
LangSmithTracer (LANGSMITH_TRACING=true) or NoopTracer (CI, tests, local by default).

Privacy: no CV/JD text or model output ever leaves the server through a trace. Spans carry
ids, agent/model names, counts and timings; inputs/outputs are empty and the client hides
them as well. A failed span records only the exception class, never its message or
traceback (a chained ValidationError can echo model output).

Fallback (approved in the plan): a trace that can't be built or sent never fails the user's
request. LangSmith exports from a background thread; a LangSmithError raised in our code
is logged at WARNING `trace_export_failed` and the request continues. Cost O(1) per span.
"""

from collections.abc import AsyncIterator
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from typing import Protocol
from uuid import UUID

from langsmith import Client
from langsmith.run_helpers import get_current_run_tree, tracing_context
from langsmith.run_trees import RunTree
from langsmith.utils import LangSmithError

from app.core import context
from app.core.logging import get_logger

log = get_logger(__name__)
Meta = str | int | float | bool | UUID | None


class Span(Protocol):
    def update(self, **metadata: Meta) -> None: ...


class Tracer(Protocol):
    def span(self, name: str, run_type: str = "chain", **metadata: Meta
             ) -> AbstractAsyncContextManager[Span]: ...


class _NoopSpan:
    def update(self, **metadata: Meta) -> None:
        return None


class NoopTracer:
    @asynccontextmanager
    async def span(self, name: str, run_type: str = "chain",
                   **metadata: Meta) -> AsyncIterator[Span]:
        yield _NoopSpan()


def _clean(metadata: dict[str, Meta]) -> dict[str, str | int | float | bool]:
    return {k: str(v) if isinstance(v, UUID) else v for k, v in metadata.items()
            if v is not None}


class _LangSmithSpan:
    def __init__(self, run: RunTree) -> None:
        self._run = run

    def update(self, **metadata: Meta) -> None:
        self._run.add_metadata(_clean(metadata))


def langsmith_client(api_key: str, endpoint: str | None) -> Client:
    return Client(api_key=api_key, api_url=endpoint, hide_inputs=True, hide_outputs=True)


class LangSmithTracer:
    def __init__(self, client: Client, project: str) -> None:
        self._client = client
        self._project = project

    @asynccontextmanager
    async def span(self, name: str, run_type: str = "chain",
                   **metadata: Meta) -> AsyncIterator[Span]:
        run = self._open(name, run_type, metadata)
        if run is None:
            yield _NoopSpan()
            return
        error: str | None = None
        try:
            with tracing_context(enabled=True, client=self._client, parent=run,
                                 project_name=self._project):
                yield _LangSmithSpan(run)
        except BaseException as exc:
            error = type(exc).__name__  # class only: messages may echo CV text
            raise
        finally:
            self._close(run, error)

    def _open(self, name: str, run_type: str, metadata: dict[str, Meta]) -> RunTree | None:
        meta = _clean({**metadata, "correlation_id": context.correlation_id.get()})
        try:
            parent = get_current_run_tree()
            if parent is not None:
                run = parent.create_child(name=name, run_type=run_type, inputs={},
                                          extra={"metadata": meta})
            else:
                run = RunTree(name=name, run_type=run_type, inputs={}, client=self._client,
                              project_name=self._project, extra={"metadata": meta})
            run.post()
            return run
        except LangSmithError as exc:
            log.warning("trace_export_failed", span=name, cause=type(exc).__name__)
            return None

    @staticmethod
    def _close(run: RunTree, error: str | None) -> None:
        try:
            run.end(outputs={}, error=error)
            run.patch()
        except LangSmithError as exc:
            log.warning("trace_export_failed", span=run.name, cause=type(exc).__name__)
