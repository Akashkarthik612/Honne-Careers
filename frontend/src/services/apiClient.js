import { apiUrl } from './apiConfig';
import { signOut } from './authService';
import { supabase } from './supabaseClient';

// Every call to the Honne Careers API goes through apiRequest: it adds the user's Supabase token and a
// correlation id, and turns the backend's {"error": {code, message, correlation_id}} into an ApiError.
// No retries. A 401 forgets the local session, so RequireAuth sends the user back to /login.

export class ApiError extends Error {
  constructor({ status, code, message, correlationId = null }, options) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;          // 0 = the request never reached the API
    this.code = code;
    this.correlationId = correlationId;
  }
}

async function readError(res, correlationId) {
  let body = null;
  try { body = await res.json(); } catch { /* not JSON (e.g. a proxy error page): keep the status only */ }
  const err = body?.error;
  return new ApiError({
    status: res.status,
    code: err?.code ?? `http_${res.status}`,
    message: err?.message ?? 'Something went wrong. Try again.',
    correlationId: err?.correlation_id ?? res.headers.get('X-Correlation-Id') ?? correlationId,
  });
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError({ status: 401, code: 'not_signed_in', message: 'Sign in to continue.' });

  const correlationId = crypto.randomUUID();
  const headers = { Authorization: `Bearer ${token}`, 'X-Correlation-Id': correlationId };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(apiUrl(path), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (cause) {
    throw new ApiError({ status: 0, code: 'network', message: 'Can’t reach Honne Careers. Check your connection and try again.', correlationId }, { cause });
  }

  if (!res.ok) {
    const error = await readError(res, correlationId);
    if (res.status === 401) await signOut({ scope: 'local' });
    throw error;
  }
  return res.status === 204 ? null : res.json();
}

// GET /me: also creates the account row on a user's first request.
export const fetchMe = () => apiRequest('/me');
// DELETE /me: AUTH-3, removes files, the sign-in and every row.
export const deleteMe = () => apiRequest('/me', { method: 'DELETE' });
