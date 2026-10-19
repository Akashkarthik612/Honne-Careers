import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '@/components/AuthLayout';
import { authText } from '@/components/authStyles';
import useSignOut from '@/hooks/useSignOut';
import { fetchMe } from '@/services/api';
import { clearNext, completeSignIn, readNext } from '@/services/authService';

// Google redirects here (Supabase redirect URL: <origin>/auth/callback). Two steps, each failing loudly:
//   1. session: supabase-js exchanged the one-time code. A code works once, so the only way out is a new sign-in.
//   2. GET /me: proves the backend accepts the token and creates the account row. Safe to retry; the user
//      is signed in to Supabase by now, so the other way out is signing out (not "back to sign in").
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const signOut = useSignOut();
  const [failure, setFailure] = useState(null); // { step: 'session' | 'account', message, ref }
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await completeSignIn();
      } catch (e) {
        if (!cancelled) setFailure({ step: 'session', message: e.message, ref: null });
        return;
      }
      try {
        await fetchMe();
      } catch (e) {
        if (!cancelled) setFailure({ step: 'account', message: e.message, ref: e.correlationId ?? null });
        return;
      }
      if (cancelled) return;
      const next = readNext();
      clearNext();
      navigate(next, { replace: true });
    })();
    return () => { cancelled = true; };
  }, [attempt, navigate]);

  if (!failure) {
    return (
      <AuthLayout eyebrow="SIGNING IN">
        <h1 className="hc-disp" style={authText.h1}>Signing you in…</h1>
        <p role="status" style={authText.sub}>Setting up your account. This takes a second.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow="SIGN-IN PROBLEM">
      <h1 className="hc-disp" style={authText.h1}>We couldn’t sign you in</h1>
      <p role="alert" style={authText.error}>
        {failure.message}
        {failure.ref && <><br /><span className="hc-mono" style={{ fontSize: 12 }}>Ref: {failure.ref}</span></>}
      </p>
      {signOut.error && <p role="alert" style={authText.error}>{signOut.error}</p>}
      <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {failure.step === 'account' ? (
          <>
            <button type="button" className="hc-btn-p" onClick={() => { setFailure(null); setAttempt((n) => n + 1); }}>Try again</button>
            <button type="button" className="hc-btn-s" onClick={signOut.signOut} disabled={signOut.busy}>Sign out</button>
          </>
        ) : (
          <Link className="hc-btn-p" to="/login" replace>Back to sign in</Link>
        )}
      </div>
    </AuthLayout>
  );
}
