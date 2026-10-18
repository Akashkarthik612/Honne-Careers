// Pure helpers between the three shapes the UI uses:
//   profile — the user's own facts (PROF-1); bullets are { id, text }.
//   doc     — a resume being built: the profile plus, per bullet, the CV wording and its review status.
//             Bullet: { id, source, text, status } where `source` is the profile fact and `text` what the CV prints.
//             status: plain | edited | busy | review | kept. Only `text` differs from `source` after a kept tailoring.
//   cv      — what CvDoc renders.
// All are O(n) in the number of entries and bullets.

export const SKILL_GROUPS = [['lang', 'Languages'], ['fw', 'Frameworks'], ['tools', 'Cloud & tools']];

let seq = 0;
export const newId = (prefix) => `${prefix}${Date.now().toString(36)}${(seq += 1)}`;

export const blankRole = () => ({ id: newId('r'), role: '', company: '', start: '', end: '', location: '', bullets: [] });
export const blankProject = () => ({ id: newId('p'), name: '', tech: '', year: '', bullets: [] });
export const blankEducation = () => ({ id: newId('e'), school: '', degree: '', years: '', city: '' });

export function emptyProfile() {
  return {
    personal: { name: '', city: '', email: '', phone: '', linkedin: '', github: '' },
    roles: [], projects: [], education: [],
    skills: { lang: [], fw: [], tools: [] },
  };
}

const mapBullets = (entries, fn) => entries.map((e) => ({ ...e, bullets: e.bullets.map(fn) }));

// profile → doc. `tailored` (bullet id → text) marks those bullets as already tailored and kept.
export function toDoc(profile, tailored = {}) {
  const bullet = (b) => (tailored[b.id]
    ? { id: b.id, source: b.text, text: tailored[b.id], status: 'kept' }
    : { id: b.id, source: b.text, text: b.text, status: 'plain' });
  return {
    personal: { ...profile.personal },
    roles: mapBullets(profile.roles, bullet),
    projects: mapBullets(profile.projects, bullet),
    education: profile.education.map((e) => ({ ...e })),
    skills: { lang: [...profile.skills.lang], fw: [...profile.skills.fw], tools: [...profile.skills.tools] },
  };
}

// doc → profile: keeps the user's facts (source), never the tailored wording.
export function docToProfile(doc) {
  const bullet = (b) => ({ id: b.id, text: b.source });
  return {
    personal: { ...doc.personal },
    roles: mapBullets(doc.roles, bullet),
    projects: mapBullets(doc.projects, bullet),
    education: doc.education.map((e) => ({ ...e })),
    skills: { ...doc.skills },
  };
}

const filled = (s) => Boolean(s && s.trim());
const span = (a, b) => [a, b].filter(filled).join(' – ');

// doc → cv. Empty fields and entries are dropped so the live preview never shows blank rows.
export function docToCv(doc) {
  const texts = (bullets) => bullets.map((b) => b.text).filter(filled);
  const p = doc.personal;
  return {
    name: p.name,
    contact: [p.city, p.phone, p.email, p.linkedin, p.github].filter(filled),
    experience: doc.roles
      .filter((r) => filled(r.role) || filled(r.company))
      .map((r) => ({ role: r.role, company: r.company, location: r.location, dates: span(r.start, r.end), bullets: texts(r.bullets) })),
    projects: doc.projects
      .filter((pr) => filled(pr.name))
      .map((pr) => ({ name: pr.name, tech: pr.tech, year: pr.year, bullets: texts(pr.bullets) })),
    education: doc.education
      .filter((e) => filled(e.school))
      .map((e) => ({ school: e.school, location: e.city, degree: e.degree, years: e.years })),
    skills: SKILL_GROUPS.filter(([k]) => doc.skills[k].length).map(([k, label]) => [label, doc.skills[k].join(', ')]),
  };
}

export const profileToCv = (profile) => docToCv(toDoc(profile));

export const blankBullet = () => ({ id: newId('b'), source: '', text: '', status: 'plain', err: null });

