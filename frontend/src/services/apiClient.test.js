import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, errorText } from './apiClient';
import { signOut } from './authService';

vi.mock('./supabaseClient', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })) } },
}));
vi.mock('./authService', () => ({ signOut: vi.fn(async () => {}) }));

const reply = (status, body, headers = {}) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('apiRequest', () => {
  it('sends the token, a correlation id and JSON', async () => {
    fetch.mockResolvedValueOnce(reply(200, { ok: true }));
    await expect(apiRequest('/resumes', { method: 'POST', body: { a: 1 } })).resolves.toEqual({ ok: true });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/api/resumes');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.headers['X-Correlation-Id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });

  it('sends FormData as is and lets the browser set the multipart boundary', async () => {
    fetch.mockResolvedValueOnce(reply(201, { upload_id: 'u' }));
    const form = new FormData();
    await apiRequest('/uploads', { method: 'POST', form });
    const [, init] = fetch.mock.calls[0];
    expect(init.body).toBe(form);
    expect(init.headers['Content-Type']).toBeUndefined();
  });

  it('turns the backend error body into an ApiError with code, details and reference', async () => {
    fetch.mockResolvedValueOnce(reply(422, { error: { code: 'truth_violation', message: 'We couldn’t tailor this.', correlation_id: 'cid-1', details: { rules: ['unknown_number'] } } }));
    const err = await apiRequest('/x').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 422, code: 'truth_violation', correlationId: 'cid-1', details: { rules: ['unknown_number'] } });
    expect(errorText(err)).toBe('We couldn’t tailor this. (Ref: cid-1)');
  });

  it('forgets the session on 401', async () => {
    fetch.mockResolvedValueOnce(reply(401, { error: { code: 'unauthorized', message: 'Please sign in again.' } }));
    await expect(apiRequest('/me')).rejects.toMatchObject({ status: 401 });
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('reports a network failure as status 0, without retrying', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(apiRequest('/me')).rejects.toMatchObject({ status: 0, code: 'network' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the status when the error body is not JSON', async () => {
    fetch.mockResolvedValueOnce(new Response('<html>bad gateway</html>', { status: 502 }));
    await expect(apiRequest('/me')).rejects.toMatchObject({ status: 502, code: 'http_502' });
  });

  it('returns null for 204', async () => {
    fetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiRequest('/resumes/1', { method: 'DELETE' })).resolves.toBeNull();
  });
});
