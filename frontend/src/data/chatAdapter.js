// The one adapter between the API's chat shapes and the Chat screen (Day 3).
// A turn is a background job: the assistant message is 'running' (steps fill in live) until it is
// 'ok' (content, sources, drafts) or 'failed' (error_code, Retry). Answers are Markdown-lite:
// paragraphs, '-' lists, **bold** and [n] citations. Never HTML.

// ── server → UI ─────────────────────────────────────────────────────────────

export const toChatSummary = (c) => ({ id: c.id, title: c.title, turnCount: c.turn_count, lastMessageAt: c.last_message_at, running: Boolean(c.running) });

export function toMessage(m) {
  return {
    id: m.id, seq: m.seq, role: m.role, status: m.status, content: m.content,
    agent: m.agent, sources: m.sources, drafts: m.drafts, steps: m.steps,
    errorCode: m.error_code, createdAt: m.created_at,
  };
}

export function toChat(c) {
  return {
    ...toChatSummary(c), turnsMax: c.turns_max, longWarnTurns: c.long_warn_turns, deletesOn: c.deletes_on,
    messages: c.messages.map(toMessage),
  };
}

// 202 from a send/retry: the chat plus the two messages of this turn.
export const toStartedTurn = (r) => ({ chat: toChatSummary(r.chat), userMessage: toMessage(r.user_message), answer: toMessage(r.assistant_message) });

// Replaces (or appends) one message by id, keeping order by seq.
export function upsertMessage(messages, m) {
  const rest = messages.filter((x) => x.id !== m.id);
  return [...rest, m].sort((a, b) => a.seq - b.seq);
}

// ── what a failed turn says (error_code → copy). The user's message is always kept. ──
const FAILED = {
  llm_unavailable: 'Couldn’t reach the AI, try again.',
  llm_output_invalid: 'The agent’s answer didn’t come through, try again.',
  agent_tool_failed: 'Couldn’t read your data, try again.',
  stale_job: 'This answer stopped before it finished, try again.',
  agent_not_found: 'This agent was deleted. Pick another with @.',
};
export const failedText = (code) => FAILED[code] ?? 'Something went wrong, try again.';

// Steps under a running answer: the server's finished steps, then one live step for what's happening now.
export function stepsView(message) {
  const done = message.steps.map((s) => ({ label: s.label, state: 'done' }));
  if (message.status !== 'running') return done;
  return [...done, { label: done.length ? 'Writing the answer' : 'Reading your data', state: 'active' }];
}

// ── Markdown-lite ───────────────────────────────────────────────────────────

// Blocks: paragraphs (blank-line separated) and '-'/'*' lists. Anything else is plain text.
export function toBlocks(text) {
  const blocks = [];
  for (const chunk of text.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const lines = chunk.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    let para = [];
    let list = null;
    const flushPara = () => { if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = []; } };
    const flushList = () => { if (list) { blocks.push({ type: 'ul', items: list }); list = null; } };
    for (const line of lines) {
      const item = line.match(/^\s*[-*•]\s+(.*)$/);
      if (item) { flushPara(); (list ??= []).push(item[1]); } else { flushList(); para.push(line.trim()); }
    }
    flushPara();
    flushList();
  }
  return blocks;
}

// Inline parts: {text}, {bold}, {cite: n, source}. A [n] with no matching source stays plain text.
export function inlineParts(text, sources = []) {
  const byRef = new Map(sources.map((s) => [s.ref, s]));
  const parts = [];
  for (const piece of text.split(/(\*\*[^*]+\*\*|\[\d{1,3}\])/)) {
    if (!piece) continue;
    const bold = piece.match(/^\*\*([^*]+)\*\*$/);
    const cite = piece.match(/^\[(\d{1,3})\]$/);
    if (bold) parts.push({ bold: bold[1] });
    else if (cite && byRef.has(Number(cite[1]))) parts.push({ cite: Number(cite[1]), source: byRef.get(Number(cite[1])) });
    else parts.push({ text: piece });
  }
  return parts;
}

// Plain text for Copy and the Markdown export: drops ** and keeps [n].
export const plainText = (text) => text.replace(/\*\*([^*]+)\*\*/g, '$1');

// ── panels (design: Chat.dc.html, "Panel · table" and "Panel · doc") ────────

const daysSince = (ymd, today) => Math.max(0, Math.round((Date.parse(today) - Date.parse(ymd)) / 86400000));

// The rows an answer cited, for the Table panel and the "Rows used" card. Applications open the
// Database side panel; resumes open the CV; the profile opens Profile.
export function sourceRows(sources, today = new Date().toISOString().slice(0, 10)) {
  return sources.map((s) => {
    const base = { ref: s.ref, kind: s.kind, label: s.label };
    if (s.kind === 'application') {
      const m = s.meta ?? {};
      return { ...base, company: m.company ?? s.label, role: m.role ?? '', status: m.status ?? '', sent: m.sent ?? '', days: m.sent ? daysSince(m.sent, today) : null, to: `/database?open=${s.id}` };
    }
    if (s.kind === 'resume') return { ...base, company: s.meta?.company ?? '', role: s.meta?.role ?? '', to: `/cv/${s.id}` };
    return { ...base, to: '/profile' };
  });
}

export const sourcesSummary = (sources) => {
  const apps = sources.filter((s) => s.kind === 'application').length;
  const other = sources.length - apps;
  const parts = [];
  if (apps) parts.push(`${apps} application${apps === 1 ? '' : 's'}`);
  if (other) parts.push(`${other} other`);
  return parts.join(' · ');
};

export function draftsToMarkdown(drafts) {
  return drafts.map((d) => `**To:** ${d.to}\n**Subject:** ${d.subject || '—'}\n\n${d.body}`).join('\n\n---\n\n');
}

export function answerToMarkdown(message) {
  const sources = message.sources.map((s) => `[${s.ref}] ${s.label}`).join('\n');
  return [plainText(message.content), message.drafts.length ? draftsToMarkdown(message.drafts) : '', sources ? `Sources:\n${sources}` : '']
    .filter(Boolean).join('\n\n');
}

// ── composer: the @ picker ──────────────────────────────────────────────────

// "@fol" at the end of the draft → "fol"; no @ being typed → null.
export function mentionQuery(draft) {
  const m = draft.match(/(?:^|\s)@([a-z0-9-]*)$/i);
  return m ? m[1].toLowerCase() : null;
}

// Replaces the @query being typed with the picked handle (and a space).
export const insertMention = (draft, handle) => draft.replace(/@([a-z0-9-]*)$/i, `@${handle} `);

// "@follow-up draft it" → "follow-up" (the server reads the same mention; this drives the UI's chip).
export function leadingMention(text) {
  const m = text.match(/^\s*@([a-z0-9][a-z0-9-]{1,29})(?![a-z0-9-])/i);
  return m ? m[1].toLowerCase() : null;
}

// @cv-writer isn't a chat agent: it opens the tailor flow (design: HONNE AGENTS group).
export const CV_WRITER = { handle: 'cv-writer', description: 'Tailors your CV to a JD', kind: 'link', to: '/new/template' };

export function pickerGroups(agents, query) {
  const match = (a) => a.handle.startsWith(query ?? '');
  const builtin = [CV_WRITER, ...agents.builtin].filter(match);
  const mine = agents.mine.filter(match);
  return { builtin, mine, none: !builtin.length && !mine.length };
}

// Two-letter tile text for an agent ("follow-up" → "FU", "analyst" → "An").
export function agentInitials(handle) {
  const words = handle.split('-').filter(Boolean);
  return words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : handle.slice(0, 2).replace(/^./, (c) => c.toUpperCase());
}
