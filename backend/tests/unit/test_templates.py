"""PDF-1: template registry, section order, cache key, the Honne Professional renderer and
certifications. Reference values come from CANAL_Plus_Exact_Template.tex."""

import os
import shutil
from io import BytesIO

import pytest
from pydantic import ValidationError

from app.core.errors import InvalidInput, RenderFailed
from app.core.hashing import render_key
from app.domain.cv import SKILL_CATEGORIES, Certification, CvContent, ResumePatch
from app.domain.layout import LayoutPatch, SectionKey
from app.ingest.extractors import PdfExtractor
from app.render.compiler import CompileQueue, TectonicCompiler
from app.render.templates import TemplateRegistry
from app.render.templates.professional import PREAMBLE
from app.truth.copying import as_origin, facts_only
from app.truth.stamper import EditStamper
from tests.fixtures import TEMPLATE_IDS, b, render, sample_cv

REG = TemplateRegistry()
ALL = [k.value for k in SectionKey]
CERTS = [Certification(name="AWS Certified Solutions Architect", issuer="Amazon & co",
                       date="2024"), Certification(name="AWS AI League 2026")]


# ---------- registry ----------

def test_every_template_default_order_lists_every_section_once():
    for t in REG.all():
        assert sorted(t.default_order) == sorted(SectionKey)


def test_professional_default_order_is_experience_first():
    assert [k.value for k in REG.require("honne_professional").default_order] == [
        "experience", "projects", "skills", "education", "certifications", "languages"]


def test_unknown_template():
    with pytest.raises(InvalidInput):
        REG.require("elegant")
    with pytest.raises(RenderFailed):  # a stored row never falls back to Jake
        REG.stored("elegant")


# ---------- layout patch ----------

def test_layout_patch_accepts_a_full_order_or_none():
    assert LayoutPatch(expected_version=1, template="jake").section_order is None
    p = LayoutPatch.model_validate({"expected_version": 1, "template": "jake",
                                    "section_order": list(reversed(ALL))})
    assert p.section_order[0] is SectionKey.LANGUAGES


@pytest.mark.parametrize("order", [ALL[:-1], [*ALL[:-1], ALL[0]], [*ALL, "header"], []])
def test_layout_patch_rejects_partial_or_repeated_orders(order):
    with pytest.raises(ValidationError):
        LayoutPatch.model_validate({"expected_version": 1, "template": "jake",
                                    "section_order": order})


@pytest.mark.parametrize("template", ["", "Jake", "a" * 41, "x;drop", "1jake"])
def test_layout_patch_rejects_bad_template_ids(template):
    with pytest.raises(ValidationError):
        LayoutPatch(expected_version=1, template=template)


# ---------- cache key ----------

def test_render_key_changes_with_template_order_and_revision():
    order = tuple(ALL)
    base = render_key("a" * 64, "jake", 1, order)
    assert base == render_key("a" * 64, "jake", 1, order)
    others = {render_key("b" * 64, "jake", 1, order),
              render_key("a" * 64, "honne_professional", 1, order),
              render_key("a" * 64, "jake", 2, order),
              render_key("a" * 64, "jake", 1, tuple(reversed(order)))}
    assert base not in others and len(others) == 4


# ---------- section order in the .tex ----------

@pytest.mark.parametrize("template", TEMPLATE_IDS)
def test_sections_print_in_the_given_order(template):
    cv = sample_cv().model_copy(update={"certifications": CERTS})
    order = tuple(reversed(REG.require(template).default_order))
    tex = render(cv, template, order)
    titles = {"experience": "Experience", "projects": "Projects", "skills": "Technical Skills",
              "education": "Education", "certifications": "Certifications",
              "languages": "Languages"}
    found = [tex.index(f"{titles[k.value]}}}") for k in order
             if f"{titles[k.value]}}}" in tex]
    assert found == sorted(found) and len(found) >= 5


