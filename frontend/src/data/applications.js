// The application Database screen (design: Database.dc.html; Day 2, SAVE-1, IQ-1/2/3).
// Server shapes (contracts/responses/applications.json, application.json) → UI rows, plus pure helpers.
// UI row: { id, source, company, role, sentAt (YYYY-MM-DD), status, referral, hasJd, hasPdf, hasNotes,
//           deletesOn (YYYY-MM-DD), rowVersion }; an opened row adds { jdText, cv, notes, events, resumeId }.
import { contentToDoc } from './cvAdapter';
import { docToCv } from './cvModel';

// Outcome only ("Referral asked" moved to the Referral column, Day 2 §2). Order = board columns.
export const STATUSES = [
  ['applied', 'Applied'],
  ['interview', 'Interview'],
  ['offer', 'Offer'],
  ['rejected', 'Rejected'],
  ['no_reply', 'No reply'],
];
export const statusLabel = (s) => STATUSES.find(([k]) => k === s)?.[1] ?? s;

// null = "—" (not set).
export const REFERRALS = [['yes', 'Yes'], ['asked', 'Asked'], ['no', 'No']];
export const referralLabel = (r) => REFERRALS.find(([k]) => k === r)?.[1] ?? '—';

export const STATUS_STYLE = {
  applied: { background: 'var(--hc-brand-tint)', color: 'var(--hc-brand-hover)' },
  interview: { background: '#E8F5EC', color: 'var(--hc-success)' },
  offer: { background: 'var(--hc-success)', color: '#FFFFFF' },
  rejected: { background: '#FFF4EE', color: 'var(--hc-warm)' },
  no_reply: { background: '#F3F4F8', color: 'var(--hc-ink-muted)' },
};

export function referralStyle(referral) {
  if (referral === 'yes') return { color: 'var(--hc-success)', fontWeight: 700 };
  if (referral === 'asked') return { color: '#B45309', fontWeight: 700 };
  return { color: 'var(--hc-ink-muted)' };
}

const BADGES = [
  { background: 'var(--hc-brand-tint)', color: 'var(--hc-brand-hover)' },
  { background: '#E8F5EC', color: 'var(--hc-success)' },
  { background: '#FFF4EE', color: '#9A3412' },
  { background: '#F3F4F8', color: 'var(--hc-ink)' },
];

// Stable colour per company, so a badge doesn't change when the list is filtered.
export function badgeColors(company) {
  let h = 0;
  for (const ch of company) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BADGES[h % BADGES.length];
}

// Dates from the API are calendar days (YYYY-MM-DD); read them as local days, not UTC midnight.
const day = (ymd) => { const [y, m, d] = ymd.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const shortDate = (ymd) => day(ymd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const longDate = (ymd) => day(ymd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
export const todayYmd = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

export function toApplication(a) {
  return {
    id: a.id, source: a.source, company: a.company ?? '', role: a.role ?? '', sentAt: a.applied_on,
    status: a.status, referral: a.referral, hasJd: a.has_jd, hasPdf: a.has_pdf, hasNotes: a.has_notes,
    deletesOn: a.deletes_on, lastSentAt: a.last_sent_at, rowVersion: a.row_version,
  };
}

export function toApplicationDetail(a) {
  return {
    ...toApplication(a),
    jdText: a.jd_text ?? '',
    cv: a.cv_content ? docToCv(contentToDoc(a.cv_content)) : null,
    notes: a.notes ?? '',
    events: a.events.map((e) => ({ from: e.from, to: e.to, at: e.at })),
    resumeId: a.resume_id,
  };
}

// An opened row back to its list row (after a PATCH or an add), so the table and the panel agree.
// eslint-disable-next-line no-unused-vars
export const summaryOf = ({ jdText, cv, notes, events, resumeId, ...row }) => row;

export const toApplicationList = (r) => ({ retentionDays: r.retention_days, rows: r.items.map(toApplication) });

// "Add by hand" form → POST /applications. Empty optional fields are left out (server defaults).
export function manualToRequest({ company, role, sentAt, status, referral, notes, jdText }) {
  const body = { company: company.trim(), role: role.trim(), status };
  if (sentAt) body.applied_on = sentAt;
  if (referral) body.referral = referral;
  if (notes.trim()) body.notes = notes.trim();
  if (jdText.trim()) body.jd_text = jdText.trim();
  return body;
}

// Side panel edits → PATCH /applications/{id}: only the changed fields, with the row's version.
export const patchRequest = (row, change) => ({ expected_version: row.rowVersion, ...change });

// Client-side filters on the loaded window (≤ the server's list cap), so chips and counts are instant.
// Newest first; search matches company or role, case-insensitive.
export function filterApplications(rows, query, status) {
  const q = query.trim().toLowerCase();
  return rows
    .filter((r) => (status === 'all' || r.status === status) && (!q || `${r.company} ${r.role}`.toLowerCase().includes(q)))
    .sort((a, b) => b.lastSentAt.localeCompare(a.lastSentAt));
}

export function statusCounts(rows) {
  const counts = { all: rows.length };
  for (const [s] of STATUSES) counts[s] = rows.filter((r) => r.status === s).length;
  return counts;
}

// Board view: one column per status, in STATUSES order.
export const groupByStatus = (rows) => STATUSES.map(([status, label]) => ({ status, label, rows: rows.filter((r) => r.status === status) }));
