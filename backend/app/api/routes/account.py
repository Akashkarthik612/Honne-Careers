from dataclasses import asdict

from fastapi import APIRouter, Response

from app.api.deps import Deps, User

router = APIRouter(tags=["account"])


@router.get("/health")
async def health(c: Deps) -> dict[str, str]:
    """No auth. Checks the DB pool answers, nothing else."""
    await c.db.ping()
    return {"status": "ok"}


@router.get("/me")
async def me(user: User, c: Deps) -> dict[str, object]:
    return asdict(await c.accounts.me(user))


@router.delete("/me", status_code=204)
async def delete_me(user: User, c: Deps) -> Response:
    """AUTH-3: removes storage files, then the auth user; every row cascades."""
    await c.accounts.delete(user)
    return Response(status_code=204)
