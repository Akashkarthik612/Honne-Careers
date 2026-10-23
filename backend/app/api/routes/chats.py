"""Chat routes (Day 3). A turn is a background job: POST returns 202 with a running answer
and a poll URL, like the tailor job (POST /resumes/{id}/tailor)."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Query, Response

from app.api.deps import Deps, User
from app.api.schemas import chat_summary_view, chat_view, message_view, turn_view
from app.domain.chat_agents import ChatTurnIn
from app.services.chats import StartedTurn

router = APIRouter(tags=["chats"])


def _accepted(started: StartedTurn) -> dict[str, object]:
    return turn_view(started.chat, started.user_message, started.assistant_message)


@router.get("/chats")
async def list_chats(user: User, c: Deps,
                     limit: Annotated[int | None, Query(ge=1, le=500)] = None
                     ) -> dict[str, object]:
    # `limit` = the most this list ever returns (CHAT_LIST_MAX), so the data export can say
    # when older chats were left out instead of cutting them silently (review #6).
    return {"items": [chat_summary_view(x) for x in await c.chats.recent(user, limit)],
            "retention_days": c.applications.window.days, "limit": c.chats.limits.list_max}


@router.post("/chats/messages", status_code=202)
async def new_chat(body: ChatTurnIn, user: User, c: Deps, background: BackgroundTasks
                   ) -> dict[str, object]:
    started = await c.chats.start(user, None, body)
    background.add_task(c.chats.run, user, started)
    return _accepted(started)


@router.post("/chats/{chat_id}/messages", status_code=202)
async def send_message(chat_id: UUID, body: ChatTurnIn, user: User, c: Deps,
                       background: BackgroundTasks) -> dict[str, object]:
    started = await c.chats.start(user, chat_id, body)
    background.add_task(c.chats.run, user, started)
    return _accepted(started)


@router.post("/chats/{chat_id}/retry", status_code=202)
async def retry_turn(chat_id: UUID, user: User, c: Deps, background: BackgroundTasks
                     ) -> dict[str, object]:
    started = await c.chats.retry(user, chat_id)
    background.add_task(c.chats.run, user, started)
    return _accepted(started)


@router.get("/chats/{chat_id}")
async def get_chat(chat_id: UUID, user: User, c: Deps) -> dict[str, object]:
    chat, messages = await c.chats.get(user, chat_id)
    lim = c.chats.limits
    return chat_view(chat, messages, lim.turns_max, lim.long_warn_turns, c.applications.window)


@router.get("/chats/{chat_id}/messages/{message_id}")
async def get_message(chat_id: UUID, message_id: UUID, user: User, c: Deps
                      ) -> dict[str, object]:
    return message_view(await c.chats.message(user, chat_id, message_id))


@router.delete("/chats/{chat_id}", status_code=204)
async def delete_chat(chat_id: UUID, user: User, c: Deps) -> Response:
    await c.chats.delete(user, chat_id)
    return Response(status_code=204)
