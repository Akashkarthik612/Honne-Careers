import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestFixture, response } from '@/test/contracts';
import { contentToProfile, prefillToDoc, profileToContentIn, sectionPatch, toResume } from '@/data/cvAdapter';
import { docToProfile } from '@/data/cvModel';
import * as api from './api';
import { ApiError, apiRequest } from './apiClient';

// api.js against a recorded apiRequest: which endpoint, which body. The bodies are the request contracts
// (contracts/requests/*.json) that the backend validates against its Pydantic shapes in CI.
vi.mock('./apiClient', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, apiRequest: vi.fn(async () => ({})) };
});

const sent = () => apiRequest.mock.calls.at(-1);

function fixedPrefill() {
  const doc = prefillToDoc(response('upload.json').prefill);
  return { ...doc, personal: { ...doc.personal, github: 'https://github.com/arjun' } };
}

beforeEach(() => apiRequest.mockClear());

describe('request contracts', () => {
  const doc = toResume(response('resume.json')).doc;
  const withLinks = { ...doc, personal: { ...doc.personal, linkedin: 'https://linkedin.com/in/arjun', github: 'https://github.com/arjun' } };

  const cases = [
    ['create_resume.json', () => api.createResume({ template: 'jake', mode: 'tailored', title: 'SDE-2 Backend · Freshworks' }), 'POST', '/resumes'],
    ['set_jd.json', () => api.setJd('r1', { text: response('resume.json').jd.text, company: 'Freshworks', role: '' }), 'PUT', '/resumes/r1/jd'],
    ['tailor.json', () => api.startTailor('r1'), 'POST', '/resumes/r1/tailor'],
    ['settle.json', () => api.settleBullet('r1', 'nw1', 'keep', 7), 'POST', '/resumes/r1/bullets/nw1/keep'],
    ['settings_put.json', () => api.saveSettings({ display_name: null, ask_before_save: false, product_emails: true }), 'PUT', '/settings'],
    ['profile_put.json', () => api.saveProfile(profileToContentIn(contentToProfile(response('profile.json').content)), 3), 'PUT', '/profile'],
    // A first-time user's profile from an upload, after the wizard made them fix the scheme-less link.
    ['profile_put_new.json', () => api.saveProfile(profileToContentIn(docToProfile(fixedPrefill())), null), 'PUT', '/profile'],
    ...['personal', 'experience', 'projects', 'education', 'skills'].map((section) => [
      `resume_patch_${section}.json`, () => api.patchResume('r1', sectionPatch(withLinks, section, 7, section === 'skills' ? 'done' : null)), 'PATCH', '/resumes/r1',
    ]),
  ];

  it.each(cases)('%s', async (name, call, method, path) => {
    await call();
    const [calledPath, opts] = sent();
    expect([calledPath, opts.method]).toEqual([path, method]);
    const [actual, expected] = requestFixture(name, opts.body);
    expect(actual).toEqual(expected);
  });

  it('uploads a file as multipart, not JSON', async () => {
    const file = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    await api.uploadCv(file);
    const [path, opts] = sent();
    expect(path).toBe('/uploads');
    expect(opts.form).toBeInstanceOf(FormData);
    expect(opts.body).toBeUndefined();
  });
});

describe('getProfile', () => {
  it('resolves null when the user has no profile yet', async () => {
    apiRequest.mockRejectedValueOnce(new ApiError({ status: 404, code: 'not_found', message: 'No saved profile yet.', details: { reason: 'no_profile' } }));
    await expect(api.getProfile()).resolves.toBeNull();
  });

  it('throws every other failure (no silent fallback)', async () => {
    const outage = new ApiError({ status: 503, code: 'http_503', message: 'down' });
    apiRequest.mockRejectedValueOnce(outage);
    await expect(api.getProfile()).rejects.toBe(outage);
    const other404 = new ApiError({ status: 404, code: 'not_found', message: 'Not found.', details: { reason: 'resume' } });
    apiRequest.mockRejectedValueOnce(other404);
    await expect(api.getProfile()).rejects.toBe(other404);
  });
});
