"""Day_1 A4 #1: valid Supabase tokens accepted; anonymous, expired or forged -> 401."""

import json
import time
import uuid

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from app.auth.jwt_verifier import AuthUnavailable, JwtVerifier
from app.core.errors import Unauthorized

ISS = "https://proj.supabase.co/auth/v1"
AUD = "authenticated"
KID = "key-1"


def _keypair():
    private = ec.generate_private_key(ec.SECP256R1())
    jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private.public_key()))
    return private, {**jwk, "kid": KID, "alg": "ES256", "use": "sig"}


PRIVATE, PUBLIC_JWK = _keypair()
OTHER_PRIVATE, _ = _keypair()


def _claims(**overrides):
    now = int(time.time())
    base = {"sub": str(uuid.uuid4()), "aud": AUD, "iss": ISS, "role": "authenticated",
            "iat": now, "exp": now + 3600, "email": "a@example.test",
            "app_metadata": {"provider": "google"}}
    base.update(overrides)
    return base


def _token(claims=None, key=PRIVATE, alg="ES256", kid=KID):
    return jwt.encode(claims or _claims(), key, algorithm=alg, headers={"kid": kid})


def _verifier(handler=None):
    calls = {"n": 0}

    def default(request):
        calls["n"] += 1
        return httpx.Response(200, json={"keys": [PUBLIC_JWK]})

    http = httpx.AsyncClient(transport=httpx.MockTransport(handler or default))
    return JwtVerifier(http, f"{ISS}/.well-known/jwks.json", ISS, AUD, 0, 600), calls


async def test_valid_token_returns_user():
    verifier, _ = _verifier()
    claims = _claims()
    user = await verifier.verify(_token(claims))
    assert str(user.id) == claims["sub"]
    assert user.provider == "google"
    assert user.access_token not in repr(user)


@pytest.mark.parametrize("claims", [
    _claims(exp=int(time.time()) - 10),          # expired
    _claims(aud="anon"),                          # wrong audience
    _claims(iss="https://evil.example/auth/v1"),  # wrong issuer
    _claims(role="anon"),                         # anon key token
    _claims(is_anonymous=True),                   # anonymous sign-in
    _claims(sub="not-a-uuid"),
])
async def test_bad_claims_rejected(claims):
    verifier, _ = _verifier()
    with pytest.raises(Unauthorized):
        await verifier.verify(_token(claims))


async def test_forged_signature_rejected():
    verifier, _ = _verifier()
    with pytest.raises(Unauthorized):
        await verifier.verify(_token(key=OTHER_PRIVATE))


async def test_hs256_rejected_even_with_valid_shape():
    verifier, _ = _verifier()
    token = jwt.encode(_claims(), "x" * 32, algorithm="HS256", headers={"kid": KID})
    with pytest.raises(Unauthorized):
        await verifier.verify(token)


async def test_garbage_rejected():
    verifier, _ = _verifier()
    with pytest.raises(Unauthorized):
        await verifier.verify("not.a.jwt")


async def test_unknown_kid_does_not_refetch_every_time():
    verifier, calls = _verifier()
    await verifier.verify(_token())
    for _ in range(5):
        with pytest.raises(Unauthorized):
            await verifier.verify(_token(kid="random"))
    assert calls["n"] == 1


async def test_jwks_outage_is_503_not_401():
    verifier, _ = _verifier(lambda request: httpx.Response(500))
    with pytest.raises(AuthUnavailable):
        await verifier.verify(_token())


async def test_empty_jwks_refuses():
    verifier, _ = _verifier(lambda request: httpx.Response(200, json={"keys": []}))
    with pytest.raises(AuthUnavailable):
        await verifier.verify(_token())
