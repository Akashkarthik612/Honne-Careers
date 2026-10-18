import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

// Template → Mode → Job description stepper at the top of the new-resume setup screens.
const STEPS = [
  { label: 'Template', to: '/new/template' },
  { label: 'Mode', to: '/new/mode' },
  { label: 'Job description', to: '/new/jd' },
];

const dot = { width: 24, height: 24, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 };

export default function SetupSteps({ current }) {
  return (
    <nav aria-label="Setup steps" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 600 }}>
      {STEPS.map((s, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <span key={s.label} style={{ display: 'contents' }}>
            {i > 0 && <span aria-hidden="true" style={{ width: 32, height: 1, background: i <= current ? 'var(--hc-brand)' : 'var(--hc-hairline)' }} />}
            {done ? (
              <Link to={s.to} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--hc-ink)', textDecoration: 'none' }}>
                <span style={{ ...dot, background: 'var(--hc-brand)', color: '#FFFFFF' }}><Check size={12} strokeWidth={3} aria-hidden="true" /></span>{s.label}
              </Link>
            ) : (
              <span aria-current={now ? 'step' : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: now ? 'var(--hc-brand)' : 'var(--hc-ink-muted)' }}>
                <span className="hc-mono" style={{ ...dot, border: `2px solid ${now ? 'var(--hc-brand)' : 'var(--hc-hairline)'}` }}>{i + 1}</span>{s.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