def test_employers_keep_their_stored_order():
    cv = sample_cv()
    tex = render(cv, "honne_professional")
    positions = [tex.index(e.company) for e in cv.experience]
    assert positions == sorted(positions)


# ---------- Honne Professional specifics ----------

def test_professional_preamble_keeps_the_reference_parameters():
    for line in [r"\documentclass[letterpaper,10pt]{article}",
                 r"\addtolength{\oddsidemargin}{-0.46in}", r"\addtolength{\textwidth}{0.92in}",
                 r"\addtolength{\topmargin}{-0.54in}", r"\addtolength{\textheight}{1.12in}",
                 r"\titlespacing*{\section}{0pt}{8pt}{4pt}",
                 r"\par\addvspace{8pt}\needspace{48pt}%",
                 r"leftmargin=0.19in, topsep=2pt, itemsep=1.6pt, parsep=0pt, partopsep=0pt",
                 r"\fontsize{9.15}{11.1}\selectfont #1", r"\par\addvspace{2pt}\needspace{42pt}%"]:
        assert line in PREAMBLE, line
    assert r"\usepackage[T1]{fontenc}" not in PREAMBLE  # Type1 ligatures break ATS text


def test_professional_header_order_and_escaping():
    cv = sample_cv()
    h = cv.header.model_copy(update={"name": "A & B", "phone": "+91 1", "location": "Pune"})
    tex = render(cv.model_copy(update={"header": h}), "honne_professional")
    assert r"{\LARGE\bfseries A \& B}\\[2pt]" in tex
    line = next(ln for ln in tex.splitlines() if ln.startswith(r"{\footnotesize +91 1"))
    assert line.index("mailto:") < line.index("Pune")  # phone | email | links | location


def test_bold_keeps_its_spaces():
    """The stuck-words report (e.g. "microservicesand"): the renderer must never eat or add
    a space at a bold boundary."""
    exp = sample_cv().experience[0]
    bullet = b("x1", "Built **microservices** and **APIs**/FastAPI for the **PepsiCo** CRM")
    cv = sample_cv().model_copy(update={"experience": [exp.model_copy(
        update={"bullets": [bullet]})]})
    for template in TEMPLATE_IDS:
        tex = render(cv, template)
        assert (r"Built \textbf{microservices} and \textbf{APIs}/FastAPI for the "
                r"\textbf{PepsiCo} CRM") in tex


def test_certifications_render_only_when_present():
    for template in TEMPLATE_IDS:
        assert "Certifications}" not in render(sample_cv(), template)
    tex = render(sample_cv().model_copy(update={"certifications": CERTS}), "honne_professional")
    assert (r"\textbf{AWS Certified Solutions Architect} -- Amazon \& co -- 2024 $|$ "
            r"\textbf{AWS AI League 2026}") in tex


# ---------- certifications as data ----------

def test_certifications_patch_is_stored_as_sent_and_survives_copies():
    patch = ResumePatch.model_validate({"expected_version": 1, "change": {
        "section": "certifications",
        "value": [{"name": "AWS Certified Solutions Architect", "issuer": "Amazon & co",
                   "date": "2024"}, {"name": "AWS AI League 2026"}]}})
    out = EditStamper().apply_patch(sample_cv(), patch.change)
    assert out.certifications == CERTS
    for copy in (as_origin(out, "profile"), facts_only(out)):
        assert copy.certifications == CERTS


@pytest.mark.parametrize("bad", [{"name": ""}, {"name": "x" * 121}, {"name": "A", "x": 1}])
def test_bad_certifications_are_rejected(bad):
    with pytest.raises(ValidationError):
        Certification.model_validate(bad)


def test_certifications_cap():
    with pytest.raises(ValidationError):
        CvContent.model_validate({"certifications": [{"name": f"C{i}"} for i in range(16)]})


# ---------- Docker offline cache fixture ----------

