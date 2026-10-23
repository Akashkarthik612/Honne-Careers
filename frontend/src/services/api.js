import { apiRequest } from './apiClient';

// One function per backend endpoint (Day_1 B8). Screens call these, never fetch; shapes are mapped to
// what the UI uses in src/data/cvAdapter.js. Paths have no /api prefix (see apiConfig.js).

const json = (method, body) => ({ method, body });

// ── account (AUTH-1, AUTH-3) ───────────────────────────────────────────────
export const fetchMe = () => apiRequest('/me');                        // also creates the account row
export const deleteMe = () => apiRequest('/me', { method: 'DELETE' }); // files, sign-in and every row
export const getUsage = () => apiRequest('/me/usage');                  // today's usage vs the beta limits

export const getSettings = () => apiRequest('/settings');
export const saveSettings = (settings) => apiRequest('/settings', json('PUT', settings));

// ── profile (PROF-1, PROF-4) ───────────────────────────────────────────────
// Resolves null when the user has no saved profile yet (404 no_profile); every other error throws.
export async function getProfile() {
  try {
    return await apiRequest('/profile');
  } catch (e) {
    if (e.status === 404 && e.details?.reason === 'no_profile') return null;
    throw e;
  }
}
// expectedVersion null = create the profile; otherwise update or 409 stale_version.
export const saveProfile = (content, expectedVersion) => apiRequest('/profile', json('PUT', { expected_version: expectedVersion, content }));
export const saveResumeToProfile = (resumeId, expectedVersion) => apiRequest(`/resumes/${resumeId}/save-to-profile`, json('POST', { expected_version: expectedVersion }));

// ── templates and resumes ───────────────────────────────────────────────────
export const listTemplates = () => apiRequest('/templates');
export const listResumes = () => apiRequest('/resumes');
export const getResume = (id) => apiRequest(`/resumes/${id}`);
export const createResume = ({ template, mode, title }) => apiRequest('/resumes', json('POST', { template, mode, title: title || null }));
export const duplicateResume = (id) => apiRequest(`/resumes/${id}/duplicate`, { method: 'POST' });
export const deleteResume = (id) => apiRequest(`/resumes/${id}`, { method: 'DELETE' });
// One wizard step (autosave). 409 stale_version when another tab saved first.
export const patchResume = (id, body) => apiRequest(`/resumes/${id}`, json('PATCH', body));
// TAIL-1 / SAVE-2: company and role are the user's corrections; null = let the backend detect them.
export const setJd = (id, { text, company, role }) => apiRequest(`/resumes/${id}/jd`, json('PUT', { text, company: company || null, role: role || null }));

// ── uploads (PROF-2, PROF-5) ────────────────────────────────────────────────
export function uploadCv(file) {
  const form = new FormData();
  form.append('file', file);
  return apiRequest('/uploads', { method: 'POST', form });
}
// .tex is parsed for content only, never compiled (PDF-3).
export const uploadLatex = (text) => apiRequest('/uploads/latex', json('POST', { text }));

// ── tailoring (TAIL-3, TAIL-4) ──────────────────────────────────────────────
export const startTailor = (id, scope = 'all') => apiRequest(`/resumes/${id}/tailor`, json('POST', { scope }));
export const tailorBullet = (id, bulletId) => apiRequest(`/resumes/${id}/bullets/${bulletId}/tailor`, { method: 'POST' });
export const settleBullet = (id, bulletId, action, expectedVersion) => apiRequest(`/resumes/${id}/bullets/${bulletId}/${action}`, json('POST', { expected_version: expectedVersion }));

// ── PDF and analysis (PDF-2, ANA-1…4) ───────────────────────────────────────
export const buildPdf = (id) => apiRequest(`/resumes/${id}/pdf`, { method: 'POST' });
export const runAnalysis = (id) => apiRequest(`/resumes/${id}/analysis`, { method: 'POST' });

// ── application Database (Day 2: SAVE-1/3, IQ-1/2/3) ────────────────────────
// Called right after Download PDF. Safe to repeat: one JD = one row (src/services/applicationSaver.js).
export const recordApplication = (resumeId) => apiRequest(`/resumes/${resumeId}/application`, { method: 'POST' });
// { retention_days, items: [summary] }, newest first. Rows past the retention window are never returned.
export function listApplications({ statuses = [], q = '' } = {}) {
  const params = new URLSearchParams();
  if (statuses.length) params.set('status', statuses.join(','));
  if (q.trim()) params.set('q', q.trim());
  const qs = params.toString();
  return apiRequest(`/applications${qs ? `?${qs}` : ''}`);
}
export const getApplication = (id) => apiRequest(`/applications/${id}`);
export const addApplication = (body) => apiRequest('/applications', json('POST', body));
// Only the fields given change. 409 stale_version when another tab saved first.
export const patchApplication = (id, body) => apiRequest(`/applications/${id}`, json('PATCH', body));
export const applicationPdf = (id) => apiRequest(`/applications/${id}/pdf`);
export const deleteApplication = (id) => apiRequest(`/applications/${id}`, { method: 'DELETE' });

// ── agents and chat (Day 3: CUST-1…4) ───────────────────────────────────────
// { mine: [agent], builtin: [agent], limit, count }. Shapes are mapped in src/data/agentsAdapter.js.
export const listAgents = () => apiRequest('/agents');
export const getAgent = (id) => apiRequest(`/agents/${id}`);
export const createAgent = (body) => apiRequest('/agents', json('POST', body));
// The whole agent again + expected_version; the server keeps every version. 409 stale_version.
export const updateAgent = (id, body) => apiRequest(`/agents/${id}`, json('PUT', body));
export const deleteAgent = (id) => apiRequest(`/agents/${id}`, { method: 'DELETE' });
// Try it (CUST-3): one answer from an unsaved agent. Nothing is saved.
export const previewAgent = (agent, message) => apiRequest('/agents/preview', json('POST', { agent, message }));

export const listChats = (limit) => apiRequest(`/chats${limit ? `?limit=${limit}` : ''}`);
export const getChat = (id) => apiRequest(`/chats/${id}`);
// A turn runs in the background: 202 { chat, user_message, assistant_message (running), poll }.
// `agent` is the @handle picked in the composer; omitted = the agent that answered last in this chat.
export function sendChatMessage(chatId, { message, agent }) {
  const body = agent ? { message, agent } : { message };
  return apiRequest(chatId ? `/chats/${chatId}/messages` : '/chats/messages', json('POST', body));
}
export const getChatMessage = (chatId, messageId) => apiRequest(`/chats/${chatId}/messages/${messageId}`); // the poll
export const retryChatTurn = (chatId) => apiRequest(`/chats/${chatId}/retry`, { method: 'POST' });
export const deleteChat = (id) => apiRequest(`/chats/${id}`, { method: 'DELETE' });
