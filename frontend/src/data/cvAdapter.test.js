import { describe, expect, it } from 'vitest';
import { response } from '@/test/contracts';
import {
  contentToDoc, contentToProfile, docToContentIn, layoutRequest, mergePrefill, openSuggestions, prefillToDoc, profileToContentIn,
  sectionPatch, timeAgo, toAnalysis, toResume, toSummary, validateDoc,
} from './cvAdapter';
import { boldParts, docToCv, emptyProfile, plainText, pruneDoc } from './cvModel';

const SERVER_ONLY = ['origin', 'locked', 'original_text', 'original_origin', 'tailor_state'];

// Every key anywhere in a JSON value.
const keysOf = (v) => (Array.isArray(v) ? v.flatMap(keysOf) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [k, ...keysOf(x)]) : []);
const bullet = (doc, id) => [...doc.roles, ...doc.projects].flatMap((e) => e.bullets).find((b) => b.id === id);

describe('server responses → UI (contracts/responses)', () => {
  const resume = toResume(response('resume.json'));

  it('maps each bullet state from origin / locked / tailor_state', () => {
    const raw = response('resume.json').content.experience[0].bullets;
    expect(bullet(resume.doc, 'nw1')).toMatchObject({ status: 'review', text: raw[0].text, tailored: raw[0].text, original: raw[0].original_text, source: raw[0].original_text });
    expect(bullet(resume.doc, 'nw2')).toMatchObject({ status: 'kept', text: raw[1].text, source: raw[1].original_text });
    expect(bullet(resume.doc, 'nw3')).toMatchObject({ status: 'edited', source: raw[2].text });
    expect(bullet(resume.doc, 'bl1').status).toBe('plain');
  });

  it('carries version, JD, PDF and missing skills', () => {
    expect(resume).toMatchObject({ state: 'ready', rowVersion: 7, missingSkills: ['Kubernetes'], pdf: { upToDate: true, pageCount: 1 } });
    expect(resume.jd).toMatchObject({ company: 'Freshworks', role: 'SDE-2 Backend' });
    expect(resume.doc.projects[0].tech).toBe('Java, Spring Boot, PostgreSQL, Docker');
  });

  it('summary: draft at its wizard step, with content for the thumbnail', () => {
    const s = toSummary(response('resume_summary.json'));
    expect(s).toMatchObject({ state: 'draft', wizardStep: 'experience', stepNo: 2, company: 'Freshworks' });
    expect(s.doc.roles[0].company).toBe('Northwind Fintech');
  });

  it('profile: bullets are the user\'s facts', () => {
    const profile = contentToProfile(response('profile.json').content);
    expect(profile.roles[0].bullets[0]).toEqual({ id: 'nw1', text: expect.stringMatching(/^Cut payment-event latency/) });
    expect(profile.skills.lang).toEqual(['Java', 'Python', 'SQL']);
  });

  it('upload pre-fill: string links split into LinkedIn and GitHub fields', () => {
    const doc = prefillToDoc(response('upload.json').prefill);
    expect(doc.personal).toMatchObject({ linkedin: 'https://linkedin.com/in/arjun', github: 'github.com/arjun', portfolio: '', otherLinks: [] });
    expect(doc.roles[0].bullets[0]).toMatchObject({ id: 'u1b1', status: 'plain' });
  });

  it('analysis: scores with evidence, levels in UI words', () => {
    const a = toAnalysis(response('analysis.json'));
    expect(a.keyword).toMatchObject({ score: 75, matched: ['Java', 'Kafka', 'AWS'], missing: ['Kubernetes'] });
    expect(a.experience.requirements.map((r) => r.level)).toEqual(['Strong', 'Yes', 'None']);
    expect(a.experience).toMatchObject({ minYears: 3, cvYears: 6.2 });
    expect(a.narrative.suggestion).toBe('Open your first bullet with Owned.');
  });
});

