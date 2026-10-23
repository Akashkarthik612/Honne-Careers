// The one adapter between the API's agent shapes and the Agents screens (Day 3: CUST-1…4).
// Requests carry only what the user writes (handle, description, instructions, guardrails, knowledge);
// the server sets model, tools and limits, and rejects anything else (extra="forbid").

// Mirrors the backend (app/domain/chat_agents.py and the DB checks in 20261023000001).
export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,29}$/;
export const DESCRIPTION_MAX = 140;
export const INSTRUCTIONS_MAX = 4000;
export const GUARDRAILS_MAX = 1000;
export const MESSAGE_MAX = 4000;

// What an agent may read. Only these are live; the rest show as "Coming soon" (design: Agents.dc.html).
export const KNOWLEDGE = [
  { key: 'profile', label: 'Profile', help: 'Your experience, projects, education and skills', ic: 'P' },
  { key: 'applications', label: 'Database', help: 'Your applications, with the JDs and the CVs you sent', ic: 'D' },
  { key: 'resumes', label: 'Resumes', help: 'Every resume you have made', ic: 'R' },
];
export const KNOWLEDGE_SOON = [{ key: 'uploads', label: 'Uploaded files', help: 'Files you add, like a LinkedIn export', ic: 'U' }];
export const CONNECTORS_SOON = ['Gmail', 'Google Drive', 'Notion'];

export const DEFAULT_GUARDRAILS = 'Never invent experience, skills, numbers or dates.\nNever contact anyone or send anything without my approval.\nNever share my data outside Honne.';

// "Start from an example" (design copy). Each fills the instructions and, if empty, the name and description.
export const EXAMPLES = [
  { label: 'Interview prep', handle: 'interview-prep', description: 'Likely questions and answer outlines for an interview',
    instructions: 'Before each interview, read the JD and my CV for that company from the Database. Give me 10 likely questions and a short answer outline for each, using only my real experience. End with 3 questions I should ask them.' },
  { label: 'Follow-up', handle: 'follow-up', description: 'Drafts follow-ups for applications with no reply',
    instructions: 'Look at my applications with no reply for 7 days or more. For each, draft a short, polite follow-up that names the role, the day I applied and one real line from the CV I sent.' },
  { label: 'Weekly check-in', handle: 'weekly-check-in', description: 'What got replies, what needs a follow-up, what to apply to next',
    instructions: 'Read my Database. Tell me which applications got replies, which need a follow-up, and plan 5 targeted applications for this week.' },
];

const labelOf = (key) => KNOWLEDGE.find((k) => k.key === key)?.label ?? key;
export const knowledgeLabels = (keys) => KNOWLEDGE.filter((k) => keys.includes(k.key)).map((k) => labelOf(k.key));

// "  @Follow-Up " → "follow-up". Same rule as normalise_handle on the server.
export const normaliseHandle = (raw) => raw.trim().replace(/^@/, '').trim().toLowerCase();

// While typing the name: lower case, runs of other characters become one '-' (design behaviour).
export const slugHandle = (raw) => normaliseHandle(raw).replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 30);

// ── server → UI ─────────────────────────────────────────────────────────────

export function toAgent(a) {
  return {
    id: a.id ?? null, kind: a.kind, handle: a.handle, description: a.description,
    instructions: a.instructions ?? '', guardrails: a.guardrails ?? '', knowledge: a.knowledge,
    version: a.version ?? null, rowVersion: a.row_version ?? null,
    chatCount: a.chat_count ?? 0, lastUsedAt: a.last_used_at ?? null,
  };
}

export function toAgentList(r) {
  const mine = r.mine.map(toAgent);
  return { mine, builtin: r.builtin.map(toAgent), limit: r.limit, atLimit: r.count >= r.limit };
}

// ── form ⇄ request ──────────────────────────────────────────────────────────

export const blankForm = () => ({ name: '', description: '', instructions: '', guardrails: DEFAULT_GUARDRAILS, knowledge: ['profile', 'applications'] });

export const agentToForm = (a) => ({ name: a.handle, description: a.description, instructions: a.instructions, guardrails: a.guardrails, knowledge: [...a.knowledge] });

export function formToRequest(form) {
  return {
    handle: normaliseHandle(form.name), description: form.description.trim(), instructions: form.instructions.trim(),
    guardrails: form.guardrails.trim(), knowledge: KNOWLEDGE.map((k) => k.key).filter((k) => form.knowledge.includes(k)),
  };
}

export const formToUpdate = (form, rowVersion) => ({ ...formToRequest(form), expected_version: rowVersion });

// Shown on the field it belongs to; never auto-fixed. {} = OK to save.
export function validateAgent(form) {
  const req = formToRequest(form);
  const errors = {};
  if (!req.handle) errors.name = 'Give it a name, e.g. interview-prep.';
  else if (!HANDLE_RE.test(req.handle)) errors.name = 'Lower case letters, digits and -, 2 to 30 characters.';
  if (!req.description) errors.description = 'Say in one line what it’s for.';
  else if (req.description.length > DESCRIPTION_MAX) errors.description = `Keep it under ${DESCRIPTION_MAX} characters.`;
  if (!req.instructions) errors.instructions = 'Tell it what to do.';
  else if (req.instructions.length > INSTRUCTIONS_MAX) errors.instructions = `Keep it under ${INSTRUCTIONS_MAX.toLocaleString('en-US')} characters.`;
  if (req.guardrails.length > GUARDRAILS_MAX) errors.guardrails = `Keep it under ${GUARDRAILS_MAX.toLocaleString('en-US')} characters.`;
  if (!req.knowledge.length) errors.knowledge = 'Pick at least one thing it can read.';
  return errors;
}

// An ApiError from save → the field it belongs to. Errors without a field return null (shown as a banner).
const FIELD_OF = { handle: 'name', description: 'description', instructions: 'instructions', guardrails: 'guardrails', knowledge: 'knowledge' };
export function fieldErrors(e) {
  if (e?.code === 'handle_taken' || e?.code === 'handle_reserved') return { name: e.message };
  if (e?.code === 'invalid_input' && Array.isArray(e.details?.fields)) {
    const out = {};
    for (const f of e.details.fields) {
      const field = FIELD_OF[f.loc?.find((part) => FIELD_OF[part])];
      if (field) out[field] = 'Check this field.';
    }
    return Object.keys(out).length ? out : null;
  }
  return null;
}
