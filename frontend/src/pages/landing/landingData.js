// Content and pure helpers for the landing page (design canvas "Honne Careers Landing Page",
// Landing.dc.html, "Landing v4 · Stripe direction"). Every company, person and number here is
// illustrative sample data shown under a SAMPLE DATA tag; none of it is a user's data.

export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Small status pill used across the mockups.
export const statusPill = (bg, fg) => ({
  fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap', background: bg, color: fg,
});

/* ---------- hero demo: paste & tailor → saved together → your week ---------- */

// One entry per frame of the looping demo. sc = scene, d = ms on screen, cur = cursor spot.
export const HERO_STEPS = [
  { sc: 'A', d: 900, cur: 'aIdle', jd: 0 },
  { sc: 'A', d: 700, cur: 'aJd', jd: 0 },
  { sc: 'A', d: 650, cur: 'aJd', jd: 0, key: 1, click: 1 },
  { sc: 'A', d: 800, cur: 'aJd', jd: 1, key: 1 },
  { sc: 'A', d: 900, cur: 'aMid', jd: 2, prog: 30, status: 'Reading the JD…' },
  { sc: 'A', d: 750, cur: 'aMid', jd: 2, b: 1, prog: 55, status: 'Rewording your real experience…' },
  { sc: 'A', d: 750, cur: 'aMid', jd: 2, b: 2, prog: 80, status: 'Rewording your real experience…' },
  { sc: 'A', d: 900, cur: 'aBtn', jd: 2, b: 3, prog: 100, status: 'done' },
  { sc: 'A', d: 1200, cur: 'aBtn', jd: 2, b: 3, prog: 100, status: 'done', pressed: 1, toast: 1, click: 1 },
  { sc: 'B', d: 700, cur: 'bIdle', newRow: 0 },
  { sc: 'B', d: 1000, cur: 'bIdle', newRow: 1 },
  { sc: 'B', d: 800, cur: 'bCv', newRow: 1 },
  { sc: 'B', d: 2100, cur: 'bCv', newRow: 1, cvPop: 1, click: 1 },
  { sc: 'B', d: 800, cur: 'bJd', newRow: 1 },
  { sc: 'B', d: 2100, cur: 'bJd', newRow: 1, jdPop: 1, click: 1 },
  { sc: 'B', d: 1800, cur: 'bIdle', newRow: 1, cap: 1 },
  { sc: 'C', d: 4400 },
];

// [number, label, scene, first step, last step]; reduced motion jumps to the last step.
export const HERO_TABS = [
  ['01', 'Paste the JD, get a tailored CV', 'A', 0, 8],
  ['02', 'Saved together in one row', 'B', 9, 12],
  ['03', 'Your week', 'C', 16, 16],
];

export const HERO_URL = { A: 'honne.careers/new-cv', B: 'honne.careers/database', C: 'honne.careers/home' };

export const HERO_CURSOR = {
  aIdle: ['62%', 330], aJd: ['24%', 150], aMid: ['52%', 300], aBtn: ['calc(100% - 88px)', 362],
  bIdle: ['44%', 340], bCv: ['calc(16px + (100% - 32px) * 0.64 + 34px)', 127], bJd: ['calc(16px + (100% - 32px) * 0.50 + 24px)', 127],
};

export const nextHeroStep = (hs) => (hs + 1) % HERO_STEPS.length;

export const HERO_BULLETS = [
  ['Moved the ledger service to Kafka Streams; p95 latency went down about 38%.', 'Cut payment-event latency 38% (p95) with event-driven Kafka Streams in Java.'],
  ['Owned the settlement pipeline. 2M events/day, no data loss.', 'Owned a 2M events/day settlement pipeline end to end, with no data loss.'],
  ['Mentored 2 interns to their first launch.', 'Mentored 2 interns through their first production launch.'],
];

