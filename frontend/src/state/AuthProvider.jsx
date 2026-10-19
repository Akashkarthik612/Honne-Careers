import { useEffect, useState } from 'react';
import { toAuthUser } from '@/services/authService';
import { supabase } from '@/services/supabaseClient';
import { AuthContext } from './auth';

// Mirrors the Supabase session into React. onAuthStateChange fires INITIAL_SESSION once the client has
// restored (or exchanged) the session, then SIGNED_IN / TOKEN_REFRESHED / SIGNED_OUT as they happen.
// The token itself stays inside supabase-js; screens only see the user.
export default function AuthProvider({ children }) {
  const [auth, setAuth] = useState({ status: 'checking', user: null });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session ? { status: 'authed', user: toAuthUser(session.user) } : { status: 'anon', user: null });
    });
    return () => subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
