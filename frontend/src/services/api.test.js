import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestFixture, response } from '@/test/contracts';
import { contentToProfile, layoutRequest, prefillToDoc, profileToContentIn, sectionPatch, toResume } from '@/data/cvAdapter';
import { moveSection } from '@/data/templates';
import { docToProfile } from '@/data/cvModel';
import { manualToRequest, patchRequest, toApplicationDetail } from '@/data/applications';
import { agentToForm, blankForm, formToRequest, formToUpdate, toAgent } from '@/data/agentsAdapter';
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
    ['resume_confirm_skill.json', () => api.confirmSkill('r1', toResume(response('resume.json')).missingSkills[0], 'tools', 7), 'POST', '/resumes/r1/skills/confirm'],
    ['settings_put.json', () => api.saveSettings({ display_name: null, ask_before_save: false, product_emails: true }), 'PUT', '/settings'],
    ['profile_put.json', () => api.saveProfile(profileToContentIn(contentToProfile(response('profile.json').content)), 3), 'PUT', '/profile'],
    // A first-time user's profile from an upload, after the wizard made them fix the scheme-less link.
    ['profile_put_new.json', () => api.saveProfile(profileToContentIn(docToProfile(fixedPrefill())), null), 'PUT', '/profile'],
    ['application_add.json', () => api.addApplication(manualToRequest({ company: 'Dust', role: 'Backend Engineer', sentAt: '2026-10-10', status: 'no_reply', referral: 'yes', notes: 'Referral from Meera', jdText: 'Build event-driven services in Rust.' })), 'POST', '/applications'],
    ['application_patch.json', () => api.patchApplication('a1', patchRequest(toApplicationDetail(response('application.json')), { status: 'offer', referral: null })), 'PATCH', '/applications/a1'],
    // Day 3: agents and chat.
    ['agent_create.json', () => api.createAgent(formToRequest({ ...blankForm(), name: '@Follow-Up', description: ' Drafts follow-ups for applications with no reply ', instructions: 'Look at applications older than 7 days with no reply. Draft a follow-up for each.' })), 'POST', '/agents'],
    ['agent_update.json', () => { const a = toAgent(response('agent.json')); return api.updateAgent(a.id, formToUpdate({ ...agentToForm(a), name: 'nudger' }, a.rowVersion)); }, 'PUT', '/agents/44444444-4444-4444-8444-444444444444'],
    ['agent_preview.json', () => api.previewAgent(formToRequest({ ...blankForm(), name: 'interview-prep', description: 'Interview prep', instructions: 'Give me 10 likely questions.', knowledge: ['applications', 'resumes'] }), 'Prep me for Freshworks'), 'POST', '/agents/preview'],
    ['chat_send_new.json', () => api.sendChatMessage(null, { message: '@follow-up who hasn’t replied?', agent: 'follow-up' }), 'POST', '/chats/messages'],
    ['chat_send.json', () => api.sendChatMessage('c1', { message: 'Draft one for Freshworks' }), 'POST', '/chats/c1/messages'],
    // Preview saves every section in this order; the last one marks the wizard done.
    ...['personal', 'experience', 'projects', 'education', 'skills', 'spoken_languages', 'certifications'].map((section) => [
      `resume_patch_${section}.json`, () => api.patchResume('r1', sectionPatch(withLinks, section, 7, section === 'certifications' ? 'done' : null)), 'PATCH', '/resumes/r1',
    ]),
    // PDF-1: a template switch with the user's own order, and one back to the template's default order.
    ['resume_layout.json', () => { const r = toResume(response('resume.json')); return api.setLayout(r.id, layoutRequest('jake', moveSection(r.sectionOrder, 0, 1), r.rowVersion)); }, 'PATCH', `/resumes/${response('resume.json').id}/layout`],
    ['resume_layout_default.json', () => api.setLayout('r1', layoutRequest('honne_professional', null, 7)), 'PATCH', '/resumes/r1/layout'],
  ];

  it.each(cases)('%s', async (name, call, method, path) => {
    await call();
    const [calledPath, opts] = sent();
    expect([calledPath, opts.method]).toEqual([path, method]);
    const [actual, expected] = requestFixture(name, opts.body);
    expect(actual).toEqual(expected);
  });

  it('Database: save after download, list filters as a query string', async () => {
    await api.recordApplication('r1');
    expect(sent()).toEqual(['/resumes/r1/application', { method: 'POST' }]);
    await api.listApplications({ statuses: ['applied', 'offer'], q: ' Zoho ' });
    expect(sent()[0]).toBe('/applications?status=applied%2Coffer&q=Zoho');
    await api.listApplications();
    expect(sent()[0]).toBe('/applications');
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
