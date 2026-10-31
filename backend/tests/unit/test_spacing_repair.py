"""Spacing repair (PROF-2, TRUTH-1): only whitespace, only where the original file proves it,
never over a user's own edit. Uses the synthetic pdfTeX-style fixture, not a real CV."""

from io import BytesIO

import pytest
from pypdf import PdfReader

from app.domain.cv import Bullet, CvContent, ExperienceItem, Origin, TailorState
from app.ingest.extractors import PdfExtractor
from app.ingest.spacing_repair import (
    AlignmentTooWeak,
    ContentRepairer,
    ExtractionAlignment,
    InvariantBroken,
    PassageMatcher,
    Reason,
    check_invariant,
)
from tests.docs import SPACING_BROKEN, SPACING_PHRASES, TECH_TERMS, kerned_bold_pdf

PDF = kerned_bold_pdf()
BROKEN = PdfReader(BytesIO(PDF)).pages[0].extract_text()   # what the old extractor stored
FIXED = PdfExtractor(max_pages=4).extract(PDF)              # what the page shows
LINE1_BROKEN = ("Built Python (FastAPI) microservicesand RESTful APIsfor thepayments and "
                "logistics modules")
LINE1_FIXED = ("Built Python (FastAPI) microservices and RESTful APIs for the payments and "
               "logistics modules")
LINE2_BROKEN = "Shipped 40 releases a quarter, with100% audit accuracy, throughPython automation"
LINE2_FIXED = "Shipped 40 releases a quarter, with 100% audit accuracy, through Python automation"
COMPANY_BROKEN, COMPANY_FIXED = "Cognizant T echnology Solutions", "Cognizant Technology Solutions"


def _matcher() -> PassageMatcher:
    return PassageMatcher(ExtractionAlignment.edits(BROKEN, FIXED))


def _upload() -> dict:
    """cv_uploads.parsed as the parser stored it from the broken text."""
    return {"header": {"name": "Arjun Mehta"},
            "experience": [{"id": "e1", "company": COMPANY_BROKEN, "role": "Engineer",
                            "bullets": [{"id": "b1", "text": LINE1_BROKEN},
                                        {"id": "b2", "text": LINE2_BROKEN}]}],
            "skills": {"languages": ["Python"], "frameworks": ["FastAPI"], "tools": []}}


def _cv(*bullets: Bullet, company: str = COMPANY_BROKEN) -> dict:
    return CvContent(experience=[ExperienceItem(id="e1", company=company, start="2022",
                                                bullets=list(bullets))]).model_dump(mode="json")


def _bullet(text: str, origin: Origin = Origin.IMPORT, locked: bool = False, **extra) -> Bullet:
    return Bullet(id="b1", text=text, origin=origin, locked=locked, **extra)


def test_alignment_finds_exactly_the_six_spacing_edits():
    pairs = {(" ".join(e.broken), " ".join(e.fixed))
             for e in ExtractionAlignment.edits(BROKEN, FIXED)}
    assert pairs == {("microservicesand", "microservices and"), ("APIsfor", "APIs for"),
                     ("thepayments", "the payments"), ("with100%", "with 100%"),
                     ("throughPython", "through Python"), ("T echnology", "Technology")}


def test_alignment_refuses_texts_that_differ_in_more_than_spacing():
    with pytest.raises(AlignmentTooWeak):
        ExtractionAlignment.edits("completely different words here", "nothing alike at all, ok")


@pytest.mark.parametrize("stored,expected", [
    (LINE1_BROKEN, LINE1_FIXED),
    (LINE2_BROKEN, LINE2_FIXED),
    (COMPANY_BROKEN, COMPANY_FIXED),
])
def test_matcher_restores_each_passage(stored, expected):
    m = _matcher().match(stored)
    assert m.text == expected and not m.issues


def test_matcher_never_touches_technical_terms_or_clean_text():
    m = _matcher().match("Stack: FastAPI, PostgreSQL, GitHub Actions, NextJS and Docker")
    assert not m.touched
    for term in TECH_TERMS:
        assert term in m.text


def test_broken_form_without_its_context_is_left_for_review():
    m = _matcher().match("Owned thepayments ledger end to end")
    assert m.text == "Owned thepayments ledger end to end"
    assert m.issues == (Reason.NO_PASSAGE,)


def test_same_broken_form_with_two_spacings_is_ambiguous():
    broken = "k1 k2 abc k3 k4 . k1 k2 abc k3 k4"
    fixed = "k1 k2 a bc k3 k4 . k1 k2 ab c k3 k4"
    m = PassageMatcher(ExtractionAlignment.edits(broken, fixed)).match("k1 k2 abc k3 k4")
    assert m.issues == (Reason.AMBIGUOUS,) and m.text == "k1 k2 abc k3 k4"


