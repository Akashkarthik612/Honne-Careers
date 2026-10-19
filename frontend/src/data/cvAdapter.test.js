import { describe, expect, it } from 'vitest';
import { response } from '@/test/contracts';
import {
  contentToDoc, contentToProfile, docToContentIn, mergePrefill, openSuggestions, prefillToDoc, profileToContentIn,
  sectionPatch, timeAgo, toAnalysis, toResume, toSummary, validateDoc,
} from './cvAdapter';
import { emptyProfile, pruneDoc } from './cvModel';

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
    expect(doc.personal).toMatchObject({ linkedin: 'https://linkedin.com/in/arjun', github: 'github.com/arjun', otherLinks: [] });
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
    expect(body.skills).toEqual({ languages: ['Java', 'Python', 'SQL'], frameworks: ['Spring Boot', 'Kafka Streams', 'JUnit'], tools: ['AWS', 'Docker', 'Git', 'Grafana'] });
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
