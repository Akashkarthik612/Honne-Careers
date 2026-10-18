import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, PenLine, Sparkles } from 'lucide-react';
import PageTitle from '@/components/PageTitle';
import SetupSteps from '@/components/SetupSteps';
import { useAppStore } from '@/state/appStore';

// Step 2 of new-resume setup (design: ModeChoice.dc.html): tailor to a JD, or build from scratch.

const pill = (bg, color) => ({ fontSize: 12, fontWeight: 700, color, background: bg, borderRadius: 999, padding: '5px 10px' });
const iconWell = (bg) => ({ width: 52, height: 52, borderRadius: 16, background: bg, color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' });

function Option({ to, onPick, icon, badges, title, blurb, points, cta, tone, highlight }) {
  return (
    <Link className="hc-opt" to={to} onClick={onPick} style={highlight ? { borderColor: '#C9D3F7' } : undefined}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span aria-hidden="true" style={iconWell(tone)}>{icon}</span>
        {badges && <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{badges}</span>}
      </div>
      <div>
        <h2 className="hc-disp" style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</h2>
        <p style={{ margin: '8px 0 0', fontSize: 15.5, lineHeight: 1.55, color: 'var(--hc-ink-muted)' }}>{blurb}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {points.map((p) => (
          <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5 }}>
            <Check size={16} strokeWidth={2.6} color={tone} aria-hidden="true" />{p}
          </span>
        ))}
      </div>
      <span style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: tone }}>
        {cta}<ArrowRight size={16} aria-hidden="true" />
      </span>
    </Link>
  );
}

export default function ModePage() {
  const { setDraft } = useAppStore();

  return (
    <main className="hc-wrap">
      <SetupSteps current={1} />
      <PageTitle before="How do you want to" accent="start?" style={{ marginTop: 24 }} />
      <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--hc-ink-muted)' }}>Both end with the same ATS-safe PDF.</p>

      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        <Option
          to="/new/jd" onPick={() => setDraft({ mode: 'jd' })} highlight tone="#3F5FD8"
          icon={<Sparkles size={24} />}
          badges={<><span style={pill('var(--hc-brand-tint)', 'var(--hc-brand-hover)')}>Recommended</span><span style={pill('#E8F5EC', 'var(--hc-success)')}>Free during beta</span></>}
          title="Tailor to a job description"
          blurb="Paste a JD. We match your real experience to it — nothing invented."
          points={['Bullets rewritten for this role, one by one', 'You see every change and keep or revert it', 'Only uses what you wrote']}
          cta="Paste a job description"
        />
        <Option
          to="/new/details" onPick={() => setDraft({ mode: 'scratch', jd: '', company: '', role: '' })} tone="#161A2B"
          icon={<PenLine size={24} />}
          title="Build from scratch"
          blurb="Fill in your details step by step. Tailor later if you want."
          points={['Five short steps', 'Live preview as you type', 'Saved to your profile for next time']}
          cta="Start building"
        />
      </div>

      <div style={{ marginTop: 24 }}>
        <Link className="hc-back" to="/new/template"><ArrowLeft size={16} aria-hidden="true" />Back to templates</Link>
      </div>
    </main>
  );
}
