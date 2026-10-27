"""PDF-1: template switch + section order (PATCH /resumes/{id}/layout) and the PDF cache key.
Switching template or order must never serve the old PDF; switching back reuses nothing
stale; content is untouched."""

import pytest

from tests.integration.test_applications_api import app_pdfs, download
from tests.integration.test_tailoring_api import returning_user

pytestmark = pytest.mark.db

PRO = "honne_professional"
ORDER = ["projects", "experience", "skills", "education", "certifications", "languages"]


async def layout(api, h, rid, template, order=None, version=None):
    if version is None:
        version = (await api.client.get(f"/resumes/{rid}", headers=h)).json()["row_version"]
    return await api.client.patch(f"/resumes/{rid}/layout", headers=h, json={
        "expected_version": version, "template": template, "section_order": order})


async def test_templates_lists_both_with_default_orders(api):
    r = (await api.client.get("/templates", headers=api.new_user())).json()
    assert [(t["id"], t["description"]) for t in r] == [
        ("jake", "For entry-level candidates"), (PRO, "For experienced professionals")]
    assert r[0]["default_order"][0] == "education" and r[1]["default_order"][0] == "experience"


async def test_create_with_professional_template(api):
    h = api.new_user()
    r = await api.client.post("/resumes", headers=h, json={"template": PRO, "mode": "scratch"})
    assert r.status_code == 201, r.text
    assert (r.json()["template"], r.json()["section_order"]) == (PRO, None)


@pytest.mark.parametrize("template", ["elegant", "Jake", "../x"])
async def test_unknown_template_is_rejected(api, template):
    h = api.new_user()
    r = await api.client.post("/resumes", headers=h, json={"template": template,
                                                           "mode": "scratch"})
    assert r.status_code == 422


async def test_switch_template_rebuilds_pdf_and_keeps_content(api):
    h, rid = await returning_user(api)
    before = (await api.client.get(f"/resumes/{rid}", headers=h)).json()
    assert (await api.client.post(f"/resumes/{rid}/pdf", headers=h)).json()["reused"] is False
    assert r"\resumeSubheading" in api.compiler.sources[-1]  # Jake

    r = await layout(api, h, rid, PRO)
    assert r.status_code == 200, r.text
    after = r.json()
    assert after["template"] == PRO
    assert (after["content"], after["content_hash"]) == (before["content"],
                                                         before["content_hash"])
    assert after["pdf"]["up_to_date"] is False  # the Jake PDF is not this CV's PDF any more

    built = (await api.client.post(f"/resumes/{rid}/pdf", headers=h)).json()
    assert built["reused"] is False and len(api.compiler.sources) == 2
    assert r"\cvbullets" in api.compiler.sources[-1]  # Honne Professional
    again = (await api.client.post(f"/resumes/{rid}/pdf", headers=h)).json()
    assert again["reused"] is True and len(api.compiler.sources) == 2

    await layout(api, h, rid, "jake")  # back to Jake: its stored PDF was replaced, rebuild
    assert (await api.client.post(f"/resumes/{rid}/pdf", headers=h)).json()["reused"] is False
    assert r"\resumeSubheading" in api.compiler.sources[-1]


async def test_section_order_is_stored_and_used(api):
    h, rid = await returning_user(api)
    await layout(api, h, rid, PRO)
    await api.client.post(f"/resumes/{rid}/pdf", headers=h)
    r = await layout(api, h, rid, PRO, ORDER)
    assert r.status_code == 200 and r.json()["section_order"] == ORDER
    assert r.json()["pdf"]["up_to_date"] is False
    assert (await api.client.post(f"/resumes/{rid}/pdf", headers=h)).json()["reused"] is False
    tex = api.compiler.sources[-1]
    assert tex.index(r"\section{Projects}") < tex.index(r"\section{Professional Experience}")
    reset = await layout(api, h, rid, PRO, None)  # None = the template's default order
    assert reset.json()["section_order"] is None


@pytest.mark.parametrize("order", [ORDER[:-1], [*ORDER[:-1], "experience"], [*ORDER, "x"]])
async def test_bad_section_order_is_rejected(api, order):
    h, rid = await returning_user(api)
    assert (await layout(api, h, rid, PRO, order)).status_code == 422


async def test_stale_layout_is_409(api):
    h, rid = await returning_user(api)
    version = (await api.client.get(f"/resumes/{rid}", headers=h)).json()["row_version"]
    assert (await layout(api, h, rid, PRO, version=version)).status_code == 200
    assert (await layout(api, h, rid, "jake", version=version)).status_code == 409


async def test_duplicate_keeps_layout(api):
    h, rid = await returning_user(api)
    await layout(api, h, rid, PRO, ORDER)
    copy = (await api.client.post(f"/resumes/{rid}/duplicate", headers=h)).json()
    assert (copy["template"], copy["section_order"]) == (PRO, ORDER)


async def test_other_user_cannot_change_my_layout(api):
    _, rid = await returning_user(api)
    r = await api.client.patch(f"/resumes/{rid}/layout", headers=api.new_user(), json={
        "expected_version": 1, "template": PRO, "section_order": None})
    assert r.status_code == 404


async def test_application_gets_the_new_templates_pdf(api):
    """SAVE-1: downloading again for the same JD after a template switch replaces the
    Database copy (it is keyed like the resume's PDF), so it never keeps the old layout."""
    h, rid = await returning_user(api)
    await download(api, h, rid)
    first = app_pdfs(api, h)
    await layout(api, h, rid, PRO)
    r = await api.client.post(f"/resumes/{rid}/application", headers=h)
    assert r.status_code == 409  # the stored PDF is the Jake one: build first
    await download(api, h, rid)
    second = app_pdfs(api, h)
    assert len(second) == 1 and second != first
