import { apiUrl } from './apiConfig';
import { signOut } from './authService';
import { supabase } from './supabaseClient';

// Every call to the Honne Careers API goes through apiRequest: it adds the user's Supabase token and a
// correlation id, and turns the backend's {"error": {code, message, correlation_id}} into an ApiError.
// No retries. A 401 forgets the local session, so RequireAuth sends the user back to /login.
// The backend's messages are written for users (B9), so screens show `message` as is.

export class ApiError extends Error {
  constructor({ status, code, message, correlationId = null, details = null }, options) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;          // 0 = the request never reached the API
    this.code = code;
    this.correlationId = correlationId;
    this.details = details;        // safe metadata only: rules, reason, current_version, fields
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
    details: err?.details ?? null,
  });
}

// `body` is sent as JSON; `form` (FormData, for file uploads) is sent as multipart and lets the
// browser set its own Content-Type boundary.
export async function apiRequest(path, { method = 'GET', body, form } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError({ status: 401, code: 'not_signed_in', message: 'Sign in to continue.' });

  const correlationId = crypto.randomUUID();
  const headers = { Authorization: `Bearer ${token}`, 'X-Correlation-Id': correlationId };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const payload = form ?? (body === undefined ? undefined : JSON.stringify(body));

  let res;
  try {
    res = await fetch(apiUrl(path), { method, headers, body: payload });
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

// What a screen shows for a failed call: the backend's message plus the reference to quote to support.
export function errorText(e) {
  if (!(e instanceof ApiError)) return 'Something went wrong. Try again.';
  return e.correlationId ? `${e.message} (Ref: ${e.correlationId})` : e.message;
}
