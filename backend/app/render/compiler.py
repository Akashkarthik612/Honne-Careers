"""LatexCompiler + bounded compile queue (B6, B11 #6, plan §1.5b).

TectonicCompiler runs Tectonic as a child process: no shell, untrusted mode (no
shell-escape, no external tools), --only-cached (offline: packages baked into the image),
fresh temp dir deleted afterwards, wall-clock timeout, address-space cap on Linux.
CompileQueue bounds concurrency and waiting so a burst can't exhaust 512 MB.
"""

import asyncio
import os
import shutil
import subprocess  # noqa: S404  # nosec B404
import sys
import tempfile
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Protocol

from app.core.errors import RenderBusy, RenderFailed
from app.core.logging import get_logger

log = get_logger(__name__)


class LatexCompiler(Protocol):
    async def compile(self, tex: str) -> bytes: ...


class CompileQueue:
    """At most `max_concurrent` compiles; at most `max_waiting` callers waiting, each for at
    most `wait_s`. Beyond that: RenderBusy (503), logged at WARNING. Never unbounded."""

    def __init__(self, max_concurrent: int, max_waiting: int, wait_s: float) -> None:
        self._sem = asyncio.Semaphore(max_concurrent)
        self._max_waiting = max_waiting
        self._wait_s = wait_s
        self._waiting = 0

    @asynccontextmanager
    async def slot(self):
        if self._sem.locked() and self._waiting >= self._max_waiting:
            log.warning("render_queue_full", waiting=self._waiting)
            raise RenderBusy(reason="queue_full")
        self._waiting += 1
        try:
            async with asyncio.timeout(self._wait_s):
                await self._sem.acquire()
        except TimeoutError as exc:
            log.warning("render_queue_timeout", wait_s=self._wait_s)
            raise RenderBusy(reason="queue_timeout") from exc
        finally:
            self._waiting -= 1
        try:
            yield
        finally:
            self._sem.release()


class TectonicCompiler:
    def __init__(self, binary: str, timeout_s: int, memory_mb: int, queue: CompileQueue,
                 cache_dir: str | None) -> None:
        self._binary = binary
        self._timeout_s = timeout_s
        self._memory_bytes = memory_mb * 1024 * 1024
        self._queue = queue
        self._cache_dir = cache_dir

    async def compile(self, tex: str) -> bytes:
        async with self._queue.slot():
            return await self._compile(tex)

    async def _compile(self, tex: str) -> bytes:
        workdir = Path(tempfile.mkdtemp(prefix="cv-"))
        started = time.monotonic()
        try:
            (workdir / "resume.tex").write_text(tex, encoding="utf-8")
            env = {"PATH": os.environ.get("PATH", ""), "HOME": str(workdir)}
            if self._cache_dir:
                env["TECTONIC_CACHE_DIR"] = self._cache_dir
            # Tectonic keeps compiled formats under $XDG_CACHE_HOME (else $HOME/.cache), not
            # TECTONIC_CACHE_DIR. The image bakes them there; without it every compile
            # regenerates the format, which exceeds the RLIMIT_FSIZE cap below.
            if xdg := os.environ.get("XDG_CACHE_HOME"):
                env["XDG_CACHE_HOME"] = xdg
            # A worker thread + subprocess.run works on every OS/event loop; the queue
            # already bounds concurrency, and run(timeout=) kills the child on expiry.
            try:
                proc = await asyncio.to_thread(
                    subprocess.run,  # noqa: S603 - fixed argv, no shell, no user input in it
                    [self._binary, "--untrusted", "--only-cached", "--chatter", "minimal",
                     "--outdir", str(workdir), str(workdir / "resume.tex")],
                    cwd=workdir, env=env, stdin=subprocess.DEVNULL, capture_output=True,
                    timeout=self._timeout_s,
                    preexec_fn=self._limits if sys.platform != "win32" else None,  # noqa: PLW1509
                )
            except subprocess.TimeoutExpired as exc:
                log.error("latex_timeout", timeout_s=self._timeout_s)
                raise RenderFailed(reason="timeout") from exc
            pdf = workdir / "resume.pdf"
            if proc.returncode != 0 or not pdf.is_file():
                # Exit code + the error lines' count only: the log can quote CV text.
                log.error("latex_failed", exit_code=proc.returncode,
                          stderr_lines=len(proc.stderr.splitlines()))
                raise RenderFailed(reason="compile_error")
            data = pdf.read_bytes()
            log.info("latex_compiled", ms=int((time.monotonic() - started) * 1000),
                     bytes=len(data))
            return data
        except OSError as exc:
            log.error("latex_unavailable", error_type=type(exc).__name__)
            raise RenderFailed(reason="engine_unavailable") from exc
        finally:
            shutil.rmtree(workdir, ignore_errors=True)

    def _limits(self) -> None:  # runs in the child before exec (Linux only)
        import resource  # noqa: PLC0415 - POSIX-only module

        resource.setrlimit(resource.RLIMIT_AS, (self._memory_bytes, self._memory_bytes))
        resource.setrlimit(resource.RLIMIT_FSIZE, (20 * 1024 * 1024, 20 * 1024 * 1024))
