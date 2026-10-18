import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { HonneTile, Wordmark } from '@/components/HonneMark';
import { GitHubIcon, GoogleIcon } from '@/components/BrandIcons';

// Sign in, from the design's SignIn.dc.html: Google or GitHub. Auth isn't wired yet (AUTH-1), so both
// continue straight to the resumes dashboard. Note AUTH-1 lists Microsoft and email + password, not GitHub.

const st = {
  page: { position: 'relative', minHeight: '100vh', background: 'var(--hc-ground)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 16px', overflow: 'hidden' },
  glow: { position: 'absolute', left: '50%', top: -220, width: 760, height: 520, marginLeft: -380, borderRadius: 999, background: 'radial-gradient(closest-side, rgba(77,112,235,.16), rgba(77,112,235,0))' },
  card: { position: 'relative', width: '100%', maxWidth: 480, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 24, padding: 'clamp(28px,6vw,44px)', boxShadow: '0 1px 2px rgba(22,26,43,.05), 0 24px 60px rgba(22,26,43,.10)' },
  eyebrow: { marginTop: 30, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: '.16em', color: 'var(--hc-brand)' },
  h1: { margin: '12px 0 0', fontSize: 'clamp(28px,4vw,34px)', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.03em' },
  sub: { margin: '12px 0 0', fontSize: 16, lineHeight: 1.55, color: 'var(--hc-ink-muted)' },
  ssoIcon: { position: 'absolute', left: 20 },
  legal: { margin: '26px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--hc-ink-muted)' },
  legalLink: { color: 'var(--hc-ink)', fontWeight: 600, textDecoration: 'none' },
};

export default function SignInPage() {
  return (
    <div style={st.page}>
      <div aria-hidden="true" style={st.glow} />
      <div className="hc-grid-bg" aria-hidden="true" style={{ position: 'absolute', inset: 0 }} />

      <main className="hc-rise-lg" style={st.card}>
        <Link to="/" aria-label="Honne Careers home" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--hc-ink)', minHeight: 44 }}>
          <HonneTile size={34} radius={10} mark={[22, 20]} />
          <Wordmark size={20} />
        </Link>

        <div className="hc-mono" style={st.eyebrow}>
          <span className="hc-dot" style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--hc-brand)', display: 'inline-block' }} />SIGN IN
        </div>
        <h1 className="hc-disp" style={st.h1}>Continue to Honne Careers</h1>
        <p style={st.sub}>Sign in, or create your account. The beta is free — no card required.</p>

        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link className="hc-sso" to="/resumes"><GoogleIcon style={st.ssoIcon} />Continue with Google</Link>
          <Link className="hc-sso" to="/resumes"><GitHubIcon style={st.ssoIcon} />Continue with GitHub</Link>
        </div>

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
