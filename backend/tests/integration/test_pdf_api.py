"""Day_1 A4 #6: download compiles once; unchanged content reuses the stored PDF."""

import pytest

from tests.integration.test_tailoring_api import returning_user

pytestmark = pytest.mark.db


async def test_pdf_built_once_then_reused_then_rebuilt_after_edit(api):
    h, rid = await returning_user(api)
    first = await api.client.post(f"/resumes/{rid}/pdf", headers=h)
    assert first.status_code == 200, first.text
    assert (first.json()["reused"], first.json()["page_count"]) == (False, 1)
    assert len(api.compiler.sources) == 1

    again = (await api.client.post(f"/resumes/{rid}/pdf", headers=h)).json()
    assert again["reused"] is True
    assert len(api.compiler.sources) == 1  # 0 compiles for unchanged content

    res = (await api.client.get(f"/resumes/{rid}", headers=h)).json()
    assert res["pdf"] == {"up_to_date": True, "page_count": 1}
    await api.client.patch(f"/resumes/{rid}", headers=h, json={
        "expected_version": res["row_version"],
        "change": {"section": "personal", "value": {"name": "Arjun M."}}})
    rebuilt = (await api.client.post(f"/resumes/{rid}/pdf", headers=h)).json()
    assert rebuilt["reused"] is False
    assert "Arjun M." in api.compiler.sources[-1]
    user_id = h["Authorization"].removeprefix("Bearer user:")
    assert all(p.startswith(f"{user_id}/resumes/{rid}/") for p in api.files.objects)


async def test_two_page_warning(api):
    h, rid = await returning_user(api)
    api.compiler.pages = 2
    r = (await api.client.post(f"/resumes/{rid}/pdf", headers=h)).json()
    assert (r["page_count"], r["warning"]) == (2, "multiple_pages")


async def test_other_user_cannot_build_my_pdf(api):
    _, rid = await returning_user(api)
    r = await api.client.post(f"/resumes/{rid}/pdf", headers=api.new_user())
    assert r.status_code == 404
    assert api.compiler.sources == []