describe('header links: LinkedIn, GitHub and portfolio are separate fields', () => {
  const withLinks = (links) => contentToDoc({ header: { name: 'A', links } }).personal;

  it('splits labelled links, and reads an older "Portfolio" row into the portfolio field', () => {
    const p = withLinks([
      { label: 'Portfolio', url: 'https://arjun.dev' },
      { label: 'GitHub', url: 'https://github.com/arjun' },
      { label: 'LinkedIn', url: 'https://linkedin.com/in/arjun' },
      { label: 'Blog', url: 'https://blog.arjun.dev' },
    ]);
    expect(p).toMatchObject({ linkedin: 'https://linkedin.com/in/arjun', github: 'https://github.com/arjun', portfolio: 'https://arjun.dev' });
    expect(p.otherLinks).toEqual([{ label: 'Blog', url: 'https://blog.arjun.dev' }]);
  });

  it('round-trips the three fields with fixed labels', () => {
    const personal = { ...emptyProfile().personal, name: 'A', linkedin: 'https://linkedin.com/in/a', github: 'https://github.com/a', portfolio: 'https://a.dev' };
    const header = docToContentIn({ ...pruneDoc(contentToDoc({})), personal }).header;
    expect(header.links).toEqual([
      { label: 'LinkedIn', url: 'https://linkedin.com/in/a' },
      { label: 'GitHub', url: 'https://github.com/a' },
      { label: 'Portfolio', url: 'https://a.dev' },
    ]);
    expect(withLinks(header.links)).toMatchObject({ linkedin: personal.linkedin, github: personal.github, portfolio: personal.portfolio });
  });

  it('the preview prints link labels with the URL as href, not the bare URL', () => {
    const cv = docToCv({ ...pruneDoc(contentToDoc({})), personal: { ...emptyProfile().personal, email: 'a@b.co', github: 'https://github.com/a', portfolio: 'https://a.dev' } });
    expect(cv.contact).toEqual([
      { text: 'a@b.co' },
      { text: 'GitHub', href: 'https://github.com/a' },
      { text: 'Portfolio', href: 'https://a.dev' },
    ]);
  });

  it('flags a portfolio link without https://', () => {
    const doc = { ...pruneDoc(contentToDoc({})), personal: { ...emptyProfile().personal, portfolio: 'a.dev' } };
    expect(validateDoc(doc, ['personal'])).toEqual({ 'personal.portfolio': 'Paste the full link, starting with https://' });
  });
});

describe('boldParts: **bold** spans in tailored bullets', () => {
  it('splits bold and plain text', () => {
    expect(boldParts('Cut **p95 latency** by **38%**')).toEqual([
      { text: 'Cut ', bold: false }, { text: 'p95 latency', bold: true }, { text: ' by ', bold: false }, { text: '38%', bold: true },
    ]);
    expect(boldParts('no markers')).toEqual([{ text: 'no markers', bold: false }]);
  });

  it('returns null for unbalanced, empty or nested markers', () => {
    expect(boldParts('Cut **latency')).toBeNull();
    expect(boldParts('Cut **** latency')).toBeNull();
    expect(boldParts('Cut ***latency*** now')).toBeNull();
  });

  it('plainText drops the markers', () => {
    expect(plainText('Cut **p95 latency** by 38%')).toBe('Cut p95 latency by 38%');
  });
});

describe('UI → client input shapes (B5: ids + text only)', () => {
  const doc = toResume(response('resume.json')).doc;

  it('never sends server-owned fields', () => {
    const body = docToContentIn(doc);
    expect(keysOf(body).filter((k) => SERVER_ONLY.includes(k))).toEqual([]);
  });

  it('sends a proposed bullet back unchanged, so the server keeps the proposal', () => {
    const body = docToContentIn(doc);
    const raw = response('resume.json').content.experience[0].bullets[0];
    expect(body.experience[0].bullets[0]).toEqual({ id: 'nw1', text: raw.text });
  });

  it('round-trips content without losing items', () => {
    const raw = response('resume.json').content;
    const body = docToContentIn(contentToDoc(raw));
    expect(body.experience.map((e) => e.id)).toEqual(raw.experience.map((e) => e.id));
    expect(body.projects[0].tech).toEqual(raw.projects[0].tech);
    expect(body.skills).toEqual({ languages: ['Java', 'Python', 'SQL'], frameworks: ['Spring Boot', 'Kafka Streams', 'JUnit'], tools: ['PostgreSQL', 'AWS', 'Docker', 'Git', 'Grafana'] });
  });

  it('drops empty entries and bullets before sending', () => {
    const withBlank = { ...doc, roles: [...doc.roles, { id: 'rX', role: '', company: '', start: '', end: '', location: '', bullets: [{ id: 'bX', text: ' ', source: '', status: 'plain' }] }] };
    expect(sectionPatch(withBlank, 'experience', 3).change.value.map((e) => e.id)).toEqual(doc.roles.map((r) => r.id));
  });

  it('profile → CvContentIn uses the profile facts', () => {
    const profile = contentToProfile(response('profile.json').content);
    expect(profileToContentIn(profile).experience[0].bullets[0].text).toMatch(/^Cut payment-event latency/);
  });
});

