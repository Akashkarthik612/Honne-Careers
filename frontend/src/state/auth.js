import { createContext, useContext } from 'react';

// Who is signed in. status: 'checking' (Supabase restoring the session) | 'authed' | 'anon'.
// user: { id, email, name, avatarUrl, provider } from authService.toAuthUser, or null.

export const AuthContext = createContext(null);

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}
