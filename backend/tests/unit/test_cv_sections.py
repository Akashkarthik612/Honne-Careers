"""Spoken languages, project links and the PDF text layer (stuck words)."""

import pytest
from pydantic import ValidationError

from app.domain.cv import (
    CvContentIn,
    LanguageLevel,
    Origin,
    ProjectIn,
    ResumePatch,
    SpokenLanguage,
)
from app.ingest.extractors import PdfExtractor, _tidy
from app.render.latex import LatexRenderer
from app.truth.copying import as_origin, facts_only
from app.truth.stamper import EditStamper
from tests.docs import text_pdf
from tests.fixtures import sample_cv

FRENCH = SpokenLanguage(name="French", level=LanguageLevel.PROFESSIONAL)


def test_spoken_languages_patch_is_stored_as_sent():
    patch = ResumePatch.model_validate({"expected_version": 1, "change": {
        "section": "spoken_languages",
        "value": [{"name": "French", "level": "professional"}, {"name": "Tamil"}]}})
    out = EditStamper().apply_patch(sample_cv(), patch.change)
    assert out.spoken_languages == [FRENCH, SpokenLanguage(name="Tamil")]
    assert out.experience == sample_cv().experience  # other sections untouched


def test_unknown_level_is_rejected():
    with pytest.raises(ValidationError):
        SpokenLanguage(name="French", level="B2")


def test_stamp_full_and_profile_copies_keep_new_fields():
    cv = sample_cv()
    incoming = CvContentIn.model_validate({
        "projects": [{"id": "ll", "name": "Ledger-lite", "link": "https://ledger.example"}],
        "spoken_languages": [{"name": "French", "level": "professional"}]})
    stored = EditStamper().stamp_full(incoming, cv)
    assert stored.projects[0].link == "https://ledger.example"
    assert stored.spoken_languages == [FRENCH]
    for copy in (as_origin(stored, Origin.PROFILE), facts_only(stored)):
        assert copy.spoken_languages == [FRENCH]
        assert copy.projects[0].link == "https://ledger.example"


@pytest.mark.parametrize("link", ["javascript:alert(1)", "ledger.example", "ftp://x.test"])
def test_project_link_must_be_http(link):
    with pytest.raises(ValidationError):
        ProjectIn(id="p", name="P", link=link)


def test_project_link_is_optional():
    assert ProjectIn(id="p", name="P").link == ""


def test_project_link_renders_as_click_here():
    cv = sample_cv()
    project = cv.projects[0].model_copy(update={"link": "https://x.test/a b?q=1&p=2"})
    tex = LatexRenderer().render(cv.model_copy(update={"projects": [project]}))
    assert r"\href{https://x.test/a\%20b?q=1\&p=2}{\underline{Click here}}" in tex


def test_spoken_languages_section():
    cv = sample_cv().model_copy(update={"spoken_languages": [
        FRENCH, SpokenLanguage(name="Tamil & English")]})
    tex = LatexRenderer().render(cv)
    assert r"\section{Languages}" in tex
    assert r"French (Professional), Tamil \& English" in tex
    none = sample_cv().model_copy(update={"spoken_languages": []})
    assert r"\section{Languages}" not in LatexRenderer().render(none)


def test_layout_text_is_tidied():
    assert _tidy("Inria      Apr. 2025\n\n\n\n  • Cut   latency  \n") == \
        "Inria Apr. 2025\n\n• Cut latency"


def test_pdf_words_come_back_single_spaced():
    text = PdfExtractor(4).extract(text_pdf(["Cut manual PDF ticket validation toil by 90%",
                                             *["filler line for length " * 3] * 6]))
    assert "Cut manual PDF ticket validation toil by 90%" in text
