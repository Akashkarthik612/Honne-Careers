// Bounded, configured client limits (guardrails §3: no unbounded or hard-coded-in-place retries).

// Tailor job polling (TAIL-3). 100 polls × 2 s = 200 s, just past the backend's tailor_job_timeout_s
// (180 s), after which the backend itself marks the job failed/stale_job.
export const TAILOR_POLL_MS = 2000;
export const TAILOR_POLL_MAX = 100;

// "Tailor all bullets" in the wizard: per-bullet calls in flight at once (each is one LLM call).
export const BULLET_TAILOR_CONCURRENCY = 3;
