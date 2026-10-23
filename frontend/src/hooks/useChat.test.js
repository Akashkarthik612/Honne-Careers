import { describe, expect, it, vi } from 'vitest';
import { pollChatTurn } from './useChat';

const running = { id: 'm1', status: 'running', steps: [] };

describe('pollChatTurn', () => {
  it('polls until the answer is ok, showing every update (live steps)', async () => {
    const replies = [running, { ...running, steps: [{ label: 'Read' }] }, { ...running, status: 'ok' }];
    const fetchMessage = vi.fn(async () => replies.shift());
    const onUpdate = vi.fn();
    const sleep = vi.fn(async () => {});
    const r = await pollChatTurn({ fetchMessage, onUpdate, isCancelled: () => false, sleep, intervalMs: 5 });
    expect(r.outcome).toBe('ok');
    expect(onUpdate).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('returns failed for a failed answer', async () => {
    const r = await pollChatTurn({ fetchMessage: async () => ({ ...running, status: 'failed' }), onUpdate: () => {}, isCancelled: () => false, sleep: async () => {} });
    expect(r.outcome).toBe('failed');
  });

  it('is bounded: gives up after maxPolls', async () => {
    const fetchMessage = vi.fn(async () => running);
    const r = await pollChatTurn({ fetchMessage, onUpdate: () => {}, isCancelled: () => false, sleep: async () => {}, maxPolls: 4 });
    expect([r.outcome, fetchMessage.mock.calls.length]).toEqual(['timeout', 4]);
  });

  it('stops when cancelled (Stop, or leaving the page)', async () => {
    let n = 0;
    const r = await pollChatTurn({ fetchMessage: async () => running, onUpdate: () => {}, isCancelled: () => (n += 1) > 2, sleep: async () => {} });
    expect(r.outcome).toBe('cancelled');
  });

  it('throws a failed request instead of retrying quietly', async () => {
    await expect(pollChatTurn({ fetchMessage: async () => { throw new Error('network'); }, onUpdate: () => {}, isCancelled: () => false, sleep: async () => {} }))
      .rejects.toThrow('network');
  });
});