describe('validateDoc: the API\'s rules, shown on the field', () => {
  it('flags a role without company or start, bad links and email', () => {
    const doc = {
      ...pruneDoc(contentToDoc({})),
      personal: { ...emptyProfile().personal, email: 'not-an-email', linkedin: 'linkedin.com/in/x' },
      roles: [{ id: 'r1', role: 'Engineer', company: '', start: '', end: '', location: '', bullets: [] }],
      projects: [{ id: 'p1', name: '', tech: 'Go', year: '', bullets: [] }],
    };
    expect(validateDoc(doc)).toEqual({
      'personal.email': expect.any(String), 'personal.linkedin': expect.any(String),
      'r1.company': 'Add the company.', 'r1.start': 'Add a start date.', 'p1.name': 'Add the project name.',
    });
  });

  it('flags a parsed link without https:// instead of rewriting it', () => {
    const doc = prefillToDoc(response('upload.json').prefill);
    expect(validateDoc(doc, ['personal'])).toEqual({ 'personal.github': 'Paste the full link, starting with https://' });
  });

  it('accepts the server\'s own content, and checks only the sections asked for', () => {
    const doc = toResume(response('resume.json')).doc;
    expect(validateDoc(doc)).toEqual({});
    const broken = { ...doc, roles: [{ ...doc.roles[0], company: '' }] };
    expect(validateDoc(broken, ['personal'])).toEqual({});
  });
});

describe('helpers', () => {
  it('mergePrefill fills only empty sections', () => {
    const saved = toResume(response('resume.json')).doc;
    const pre = prefillToDoc(response('upload.json').prefill);
    const merged = mergePrefill({ ...saved, education: [] }, pre);
    expect(merged.roles).toBe(saved.roles);
    expect(merged.education).toBe(pre.education);
  });

  it('toResume exposes tailor-added skills and non-skill gaps (V4.1)', () => {
    const resume = toResume(response('resume.json'));
    expect(resume.addedSkills).toEqual(['PostgreSQL']);
    expect(resume.doc.skills.tools[0]).toBe('PostgreSQL');
    expect(resume.gaps).toEqual([{ kind: 'experience', text: '5+ years of backend experience' }, { kind: 'language', text: 'Fluent Kannada' }]);
    expect(toResume({ ...response('resume.json'), gaps: undefined }).gaps).toEqual([]);
  });

  it('openSuggestions drops skills the user already added (case-insensitive)', () => {
    expect(openSuggestions(['Kubernetes', 'Docker'], { lang: [], fw: [], tools: ['docker'] })).toEqual(['Kubernetes']);
  });

  it('timeAgo', () => {
    const now = Date.parse('2026-10-19T12:00:00Z');
    expect(timeAgo('2026-10-19T11:59:40Z', now)).toBe('Updated just now');
    expect(timeAgo('2026-10-19T10:00:00Z', now)).toBe('Updated 2 h ago');
    expect(timeAgo('2026-10-18T10:00:00Z', now)).toBe('Updated yesterday');
  });
});

