// Home dashboard (design: Home.dc.html): pure helpers over the user's own data. Nothing here is seeded;
// every number and insight is computed from GET /applications, GET /resumes and GET /profile.
import { profileSections } from './cvModel';

const DAY_MS = 86400000;
// "No reply for over two weeks": the follow-up insight's threshold.
export const FOLLOW_UP_DAYS = 14;
export const HOME_APPLICATIONS = 5;
export const HOME_CVS = 3;
export const HOME_INSIGHTS_MAX = 2;

// Dot + text colours per outcome status (the Database page uses filled chips instead).
export const STATUS_DOT = {
  applied: ['var(--hc-ink-faint)', '#3D4357'],
  interview: ['var(--hc-brand)', 'var(--hc-brand-hover)'],
  offer: ['var(--hc-success)', 'var(--hc-success)'],
  rejected: ['var(--hc-warm)', '#9A3412'],
  no_reply: ['#C9CCD8', 'var(--hc-ink-muted)'],
};

// The three built-in agents the "AI career team" card offers, in this order; only those the API lists show.
export const TEAM = [
  { handle: 'analyst', title: 'Analyze my applications', desc: 'Review your application history and identify patterns.' },
  { handle: 'outreach', title: 'Draft recruiter outreach', desc: 'Write personalized messages based on your background and target role.' },
  { handle: 'fit', title: 'Review job fit', desc: 'Understand how your experience aligns with a job.' },
];

export const teamOf = (builtin) => TEAM.filter((t) => builtin.some((a) => a.handle === t.handle));

// Replies = a person answered (interview or offer); a rejection is not counted.
export function homeStats(rows) {
  const n = (statuses) => rows.filter((r) => statuses.includes(r.status)).length;
  return { applications: rows.length, replies: n(['interview', 'offer']), interviews: n(['interview']), offers: n(['offer']) };
}

const daysSince = (ymd, today) => {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return Math.floor((today - new Date(y, m - 1, d)) / DAY_MS);
};

// Simple rules on the user's own applications, at most two. Each: { key, text, cta, to, agent? }.
export function homeInsights(rows, today = new Date()) {
  const s = homeStats(rows);
  const stale = rows.filter((r) => ['applied', 'no_reply'].includes(r.status) && daysSince(r.sentAt, today) > FOLLOW_UP_DAYS).length;
  const out = [];
  if (s.applications === 0) out.push({ key: 'start', text: 'Start by tailoring your first CV and tracking your applications.', cta: 'Tailor my first CV', to: '#tailor' });
  if (s.interviews > 0) {
    const offers = s.offers ? ` and have ${s.offers} offer${s.offers === 1 ? '' : 's'} to decide on` : '';
    out.push({ key: 'interviews', text: `You’re in ${s.interviews} interview process${s.interviews === 1 ? '' : 'es'}${offers}. Review your upcoming opportunities.`, cta: 'Review interviews', to: '/database' });
  }
  if (stale > 0) {
    const has = stale === 1 ? '1 application has' : `${stale} applications have`;
    out.push({ key: 'follow-up', text: `${has} had no reply for over two weeks. Some may be ready for a follow-up.`, cta: 'Draft follow-ups', to: '/chat', agent: 'outreach' });
  }
  if (s.applications >= 5 && s.interviews === 0) out.push({ key: 'fit', text: 'You’ve tracked several applications without recording an interview yet. Review your CV alignment and target roles.', cta: 'Review job fit', to: '/chat', agent: 'fit' });
  return out.slice(0, HOME_INSIGHTS_MAX);
}

// The profile bar: % of the five sections complete and the next one to fill. profile null = none saved yet.
export function profileProgress(profile) {
  if (!profile) return { pct: 0, cta: 'Create your profile' };
  const sections = profileSections(profile);
  const done = sections.filter((s) => s.complete).length;
  const next = sections.find((s) => !s.complete);
  if (!next) return { pct: 100, cta: 'View your profile' };
  return { pct: done * 20, cta: next.key === 'personal' ? 'Add your details' : `Add your ${next.label.toLowerCase()}` };
}

export const recentCvs = (resumes, n = HOME_CVS) => [...resumes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, n);