const DB_ROWS = [
  ['21 Oct', 'Razorpay', 'Platform Eng.', 'CV v3', 'Interview', ['#EAF0FD', '#2F5FD0']],
  ['19 Oct', 'Zoho', 'Backend Eng.', 'CV v2', 'Replied', ['#E6F4EE', '#0F7A5C']],
  ['15 Oct', 'Groww', 'SDE-2', 'CV v3', 'No reply', ['#FFF2E8', '#B4500F']],
  ['12 Oct', 'Swiggy', 'Data Eng.', 'CV v1', 'Applied', ['#F3F1EE', '#4A4A4A']],
];
const NEW_ROW = ['25 Oct', 'Freshworks', 'SDE-2 Backend', 'CV v4', 'Applied today', ['#F0EDFF', '#5847D6'], true];

// The Database rows in scene B; the Freshworks row slides in on top once it's saved.
export const heroDbRows = (withNew) => (withNew ? [NEW_ROW, ...DB_ROWS.slice(0, 3)] : DB_ROWS);

export const DASH_APPS = [
  { co: 'Freshworks', role: 'SDE-2 Backend', status: 'Tailoring', style: statusPill('#F0EDFF', '#5847D6') },
  { co: 'Zoho', role: 'Backend Engineer', status: 'Interview', style: statusPill('#EAF0FD', '#2F5FD0') },
  { co: 'Razorpay', role: 'Platform Eng.', status: 'Replied', style: statusPill('#E6F4EE', '#0F7A5C') },
  { co: 'Groww', role: 'SDE-2', status: 'No reply · 13d', style: statusPill('#FFF2E8', '#B4500F') },
  { co: 'Swiggy', role: 'Data Engineer', status: 'Applied', style: statusPill('#F3F1EE', '#4A4A4A') },
];

export const ATS_NAMES = ['Workday', 'Greenhouse', 'Lever'];

/* ---------- 02 problem ---------- */

export const PAINS = [
  { n: '01', tag: 'TAILORING', t: 'You rewrite your CV for every job.', d: 'Hours of copy-paste, guessing what each company wants. Then you do it all again for the next one.' },
  { n: '02', tag: 'MATCHING', t: 'You don’t know if you even fit the job.', d: 'So you apply anyway and hope someone reads it.' },
  { n: '03', tag: 'CHOOSING', t: 'You apply everywhere, because you don’t know where to focus.', d: 'No referrals, no plan. Most of those jobs were never a real match for you.' },
  { n: '04', tag: 'TRACKING', t: 'You forget which CV you sent where.', d: 'Your Google Sheet or ChatGPT chat has the company and the date. Not the job description. Not the exact CV you sent. So when a recruiter finally calls, you don’t know what they read.', hot: true },
  { n: '05', tag: 'LEARNING', t: 'Nobody tells you why you got no reply.', d: 'So next week you make the same mistakes again, starting from zero.' },
];

export const FIX_COLS = ['Analyze', 'Prioritize', 'Apply', 'Track', 'Improve'];
export const OLD_LOOP = ['Apply', 'Wait', 'No response', 'Repeat'];

// a/as = the chaos card, b/bs = what it becomes; c = [left %, top %, rotation] when scattered,
// o = [column, row] when sorted.
export const FIX_CARDS = [
  { a: 'Applied · Swiggy', as: '21 days, no reply', b: 'Freshworks JD read', bs: '6 of 8 requirements match', c: [3, 6, -6], o: [0, 0] },
  { a: 'CV_final_v7.docx', as: 'edited 14 times', b: 'Gap found', bs: 'Kubernetes isn’t in your profile', c: [23, 40, 4], o: [0, 1] },
  { a: 'Easy Apply × 40', as: 'this week', b: 'Sure shot', bs: 'Zoho · you know someone there', c: [43, 2, -3], o: [1, 0] },
  { a: 'Which CV did I send?', as: 'Flipkart, 3 weeks ago', b: 'Skip this one', bs: 'Uber · asks for 8+ years', c: [62, 30, 7], o: [1, 1] },
  { a: 'Rejected', as: 'automated email, no reason', b: 'Tailored CV sent', bs: 'saved with its JD', c: [80, 4, -8], o: [2, 0] },
  { a: 'Applied · Ola', as: 'no reply', b: 'Groww · follow up today', bs: '13 days, no reply', c: [9, 66, 5], o: [3, 0] },
  { a: 'Follow up?', as: 'maybe… not sure when', b: 'Razorpay · interview Thu', bs: 'prep notes ready', c: [33, 74, -5], o: [3, 1] },
  { a: 'CV_FINAL_final.pdf', as: 'which one is final?', b: 'Referrals got replies', bs: '4 of 5 · cold: 2 of 19', c: [55, 66, 3], o: [4, 0] },
  { a: 'Applied · InMobi', as: 'no reply', b: 'Next week', bs: '3 referral asks first', c: [78, 60, -4], o: [4, 1] },
];