describe('spoken languages and project links', () => {
  const raw = response('profile.json').content;

  it('round-trips spoken languages and the project link, with no client ids sent', () => {
    const doc = contentToDoc(raw);
    expect(doc.spoken.map((l) => [l.name, l.level])).toEqual([['English', 'professional'], ['Tamil', 'native']]);
    const body = docToContentIn(doc);
    expect(body.spoken_languages).toEqual(raw.spoken_languages);
    expect(body.projects[0].link).toBe(raw.projects[0].link);
  });

  it('sends no level as null and drops a language without a name', () => {
    const doc = { ...contentToDoc(raw), spoken: [{ id: 'a', name: ' French ', level: '' }, { id: 'b', name: ' ', level: 'native' }] };
    expect(sectionPatch(doc, 'spoken_languages', 4).change).toEqual({ section: 'spoken_languages', value: [{ name: 'French', level: null }] });
  });

  it('prints "Click here" links and a Languages line in the preview', () => {
    const cv = docToCv(contentToDoc(raw));
    expect(cv.projects[0].link).toBe(raw.projects[0].link);
    expect(cv.languages).toBe('English (Professional), Tamil (Native)');
    expect(docToCv({ ...contentToDoc(raw), spoken: [] }).languages).toBe('');
  });

  it('flags a project link without https://', () => {
    const doc = contentToDoc(raw);
    const bad = { ...doc, projects: [{ ...doc.projects[0], link: 'ledger.dev' }] };
    expect(validateDoc(bad, ['projects'])).toEqual({ [`${doc.projects[0].id}.link`]: 'Paste the full link, starting with https://' });
  });

  it('a removed last entry leaves the section empty', () => {
    const doc = contentToDoc(raw);
    expect(sectionPatch({ ...doc, projects: [] }, 'projects', 4).change.value).toEqual([]);
  });
});

describe('certifications (typed by the user, shown in both templates)', () => {
  const raw = response('profile.json').content;

  it('round-trips certifications with no client ids sent', () => {
    const doc = contentToDoc(raw);
    expect(doc.certs.map((c) => c.name)).toEqual(['AWS Certified Developer', 'Smart India Hackathon finalist']);
    expect(docToContentIn(doc).certifications).toEqual(raw.certifications);
    expect(contentToProfile(raw).certs).toHaveLength(2);
    expect(profileToContentIn(contentToProfile(raw)).certifications).toEqual(raw.certifications);
  });

  it('drops an empty row, flags a row without a name, and saves with the Skills step', () => {
    const doc = { ...contentToDoc(raw), certs: [{ id: 'a', name: ' AWS ', issuer: '', date: ' 2024 ' }, { id: 'b', name: '', issuer: '', date: '' }, { id: 'c', name: '', issuer: 'Google', date: '' }] };
    expect(validateDoc(doc, ['skills'])).toEqual({ 'c.name': 'Add the certification name.' });
    const ok = { ...doc, certs: doc.certs.slice(0, 2) };
    expect(sectionPatch(ok, 'certifications', 4).change).toEqual({ section: 'certifications', value: [{ name: 'AWS', issuer: '', date: '2024' }] });
  });

  it('prints name – issuer – year in the preview', () => {
    expect(docToCv(contentToDoc(raw)).certifications).toEqual(['AWS Certified Developer – Amazon Web Services – 2024', 'Smart India Hackathon finalist']);
    expect(emptyProfile().certs).toEqual([]);
  });

  it('mergePrefill keeps the resume\'s own certifications', () => {
    const doc = contentToDoc(raw);
    expect(mergePrefill(doc, { ...doc, certs: [] }).certs).toBe(doc.certs);
  });
});

describe('layout (PDF-1)', () => {
  it('toResume / toSummary carry the stored section order (null = template default)', () => {
    expect(toResume(response('resume.json')).sectionOrder).toEqual(['experience', 'projects', 'skills', 'certifications', 'languages', 'education']);
    expect(toSummary(response('resume_summary.json')).sectionOrder).toBeNull();
  });

  it('layoutRequest sends ids only', () => {
    expect(layoutRequest('jake', null, 3)).toEqual({ expected_version: 3, template: 'jake', section_order: null });
  });
});
