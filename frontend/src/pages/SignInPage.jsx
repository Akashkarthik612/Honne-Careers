import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { authText } from '@/components/authStyles';
import { GitHubIcon, GoogleIcon } from '@/components/BrandIcons';
import { safeNext, signInWithGoogle } from '@/services/authService';
import { useAuth } from '@/state/auth';

// Sign in / sign up (AUTH-1): a user's first Google sign-in creates the account.
// Beta: Google only. GitHub is shown as "Coming soon"; Microsoft and email + password are later.

const ssoIcon = { position: 'absolute', left: 20 };

export default function SignInPage() {
  const { status } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (status === 'authed') return <Navigate to={next} replace />;

  async function google() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle(next); // on success the browser leaves for Google
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  const footer = (
    <div style={{ position: 'relative', width: '100%', maxWidth: 480, marginTop: 20, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <Link to="/" style={{ color: 'var(--hc-ink-muted)', textDecoration: 'none', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44 }}>
        <ArrowLeft size={16} aria-hidden="true" />Back to home
      </Link>
      <span className="hc-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.16em', color: 'var(--hc-ink-muted)' }}>ATS-SAFE · AGENT-POWERED</span>
    </div>
  );

  return (
    <AuthLayout eyebrow="SIGN IN" footer={footer}>
      <h1 className="hc-disp" style={authText.h1}>Continue to Honne Careers</h1>
      <p style={authText.sub}>Sign in, or create your account. The beta is free — no card required.</p>

      {error && <p role="alert" style={authText.error}>{error}</p>}

      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button type="button" className="hc-sso" onClick={google} disabled={busy || status === 'checking'} aria-busy={busy}>
          <GoogleIcon style={ssoIcon} />{busy ? 'Opening Google…' : 'Continue with Google'}
        </button>
        <span className="hc-sso" aria-disabled="true" title="GitHub sign-in is coming soon">
          <GitHubIcon style={ssoIcon} />GitHub
          <span className="hc-soon" style={{ marginLeft: 10 }}>COMING SOON</span>
        </span>
      </div>

      <p style={{ margin: '26px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--hc-ink-muted)' }}>
        By continuing you agree to our <a href="#terms" style={{ color: 'var(--hc-ink)', fontWeight: 600, textDecoration: 'none' }}>Terms</a> and <a href="#privacy" style={{ color: 'var(--hc-ink)', fontWeight: 600, textDecoration: 'none' }}>Privacy Policy</a>.
      </p>
    </AuthLayout>
  );
}
