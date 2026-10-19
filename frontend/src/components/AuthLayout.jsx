import { Link } from 'react-router-dom';
import { HonneTile, Wordmark } from '@/components/HonneMark';

// The centred card on a soft grid (design: SignIn.dc.html), shared by /login and /auth/callback.

const st = {
  page: { position: 'relative', minHeight: '100vh', background: 'var(--hc-ground)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 16px', overflow: 'hidden' },
  glow: { position: 'absolute', left: '50%', top: -220, width: 760, height: 520, marginLeft: -380, borderRadius: 999, background: 'radial-gradient(closest-side, rgba(77,112,235,.16), rgba(77,112,235,0))' },
  card: { position: 'relative', width: '100%', maxWidth: 480, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 24, padding: 'clamp(28px,6vw,44px)', boxShadow: '0 1px 2px rgba(22,26,43,.05), 0 24px 60px rgba(22,26,43,.10)' },
  eyebrow: { marginTop: 30, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: '.16em', color: 'var(--hc-brand)' },
};

export default function AuthLayout({ eyebrow, children, footer }) {
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
          <span className="hc-dot" style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--hc-brand)', display: 'inline-block' }} />{eyebrow}
        </div>
        {children}
      </main>

      {footer}
    </div>
  );
}
