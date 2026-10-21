import { describe, expect, it, vi } from 'vitest';
import { flushPendingSaves, isRetryable, markPending, pendingSaves, saveWithRetry } from './applicationSaver';
import { ApiError } from './apiClient';

const err = (status, code = `http_${status}`) => new ApiError({ status, code, message: 'x' });

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

describe('saveWithRetry (Day 2 fallback C)', () => {
  it('retries network and 5xx errors with growing waits, then succeeds', async () => {
    const record = vi.fn().mockRejectedValueOnce(err(0, 'network')).mockRejectedValueOnce(err(503, 'save_conflict')).mockResolvedValue({ saved: true });
    const sleep = vi.fn(async () => {});
    await expect(saveWithRetry('r1', { record, sleep, attempts: 5, baseMs: 100 })).resolves.toEqual({ saved: true });
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 200]);
  });

  it('stops at once on errors retrying can’t fix', async () => {
    for (const e of [err(401), err(404), err(409, 'pdf_outdated'), err(422)]) {
      const record = vi.fn().mockRejectedValue(e);
      await expect(saveWithRetry('r1', { record, sleep: async () => {} })).rejects.toBe(e);
      expect(record).toHaveBeenCalledTimes(1);
    }
  });

  it('is bounded: gives up after the configured attempts', async () => {
    const record = vi.fn().mockRejectedValue(err(502));
    await expect(saveWithRetry('r1', { record, sleep: async () => {}, attempts: 3 })).rejects.toMatchObject({ status: 502 });
    expect(record).toHaveBeenCalledTimes(3);
  });

  it('knows which errors are retryable', () => {
    expect([0, 500, 502, 503].map((s) => isRetryable(err(s)))).toEqual([true, true, true, true]);
    expect([400, 401, 404, 409, 422, 429].some((s) => isRetryable(err(s)))).toBe(false);
  });
});

describe('pending saves (next visit)', () => {
  it('saves pending ones, keeps transient failures, drops permanent ones', async () => {
    const storage = memoryStorage();
    ['ok', 'flaky', 'gone'].forEach((id) => markPending(id, storage));
    const record = vi.fn(async (id) => {
      if (id === 'flaky') throw err(503);
      if (id === 'gone') throw err(404);
      return { saved: true };
    });
    expect(await flushPendingSaves({ record, storage })).toEqual({ saved: ['ok'], dropped: ['gone'], kept: ['flaky'] });
    expect(pendingSaves(storage)).toEqual({ flaky: { visits: 1 } });
  });

  it('stops retrying after the configured number of visits', async () => {
    const storage = memoryStorage();
    markPending('flaky', storage);
    const record = async () => { throw err(503); };
    await flushPendingSaves({ record, storage, maxVisits: 2 });
    const last = await flushPendingSaves({ record, storage, maxVisits: 2 });
    expect(last.dropped).toEqual(['flaky']);
    expect(pendingSaves(storage)).toEqual({});
  });

  it('treats unreadable storage as nothing pending', async () => {
    const storage = { getItem: () => '{not json', setItem: () => {}, removeItem: () => {} };
    expect(pendingSaves(storage)).toEqual({});
    expect(await flushPendingSaves({ record: vi.fn(), storage })).toEqual({ saved: [], dropped: [], kept: [] });
  });
});