def test_warm_fixture_has_two_of_everything():
    """The image's LaTeX cache holds only what docker/warm_cache.py compiled. Separators
    between items are typeset at each section's size, so every list section needs two items
    or a real CV hits an uncached font offline (27 Oct 2026: 3 spoken languages -> cmr9)."""
    from docker.warm_cache import CV

    lists = {"links": CV.header.links, "experience": CV.experience, "projects": CV.projects,
             "education": CV.education, "spoken_languages": CV.spoken_languages,
             "certifications": CV.certifications,
             **{f"skills.{c}": getattr(CV.skills, c) for c in SKILL_CATEGORIES}}
    assert {k: len(v) for k, v in lists.items() if len(v) < 2} == {}
    assert all(p.link for p in CV.projects)  # the project link separator at 10 pt
    assert set(CvContent.model_fields) == {"header", "experience", "projects", "education",
                                           "skills", "spoken_languages", "certifications"}, \
        "a new CvContent section: add it to docker/warm_cache.py with two items"


# ---------- real compile: geometry + text layer ----------

TECTONIC = os.environ.get("TECTONIC_BIN") or shutil.which("tectonic")


def _senior_cv() -> CvContent:
    """Eight employers x five long bullets: flows onto extra pages at full size, never
    shrunk to fit (TAIL-8: more than one page is a warning, not a failure)."""
    cv = sample_cv()
    exp = cv.experience[0]
    long = ("Led the **payments** platform migration across twelve services, cutting p99 latency "
            "by 38% and on-call pages by half while mentoring four engineers on the team")
    items = [exp.model_copy(update={"id": f"e{i}", "bullets": [
        b(f"b{i}{j}", long) for j in range(5)]}) for i in range(8)]
    return cv.model_copy(update={"experience": items, "certifications": CERTS})


@pytest.mark.latex
@pytest.mark.skipif(not TECTONIC, reason="tectonic not installed; runs in the Docker CI job")
async def test_professional_geometry_matches_the_reference():
    """Positions measured from the CANAL+ reference PDF (pdfLaTeX): section rule x 38.88,
    bullet text 9.15 pt, bullet text x 52.56. pypdf's visitor gives each text run's matrix."""
    from pypdf import PdfReader

    compiler = TectonicCompiler(TECTONIC, 60, 4096, CompileQueue(1, 1, 60),
                                os.environ.get("TECTONIC_CACHE_DIR"))
    cv = sample_cv().model_copy(update={"certifications": CERTS})
    pdf = await compiler.compile(render(cv, "honne_professional"))
    page = PdfReader(BytesIO(pdf)).pages[0]
    runs: list[tuple[float, float, str]] = []

    def visit(text, cm, tm, font, size):
        if text.strip():
            runs.append((round(tm[4] * cm[0] + cm[4], 2), round(size * tm[0], 2), text))

    page.extract_text(visitor_text=visit)
    assert (float(page.mediabox.width), float(page.mediabox.height)) == (612.0, 792.0)
    heading = next(r for r in runs if r[2].startswith("Professional"))
    assert abs(heading[0] - 38.88) < 0.5  # left margin
    full = PdfExtractor(2).extract(pdf)  # our upload reader, as docker/smoke_compile.py
    assert "AWS Certified Solutions Architect" in full and "ﬁ" not in full  # no "ﬁ"
    sizes = {r[1] for r in runs}
    assert any(abs(s - 9.15) < 0.05 for s in sizes)  # bullet font


@pytest.mark.latex
@pytest.mark.skipif(not TECTONIC, reason="tectonic not installed; runs in the Docker CI job")
@pytest.mark.parametrize("template", TEMPLATE_IDS)
async def test_senior_cv_flows_onto_more_pages(template):
    from app.render.inspector import PdfInspector

    compiler = TectonicCompiler(TECTONIC, 60, 4096, CompileQueue(1, 1, 60),
                                os.environ.get("TECTONIC_CACHE_DIR"))
    pdf = await compiler.compile(render(_senior_cv(), template))
    assert PdfInspector().page_count(pdf) >= 2
    text = PdfExtractor(5).extract(pdf)
    assert text.count("on-call pages by half") == 40  # every bullet printed, none clipped
