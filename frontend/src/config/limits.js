// Bounded, configured client limits (guardrails §3: no unbounded or hard-coded-in-place retries).

// Longest JD the API accepts (TAIL-1). Home and the JD page check it before anything is sent.
export const MAX_JD_WORDS = 1000;

// Tailor job polling (TAIL-3). 100 polls × 2 s = 200 s, just past the backend's tailor_job_timeout_s
// (180 s), after which the backend itself marks the job failed/stale_job.
export const TAILOR_POLL_MS = 2000;
export const TAILOR_POLL_MAX = 100;

// "Tailor all bullets" in the wizard: per-bullet calls in flight at once (each is one LLM call).
export const BULLET_TAILOR_CONCURRENCY = 3;

// Saving a download to the Database (Day 2, approved fallback C): retries only errors that can fix
// themselves (network, 5xx), waiting 2 s, 4 s, 8 s, 16 s (≈30 s in all). Still failing → kept as pending
// in this browser and retried on the next visit, at most PENDING_SAVE_MAX_VISITS times.
export const RECORD_RETRY_ATTEMPTS = 5;
export const RECORD_RETRY_BASE_MS = 2000;
export const PENDING_SAVE_MAX_VISITS = 10;
