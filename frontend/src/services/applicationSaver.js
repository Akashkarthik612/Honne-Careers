import { PENDING_SAVE_MAX_VISITS, RECORD_RETRY_ATTEMPTS, RECORD_RETRY_BASE_MS } from '@/config/limits';
import { recordApplication } from './api';

// Saving a download to the Database (SAVE-1), with the retry agreed for Day 2 (fallback C):
//  1. retry only errors that can fix themselves: network (status 0), 5xx/503 (server waking, storage hiccup,
//     save_conflict). 401 (signed out), 404, 409 pdf_outdated never succeed by retrying, so they stop at once;
//  2. bounded back-off: RECORD_RETRY_ATTEMPTS tries, waiting RECORD_RETRY_BASE_MS × 2^n between them;
//  3. still failing → the resume id is kept as "pending" in this browser and retried on the next visit
//     (flushPendingSaves), at most PENDING_SAVE_MAX_VISITS visits.
// The save is idempotent on the server (one JD = one row), so a retry can never create a duplicate.

export const isRetryable = (e) => e?.status === 0 || (e?.status >= 500 && e?.status < 600);

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Pure loop (record and sleep injected). Resolves with the server's answer or throws the last error.
export async function saveWithRetry(resumeId, { record = recordApplication, sleep = wait, attempts = RECORD_RETRY_ATTEMPTS, baseMs = RECORD_RETRY_BASE_MS, onRetry = () => {} } = {}) {
  for (let n = 0; ; n += 1) {
    try {
      return await record(resumeId);
    } catch (e) {
      if (!isRetryable(e) || n + 1 >= attempts) throw e;
      onRetry(n + 1, e);
      await sleep(baseMs * 2 ** n);
    }
  }
}

// ── pending saves (localStorage: per browser, survives a reload) ─────────────
const KEY = 'hc.pendingApplicationSaves';

function read(storage) {
  try {
    const value = JSON.parse(storage.getItem(KEY) ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {}; // unreadable or blocked storage: nothing pending in this browser
  }
}

function write(storage, pending) {
  try {
    if (Object.keys(pending).length) storage.setItem(KEY, JSON.stringify(pending));
    else storage.removeItem(KEY);
  } catch {
    /* storage blocked (private mode): pending saves can't be remembered; the page already showed the error */
  }
}

export const pendingSaves = (storage = globalThis.localStorage) => read(storage);

export function markPending(resumeId, storage = globalThis.localStorage) {
  const pending = read(storage);
  pending[resumeId] = { visits: pending[resumeId]?.visits ?? 0 };
  write(storage, pending);
}

export function clearPending(resumeId, storage = globalThis.localStorage) {
  const pending = read(storage);
  delete pending[resumeId];
  write(storage, pending);
}

// Next visit: one try each (no back-off loop). Saved or permanently refused → forgotten; a retryable error
// keeps it until PENDING_SAVE_MAX_VISITS. Returns { saved, dropped, kept } ids, for the caller to report.
export async function flushPendingSaves({ record = recordApplication, storage = globalThis.localStorage, maxVisits = PENDING_SAVE_MAX_VISITS } = {}) {
  const result = { saved: [], dropped: [], kept: [] };
  for (const [resumeId, { visits = 0 }] of Object.entries(read(storage))) {
    try {
      await record(resumeId);
      clearPending(resumeId, storage);
      result.saved.push(resumeId);
    } catch (e) {
      if (isRetryable(e) && visits + 1 < maxVisits) {
        const pending = read(storage);
        pending[resumeId] = { visits: visits + 1 };
        write(storage, pending);
        result.kept.push(resumeId);
      } else {
        clearPending(resumeId, storage);
        result.dropped.push(resumeId);
      }
    }
  }
  return result;
}
