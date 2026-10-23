// GET /me/usage → what the Settings "Beta limits" panel shows. The numbers come from the server
// (backend/config/limits.yaml); only the wording lives here. No plan or price wording (beta).

// key → [label, unit]. Only these are shown; the other daily caps are safety limits users rarely meet.
export const SHOWN = [
  ['full_tailor', 'CV tailorings', 'today'],
  ['chat_start', 'New AI chats', 'today'],
  ['custom_agents', 'Custom agents', null],
];

export function toUsage(r) {
  const byKey = Object.fromEntries(r.items.map((i) => [i.key, i]));
  const rows = SHOWN.filter(([key]) => byKey[key]).map(([key, label, unit]) => {
    const { used, limit } = byKey[key];
    return { key, label, unit, used, limit, left: Math.max(limit - used, 0), full: used >= limit };
  });
  return { rows, resetsAt: new Date(r.resets_at) };
}

// "5:30 am": when the daily counts start again, in the user's own time zone.
export const resetTime = (date) => date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
