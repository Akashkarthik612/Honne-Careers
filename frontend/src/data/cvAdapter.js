import { LINK_FIELDS, personalLinks, pruneDoc, toDoc } from './cvModel';

// The one adapter between the backend's shapes (Day_1 B2) and the UI's (cvModel.js).
//
//   server CvContent  ──contentToDoc──▶  doc        (per bullet: status from origin/locked/tailor_state)
//   doc               ──docToContentIn─▶ CvContentIn (ids + text only: the server stamps origin/locked, B5)
//
// Never sends origin, locked, original_text or tailor_state: the backend rejects them (extra="forbid"),
// and contracts/requests/*.json pin that in CI. All functions are pure and O(items + bullets).

export const WIZARD_ORDER = ['personal', 'experience', 'projects', 'education', 'skills'];
const SKILL_KEYS = [['lang', 'languages'], ['fw', 'frameworks'], ['tools', 'tools']];
// The API's skill category for each UI group (cvModel SKILL_GROUPS), e.g. for "I have this" (V4.1).
export const SKILL_API_CATEGORY = Object.fromEntries(SKILL_KEYS);

const filled = (s) => Boolean(s && s.trim());
const trim = (s) => (s ?? '').trim();
const EMAIL = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/;
const HTTP_URL = /^https?:\/\/[^\s/]+/i;

// ── links: the UI has three fields (LinkedIn, GitHub, portfolio); the API stores up to 5 labelled links ──

function splitLinks(links) {
  const all = links.map((l) => (typeof l === 'string' ? { label: '', url: l } : l)); // upload pre-fill sends strings
  const take = (test) => {
    const i = all.findIndex(test);
    return i < 0 ? null : all.splice(i, 1)[0];
  };
  const labelled = (name, host) => (l) => l.label.toLowerCase() === name || host.test(l.url);
  const linkedin = take(labelled('linkedin', /linkedin\.com/i));
  const github = take(labelled('github', /github\.com/i));
  // An older "GitHub or portfolio" row was saved as Portfolio; an unlabelled upload link is a portfolio too.
  const portfolio = take((l) => l.label.toLowerCase() === 'portfolio') ?? take((l) => !l.label);
  return { linkedin: linkedin?.url ?? '', github: github?.url ?? '', portfolio: portfolio?.url ?? '', otherLinks: all };
}

function personalToHeader(p) {
  return { name: trim(p.name), location: trim(p.city), email: trim(p.email), phone: trim(p.phone), links: personalLinks(p) };
}

function headerToPersonal(h) {
  return { name: h.name ?? '', city: h.location ?? '', email: h.email ?? '', phone: h.phone ?? '', ...splitLinks(h.links ?? []) };
}

// ── bullets ──

// Server bullet → doc bullet. `source` is always the user's fact; `text` is what the CV prints.
export function bulletToDoc(b) {
  const base = { id: b.id, err: null };
  if (b.tailor_state === 'proposed') {
    return { ...base, source: b.original_text, text: b.text, original: b.original_text, tailored: b.text, status: 'review' };
  }
  if (b.tailor_state === 'kept') return { ...base, source: b.original_text, text: b.text, status: 'kept' };
  return { ...base, source: b.text, text: b.text, status: b.locked ? 'edited' : 'plain' };
}

// A proposed bullet goes back with its AI text unchanged, so the server keeps the proposal (B5).
const bulletIn = (b) => ({ id: b.id, text: trim(b.text) });

// ── content ↔ doc ──

export function contentToDoc(c) {
  return {
    personal: headerToPersonal(c.header ?? {}),
    roles: (c.experience ?? []).map((e) => ({ id: e.id, role: e.role ?? '', company: e.company ?? '', start: e.start ?? '', end: e.end ?? '', location: e.location ?? '', bullets: e.bullets.map(bulletToDoc) })),
    projects: (c.projects ?? []).map((p) => ({ id: p.id, name: p.name ?? '', tech: (p.tech ?? []).join(', '), year: p.date ?? '', link: p.link ?? '', bullets: p.bullets.map(bulletToDoc) })),
    education: (c.education ?? []).map((e) => ({ id: e.id, school: e.school ?? '', degree: e.degree ?? '', years: e.years ?? '', city: e.location ?? '' })),
    skills: Object.fromEntries(SKILL_KEYS.map(([ui, api]) => [ui, (c.skills?.[api] ?? []).map((s) => (typeof s === 'string' ? s : s.name))])),
    // Spoken languages carry no server id: `id` is a React key only and is never sent.
    spoken: (c.spoken_languages ?? []).map((l, i) => ({ id: `sl${i}`, name: l.name ?? '', level: l.level ?? '' })),
    // Certifications, too: `id` is a React key only.
    certs: (c.certifications ?? []).map((x, i) => ({ id: `ce${i}`, name: x.name ?? '', issuer: x.issuer ?? '', date: x.date ?? '' })),
  };
}

