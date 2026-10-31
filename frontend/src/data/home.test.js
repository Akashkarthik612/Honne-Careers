import { describe, expect, it } from 'vitest';
import { emptyProfile } from './cvModel';
import { homeInsights, homeStats, profileProgress, recentCvs, teamOf } from './home';

const row = (status, sentAt = '2026-10-20') => ({ status, sentAt });
const today = new Date(2026, 9, 29);

describe('homeStats', () => {
  it('counts replies as interviews + offers, never rejections', () => {
    const rows = [row('applied'), row('interview'), row('offer'), row('rejected'), row('no_reply')];
    expect(homeStats(rows)).toEqual({ applications: 5, replies: 2, interviews: 1, offers: 1 });
  });
});

describe('homeInsights', () => {
  it('starts a new user at tailoring', () => {
    expect(homeInsights([], today).map((i) => i.key)).toEqual(['start']);
  });

  it('counts only applied / no-reply rows older than two weeks for follow-ups', () => {
    const rows = [row('applied', '2026-10-01'), row('no_reply', '2026-10-10'), row('applied', '2026-10-20'), row('rejected', '2026-09-01')];
    const [i] = homeInsights(rows, today);
    expect(i).toMatchObject({ key: 'follow-up', agent: 'outreach' });
    expect(i.text).toMatch(/^2 applications have had no reply/);
  });

  it('shows at most two, interviews first', () => {
    const rows = [row('interview'), row('offer'), ...Array.from({ length: 5 }, () => row('applied', '2026-09-01'))];
    const out = homeInsights(rows, today);
    expect(out.map((i) => i.key)).toEqual(['interviews', 'follow-up']);
    expect(out[0].text).toBe('You’re in 1 interview process and have 1 offer to decide on. Review your upcoming opportunities.');
  });

  it('suggests a job-fit review after five applications with no interview', () => {
    const rows = Array.from({ length: 5 }, () => row('rejected'));
    expect(homeInsights(rows, today).map((i) => i.key)).toEqual(['fit']);
  });
});

describe('profileProgress', () => {
  it('asks for a profile when none is saved', () => {
    expect(profileProgress(null)).toEqual({ pct: 0, cta: 'Create your profile' });
  });

  it('points at the first incomplete section', () => {
    expect(profileProgress(emptyProfile())).toEqual({ pct: 0, cta: 'Add your details' });
  });
});

describe('teamOf / recentCvs', () => {
  it('keeps the team order and drops agents the API does not list', () => {
    expect(teamOf([{ handle: 'fit' }, { handle: 'analyst' }, { handle: 'advisor' }]).map((t) => t.handle)).toEqual(['analyst', 'fit']);
  });

  it('takes the most recently updated CVs', () => {
    const cvs = [{ id: 'a', updatedAt: '2026-10-01T00:00:00Z' }, { id: 'b', updatedAt: '2026-10-20T00:00:00Z' }, { id: 'c', updatedAt: '2026-10-10T00:00:00Z' }];
    expect(recentCvs(cvs, 2).map((c) => c.id)).toEqual(['b', 'c']);
  });
});
