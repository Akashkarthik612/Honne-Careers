"""PDF-3: user text can never become LaTeX. Plus the bounded compile queue."""

import asyncio
import os
import shutil

import pytest

from app.core.errors import RenderBusy
from app.domain.cv import Header, Link
from app.domain.markup import plain
from app.render.compiler import CompileQueue, TectonicCompiler
from app.render.inspector import PdfInspector
from app.render.latex import escape, escape_url, rich
from tests.docs import SPACING_BROKEN, SPACING_PHRASES, TECH_TERMS
from tests.fixtures import TEMPLATE_IDS, render, sample_cv

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


@pytest.mark.parametrize("template", TEMPLATE_IDS)
def test_render_has_no_raw_user_commands(template):
    cv = sample_cv().model_copy(update={"header": Header(
        name=ATTACKS[1], links=[Link(label=ATTACKS[0], url="https://ok.test")])})
    tex = render(cv, template)
    assert r"\immediate\write18" not in tex
    assert r"\input{/etc/passwd}" not in tex
    assert tex.count(r"\begin{document}") == 1 and tex.count(r"\end{document}") == 1


@pytest.mark.parametrize("template", TEMPLATE_IDS)
def test_empty_cv_renders_without_empty_lists(template):
    from app.domain.cv import CvContent
    body = render(CvContent(), template).split(r"\begin{document}")[1]
    assert r"\resumeItemListStart" not in body and r"\cvbullets" not in body
    assert r"\section" not in body  # no empty sections


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
@pytest.mark.parametrize("template", TEMPLATE_IDS)
async def test_real_compile_offline_one_page(template):
    compiler = TectonicCompiler(TECTONIC, 60, 4096, CompileQueue(1, 1, 60),
                                os.environ.get("TECTONIC_CACHE_DIR"))
    cv = sample_cv()
    exp = cv.experience[0]
    bold = exp.bullets[0].model_copy(update={"text": "Cut latency by **38%** with **Kafka**"})
    cv = cv.model_copy(update={
        "header": Header(name=ATTACKS[0]),
        "experience": [exp.model_copy(update={"bullets": [bold, *exp.bullets[1:]]}),
                       *cv.experience[1:]]})
    pdf = await compiler.compile(render(cv, template))
    assert PdfInspector().page_count(pdf) == 1
    from io import BytesIO

    from pypdf import PdfReader
    text = PdfReader(BytesIO(pdf)).pages[0].extract_text()
    assert r"\input{/etc/passwd}" in text  # printed literally, not executed
    assert "Cut latency by 38% with Kafka" in text and "**" not in text  # bold, no markers


# The six phrases a real CV lost its spaces in (PROF-2, PDF-4). The defect was in stored text
# (pypdf default mode at upload), not here; these pin that rich() never adds or drops a space.
RICH_CASES = [
    ("Built Python (FastAPI) microservices and RESTful APIs for the payments modules",
     "Built Python (FastAPI) microservices and RESTful APIs for the payments modules"),
    ("Built **microservices** and **RESTful APIs** for the **payments** modules",
     r"Built \textbf{microservices} and \textbf{RESTful APIs} for the \textbf{payments} modules"),
    ("Shipped releases with 100% audit accuracy, through Python automation",
     r"Shipped releases with 100\% audit accuracy, through Python automation"),
    ("Shipped releases with **100%** audit accuracy, through **Python** automation",
     r"Shipped releases with \textbf{100\%} audit accuracy, through \textbf{Python} automation"),
    ("Joined Cognizant Technology Solutions", "Joined Cognizant Technology Solutions"),
    ("Joined **Cognizant Technology Solutions**",
     r"Joined \textbf{Cognizant Technology Solutions}"),
    ("**Python**/FastAPI on **PostgreSQL**, GitHub and NextJS",
     r"\textbf{Python}/FastAPI on \textbf{PostgreSQL}, GitHub and NextJS"),
]


@pytest.mark.parametrize("text,tex", RICH_CASES)
def test_rich_keeps_every_space_around_bold(text, tex):
    assert rich(text) == tex
    # Unwrapping \textbf gives exactly the escaped plain text: nothing added or trimmed.
    unwrapped = rich(text).replace(r"\textbf{", "")
    assert unwrapped.replace("}", "") == escape(plain(text)).replace("}", "")


def _spacing_cv():
    """sample_cv with the six phrases as plain and as bold bullets, the employer as a field."""
    cv = sample_cv()
    exp = cv.experience[0]
    texts = ["Built microservices and RESTful APIs for the payments team",
             "Built **microservices** and **RESTful APIs** for the **payments** team",
             "Cut toil with 100% audit accuracy, through Python automation",
             "Cut toil with **100%** audit accuracy, through **Python** automation",
             "Ran **FastAPI** on **PostgreSQL** with GitHub Actions and NextJS"]
    bullets = [exp.bullets[0].model_copy(update={"id": f"sp{i}", "text": t})
               for i, t in enumerate(texts)]
    return cv.model_copy(update={"experience": [
        exp.model_copy(update={"company": "Cognizant Technology Solutions", "bullets": bullets}),
        *cv.experience[1:]]})


@pytest.mark.latex
@pytest.mark.skipif(not TECTONIC, reason="tectonic not installed; runs in the Docker CI job")
@pytest.mark.parametrize("template", TEMPLATE_IDS)
async def test_compiled_pdf_reads_back_with_every_space(template):
    """PDF-4: a fresh compile (no PDF cache) read by two parsers shows the exact phrases and
    never splits a word. pypdf's default mode is not asserted: it drops the space at a
    font switch in any TeX PDF (the upload bug), so it is only reported by the verify script."""
    from io import BytesIO

    import pymupdf
    from pypdf import PdfReader
    compiler = TectonicCompiler(TECTONIC, 60, 4096, CompileQueue(1, 1, 60),
                                os.environ.get("TECTONIC_CACHE_DIR"))
    pdf = await compiler.compile(render(_spacing_cv(), template))
    readers = {
        "pypdf_layout": PdfReader(BytesIO(pdf)).pages[0].extract_text(extraction_mode="layout"),
        "pymupdf": pymupdf.open(stream=pdf, filetype="pdf").load_page(0).get_text(),
    }
    for name, raw in readers.items():
        text = " ".join(raw.split())  # line breaks and layout padding -> one space
        for phrase in SPACING_PHRASES:
            assert phrase in text, (name, phrase)
        for broken in SPACING_BROKEN:
            assert broken not in text, (name, broken)
        for term in TECH_TERMS:
            assert term in text, (name, term)
        assert "**" not in text