const splitTech = (tech) => tech.split(',').map((t) => t.trim()).filter(Boolean);

const SECTION_IN = {
  personal: (d) => personalToHeader(d.personal),
  experience: (d) => d.roles.map((r) => ({ id: r.id, role: trim(r.role), company: trim(r.company), location: trim(r.location), start: trim(r.start), end: trim(r.end), bullets: r.bullets.map(bulletIn) })),
  projects: (d) => d.projects.map((p) => ({ id: p.id, name: trim(p.name), tech: splitTech(p.tech), date: trim(p.year), link: trim(p.link), bullets: p.bullets.map(bulletIn) })),
  education: (d) => d.education.map((e) => ({ id: e.id, school: trim(e.school), degree: trim(e.degree), years: trim(e.years), location: trim(e.city) })),
  skills: (d) => Object.fromEntries(SKILL_KEYS.map(([ui, api]) => [api, d.skills[ui].map(trim).filter(Boolean)])),
  spoken_languages: (d) => d.spoken.map((l) => ({ name: trim(l.name), level: l.level || null })),
  certifications: (d) => d.certs.map((c) => ({ name: trim(c.name), issuer: trim(c.issuer), date: trim(c.date) })),
};

// The sections each wizard step saves. Spoken languages and certifications are edited on the Skills step.
export const STEP_SECTIONS = { personal: ['personal'], experience: ['experience'], projects: ['projects'], education: ['education'], skills: ['skills', 'spoken_languages', 'certifications'] };

// Empty entries and bullets are dropped first, as the wizard's "Preview" always did.
export function docToContentIn(doc) {
  const d = pruneDoc(doc);
  return { header: SECTION_IN.personal(d), experience: SECTION_IN.experience(d), projects: SECTION_IN.projects(d), education: SECTION_IN.education(d), skills: SECTION_IN.skills(d), spoken_languages: SECTION_IN.spoken_languages(d), certifications: SECTION_IN.certifications(d) };
}

// PATCH /resumes/{id} body for one wizard step.
export function sectionPatch(doc, section, expectedVersion, wizardStep = null) {
  return { expected_version: expectedVersion, change: { section, value: SECTION_IN[section](pruneDoc(doc)) }, wizard_step: wizardStep };
}

// PATCH /resumes/{id}/layout body (PDF-1). `order` null = the template's default order.
export function layoutRequest(template, order, expectedVersion) {
  return { expected_version: expectedVersion, template, section_order: order };
}

// ── the profile page's shape: bullets are { id, text } facts (cvModel.js) ──

export function contentToProfile(c) {
  const doc = contentToDoc(c);
  const facts = (entries) => entries.map((e) => ({ ...e, bullets: e.bullets.map((b) => ({ id: b.id, text: b.source })) }));
  return { ...doc, roles: facts(doc.roles), projects: facts(doc.projects) };
}

export const profileToContentIn = (profile) => docToContentIn(toDoc(profile));

// Upload pre-fill (PrefillCv, lenient: may lack a company or start) → doc for the wizard to review
// (PROF-4). Its bullets carry no AI state, so they map as plain facts.
export const prefillToDoc = (prefill) => contentToDoc(prefill);

// Fills only the sections the resume doesn't have yet, so a pre-fill never overwrites saved work.
export function mergePrefill(doc, pre) {
  const hasPersonal = ['name', 'email', 'phone', 'city'].some((k) => filled(doc.personal[k]));
  const hasSkills = SKILL_KEYS.some(([ui]) => doc.skills[ui].length);
  return {
    personal: hasPersonal ? doc.personal : pre.personal,
    roles: doc.roles.length ? doc.roles : pre.roles,
    projects: doc.projects.length ? doc.projects : pre.projects,
    education: doc.education.length ? doc.education : pre.education,
    skills: hasSkills ? doc.skills : pre.skills,
    spoken: doc.spoken.length ? doc.spoken : pre.spoken,
    certs: doc.certs.length ? doc.certs : pre.certs,
  };
}

// ── client-side checks: the same rules the API applies, shown on the field instead of a 422 ──
// Keys: 'personal.<field>' or '<entryId>.<field>'. Returns {} when the sections are valid.