// Gives each section at least one entry so the wizard always has a form to fill.
export function ensureEntries(doc) {
  return {
    ...doc,
    roles: doc.roles.length ? doc.roles : [{ ...blankRole(), bullets: [blankBullet()] }],
    projects: doc.projects.length ? doc.projects : [{ ...blankProject(), bullets: [blankBullet()] }],
    education: doc.education.length ? doc.education : [blankEducation()],
  };
}

// Resolves transient bullet states (busy, review → back to what was there before; errors cleared),
// so a saved doc only holds plain | edited | kept.
export function settleDoc(doc) {
  const settle = (b) => {
    if (b.status === 'review') return { ...b, text: b.original, status: b.prev || 'plain', err: null };
    if (b.status === 'busy') return { ...b, status: b.prev || 'plain', err: null };
    return { ...b, err: null };
  };
  return { ...doc, roles: mapBullets(doc.roles, settle), projects: mapBullets(doc.projects, settle) };
}

// Drops empty bullets and entries with nothing filled in, before a doc is saved.
export function pruneDoc(doc) {
  const keep = (entries, fields) => entries
    .map((e) => (e.bullets ? { ...e, bullets: e.bullets.filter((b) => filled(b.text)) } : e))
    .filter((e) => fields.some((f) => filled(e[f])) || (e.bullets && e.bullets.length));
  return {
    ...doc,
    roles: keep(doc.roles, ['role', 'company', 'start', 'end', 'location']),
    projects: keep(doc.projects, ['name', 'tech']),
    education: keep(doc.education, ['school', 'degree', 'years', 'city']),
  };
}

// Bullets whose CV wording differs from the profile fact — the "What changed" list on the ready screen.
export function docChanges(doc) {
  const out = [];
  doc.roles.forEach((r) => r.bullets.forEach((b, i) => {
    if (b.text !== b.source) out.push({ id: b.id, where: `Experience · ${r.company || r.role} · bullet ${i + 1}`, before: b.source, after: b.text });
  }));
  doc.projects.forEach((pr) => pr.bullets.forEach((b) => {
    if (b.text !== b.source) out.push({ id: b.id, where: `Projects · ${pr.name}`, before: b.source, after: b.text });
  }));
  return out;
}

// Five profile sections with a completeness flag and the tag the profile page shows.
export function profileSections(profile) {
  const p = profile.personal;
  const hasBullets = (entries) => entries.some((e) => e.bullets.some((b) => filled(b.text)));
  const skillCount = SKILL_GROUPS.reduce((n, [k]) => n + profile.skills[k].length, 0);
  const projects = profile.projects.filter((pr) => filled(pr.name));
  return [
    { key: 'personal', label: 'Personal', complete: filled(p.name) && filled(p.email) },
    { key: 'experience', label: 'Experience', complete: hasBullets(profile.roles) },
    { key: 'projects', label: 'Projects', complete: projects.length >= 2, hint: projects.length === 1 ? 'Add a second project' : null },
    { key: 'education', label: 'Education', complete: profile.education.some((e) => filled(e.school)) },
    { key: 'skills', label: 'Skills', complete: skillCount > 0 },
  ];
}

export const hasProfile = (profile) => profile.roles.some((r) => r.bullets.length > 0);

export const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length;

// SAVE-2 placeholder: the backend extracts company and role from the JD; until then, read a
// "Role · Company · City" first line. Returns blanks when the line doesn't have that shape.
export function guessJobMeta(jd) {
  const first = jd.trim().split('\n')[0] || '';
  const parts = first.split('·').map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return { role: '', company: '' };
  return { role: parts[0], company: parts[1] };
}

// JD skills not already in the profile (case-insensitive substring match against every skill chip).
export function missingSkills(skills, jdSkills) {
  const have = SKILL_GROUPS.flatMap(([k]) => skills[k]).map((s) => s.toLowerCase());
  return jdSkills.filter((s) => !have.some((h) => h.includes(s.toLowerCase())));
}
