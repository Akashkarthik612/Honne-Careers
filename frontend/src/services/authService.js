import { supabase } from './supabaseClient';

// Sign-in operations (AUTH-1). Beta: Google only; GitHub shows as "Coming soon".
// Every failure becomes an AuthError with a code the UI can branch on; nothing is retried here.

export const DEFAULT_NEXT = '/resumes';
const NEXT_KEY = 'honne-auth-next';
const CALLBACK_PATH = '/auth/callback';

export class AuthError extends Error {
  // code: 'oauth_start_failed' | 'oauth_denied' | 'callback_failed' | 'sign_out_failed'
  constructor(code, message, options) {
    super(message, options);
    this.name = 'AuthError';
    this.code = code;
  }
}

// Only same-site paths: '/x' yes; '//evil.com', '/\evil.com' and full URLs no (open-redirect guard).
export function safeNext(raw) {
  return typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')
    ? raw : DEFAULT_NEXT;
}

// Where to land after Google returns. Kept in sessionStorage, not in redirectTo, so the redirect URL
// matches Supabase's allowlist exactly (a mismatch makes Supabase redirect to the Site URL instead).
// Storage blocked → the user lands on DEFAULT_NEXT.
export function readNext() {
  try { return safeNext(window.sessionStorage.getItem(NEXT_KEY)); } catch { return DEFAULT_NEXT; }
}

export function clearNext() {
  try { window.sessionStorage.removeItem(NEXT_KEY); } catch { /* storage blocked: nothing was stored */ }
}

function rememberNext(next) {
  try { window.sessionStorage.setItem(NEXT_KEY, safeNext(next)); } catch { /* storage blocked: DEFAULT_NEXT */ }
}

// Leaves the page on success (browser goes to Google). Only returns if starting the redirect failed.
export async function signInWithGoogle(next) {
  rememberNext(next);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${CALLBACK_PATH}` },
  });
  if (error) throw new AuthError('oauth_start_failed', 'Couldn’t start Google sign-in. Try again.', { cause: error });
}

// On /auth/callback: the client has already exchanged the ?code= (detectSessionInUrl); getSession waits for it.
export async function completeSignIn(location = window.location) {
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (query.get('error') || hash.get('error')) {
    throw new AuthError('oauth_denied', 'Google sign-in was cancelled or didn’t complete. Try again.');
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new AuthError('callback_failed', 'Sign-in didn’t complete. Try again.', { cause: error });
  if (!data.session) throw new AuthError('callback_failed', 'Sign-in didn’t complete. Try again.');
  return data.session;
}

// scope 'global' revokes the session on Supabase; 'local' only forgets it in this browser
// (used after a 401 or account deletion, when the server-side session is already invalid).
export async function signOut({ scope = 'global' } = {}) {
  const { error } = await supabase.auth.signOut({ scope });
  if (error) throw new AuthError('sign_out_failed', 'Couldn’t sign out. Try again.', { cause: error });
}

// What the UI shows for a signed-in user. Google puts the name in full_name/name and the photo in avatar_url.
export function toAuthUser(user) {
  const meta = user.user_metadata ?? {};
  const email = user.email ?? '';
  return {
    id: user.id,
    email,
    name: meta.full_name || meta.name || email.split('@')[0],
    avatarUrl: meta.avatar_url || meta.picture || null,
    provider: user.app_metadata?.provider ?? null,
  };
}
