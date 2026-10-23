"""ChatService: chats with agents (Day 3). A turn is a background job, like the tailor job.

start (request): short UoW - resolve the agent, check limits, count quota, save the user's
message and a 'running' assistant message -> 202. The route then schedules run().
run (background): read history (short UoW) -> ChatAgentRunner (no transaction held; every
step is written in its own short UoW so the UI shows it live) -> short UoW to finish. Any
failure leaves the message 'failed' with a code and Retry; the user's message stays.
A turn whose process died (Render restart/sleep) is marked failed/stale_job on the next read.
Retry continues the run from its checkpoint when it can (F4: otherwise a fresh run).

Memory (as Dust): one chat, any agent, every agent sees the whole chat (up to
CHAT_TURNS_MAX = 25 turns = 50 messages). The agent answering sees its own earlier answers as
its own turns and other agents' answers as labelled notes (history_of). A message without an
@ goes to the agent that answered last, found by identity (Speaker), not handle.
Logs carry ids, counts and codes, never message text.
"""

import re
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from uuid import UUID

import psycopg

from app.agents.chat.catalog import AgentCatalog
from app.agents.chat.prompt import OTHER_AGENT_TAG, escape
from app.agents.chat.runner import ChatAgentRunner, TurnGone
from app.core.errors import (
    AgentRequired,
    AppError,
    ChatBusy,
    ChatLimitReached,
    NotFound,
    NothingToRetry,
)
from app.core.logging import get_logger
from app.db.unit_of_work import UnitOfWork, UnitOfWorkFactory
from app.domain.agents import LlmMessage
from app.domain.applications import RetentionWindow
from app.domain.auth import AuthUser
from app.domain.chat_agents import (
    HANDLE,
    AgentSpec,
    ChatMessageRow,
    ChatRow,
    ChatTurnIn,
    Speaker,
    StepRecord,
)
from app.policy.limits import DailyAction
from app.policy.quota import QuotaGuard
from app.policy.slots import TurnSlots

log = get_logger(__name__)

_MENTION = re.compile(r"^\s*@(" + HANDLE.strip("^$") + r")(?![a-z0-9-])", re.IGNORECASE)
TITLE_MAX = 60


@dataclass(frozen=True, slots=True)
class ChatLimits:
    turns_max: int
    long_warn_turns: int
    history_turns: int
    list_max: int
    turn_timeout_s: int


@dataclass(frozen=True, slots=True)
class StartedTurn:
    chat: ChatRow
    user_message: ChatMessageRow
    assistant_message: ChatMessageRow
    spec: AgentSpec
    slot: int = 0      # TurnSlots token, released when the job ends
    resume: bool = False  # Retry continues the run's checkpoint


def mentioned(message: str) -> str | None:
    """'@follow-up draft…' -> 'follow-up'. Only a mention at the start picks the agent."""
    m = _MENTION.match(message)
    return m.group(1).lower() if m else None


def title_of(message: str) -> str:
    text = " ".join(_MENTION.sub("", message, count=1).split()) or message.strip()
    return text[:TITLE_MAX - 1] + "…" if len(text) > TITLE_MAX else text


def other_agent_note(handle: str, text: str) -> str:
    return (f'<{OTHER_AGENT_TAG} handle="@{handle}">Answer from another agent in this chat '
            f"(its final answer only, not its tool steps):\n{escape(text)}</{OTHER_AGENT_TAG}>")


def history_of(messages: list[ChatMessageRow], before_seq: int, turns: int, me: Speaker
               ) -> list[LlmMessage]:
    """Earlier turns for the model, as Dust renders them: each user message with the answer
    it got, failed or unanswered turns left out, last `turns` turns only. An answer by `me`
    (the agent answering now) is its own model turn; another agent's answer is a labelled
    note in the user's turn, so roles still alternate. A trailing user turn (notes only) is
    the caller's to merge with the new message (merge_message). O(messages), n <= 50."""
    pairs: list[tuple[ChatMessageRow, ChatMessageRow]] = []
    pending: ChatMessageRow | None = None
    for m in messages:
        if m.seq >= before_seq:
            break
        if m.role == "user":
            pending = m
        elif pending is not None and m.status == "ok":
            pairs.append((pending, m))
            pending = None
    out: list[LlmMessage] = []
    user_parts: list[str] = []
    for u, a in pairs[-turns:]:
        drafts = f"\n(Drafted {len(a.drafts)} message(s) for the user.)" if a.drafts else ""
        user_parts.append(u.content)
        if Speaker.of_message(a) == me:
            out.append(LlmMessage(role="user", text="\n\n".join(user_parts)))
            out.append(LlmMessage(role="model", text=f"{a.content}{drafts}"))
            user_parts = []
        else:
            user_parts.append(other_agent_note(a.agent_handle or "agent", f"{a.content}{drafts}"))
    if user_parts:
        out.append(LlmMessage(role="user", text="\n\n".join(user_parts)))
    return out