export const fixColX = (col) => col * 20.35;

// Where card i sits at progress p (0 = scattered, 1 = sorted). left/top are % of the stage;
// t is the card's own eased progress (cards start 2.5% apart so they don't move as a block).
export function cardFrame(card, i, p) {
  const t = easeInOut(clamp01((p - i * 0.025) / 0.8));
  const left = card.c[0] + (fixColX(card.o[0]) - card.c[0]) * t;
  const top = card.c[1] + ((card.o[1] === 0 ? 15 : 52) - card.c[1]) * t;
  return { t, left, top, rot: card.c[2] * (1 - t) };
}

/* ---------- 03 agents ---------- */

export const AGENTS = [
  { id: 'writer', name: 'CV Writer', handle: '@cv-writer', c: '#6655E8', bg: '#F0EDFF', ink: '#5847D6', status: 'Available in beta', role: 'Tailors your CV to one job, using only what’s already in your profile.', d1: 'M12 20h9', d2: 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z' },
  { id: 'analyst', name: 'Analyst', handle: '@analyst', c: '#2F5FD0', bg: '#EAF0FD', ink: '#2F5FD0', status: 'In beta', role: 'Compares a JD with your profile: where you’re strong, where the gaps are.', d1: 'M3 3v18h18', d2: 'M7 15l4-4 3 3 5-6' },
  { id: 'advisor', name: 'Advisor', handle: '@advisor', c: '#0F7A5C', bg: '#E6F4EE', ink: '#0F7A5C', status: 'In beta', role: 'Turns what the others found into a short list of what to do next.', d1: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', d2: 'm15.5 8.5-2 5-5 2 2-5z' },
  { id: 'strategist', name: 'Strategist', handle: '@strategist', c: '#B4500F', bg: '#FFF2E8', ink: '#B4500F', status: 'In beta', role: 'Reviews your week and changes the plan based on what got replies.', d1: 'M21 12a9 9 0 1 1-3-6.7L21 8', d2: 'M21 3v5h-5' },
  { id: 'custom', name: 'Your agent', handle: '@your-agent', c: '#171717', bg: '#F3F2EF', ink: '#171717', status: 'Available in beta', role: 'Anything we don’t cover yet. Describe it once, call it with @.', d1: 'M12 5v14', d2: 'M5 12h14' },
];

// Node centres in the "How they connect" diagram (viewBox 520×420, hub at 260,205).
export const AGENT_POS = [[260, 52], [404, 154], [349, 330], [171, 330], [116, 154]];

const MATCH_PILL = { Strong: statusPill('#E6F4EE', '#0F7A5C'), Partial: statusPill('#FFF2E8', '#B4500F'), Gap: statusPill('#F3F1EE', '#4A4A4A') };
export const ANALYST_ROWS = [
  ['Event-driven services', 'Kafka Streams ledger service', 'Strong'],
  ['Reliability at scale', '2M events/day, no data loss', 'Strong'],
  ['Mentoring', '2 interns to production', 'Strong'],
  ['Distributed systems', 'Pipelines, but no design write-up', 'Partial'],
  ['Kubernetes', 'Not in your profile', 'Gap'],
].map(([req, ev, s]) => ({ req, ev, s, style: MATCH_PILL[s] }));

export const ADVISOR_RECS = [
  { n: '1', t: 'Apply to Freshworks this week', why: 'Strong fit on 6 of 8 requirements. Your tailored CV is ready.', tag: 'This week', style: statusPill('#E6F4EE', '#0F7A5C') },
  { n: '2', t: 'Ask for a referral at Zoho first', why: 'Your notes mention a former teammate there. Referrals got most of your replies.', tag: 'Before applying', style: statusPill('#F0EDFF', '#5847D6') },
  { n: '3', t: 'Skip the Staff Engineer role at Uber', why: 'It asks for 8+ years. You have 5. Your time is better spent elsewhere.', tag: 'Skip', style: statusPill('#F3F1EE', '#4A4A4A') },
];

export const STRATEGIST_BARS = [
  { t: 'With a referral · replied', v: '4 of 5', width: '80%', color: '#0F7A5C' },
  { t: 'Cold applications · replied', v: '2 of 19', width: '10.5%', color: '#B4500F' },
];

/* ---------- 04 tailoring ---------- */

export const ORIG_BULLETS = [
  'Moved the ledger service to Kafka Streams in Java on AWS; p95 latency went down about 38%.',
  'Owned the settlement pipeline — 2M events/day, no data loss. Added idempotent consumers and replay tooling.',
  'Built Grafana dashboards for on-call to spot settlement delays.',
  'Mentored 2 interns to their first production launch.',
];
export const ORIG_SKILLS = 'Java, Python, SQL, Spring Boot, Kafka Streams, AWS, PostgreSQL, Grafana, Git';

// segs: [text, m(atched) | p(artial) | g(ap)]; reqs: [requirement, kind, evidence];
// bullets: [tailored text, which JD words it matches].
export const SAMPLE_JDS = {
  fw: {
    tab: 'Freshworks · SDE-2', title: 'SDE-2, Backend · Freshworks · Chennai',
    segs: [['You’ll '], ['design and own event-driven services', 'm'], [' in '], ['Java and Kafka', 'm'], [' on AWS, '], ['improve reliability and latency', 'm'], [' for systems handling '], ['millions of events a day', 'm'], [', and '], ['mentor junior engineers', 'm'], ['. We’re looking for '], ['3+ years of backend experience', 'm'], [' and strong '], ['distributed systems', 'p'], [' skills. '], ['Kubernetes', 'g'], [' is a plus.']],
    reqs: [['Event-driven services', 'm', 'your Kafka Streams ledger service'], ['Java and Kafka', 'm', 'both in your work and skills'], ['Reliability and latency', 'm', '38% p95 cut, no data loss'], ['Millions of events a day', 'm', '2M events/day pipeline'], ['Mentoring', 'm', '2 interns to production'], ['3+ years backend', 'm', '5 years at Northwind'], ['Distributed systems', 'p', 'shown through pipelines, no design write-up'], ['Kubernetes', 'g', 'not in your profile']],
    bullets: [['Cut payment-event latency by 38% (p95) by moving the ledger service to event-driven Kafka Streams in Java on AWS.', 'event-driven services · latency'], ['Owned the settlement pipeline end to end at 2M events/day with no data loss, adding idempotent consumers and replay tooling.', 'reliability · millions of events'], ['Mentored 2 interns through their first production launch.', 'mentoring'], [ORIG_BULLETS[2], '']],
    skills: 'Java, Kafka Streams, Spring Boot, AWS, SQL, PostgreSQL, Python, Grafana, Git',
  },
  rz: {
    tab: 'Razorpay · Platform', title: 'Platform Engineer, Payments · Razorpay · Bengaluru',
    segs: [['Build '], ['highly available payment systems', 'm'], ['. You’ll own '], ['settlement and reconciliation', 'm'], [' services written in '], ['Java or Go', 'p'], [', set up '], ['observability and on-call', 'm'], [', and run workloads on '], ['Kubernetes', 'g'], ['. '], ['Payments or fintech experience', 'm'], [' helps.']],
    reqs: [['Highly available payments', 'm', '2M events/day with no data loss'], ['Settlement', 'm', 'you owned the settlement pipeline'], ['Observability and on-call', 'm', 'your Grafana dashboards'], ['Fintech experience', 'm', 'Northwind Fintech'], ['Java or Go', 'p', 'Java yes, Go isn’t in your profile'], ['Kubernetes', 'g', 'not in your profile']],
    bullets: [['Owned the payments settlement pipeline end to end: 2M events/day with no data loss, through idempotent consumers and replay tooling.', 'settlement · high availability'], ['Cut payment-event latency by 38% (p95) by moving the ledger service to Kafka Streams in Java on AWS.', 'payment systems'], ['Built Grafana dashboards the on-call team used to spot settlement delays.', 'observability · on-call'], [ORIG_BULLETS[3], '']],
    skills: 'Java, Kafka Streams, AWS, PostgreSQL, Grafana, Spring Boot, SQL, Python, Git',
  },
  sw: {
    tab: 'Swiggy · Data Eng.', title: 'Data Engineer · Swiggy · Bengaluru',
    segs: [['Build '], ['streaming data pipelines', 'm'], [' that power delivery analytics. Strong '], ['SQL', 'm'], [' and '], ['Python', 'p'], [' needed. You’ll care about '], ['data quality and correctness', 'm'], ['. Experience with '], ['Spark', 'g'], [' and '], ['Airflow', 'g'], [' is expected.']],
    reqs: [['Streaming pipelines', 'm', 'your Kafka Streams settlement pipeline'], ['SQL', 'm', 'in your skills, with PostgreSQL'], ['Data quality', 'm', 'no data loss, replay tooling'], ['Python', 'p', 'listed in skills, no project shows it yet'], ['Spark', 'g', 'not in your profile'], ['Airflow', 'g', 'not in your profile']],
    bullets: [['Owned a streaming settlement pipeline processing 2M events/day with no data loss, adding idempotent consumers and replay tooling.', 'streaming pipelines · data quality'], ['Moved the ledger service to Kafka Streams on AWS, cutting p95 event latency by 38%.', 'streaming'], [ORIG_BULLETS[2], ''], [ORIG_BULLETS[3], '']],
    skills: 'SQL, Python, Kafka Streams, PostgreSQL, Java, AWS, Grafana, Spring Boot, Git',
  },
};

export const countReqs = (jd, kind) => jd.reqs.filter((r) => r[1] === kind).length;

// The note under the tailored CV for requirements that aren't in the profile (TRUTH: never added).
export function gapNote(jd) {
  const gaps = jd.reqs.filter((r) => r[1] === 'g').map((r) => r[0]);
  if (gaps.length === 0) return null;
  const many = gaps.length > 1;
  return {
    names: gaps.join(' and '),
    rest: `${many ? 'aren’t' : 'isn’t'} in your profile, so ${many ? 'they’re' : 'it’s'} not on this CV. Learn ${many ? 'them' : 'it'} first, then add ${many ? 'them' : 'it'} yourself.`,
  };
}

/* ---------- 06 learning loop ---------- */

export const LOOP_STEPS = [
  { t: 'Applications', d: 'Every application is saved with the JD and the exact CV you sent.', panel: 'kpi' },
  { t: 'Outcomes', d: 'Replies, interviews and silence are logged by you now, and from Gmail once it’s connected.', panel: 'funnel' },
  { t: 'Analysis', d: 'The Strategist looks for patterns in your own data, like which applications got replies.', panel: 'src' },
  { t: 'Recommendations', d: 'You get a short list for next week, not a lecture.', panel: 'recs' },
  { t: 'Next strategy', d: 'Next week starts from what worked, not from scratch.', panel: 'recs' },
];

export const LOOP_R = 140;

// Step i sits on the ring, clockwise from 12 o'clock (viewBox 400×400, centre 200,200).
export function loopNodePos(i) {
  const ang = ((-90 + i * 72) * Math.PI) / 180;
  return { x: 200 + LOOP_R * Math.cos(ang), y: 200 + LOOP_R * Math.sin(ang) };
}

export const MONTHS = {
  oct: { kpi: [['Applications', '24'], ['Replies', '6'], ['Interviews', '3'], ['Follow-ups sent', '5']], funnel: [['Applied', 24], ['Replied', 6], ['Interview', 3], ['Offer', 1]], src: [['With a referral', 5, 4], ['Cold', 19, 2]], recs: ['Ask for referrals before applying: they got 4 of your 5 replies', 'Follow up with Groww and Flipkart (13+ days, no reply)', 'Apply to 5 roles asking for 2–4 years'], note: 'Fewer, more targeted applications than September, and twice the replies.' },
  sep: { kpi: [['Applications', '41'], ['Replies', '3'], ['Interviews', '1'], ['Follow-ups sent', '0']], funnel: [['Applied', 41], ['Replied', 3], ['Interview', 1], ['Offer', 0]], src: [['With a referral', 2, 1], ['Cold', 39, 2]], recs: ['Most replies came after a referral, so try asking first', 'You sent no follow-ups. Start one after 7 days', 'Many roles asked for 8+ years. Filter those out'], note: 'Lots of applications, few replies. This is where the loop starts.' },
};

export const FUNNEL_COLORS = ['#6655E8', '#2F5FD0', '#0F7A5C', '#B4500F'];

// Bar width in %, never under 2 so an empty bar still shows a stub.
export const barWidth = (v, max) => `${Math.max(2, (v / (max || 1)) * 100).toFixed(1)}%`;

/* ---------- 07 custom agent builder ---------- */

export const BUILDER_RESP = {
  interviews: { label: 'Prepare me for interviews', icon: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z', desc: 'Reads the JD and the CV you sent, then preps likely questions using only your real experience.', ask: 'I have the Freshworks interview on Thursday', reply: 'Here are the questions this JD points to. For each one, I’ve pulled the matching story from your Northwind work.', items: ['Tell me about a latency problem you fixed → your 38% p95 cut', 'How do you avoid data loss in pipelines? → idempotent consumers, replay tooling'] },
  referrals: { label: 'Find people who can refer me', icon: 'M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', desc: 'Looks through your notes and uploads for people at companies you’re applying to, and drafts the ask.', ask: 'anyone who could refer me at Zoho?', reply: 'Your notes mention a former teammate who joined Zoho last year. Here’s a short message you could send.', items: ['“Hi! I’m applying for Backend Engineer at Zoho and would love your take…”', 'Nothing is sent without your OK'] },
  followups: { label: 'Draft follow-ups after 7 days', icon: 'M3 7l9 6 9-6M3 5h18v14H3z', desc: 'Spots applications with no reply after a week and drafts a polite nudge for each.', ask: 'who should I follow up with?', reply: 'Three applications are past 7 days with no reply. The drafts are ready for you to review.', items: ['Groww · SDE-2 · 13 days', 'Flipkart · SDE-2 · 20 days'] },
  weekly: { label: 'Plan my week', icon: 'M8 2v4M16 2v4M3 10h18M3 6h18v15H3z', desc: 'Every Monday, reviews last week and suggests a short, focused plan.', ask: 'plan this week', reply: 'Last week, referrals got replies and cold applications didn’t. So this week starts with referrals.', items: ['Mon · ask for 3 referrals', 'Wed · apply to 5 roles asking for 2–4 years'] },
};

export const BUILDER_TEMPLATES = [
  { id: 'interview', label: 'Interview prep', name: 'interview-prep', resp: 'interviews', kn: { profile: true, apps: true, resumes: false, uploads: false } },
  { id: 'referral', label: 'Referral finder', name: 'referral-finder', resp: 'referrals', kn: { profile: true, apps: false, resumes: false, uploads: true } },
  { id: 'followup', label: 'Follow-up drafter', name: 'follow-up', resp: 'followups', kn: { profile: false, apps: true, resumes: false, uploads: false } },
  { id: 'weekly', label: 'Weekly planner', name: 'weekly-plan', resp: 'weekly', kn: { profile: true, apps: true, resumes: false, uploads: false } },
];

export const BUILDER_KNOWLEDGE = [['profile', 'Profile'], ['apps', 'Applications'], ['resumes', 'Resumes'], ['uploads', 'Uploaded files']];

// The @handle shown for a typed name. Display only, like the design; the real rule is
// normaliseHandle in agentsAdapter.js, used by the agent builder in the app.
export function previewHandle(name) {
  const slug = name.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `@${slug || 'your-agent'}`;
}
