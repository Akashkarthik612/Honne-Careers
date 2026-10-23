"""Custom agent routes (Day 3: CUST-1, CUST-3, CUST-4). HTTP in/out only."""

from uuid import UUID

from fastapi import APIRouter, Response

from app.api.deps import Deps, User
from app.api.schemas import PreviewAgent, UpdateAgent, agent_view, agents_view, preview_view
from app.domain.chat_agents import CustomAgentIn

router = APIRouter(tags=["agents"])


@router.get("/agents")
async def list_agents(user: User, c: Deps) -> dict[str, object]:
    """The user's agents (with usage) and the built-in ones, for the list, Home and @."""
    mine, limit = await c.custom_agents.list(user)
    return agents_view(mine, c.custom_agents.catalog.builtins(), limit)


@router.post("/agents", status_code=201)
async def create_agent(body: CustomAgentIn, user: User, c: Deps) -> dict[str, object]:
    return agent_view(await c.custom_agents.create(user, body))


@router.post("/agents/preview")
async def preview_agent(body: PreviewAgent, user: User, c: Deps) -> dict[str, object]:
    """Try it (CUST-3): one answer from the unsaved agent; nothing is saved. Synchronous on
    purpose: a single short turn with no row to poll."""
    return preview_view(await c.custom_agents.preview(user, body.agent, body.message))


@router.get("/agents/{agent_id}")
async def get_agent(agent_id: UUID, user: User, c: Deps) -> dict[str, object]:
    return agent_view(await c.custom_agents.get(user, agent_id))


@router.put("/agents/{agent_id}")
async def update_agent(agent_id: UUID, body: UpdateAgent, user: User, c: Deps
                       ) -> dict[str, object]:
    data = CustomAgentIn.model_validate(body.model_dump(exclude={"expected_version"}))
    return agent_view(await c.custom_agents.update(user, agent_id, body.expected_version, data))


@router.delete("/agents/{agent_id}", status_code=204)
async def delete_agent(agent_id: UUID, user: User, c: Deps) -> Response:
    await c.custom_agents.delete(user, agent_id)
    return Response(status_code=204)