def test_upload_repair_fixes_every_string_and_keeps_ids():
    upload = _upload()
    out = ContentRepairer(_matcher(), upload).repair_upload(upload)
    exp = out.content["experience"][0]
    assert exp["company"] == COMPANY_FIXED and exp["id"] == "e1"
    assert [b["text"] for b in exp["bullets"]] == [LINE1_FIXED, LINE2_FIXED]
    assert not out.reviews and len(out.fixes) == 3
    assert upload["experience"][0]["company"] == COMPANY_BROKEN   # input not mutated


def test_imported_bullet_traced_to_the_upload_is_fixed_with_flags_kept():
    cv = _cv(_bullet(LINE1_BROKEN))
    out = ContentRepairer(_matcher(), _upload()).repair_cv(cv)
    bullet = out.content["experience"][0]["bullets"][0]
    assert bullet["text"] == LINE1_FIXED
    assert {k: bullet[k] for k in ("id", "origin", "locked", "tailor_state")} == \
        {"id": "b1", "origin": "import", "locked": False, "tailor_state": "none"}
    assert out.content["experience"][0]["company"] == COMPANY_FIXED


def test_locked_bullet_equal_to_the_upload_is_fixed():
    out = ContentRepairer(_matcher(), _upload()).repair_cv(
        _cv(_bullet(LINE1_BROKEN, Origin.USER, locked=True)))
    assert out.content["experience"][0]["bullets"][0]["text"] == LINE1_FIXED


def test_locked_bullet_the_user_edited_is_never_overwritten():
    edited = LINE1_BROKEN + " across 3 regions"
    out = ContentRepairer(_matcher(), _upload()).repair_cv(
        _cv(_bullet(edited, Origin.USER, locked=True)))
    assert out.content["experience"][0]["bullets"][0]["text"] == edited
    assert [r.reason for r in out.reviews] == [Reason.LOCKED_EDIT]


def test_passage_not_in_the_upload_is_provenance_unknown():
    upload = _upload()
    upload["experience"][0]["bullets"] = []   # the upload never had line 1
    out = ContentRepairer(_matcher(), upload).repair_cv(_cv(_bullet(LINE1_BROKEN)))
    assert out.content["experience"][0]["bullets"][0]["text"] == LINE1_BROKEN
    assert Reason.PROVENANCE_UNKNOWN in [r.reason for r in out.reviews]


def test_text_and_original_text_are_repaired_together():
    ai = _bullet(LINE1_BROKEN, Origin.AI, original_text=LINE1_BROKEN,
                 original_origin=Origin.IMPORT, tailor_state=TailorState.PROPOSED)
    out = ContentRepairer(_matcher(), _upload()).repair_cv(_cv(ai))
    bullet = out.content["experience"][0]["bullets"][0]
    assert bullet["text"] == bullet["original_text"] == LINE1_FIXED
    assert bullet["tailor_state"] == "proposed" and bullet["original_origin"] == "import"


def test_only_one_of_text_and_original_fixable_changes_neither():
    # The AI text's passage is not in the upload; the original is. Fixing only the original
    # would leave Keep/Revert pairs inconsistent, so both go to review.
    upload = _upload()
    upload["experience"][0]["bullets"] = [{"id": "b1", "text": LINE2_BROKEN}]
    ai = _bullet(LINE1_BROKEN, Origin.AI, original_text=LINE2_BROKEN,
                 original_origin=Origin.IMPORT, tailor_state=TailorState.KEPT)
    out = ContentRepairer(_matcher(), upload).repair_cv(_cv(ai))
    bullet = out.content["experience"][0]["bullets"][0]
    assert (bullet["text"], bullet["original_text"]) == (LINE1_BROKEN, LINE2_BROKEN)
    assert {r.reason for r in out.reviews} == {Reason.TEXT_ORIGINAL_MISMATCH}


def test_repair_is_idempotent():
    repairer = ContentRepairer(_matcher(), _upload())
    once = repairer.repair_cv(_cv(_bullet(LINE1_BROKEN)))
    twice = repairer.repair_cv(once.content)
    assert twice.content == once.content and not twice.fixes and not twice.reviews


def test_every_repaired_string_differs_only_in_whitespace():
    out = ContentRepairer(_matcher(), _upload()).repair_upload(_upload())
    for fix in out.fixes:
        assert fix.before.replace(" ", "") == fix.after.replace(" ", "")
    for phrase in SPACING_PHRASES:
        assert any(phrase in f.after for f in out.fixes)
    for broken in SPACING_BROKEN:
        assert not any(broken in f.after for f in out.fixes)


def test_invariant_rejects_any_non_space_change():
    check_invariant({"a": "with100%"}, {"a": "with 100%"})
    with pytest.raises(InvariantBroken):
        check_invariant({"a": "with100%"}, {"a": "with 10%"})
    with pytest.raises(InvariantBroken):
        check_invariant({"a": "x", "locked": True}, {"a": "x", "locked": False})