def merge_message(history: list[LlmMessage], message: str) -> tuple[list[LlmMessage], str]:
    """The new message joins a trailing user turn (other agents' notes), so the model sees
    user/model turns alternating, as Gemini expects."""
    if history and history[-1].role == "user":
        return history[:-1], f"{history[-1].text}\n\n{message}"
    return history, message


class ChatService:
    def __init__(self, uow: UnitOfWorkFactory, catalog: AgentCatalog, runner: ChatAgentRunner,
                 quota: QuotaGuard, slots: TurnSlots, window: RetentionWindow,
                 limits: ChatLimits) -> None:
        self._uow = uow
        self._catalog = catalog
        self._runner = runner
        self._quota = quota
        self._slots = slots
        self._window = window
        self._limits = limits

    @property
    def limits(self) -> ChatLimits:
        return self._limits

    def _cutoff(self) -> datetime:
        return self._window.cutoff(datetime.now(UTC))

    # ---------- reads ----------

    async def recent(self, user: AuthUser, limit: int | None = None) -> list[ChatRow]:
        n = min(limit or self._limits.list_max, self._limits.list_max)
        async with self._uow(user.id) as uow:
            return await uow.chats.list_recent(user.id, self._cutoff(), n)

    async def get(self, user: AuthUser, chat_id: UUID
                  ) -> tuple[ChatRow, list[ChatMessageRow]]:
        async with self._uow(user.id) as uow:
            chat = await self._chat(uow, user, chat_id)
            await self._mark_stale(uow, user, chat_id)
            return chat, await uow.chats.messages(user.id, chat_id)

    async def message(self, user: AuthUser, chat_id: UUID, message_id: UUID
                      ) -> ChatMessageRow:
        """The poll target while a turn runs."""
        async with self._uow(user.id) as uow:
            await self._chat(uow, user, chat_id)
            await self._mark_stale(uow, user, chat_id)
            row = await uow.chats.message(user.id, chat_id, message_id)
        if row is None:
            raise NotFound(reason="message")
        return row

    async def delete(self, user: AuthUser, chat_id: UUID) -> None:
        async with self._uow(user.id) as uow:
            if not await uow.chats.delete(user.id, chat_id):
                raise NotFound(reason="chat")
        log.info("chat_deleted", chat_id=chat_id)

    # ---------- a turn ----------

    async def start(self, user: AuthUser, chat_id: UUID | None, turn: ChatTurnIn
                    ) -> StartedTurn:
        """Saves the message and a running answer. The caller must schedule run()."""
        slot = self._slots.acquire()
        try:
            started = replace(await self._start(user, chat_id, turn), slot=slot)
        except BaseException:
            self._slots.release(slot)
            raise
        log.info("chat_turn_started", chat_id=started.chat.id,
                 message_id=started.assistant_message.id, agent_kind=started.spec.kind,
                 turn=started.chat.turn_count)
        return started

    async def _start(self, user: AuthUser, chat_id: UUID | None, turn: ChatTurnIn
                     ) -> StartedTurn:
        try:
            async with self._uow(user.id) as uow:
                chat = await self._chat(uow, user, chat_id, lock=True) if chat_id else None
                if chat is not None:  # a dead running turn must not block the send (ChatBusy)
                    await self._mark_stale(uow, user, chat.id)
                messages = await uow.chats.messages(user.id, chat.id) if chat else []
                handle = turn.agent or mentioned(turn.message)
                if handle is not None:
                    spec = await self._catalog.resolve(uow, user.id, handle)
                else:  # no @: the agent that answered last, by identity (review #2)
                    last = _last_speaker(messages)
                    if last is None:
                        raise AgentRequired()
                    spec = await self._catalog.resolve_speaker(uow, user.id, last)
                if chat is not None and chat.turn_count >= self._limits.turns_max:
                    raise ChatLimitReached(limit=self._limits.turns_max)
                if chat is None:  # a new conversation uses one of today's chats (PLAN-2)
                    await self._quota.consume(uow, user.id, DailyAction.CHAT_START)
                await self._quota.consume(uow, user.id, DailyAction.CHAT_MESSAGE)
                if chat is None:
                    chat = await uow.chats.create(user.id, title_of(turn.message))
                user_msg = await uow.chats.insert(user.id, chat.id, "user", content=turn.message)
                answer = await uow.chats.insert(
                    user.id, chat.id, "assistant", status="running", agent_handle=spec.handle,
                    agent_kind=spec.kind, agent_version_id=spec.version_id,
                    builtin_version=spec.version if spec.kind == "builtin" else None)
                await uow.chats.touch(user.id, chat.id, new_turn=True)
                chat = await self._chat(uow, user, chat.id)
        except psycopg.errors.UniqueViolation as exc:  # one running turn per chat
            raise ChatBusy(chat_id=str(chat_id)) from exc
        return StartedTurn(chat, user_msg, answer, spec)

    async def retry(self, user: AuthUser, chat_id: UUID) -> StartedTurn:
        """Runs the last failed turn again, in place, with the agent's current version."""
        slot = self._slots.acquire()
        try:
            async with self._uow(user.id) as uow:
                chat = await self._chat(uow, user, chat_id, lock=True)
                await self._mark_stale(uow, user, chat_id)
                messages = await uow.chats.messages(user.id, chat_id)
                if (len(messages) < 2 or messages[-1].role != "assistant"
                        or messages[-1].status != "failed" or messages[-2].role != "user"):
                    raise NothingToRetry()
                failed, user_msg = messages[-1], messages[-2]
                who = Speaker.of_message(failed)
                if who is None:
                    raise NothingToRetry()
                spec = await self._catalog.resolve_speaker(uow, user.id, who)
                # One indexed read of the run's last checkpoint; no LLM call under the lock.
                point = await self._runner.resume_point(failed.id, spec)
                if point.check != "resume":  # F4
                    log.warning("chat_retry_fresh", chat_id=chat_id, message_id=failed.id,
                                reason=point.check)
                await self._quota.consume(uow, user.id, DailyAction.CHAT_MESSAGE)
                if not await uow.chats.restart(user.id, failed.id, steps=point.steps):
                    raise NothingToRetry()
                answer = await uow.chats.message(user.id, chat_id, failed.id)
        except BaseException:
            self._slots.release(slot)
            raise
        if answer is None:
            self._slots.release(slot)
            raise NothingToRetry()
        resume = point.check == "resume"
        log.info("chat_turn_retried", chat_id=chat_id, message_id=answer.id, resume=resume)
        return StartedTurn(chat, user_msg, answer, spec, slot, resume)

    async def run(self, user: AuthUser, started: StartedTurn) -> None:
        """The job. Never raises: any failure leaves the answer 'failed' with a code."""
        mid, chat_id = started.assistant_message.id, started.chat.id
        try:
            async with self._uow(user.id) as uow:
                messages = await uow.chats.messages(user.id, chat_id)
            history, message = merge_message(
                history_of(messages, started.user_message.seq, self._limits.history_turns,
                           Speaker.of_spec(started.spec)),
                started.user_message.content)

            async def on_step(step: StepRecord) -> None:
                async with self._uow(user.id) as uow:
                    live = await uow.chats.add_step(user.id, mid, step.to_json())
                if not live:
                    raise TurnGone()

            result = await self._runner.answer(user, started.spec, history, message,
                                               entity_id=mid, on_step=on_step, thread=mid,
                                               resume=started.resume)
            async with self._uow(user.id) as uow:
                done = await uow.chats.finish(
                    user.id, mid, result.answer.content, [s.to_json() for s in result.sources],
                    [d.model_dump(mode="json") for d in result.answer.drafts])
                if done:
                    await uow.chats.touch(user.id, chat_id, new_turn=False)
            if not done:
                log.warning("chat_turn_result_discarded", chat_id=chat_id, message_id=mid,
                            reason="no longer running (stale, retried or chat deleted)")
                return
            log.info("chat_turn_finished", chat_id=chat_id, message_id=mid,
                     sources=len(result.sources), drafts=len(result.answer.drafts),
                     steps=len(result.steps), forced_submit=result.forced_submit)
        except TurnGone:
            log.warning("chat_turn_gone", chat_id=chat_id, message_id=mid)
        except AppError as exc:
            await self._fail(user, mid, exc.code)
            log.warning("chat_turn_failed", chat_id=chat_id, message_id=mid, code=exc.code)
        except Exception:
            # Job boundary: log with traceback, leave a clear state, never stuck 'running'.
            log.exception("chat_turn_crashed", chat_id=chat_id, message_id=mid)
            await self._fail(user, mid, "internal_error")
        finally:
            self._slots.release(started.slot)

    # ---------- helpers ----------

    async def _chat(self, uow: UnitOfWork, user: AuthUser, chat_id: UUID, *,
                    lock: bool = False) -> ChatRow:
        chat = await uow.chats.get(user.id, chat_id, self._cutoff(), for_update=lock)
        if chat is None:
            raise NotFound(reason="chat")
        return chat

    async def _mark_stale(self, uow: UnitOfWork, user: AuthUser, chat_id: UUID) -> None:
        if await uow.chats.mark_stale(user.id, chat_id, self._limits.turn_timeout_s):
            log.warning("chat_turn_stale", chat_id=chat_id)  # B9 for chat turns

    async def _fail(self, user: AuthUser, message_id: UUID, code: str) -> None:
        async with self._uow(user.id) as uow:
            await uow.chats.fail(user.id, message_id, code)


def _last_speaker(messages: list[ChatMessageRow]) -> Speaker | None:
    for m in reversed(messages):
        if m.role == "assistant" and (who := Speaker.of_message(m)) is not None:
            return who
    return None
