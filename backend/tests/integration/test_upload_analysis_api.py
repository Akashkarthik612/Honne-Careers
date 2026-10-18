"""PROF-2..5 uploads, A4 #7 analysis cache, and save-to-profile."""

import pytest

from tests.docs import docx, text_pdf
from tests.integration.test_tailoring_api import get, returning_user

pytestmark = pytest.mark.db

PARSED = {
    "header": {"name": "Arjun Mehta", "location": "Chennai, India",
               "email": "arjun.mehta@mail.com", "phone": "", "links": []},
    "experience": [{"role": "Software Engineer", "company": "Northwind Fintech",
                    "location": "", "start": "Jul 2021", "end": "Present",
                    "bullets": ["Cut payment-event latency by 38% (p95)"]}],
    "projects": [], "education": [],
    "skills": {"languages": ["Java"], "frameworks": [], "tools": ["AWS"]},
}

JUDGMENT = {
    "jd_skills": ["Java", "Kafka", "Kubernetes"],
    "requirements": [{"text": "Java", "level": "strong", "evidence": "Java services"}],
    "min_years": 3,
    "narrative": {"sub_scores": {"relevance": 4, "ordering": 3, "ownership": 4, "impact": 4,
                                 "clarity": 4},
                  "jd_story": "Own event-driven services", "cv_story": "Payments engineer",
                  "suggestion": "Try: lead with the settlement pipeline"},
}


async def test_pdf_upload_prefills_and_stores_privately(api):
    h = api.new_user()
    api.provider.push(PARSED)
    r = await api.client.post("/uploads", headers=h,
                              files={"file": ("../../etc/CV Arjun.pdf", text_pdf(), "image/png")})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["filename"] == "CV Arjun.pdf"          # display only, path-stripped
    exp = body["prefill"]["experience"][0]
    assert exp["id"] and exp["bullets"][0]["id"]        # ids assigned in Python
    user_id = h["Authorization"].removeprefix("Bearer user:")
    assert list(api.files.objects) == [f"{user_id}/uploads/{body['upload_id']}.pdf"]


async def test_docx_and_latex_paste(api):
    h = api.new_user()
    api.provider.push(PARSED, PARSED)
    r = await api.client.post("/uploads", headers=h, files={"file": ("cv.docx", docx(), "x/y")})
    assert r.status_code == 201
    tex = r"\documentclass{article}\begin{document}" + "Built ledgers at Northwind. " * 20
    r = await api.client.post("/uploads/latex", json={"text": tex}, headers=h)
    assert r.status_code == 201
    assert r.json()["upload_id"]


async def test_unsupported_file_fails_before_any_llm_call(api):
    exe = ("cv.pdf", b"MZ\x90\x00 not a pdf", "application/pdf")
    r = await api.client.post("/uploads", headers=api.new_user(), files={"file": exe})
    assert r.status_code == 422
    assert r.json()["error"]["details"]["reason"] == "unsupported_type"
    assert api.provider.calls == []


async def test_analysis_cached_by_content_and_jd(api):
    h, rid = await returning_user(api)
    api.provider.push(JUDGMENT)
    first = (await api.client.post(f"/resumes/{rid}/analysis", headers=h)).json()
    assert first["cached"] is False
    assert (first["keyword"], first["narrative"]) == (67, 76)

    again = (await api.client.post(f"/resumes/{rid}/analysis", headers=h)).json()
    assert again["cached"] is True
    assert len(api.provider.calls) == 1                   # same content again = 0 LLM calls

    res = await get(api, h, rid)
    await api.client.patch(f"/resumes/{rid}", headers=h, json={
        "expected_version": res["row_version"],
        "change": {"section": "personal", "value": {"name": "Arjun M."}}})
    api.provider.push(JUDGMENT)
    assert (await api.client.post(f"/resumes/{rid}/analysis",
                                  headers=h)).json()["cached"] is False


async def test_save_to_profile_adopts_content_as_user_facts(api):
    h, rid = await returning_user(api)
    version = (await api.client.get("/profile", headers=h)).json()["row_version"]
    r = await api.client.post(f"/resumes/{rid}/save-to-profile", headers=h,
                              json={"expected_version": version})
    assert r.json()["row_version"] == version + 1
    profile = (await api.client.get("/profile", headers=h)).json()
    bullet = profile["content"]["experience"][0]["bullets"][0]
    assert (bullet["origin"], bullet["locked"]) == ("user", True)
    stale = await api.client.post(f"/resumes/{rid}/save-to-profile", headers=h,
                                  json={"expected_version": version})
    assert stale.status_code == 409
