"""PDF-3: user text can never become LaTeX. Plus the bounded compile queue."""

import asyncio
import os
import shutil

import pytest

from app.core.errors import RenderBusy
from app.domain.cv import Header, Link
from app.render.compiler import CompileQueue, TectonicCompiler
from app.render.inspector import PdfInspector
from app.render.latex import LatexRenderer, escape, escape_url
from tests.fixtures import sample_cv

ATTACKS = [r"\input{/etc/passwd}", r"\immediate\write18{rm -rf /}", r"$\x$", "}{\\end{document}",
           "#1 & 100% ~ ^ _ <>|", "\x00\x1bbad"]


@pytest.mark.parametrize("attack", ATTACKS)
def test_escape_neutralises_every_special(attack):
    out = escape(attack)
    unescaped_specials = [c for i, c in enumerate(out) if c in "{}$&#%_^~"
                          and (i == 0 or out[i - 1] != "\\") and not out[:i].endswith(
                              ("textbackslash", "textasciitilde", "textasciicircum",
                               "textless", "textgreater", "textbar"))]
    # Only the braces of our own \textX{} macros may remain unescaped.
    assert all(c in "{}" for c in unescaped_specials)
    assert "\\input" not in out and "\\write18" not in out and "\x00" not in out


def test_url_is_percent_encoded():
    assert escape_url("https://x.test/a b?q=1&p=50%#f") == \
        r"https://x.test/a\%20b?q=1\&p=50\%25\%23f"


def test_render_has_no_raw_user_commands():
    cv = sample_cv().model_copy(update={"header": Header(
        name=ATTACKS[1], links=[Link(label=ATTACKS[0], url="https://ok.test")])})
    tex = LatexRenderer().render(cv)
    assert r"\immediate\write18" not in tex
    assert r"\input{/etc/passwd}" not in tex
    assert tex.count(r"\begin{document}") == 1 and tex.count(r"\end{document}") == 1


def test_empty_cv_renders_without_empty_lists():
    from app.domain.cv import CvContent
    body = LatexRenderer().render(CvContent()).split(r"\begin{document}")[1]
    assert r"\resumeItemListStart" not in body


async def test_queue_rejects_when_full():
    queue = CompileQueue(max_concurrent=1, max_waiting=1, wait_s=5)
    release = asyncio.Event()

    async def hold():
        async with queue.slot():
            await release.wait()

    holder = asyncio.create_task(hold())
    await asyncio.sleep(0)
    waiter = asyncio.create_task(hold())
    await asyncio.sleep(0)
    with pytest.raises(RenderBusy):
        async with queue.slot():
            pass
    release.set()
    await asyncio.gather(holder, waiter)


async def test_queue_wait_is_bounded():
    queue = CompileQueue(max_concurrent=1, max_waiting=5, wait_s=0.05)
    async with queue.slot():
        with pytest.raises(RenderBusy):
            async with queue.slot():
                pass


TECTONIC = os.environ.get("TECTONIC_BIN") or shutil.which("tectonic")


@pytest.mark.latex
@pytest.mark.skipif(not TECTONIC, reason="tectonic not installed; runs in the Docker CI job")
async def test_real_compile_offline_one_page():
    compiler = TectonicCompiler(TECTONIC, 60, 4096, CompileQueue(1, 1, 60),
                                os.environ.get("TECTONIC_CACHE_DIR"))
    cv = sample_cv().model_copy(update={"header": Header(name=ATTACKS[0])})
    pdf = await compiler.compile(LatexRenderer().render(cv))
    assert PdfInspector().page_count(pdf) == 1
    from io import BytesIO

    from pypdf import PdfReader
    text = PdfReader(BytesIO(pdf)).pages[0].extract_text()
    assert r"\input{/etc/passwd}" in text  # printed literally, not executed
