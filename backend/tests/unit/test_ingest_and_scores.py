from datetime import date

import pytest

from app.analysis.scores import ScoreCalculator, years_of_experience
from app.core.errors import InvalidInput, UnreadableUpload
from app.domain.analysis import AnalysisJudgment
from app.ingest.extractors import TextExtractor
from tests.docs import docx, text_pdf, zip_bomb_docx
from tests.fakes import FakeLatexCompiler
from tests.fixtures import sample_cv

EXTRACTOR = TextExtractor(max_bytes=5 * 1024 * 1024, max_pages=4,
                          max_uncompressed=20 * 1024 * 1024, timeout_s=10)


async def test_pdf_and_docx_text_extracted_by_magic_bytes():
    pdf = await EXTRACTOR.extract(text_pdf())
    assert pdf.source_type == "pdf" and "Northwind Fintech" in pdf.text
    doc = await EXTRACTOR.extract(docx())
    assert doc.source_type == "docx" and "38%" in doc.text


@pytest.mark.parametrize("data,reason", [
    (b"GIF89a....", "unsupported_type"),
    (text_pdf(pages=5), "too_many_pages"),
    (zip_bomb_docx(), "zip_bomb"),
    (b"%PDF-1.4 garbage", "corrupt_pdf"),
], ids=["gif", "five_pages", "zip_bomb", "corrupt"])
async def test_bad_files_fail_loudly(data, reason):
    with pytest.raises(UnreadableUpload) as exc:
        await EXTRACTOR.extract(data)
    assert exc.value.details["reason"] == reason


async def test_image_only_pdf_rejected_no_ocr():
    blank = await FakeLatexCompiler().compile("")  # a PDF with no text at all
    with pytest.raises(UnreadableUpload) as exc:
        await EXTRACTOR.extract(blank)
    assert exc.value.details["reason"] == "image_only"


async def test_size_cap():
    with pytest.raises(InvalidInput):
        await EXTRACTOR.extract(b"%PDF-" + b"0" * (6 * 1024 * 1024))


async def test_latex_is_read_as_text_without_comments():
    src = ("% secret comment\n" + r"\section{Experience} Built ledgers at 50\% cost " * 10)
    out = await EXTRACTOR.extract(src.encode(), source_type="latex")
    assert "secret comment" not in out.text and r"50\%" in out.text


def test_years_merges_overlaps():
    cv = sample_cv()  # Aug 2020 - Jun 2021, Jul 2021 - Present
    assert years_of_experience(cv, today=date(2026, 7, 1)) == 6.0  # 72 months inclusive


def test_scores():
    judgment = AnalysisJudgment.model_validate({
        "jd_skills": ["Java", "Kafka", "AWS", "Kubernetes"],
        "requirements": [{"text": "Java", "level": "strong", "evidence": "Java services"},
                         {"text": "Distributed systems", "level": "partial"},
                         {"text": "Kubernetes", "level": "none"}],
        "min_years": 3,
        "narrative": {"sub_scores": {"relevance": 4, "ordering": 4, "ownership": 5,
                                     "impact": 4, "clarity": 3},
                      "jd_story": "j", "cv_story": "c", "suggestion": "s"}})
    scores = ScoreCalculator(today=date(2026, 7, 1)).compute(judgment, sample_cv())
    assert scores.keyword == 75                      # Kafka matches via "Kafka Streams"
    assert scores.details["keyword"]["missing"] == ["Kubernetes"]
    assert scores.experience == round(100 * (0.8 * 0.5 + 0.2 * 1.0))
    assert scores.narrative == 80


def test_no_skills_in_jd_is_zero_with_reason():
    judgment = AnalysisJudgment.model_validate({
        "jd_skills": [], "requirements": [],
        "narrative": {"sub_scores": {"relevance": 0, "ordering": 0, "ownership": 0,
                                     "impact": 0, "clarity": 0},
                      "jd_story": "", "cv_story": "", "suggestion": ""}})
    scores = ScoreCalculator().compute(judgment, sample_cv())
    assert scores.keyword == 0 and scores.details["keyword"]["reason"] == "no_skills_in_jd"
