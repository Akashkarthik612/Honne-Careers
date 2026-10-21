import { describe, expect, it } from 'vitest';
import { response } from '@/test/contracts';
import {
  badgeColors, filterApplications, groupByStatus, manualToRequest, patchRequest, referralLabel, statusCounts, STATUSES, summaryOf,
  toApplicationDetail, toApplicationList,
} from './applications';

describe('server responses → UI (contracts/responses)', () => {
  const list = toApplicationList(response('applications.json'));

  it('maps the list with retention days, deletes-on and no text', () => {
    expect(list.retentionDays).toBe(20);
    expect(list.rows[0]).toMatchObject({ company: 'Freshworks', status: 'interview', referral: 'asked', sentAt: '2026-10-19', deletesOn: '2026-11-08', hasPdf: true, rowVersion: 4 });
    expect(list.rows[1]).toMatchObject({ source: 'manual', hasJd: false, hasPdf: false, referral: null });
    expect(Object.keys(list.rows[0])).not.toContain('jdText');
  });

  it('maps an opened row: JD, the CV sent ready for CvDoc, notes and history', () => {
    const d = toApplicationDetail(response('application.json'));
    expect(d.jdText).toMatch(/^SDE-2, Backend/);
    expect(d.cv.name).toBe('Arjun Mehta');
    expect(d.notes).toBe('Referral from Priya');
    expect(d.events.map((e) => [e.from, e.to])).toEqual([[null, 'applied'], ['applied', 'interview']]);
    expect(summaryOf(d)).toEqual(list.rows[0]);
  });

  it('labels referral, with — for not set', () => {
    expect([referralLabel('yes'), referralLabel('asked'), referralLabel(null)]).toEqual(['Yes', 'Asked', '—']);
  });
});

const row = (id, company, role, lastSentAt, status) => ({ id, company, role, lastSentAt, status });
const rows = [
  row('a', 'Zoho', 'Member Technical Staff', '2026-10-06T10:00:00Z', 'offer'),
  row('b', 'Razorpay', 'Backend Engineer', '2026-10-15T10:00:00Z', 'interview'),
  row('c', 'Freshworks', 'SDE-2, Backend', '2026-10-17T10:00:00Z', 'applied'),
];

describe('Database helpers', () => {
  it('filters by status and by company or role, newest first', () => {
    expect(filterApplications(rows, '', 'all').map((r) => r.id)).toEqual(['c', 'b', 'a']);
    expect(filterApplications(rows, 'backend', 'all').map((r) => r.id)).toEqual(['c', 'b']);
    expect(filterApplications(rows, ' ZOHO ', 'all').map((r) => r.id)).toEqual(['a']);
    expect(filterApplications(rows, '', 'interview').map((r) => r.id)).toEqual(['b']);
  });

  it('has outcome-only statuses ("Referral asked" lives in Referral)', () => {
    expect(STATUSES.map(([k]) => k)).toEqual(['applied', 'interview', 'offer', 'rejected', 'no_reply']);
    expect(statusCounts(rows)).toEqual({ all: 3, applied: 1, interview: 1, offer: 1, rejected: 0, no_reply: 0 });
    expect(groupByStatus(rows).find((c) => c.status === 'offer').rows.map((r) => r.id)).toEqual(['a']);
  });

  it('builds requests with only what the user gave', () => {
    expect(manualToRequest({ company: ' Dust ', role: 'SWE', sentAt: '', status: 'applied', referral: '', notes: ' ', jdText: '' }))
      .toEqual({ company: 'Dust', role: 'SWE', status: 'applied' });
    expect(patchRequest({ rowVersion: 4 }, { status: 'offer' })).toEqual({ expected_version: 4, status: 'offer' });
  });

  it('gives a company the same badge colour every time', () => {
    expect(badgeColors('Zoho')).toBe(badgeColors('Zoho'));
  });
});
