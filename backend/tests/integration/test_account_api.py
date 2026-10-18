import pytest

pytestmark = pytest.mark.db


async def test_health_needs_no_auth(api):
    r = await api.client.get("/health")
    assert r.status_code == 200
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-correlation-id"]


async def test_me_requires_a_token(api):
    assert (await api.client.get("/me")).status_code == 401
    r = await api.client.get("/me", headers={"Authorization": "Bearer forged"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


async def test_me_creates_account_on_first_request(api):
    headers = api.new_user()
    r = await api.client.get("/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["plan"] == "free"
    assert r.json()["has_profile"] is False


async def test_delete_me_removes_files_rows_and_blocks_the_old_token(api):
    headers = api.new_user()
    user_id = headers["Authorization"].removeprefix("Bearer user:")
    await api.client.get("/me", headers=headers)
    api.files.objects[f"{user_id}/uploads/x.pdf"] = b"%PDF"
    api.files.objects["someone-else/uploads/y.pdf"] = b"%PDF"

    assert (await api.client.delete("/me", headers=headers)).status_code == 204
    assert list(api.files.objects) == ["someone-else/uploads/y.pdf"]
    # Token is still cryptographically valid for a while; the account must not come back.
    api.container.accounts._ensured.clear()
    assert (await api.client.get("/me", headers=headers)).status_code == 401


async def test_oversized_body_is_413(api):
    r = await api.client.post("/me", content=b"x" * (7 * 1024 * 1024),
                              headers=api.new_user())
    assert r.status_code == 413


async def test_cors_rejects_unknown_origin(api):
    r = await api.client.options("/me", headers={"Origin": "https://evil.test",
                                                 "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in r.headers
