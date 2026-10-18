import { useCallback, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { hasProfile, toDoc } from '@/data/cvModel';
import { SAMPLE_TAILORED } from '@/data/sampleCv';
import useTailorJob, { TAILOR_STEPS } from '@/hooks/useTailorJob';
import { useAppStore } from '@/state/appStore';

// Tailoring progress for a returning user (design: Tailoring.dc.html). The job tailors every bullet of the
// saved profile; the result is saved as a ready resume that opens on the "Your CV is ready" screen.

function Spinner() {
  return (
    <svg className="hc-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flex: 'none' }}>
      <circle cx="12" cy="12" r="9" stroke="#E4E6EE" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="#3F5FD8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function StepRow({ label, state }) {
  const style = {
    display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 12, fontSize: 15, fontWeight: 600,
    ...(state === 'active' ? { background: '#EEF1FD', color: 'var(--hc-ink)' }
      : state === 'done' ? { background: '#FFFFFF', color: 'var(--hc-ink)', border: '1px solid var(--hc-hairline)' }
        : { background: '#FFFFFF', color: 'var(--hc-ink-muted)', border: '1px solid #F0F1F5' }),
  };
  return (
    <div style={style}>
      {state === 'done' && <span style={{ flex: 'none', width: 24, height: 24, borderRadius: 99, background: 'var(--hc-success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} strokeWidth={3} color="#FFFFFF" aria-hidden="true" /></span>}
      {state === 'active' && <Spinner />}
      {state === 'pending' && <span style={{ flex: 'none', width: 24, height: 24, borderRadius: 99, border: '2px solid var(--hc-hairline)', display: 'inline-block' }} />}
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
    </div>
  );
}

const SKELETON = [['46%', 14, '0 auto'], ['80%', 7, '0 auto 10px'], ['28%'], ['100%'], ['92%'], ['84%'], ['28%', 9, '10px 0 0'], ['90%'], ['76%'], ['28%', 9, '10px 0 0'], ['66%'], ['28%', 9, '10px 0 0'], ['72%']];

export default function TailoringPage() {
  const { profile, draft, addResume } = useAppStore();
  const [resumeId, setResumeId] = useState(null);
  const created = useRef(null);

  const onDone = useCallback(() => {
    if (created.current) { setResumeId(created.current); return; } // Replay doesn't save a second copy.
    const tailored = Object.fromEntries(Object.entries(SAMPLE_TAILORED).filter(([id]) => profile.roles.concat(profile.projects).some((e) => e.bullets.some((b) => b.id === id))));
    const id = addResume({ role: draft.role, company: draft.company, mode: 'jd', status: 'ready', template: draft.template, jd: draft.jd, doc: toDoc(profile, tailored), addedSkills: [] });
    created.current = id;
    setResumeId(id);
  }, [profile, draft, addResume]);

  const job = useTailorJob(onDone);

  if (!hasProfile(profile)) return <Navigate to="/new/jd" replace />; // TAIL-2
  const meta = [draft.role, draft.company].filter(Boolean).join(' · ');

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 72px' }}>
      {meta && <div className="hc-lbl">{meta}</div>}
      <h1 className="hc-disp" style={{ margin: '6px 0 0', fontSize: 'clamp(28px,3.2vw,40px)', lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.035em' }}>
        {job.done ? 'Your CV is ready.' : 'Tailoring your CV…'}
      </h1>
      <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--hc-ink-muted)' }}>Using your saved profile. This usually takes under a minute.</p>

      <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
        <div className="hc-card" role="status" aria-live="polite" style={{ flex: '1 1 360px', minWidth: 0, padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TAILOR_STEPS.map((label, i) => <StepRow key={label} label={label} state={i < job.step ? 'done' : i === job.step ? 'active' : 'pending'} />)}
          <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--hc-ink-muted)' }}>Every rewritten bullet is checked against what you wrote. If something can’t be tailored without inventing, we leave it as it is and tell you.</p>
          {job.done && resumeId ? (
            <div className="hc-rise" style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <Link className="hc-btn-p is-lg" to={`/cv/${resumeId}`}>See your CV<ArrowRight size={16} aria-hidden="true" /></Link>
              <button type="button" className="hc-btn-t" onClick={job.restart}>Replay</button>
            </div>
          ) : (
            <Link className="hc-back" to="/new/jd" style={{ marginTop: 4 }}>Cancel</Link>
          )}
        </div>

        <div aria-hidden="true" style={{ flex: '1 1 380px', minWidth: 0, background: '#EEF0F5', borderRadius: 20, padding: 20 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 6, padding: '26px 24px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 440, boxShadow: '0 12px 30px rgba(22,26,43,.08)' }}>
            {SKELETON.map(([w, h = 9, m], i) => <div key={i} className="hc-sk" style={{ width: w, height: h, margin: m }} />)}
          </div>
        </div>
      </div>
    </main>
  );
}
