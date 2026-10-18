import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { HonneTile, Wordmark } from '@/components/HonneMark';

// Sign in, from the design's SignIn.dc.html. Auth isn't wired yet (AUTH-1: Google SSO, Microsoft SSO,
// email + password), so every path continues straight to the CV studio.

const st = {
  page: { position: 'relative', minHeight: '100vh', background: 'var(--hc-ground)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 16px', overflow: 'hidden' },
  glow: { position: 'absolute', left: '50%', top: -220, width: 760, height: 520, marginLeft: -380, borderRadius: 999, background: 'radial-gradient(closest-side, rgba(77,112,235,.16), rgba(77,112,235,0))' },
  card: { position: 'relative', width: '100%', maxWidth: 480, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 24, padding: 'clamp(28px,6vw,44px)', boxShadow: '0 1px 2px rgba(22,26,43,.05), 0 24px 60px rgba(22,26,43,.10)' },
  eyebrow: { marginTop: 34, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: '.16em', color: 'var(--hc-brand)' },
  h1: { margin: '12px 0 0', fontSize: 'clamp(28px,4vw,34px)', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.03em' },
  sub: { margin: '12px 0 0', fontSize: 16, lineHeight: 1.55, color: 'var(--hc-ink-muted)' },
  ssoIcon: { position: 'absolute', left: 20 },
  toggle: { width: '100%', minHeight: 48, background: 'none', border: 0, padding: '8px 4px', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: 'var(--hc-ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--hc-ink)' },
  submit: { minHeight: 52, borderRadius: 999, border: 0, background: 'var(--hc-brand)', color: '#FFFFFF', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 20px rgba(63,95,216,.25)' },
  legal: { margin: '24px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--hc-ink-muted)' },
  legalLink: { color: 'var(--hc-ink)', fontWeight: 600, textDecoration: 'none' },
};

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true" style={st.ssoIcon}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" aria-hidden="true" style={{ ...st.ssoIcon, left: 21 }}>
      <rect x="0" y="0" width="10" height="10" fill="#F25022" />
      <rect x="12" y="0" width="10" height="10" fill="#7FBA00" />
      <rect x="0" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

export default function SignInPage() {
  const navigate = useNavigate();
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const continueToStudio = () => navigate('/home');

  function handleSubmit(e) {
    e.preventDefault();
    continueToStudio();
  }

  return (
    <div style={st.page}>
      <div aria-hidden="true" style={st.glow} />
      <div className="hc-grid-bg" aria-hidden="true" style={{ position: 'absolute', inset: 0 }} />

      <main className="hc-rise-lg" style={st.card}>
        <Link to="/" aria-label="Honne Careers home" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--hc-ink)' }}>
          <HonneTile size={34} radius={10} mark={[22, 20]} />
          <Wordmark size={20} />
        </Link>

        <div className="hc-mono" style={st.eyebrow}>
          <span className="hc-dot" style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--hc-brand)', display: 'inline-block' }} />SIGN IN
        </div>
        <h1 className="hc-disp" style={st.h1}>Continue to Honne Careers</h1>
        <p style={st.sub}>Sign in, or create your account. The beta is free — no card required.</p>

        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button type="button" className="hc-sso" onClick={continueToStudio}><GoogleIcon />Continue with Google</button>
          <button type="button" className="hc-sso" onClick={continueToStudio}><MicrosoftIcon />Continue with Microsoft</button>
        </div>

        <div style={{ height: 1, background: 'var(--hc-hairline)', margin: '26px 0 6px' }} />

        <button type="button" aria-expanded={emailOpen} aria-controls="si-email-form" onClick={() => setEmailOpen((o) => !o)} style={st.toggle}>
          Use email and password
          <ChevronDown size={18} aria-hidden="true" style={{ transition: 'transform .25s ease', transform: `rotate(${emailOpen ? 180 : 0}deg)` }} />
        </button>

        {emailOpen && (
          <form id="si-email-form" onSubmit={handleSubmit} style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="si-email" style={st.label}>Email</label>
              <input id="si-email" className="hc-field" type="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <label htmlFor="si-pass" style={st.label}>Password</label>
                <a href="#forgot" style={{ fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Forgot password?</a>
              </div>
              <input id="si-pass" className="hc-field" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" style={st.submit}>Continue</button>
          </form>
        )}

        <p style={st.legal}>
          By continuing you agree to our <a href="#terms" style={st.legalLink}>Terms</a> and <a href="#privacy" style={st.legalLink}>Privacy Policy</a>.
        </p>
      </main>

      <div style={{ position: 'relative', width: '100%', maxWidth: 480, marginTop: 20, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Link to="/" style={{ color: 'var(--hc-ink-muted)', textDecoration: 'none', fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44 }}>
          <ArrowLeft size={16} aria-hidden="true" />Back to home
        </Link>
        <span className="hc-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.16em', color: 'var(--hc-ink-muted)' }}>ATS-SAFE · AGENT-POWERED</span>
      </div>
    </div>
  );
}
