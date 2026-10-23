import { describe, expect, it } from 'vitest';
import { response } from '@/test/contracts';
import {
  agentInitials, answerToMarkdown, failedText, inlineParts, insertMention, leadingMention, mentionQuery, pickerGroups, sourceRows,
  sourcesSummary, stepsView, toBlocks, toChat, toChatSummary, toMessage, toStartedTurn, upsertMessage,
} from './chatAdapter';
import { toAgentList } from './agentsAdapter';

describe('server responses → UI (contracts/responses)', () => {
  it('maps a chat with its messages, limits and retention', () => {
    const chat = toChat(response('chat.json'));
    expect(chat).toMatchObject({ title: 'Follow-ups this week', turnCount: 1, turnsMax: 25, longWarnTurns: 20, running: false, deletesOn: '2026-11-08' });
    expect(chat.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    const answer = chat.messages[1];
    expect(answer.agent).toEqual({ handle: 'follow-up', kind: 'user' });
    expect(answer.sources[0]).toMatchObject({ ref: 1, kind: 'application', label: 'Freshworks · SDE-2 Backend' });
    expect(answer.drafts[0].to).toBe('Recruiting team, Freshworks');
  });

  it('maps a started turn: the answer is running with its first live step', () => {
    const turn = toStartedTurn(response('chat_turn.json'));
    expect(turn.chat.running).toBe(true);
    expect(turn.answer.status).toBe('running');
    expect(stepsView(turn.answer)).toEqual([
      { label: 'Read your Database · 6 applications', state: 'done' }, { label: 'Writing the answer', state: 'active' }]);
  });

  it('maps a failed turn to its copy', () => {
    const m = toMessage(response('chat_message_failed.json'));
    expect([m.status, failedText(m.errorCode)]).toEqual(['failed', 'Couldn’t reach the AI, try again.']);
    expect(failedText('stale_job')).toMatch(/stopped/);
  });

  it('maps the recent-chats list', () => {
    const items = response('chats.json').items.map(toChatSummary);
    expect(items.map((c) => [c.title, c.running])).toEqual([['Follow-ups this week', true], ['Referral ask', false]]);
  });
});

describe('Markdown-lite answers', () => {
  const sources = response('chat.json').messages[1].sources;

  it('splits paragraphs and lists', () => {
    expect(toBlocks('First line\nsame para\n\n- one\n- two **bold**\n\nEnd')).toEqual([
      { type: 'p', text: 'First line same para' }, { type: 'ul', items: ['one', 'two **bold**'] }, { type: 'p', text: 'End' }]);
  });

  it('turns [n] into a citation only when that source exists, and **x** into bold', () => {
    expect(inlineParts('Freshworks [1] and ghost [9], **now**.', sources)).toEqual([
      { text: 'Freshworks ' }, { cite: 1, source: sources[0] }, { text: ' and ghost ' }, { text: '[9]' }, { text: ', ' }, { bold: 'now' }, { text: '.' }]);
  });

  it('never produces HTML: tags stay text', () => {
    expect(inlineParts('<img src=x onerror=alert(1)>')).toEqual([{ text: '<img src=x onerror=alert(1)>' }]);
  });

  it('exports an answer as Markdown with drafts and sources', () => {
    const md = answerToMarkdown(toChat(response('chat.json')).messages[1]);
    expect(md).toContain('**To:** Recruiting team, Freshworks');
    expect(md).toContain('[1] Freshworks · SDE-2 Backend');
  });
});

describe('sources', () => {
  it('links applications to the Database panel with days since sent', () => {
    const [row] = sourceRows(response('chat.json').messages[1].sources, '2026-10-22');
    expect(row).toMatchObject({ company: 'Freshworks', role: 'SDE-2 Backend', status: 'applied', sent: '2026-10-08', days: 14 });
    expect(row.to).toBe('/database?open=33333333-3333-4333-8333-333333333333');
    expect(sourcesSummary([...response('chat.json').messages[1].sources, { ref: 2, kind: 'profile', id: 'profile', label: 'Your profile' }])).toBe('1 application · 1 other');
  });
});

describe('composer', () => {
  const agents = toAgentList(response('agents.json'));

  it('finds the @ being typed and inserts the pick', () => {
    expect(mentionQuery('hi @fol')).toBe('fol');
    expect(mentionQuery('@')).toBe('');
    expect(mentionQuery('mail@x.com')).toBeNull();
    expect(insertMention('ask @fol', 'follow-up')).toBe('ask @follow-up ');
    expect(leadingMention('@Follow-Up draft it')).toBe('follow-up');
    expect(leadingMention('draft @follow-up')).toBeNull();
  });

  it('groups the picker: Honne agents (with @cv-writer) and yours', () => {
    expect(pickerGroups(agents, '').builtin.map((a) => a.handle)).toEqual(['cv-writer', 'analyst']);
    expect(pickerGroups(agents, 'fo').mine.map((a) => a.handle)).toEqual(['follow-up']);
    expect(pickerGroups(agents, 'zz').none).toBe(true);
    expect([agentInitials('follow-up'), agentInitials('analyst')]).toEqual(['FU', 'An']);
  });

  it('keeps messages ordered when one is replaced', () => {
    const a = { id: 'a', seq: 1 }; const b = { id: 'b', seq: 2, status: 'running' };
    expect(upsertMessage([a, b], { id: 'b', seq: 2, status: 'ok' })).toEqual([a, { id: 'b', seq: 2, status: 'ok' }]);
  });
});
