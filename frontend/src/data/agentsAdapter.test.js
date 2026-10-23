import { describe, expect, it } from 'vitest';
import { response } from '@/test/contracts';
import { ApiError } from '@/services/apiClient';
import {
  agentToForm, blankForm, fieldErrors, formToRequest, formToUpdate, knowledgeLabels, normaliseHandle, slugHandle, toAgent, toAgentList,
  validateAgent,
} from './agentsAdapter';

describe('server responses → UI (contracts/responses)', () => {
  it('maps the agents list: mine with usage, built-ins, the limit', () => {
    const list = toAgentList(response('agents.json'));
    expect(list.mine[0]).toMatchObject({ handle: 'follow-up', kind: 'user', version: 2, rowVersion: 3, chatCount: 3, knowledge: ['applications', 'profile'] });
    expect(list.builtin.map((a) => [a.handle, a.kind])).toEqual([['analyst', 'builtin']]);
    expect([list.limit, list.atLimit]).toEqual([10, false]);
    expect(knowledgeLabels(list.mine[0].knowledge)).toEqual(['Profile', 'Database']);
  });

  it('round-trips an agent through the form', () => {
    const agent = toAgent(response('agent.json'));
    const form = agentToForm(agent);
    expect(formToRequest(form)).toEqual({
      handle: 'follow-up', description: agent.description, instructions: agent.instructions, guardrails: 'Never mention salary.', knowledge: ['profile', 'applications'],
    });
    expect(formToUpdate(form, agent.rowVersion).expected_version).toBe(3);
  });
});

describe('handles', () => {
  it('normalises like the server and slugs while typing', () => {
    expect(normaliseHandle('  @Follow-Up ')).toBe('follow-up');
    expect(slugHandle('@Interview Prep!')).toBe('interview-prep-');
    expect(slugHandle('--x')).toBe('x');
  });
});

describe('validation', () => {
  it('starts with the Honne guardrails and two knowledge sources', () => {
    expect(blankForm().guardrails).toMatch(/^Never invent/);
    expect(blankForm().knowledge).toEqual(['profile', 'applications']);
  });

  it('flags each field it belongs to, never fixes it', () => {
    expect(validateAgent({ ...blankForm() })).toEqual({ name: expect.any(String), description: expect.any(String), instructions: expect.any(String) });
    expect(validateAgent({ ...blankForm(), name: 'a', description: 'd', instructions: 'i', knowledge: [] })).toEqual({ name: expect.stringMatching(/2 to 30/), knowledge: expect.any(String) });
    expect(validateAgent({ ...blankForm(), name: '@ok-name', description: 'd', instructions: 'i' })).toEqual({});
  });

  it('maps server errors onto fields', () => {
    expect(fieldErrors(new ApiError({ status: 409, code: 'handle_taken', message: 'Taken.' }))).toEqual({ name: 'Taken.' });
    expect(fieldErrors(new ApiError({ status: 422, code: 'invalid_input', message: 'x', details: { fields: [{ loc: ['body', 'instructions'], type: 'string_too_long' }] } })))
      .toEqual({ instructions: 'Check this field.' });
    expect(fieldErrors(new ApiError({ status: 409, code: 'agent_limit_reached', message: 'x' }))).toBeNull();
  });
});
