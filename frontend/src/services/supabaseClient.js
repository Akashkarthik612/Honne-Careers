import { createClient } from '@supabase/supabase-js';

// The one browser client for Supabase Auth (AUTH-1). PKCE: Google redirects back with a one-time code
// that the client exchanges on load, so tokens never appear in the URL.
// Missing config stops the app at load: no placeholder client, no silent fallback (guardrails §3).

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set (see frontend/.env.example)');
}

export const supabase = createClient(url, anonKey, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
