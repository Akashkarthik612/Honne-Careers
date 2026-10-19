import { describe, expect, it, vi } from 'vitest';
import { pollTailorJob } from './useTailorJob';

vi.mock('@/services/supabaseClient', () => ({ supabase: { auth: {} } }));

const job = (...states) => {
  const queue = states.map((state, i) => ({ state, jobStep: ['reading', 'rewriting', 'checking'][i] ?? null }));
  return vi.fn(async () => queue.shift() ?? { state: 'tailoring' });
};
const run = (fetchResume, extra = {}) => {
  const updates = [];
  const sleep = vi.fn(async () => {});
  const result = pollTailorJob({ fetchResume, onUpdate: (r) => updates.push(r.jobStep), isCancelled: () => false, intervalMs: 5, maxPolls: 4, sleep, ...extra });
  return { result, updates, sleep };
};

describe('pollTailorJob (TAIL-3)', () => {
  it('reports each step and stops when the job is ready', async () => {
    const { result, updates, sleep } = run(job('tailoring', 'tailoring', 'ready'));
    await expect(result).resolves.toMatchObject({ outcome: 'ready' });
    expect(updates).toEqual(['reading', 'rewriting', 'checking']);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('stops on failure', async () => {
    const { result } = run(job('tailoring', 'failed'));
    await expect(result).resolves.toMatchObject({ outcome: 'failed', resume: { state: 'failed' } });
  });

  it('gives up after maxPolls (bounded, configured)', async () => {
    const fetchResume = job();
    const { result } = run(fetchResume);
    await expect(result).resolves.toMatchObject({ outcome: 'timeout' });
    expect(fetchResume).toHaveBeenCalledTimes(4);
  });

  it('a failed request throws: no silent retry', async () => {
    const fetchResume = vi.fn().mockResolvedValueOnce({ state: 'tailoring' }).mockRejectedValueOnce(new Error('503'));
    const { result } = run(fetchResume);
    await expect(result).rejects.toThrow('503');
    expect(fetchResume).toHaveBeenCalledTimes(2);
  });

  it('stops quietly when the screen unmounts', async () => {
    let cancelled = false;
    const fetchResume = vi.fn(async () => { cancelled = true; return { state: 'tailoring' }; });
    const { result } = run(fetchResume, { isCancelled: () => cancelled });
    await expect(result).resolves.toMatchObject({ outcome: 'cancelled' });
    expect(fetchResume).toHaveBeenCalledTimes(1);
  });
});
