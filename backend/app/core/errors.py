"""Domain exceptions. One per failure; each carries an HTTP status and a stable code.

Messages are user-facing (Day_1 B9). Never put CV/JD text or internals in them.
Adding a failure = adding a subclass; ErrorMapper needs no change (OCP).
"""

from typing import Any


class AppError(Exception):
    status_code: int = 500
    code: str = "internal_error"
    message: str = "Something went wrong."

    def __init__(self, message: str | None = None, **details: Any) -> None:
        super().__init__(message or self.message)
        self.message = message or self.message
        self.details = details  # safe, non-content metadata only (ids, field paths)


class Unauthorized(AppError):
    status_code, code, message = 401, "unauthorized", "Please sign in again."


class NotFound(AppError):
    # Also used for other users' rows: 404, never 403, so ids leak nothing (security §1.4).
    status_code, code, message = 404, "not_found", "Not found."


class InvalidInput(AppError):
    status_code, code, message = 422, "invalid_input", "Some fields are invalid."


class UnreadableUpload(AppError):
    status_code, code, message = 422, "unreadable_upload", "We couldn't read this file."


class StaleVersion(AppError):
    status_code, code, message = 409, "stale_version", "Updated in another tab, reload."


class JobAlreadyRunning(AppError):
    status_code, code, message = 409, "job_running", "Tailoring is already running."


class PdfOutdated(AppError):
    # Saving to the Database needs the PDF of the CV as it is now (SAVE-1).
    status_code, code = 409, "pdf_outdated"
    message = "Your CV changed after this PDF was built. Download it again to save it."


class ApplicationExists(AppError):
    # One JD = one row in the Database (SAVE-3).
    status_code, code = 409, "application_exists"
    message = "This job is already in your Database."


class SaveConflict(AppError):
    # Two saves for the same job at once; the other one won. Safe to retry.
    status_code, code, message = 503, "save_conflict", "Couldn't save it, try again."


class EntitlementRequired(AppError):
    status_code, code, message = 402, "upgrade_required", "This feature needs an upgrade."


class QuotaExceeded(AppError):
    status_code, code, message = 429, "quota_exceeded", "Daily limit reached, try tomorrow."


class TruthViolation(AppError):
    status_code, code = 422, "truth_violation"
    message = "We couldn't tailor this without adding things you didn't write."


class FactMissing(AppError):
    # An AI-worded bullet whose original fact text is gone (TRUTH-1). Never guess it.
    status_code, code = 409, "fact_missing"
    message = "We lost the original wording of a bullet. Edit it to continue."


class LlmUnavailable(AppError):
    status_code, code, message = 503, "llm_unavailable", "Couldn't reach the AI, try again."


class LlmOutputInvalid(AppError):
    status_code, code, message = 502, "llm_output_invalid", "Couldn't reach the AI, try again."


class AgentNotFound(NotFound):
    # Unknown handle, another user's agent, or one the user deleted (Day 3).
    code, message = "agent_not_found", "No agent with that name. Type @ to pick one."


class AgentGone(NotFound):
    # A follow-up or Retry for an agent the user deleted after it answered here (Day 3).
    code = "agent_gone"
    message = "The agent that answered here was deleted. Type @ to pick another."


class AgentRequired(AppError):
    status_code, code, message = 422, "agent_required", "Type @ to pick an agent."


class HandleTaken(AppError):
    status_code, code, message = 409, "handle_taken", "You already have an agent with that name."


class HandleReserved(AppError):
    status_code, code, message = 422, "handle_reserved", "That name belongs to a Honne agent."


class AgentLimitReached(AppError):
    # CUST-4. The limit is in details so the UI can say it.
    status_code, code = 409, "agent_limit_reached"
    message = "You've reached the agent limit. Delete one to make another."


class ChatLimitReached(AppError):
    status_code, code = 409, "chat_limit_reached"
    message = "This chat is full. Start a new chat; your profile and Database come with you."


class ChatBusy(AppError):
    # One running turn per chat (partial unique index); another tab is waiting on an answer.
    status_code, code, message = 409, "chat_busy", "Wait for the answer before sending again."


class NothingToRetry(AppError):
    status_code, code, message = 409, "nothing_to_retry", "There's nothing to retry here."


class AgentToolFailed(AppError):
    # A data tool timed out mid-turn (DB slow). Not handed to the model: the turn fails.
    status_code, code, message = 503, "agent_tool_failed", "Couldn't read your data, try again."


class AgentsBusy(AppError):
    # Per-process cap on running chat turns (free Render CPU). Fail loudly, never queue.
    status_code, code, message = 429, "agents_busy", "Agents are busy, try again in a minute."


class RenderFailed(AppError):
    status_code, code = 500, "render_failed"
    message = "Couldn't build the PDF. Your edits are saved."


class RenderBusy(AppError):
    status_code, code, message = 503, "render_busy", "PDF builder is busy, try again."


class StorageFailed(AppError):
    status_code, code, message = 502, "storage_failed", "File storage failed, try again."


class ConfigError(Exception):
    """Startup-only: bad agent file, missing prompt, unknown provider. Stops the app."""
