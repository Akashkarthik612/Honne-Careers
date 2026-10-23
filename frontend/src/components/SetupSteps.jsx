import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

// Template → Mode → Job description stepper at the top of the new-resume setup screens.
// jdFromHome: the JD came from Home, so Mode shows as skipped and the JD step counts as done
// (design: TemplatePicker.dc.html, withJd).
const STEPS = [
  { label: 'Template', to: '/new/template' },
  { label: 'Mode', to: '/new/mode' },
  { label: 'Job description', to: '/new/jd' },
];
const MODE = 1;
const JD = 2;

const dot = { width: 24, height: 24, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 };
const doneDot = (bg) => <span style={{ ...dot, background: bg, color: '#FFFFFF' }}><Check size={12} strokeWidth={3} aria-hidden="true" /></span>;

export default function SetupSteps({ current, jdFromHome = false }) {
  return (
    <nav aria-label="Setup steps" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 600 }}>
      {STEPS.map((s, i) => {
        const skipped = jdFromHome && i === MODE;
        const carried = jdFromHome && i === JD && current < JD;
        const done = i < current && !skipped;
        const now = i === current;
        let step;
        if (skipped) {
          step = (
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--hc-ink-muted)', textDecoration: 'line-through' }}>
                <span className="hc-mono" style={{ ...dot, border: '2px dashed #C9CCD8' }}>{i + 1}</span>{s.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--hc-ink-muted)', background: '#F3F4F8', borderRadius: 999, padding: '2px 8px' }}>Skipped · tailoring</span>
            </>
          );
        } else if (carried) {
          step = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--hc-success)' }}>{doneDot('var(--hc-success)')}{s.label}</span>;
        } else if (done) {
          step = <Link to={s.to} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--hc-ink)', textDecoration: 'none' }}>{doneDot('var(--hc-brand)')}{s.label}</Link>;
        } else {
          step = (
            <span aria-current={now ? 'step' : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: now ? 'var(--hc-brand)' : 'var(--hc-ink-muted)' }}>
              <span className="hc-mono" style={{ ...dot, border: `2px solid ${now ? 'var(--hc-brand)' : 'var(--hc-hairline)'}` }}>{i + 1}</span>{s.label}
            </span>
          );
        }
        return (
          <span key={s.label} style={{ display: 'contents' }}>
            {i > 0 && <span aria-hidden="true" style={{ width: 32, height: 1, background: i <= current ? 'var(--hc-brand)' : 'var(--hc-hairline)' }} />}
            {step}
          </span>
        );
      })}
    </nav>
  );
}