export function validateDoc(doc, sections = WIZARD_ORDER) {
  const d = pruneDoc(doc);
  const errors = {};
  if (sections.includes('personal')) {
    const p = d.personal;
    if (filled(p.email) && !EMAIL.test(trim(p.email))) errors['personal.email'] = 'Enter a valid email address.';
    for (const [k] of LINK_FIELDS) {
      if (filled(p[k]) && !HTTP_URL.test(trim(p[k]))) errors[`personal.${k}`] = 'Paste the full link, starting with https://';
    }
  }
  if (sections.includes('experience')) {
    for (const r of d.roles) {
      if (!filled(r.company)) errors[`${r.id}.company`] = 'Add the company.';
      if (!filled(r.start)) errors[`${r.id}.start`] = 'Add a start date.';
    }
  }
  if (sections.includes('projects')) {
    for (const p of d.projects) {
      if (!filled(p.name)) errors[`${p.id}.name`] = 'Add the project name.';
      if (filled(p.link) && !HTTP_URL.test(trim(p.link))) errors[`${p.id}.link`] = 'Paste the full link, starting with https://';
    }
  }
  if (sections.includes('education')) {
    for (const e of d.education) if (!filled(e.school)) errors[`${e.id}.school`] = 'Add the school.';
  }
  if (sections.includes('skills')) {
    for (const c of d.certs) if (!filled(c.name)) errors[`${c.id}.name`] = 'Add the certification name.';
  }
  return errors;
}

// ── response views ──

// draft | tailoring | failed | ready. The wizard never sets status=ready, so wizard_step=done counts too.
function resumeState(status, wizardStep) {
  if (status === 'tailoring' || status === 'failed') return status;
  return status === 'ready' || wizardStep === 'done' ? 'ready' : 'draft';
}

const stepNo = (wizardStep) => Math.max(1, WIZARD_ORDER.indexOf(wizardStep) + 1);

export function toResume(r) {
  return {
    id: r.id, title: r.title, template: r.template, mode: r.mode,
    sectionOrder: r.section_order ?? null, // null = the template's default order (templates.js sectionOrderOf)
    state: resumeState(r.status, r.wizard_step), jobStep: r.job_step ?? null, errorCode: r.error_code ?? null,
    wizardStep: r.wizard_step, stepNo: stepNo(r.wizard_step), rowVersion: r.row_version,
    doc: contentToDoc(r.content), missingSkills: r.missing_skills ?? [],
    // V4.1: skills the tailor added because the user's own experience shows them (origin ai), and JD
    // requirements that aren't skills (degree, years, spoken language), shown but never confirmable.
    addedSkills: aiSkills(r.content), gaps: (r.gaps ?? []).map((g) => ({ kind: g.kind, text: g.text })),
    jd: r.jd ? { text: r.jd.text, company: r.jd.company ?? '', role: r.jd.role ?? '' } : null,
    pdf: r.pdf ? { upToDate: r.pdf.up_to_date, pageCount: r.pdf.page_count } : null,
    updatedAt: r.updated_at,
  };
}

function aiSkills(c) {
  return SKILL_KEYS.flatMap(([, api]) => (c.skills?.[api] ?? []).filter((s) => typeof s !== 'string' && s.origin === 'ai').map((s) => s.name));
}

export function toSummary(s) {
  return {
    id: s.id, title: s.title, template: s.template, mode: s.mode, sectionOrder: s.section_order ?? null,
    state: resumeState(s.status, s.wizard_step),
    wizardStep: s.wizard_step, stepNo: stepNo(s.wizard_step), company: s.company ?? '', role: s.role ?? '',
    doc: contentToDoc(s.content), updatedAt: s.updated_at,
  };
}

// Where a resume card opens: the tailoring job, the wizard step it stopped at, or the finished CV.
export function openPath(r) {
  if (r.state === 'tailoring') return `/tailoring/${r.id}`;
  if (r.state === 'draft') return `/new/details?resume=${r.id}&step=${r.wizardStep}`;
  return `/cv/${r.id}`;
}

const LEVEL = { yes: 'Yes', strong: 'Strong', partial: 'Partial', none: 'None' };

export function toAnalysis(a) {
  const { keyword: k, experience: e, narrative: n } = a.details;
  return {
    keyword: { score: a.keyword, matched: k.matched, missing: k.missing, note: k.missing_note, reason: k.reason ?? null },
    experience: {
      score: a.experience, cvYears: e.cv_years, minYears: e.min_years ?? null, reason: e.reason ?? null,
      requirements: e.requirements.map((r) => ({ text: r.text, level: LEVEL[r.level], evidence: r.evidence })),
    },
    narrative: { score: a.narrative, jdStory: n.jd_story, cvStory: n.cv_story, suggestion: n.suggestion },
  };
}

// JD skills the CV still lacks: the full tailor's missing_skills minus what the user has since added.
export function openSuggestions(missingSkills, skills) {
  const have = new Set(SKILL_KEYS.flatMap(([ui]) => skills[ui]).map((s) => s.toLowerCase()));
  return missingSkills.filter((s) => !have.has(s.toLowerCase()));
}

// "Updated 2 h ago". `now` is injectable for tests.
export function timeAgo(iso, now = Date.now()) {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Updated ${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Updated yesterday';
  if (days < 7) return `Updated ${days} days ago`;
  return `Updated ${new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
