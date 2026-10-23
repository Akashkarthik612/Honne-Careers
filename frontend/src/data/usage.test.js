import { describe, expect, it } from 'vitest';
import { response } from '@/test/contracts';
import { toUsage } from './usage';

describe('toUsage: the Beta limits panel (contracts/responses/usage.json)', () => {
  const usage = toUsage(response('usage.json'));

  it('shows CV tailorings, new chats and agents, with the limits from the server', () => {
    expect(usage.rows.map((r) => [r.key, r.used, r.limit, r.unit])).toEqual([
      ['full_tailor', 1, 3, 'today'], ['chat_start', 2, 5, 'today'], ['custom_agents', 1, 2, null],
    ]);
    expect(usage.resetsAt.toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });

  it('marks a limit that is used up', () => {
    const full = toUsage({ ...response('usage.json'), items: [{ key: 'custom_agents', used: 2, limit: 2, daily: false }] });
    expect(full.rows).toEqual([{ key: 'custom_agents', label: 'Custom agents', unit: null, used: 2, limit: 2, left: 0, full: true }]);
  });

  it('never mentions plans or prices', () => {
    expect(JSON.stringify(usage)).not.toMatch(/plan|price|₹|pro\b|plus\b/i);
  });
});
