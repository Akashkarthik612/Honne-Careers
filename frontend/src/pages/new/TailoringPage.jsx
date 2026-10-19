import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { ErrorBanner } from '@/components/Status';
import useTailorJob, { TAILOR_STEPS } from '@/hooks/useTailorJob';
import { startTailor } from '@/services/api';

// Tailoring progress (design: Tailoring.dc.html). POST /resumes/{id}/tailor started the job (202); this
// screen polls GET /resumes/{id} and shows the step the backend reports (TAIL-3, resumes.job_step).
// Polling is bounded (config/limits.js). On failure the resume's content is untouched; Retry starts a new
// job. The result opens on the "Your CV is ready" screen.

// What a failed job's error_code means to the user. Codes come from app/core/errors.py and B9.
const FAILURE = {
  truth_violation: 'We couldn’t tailor this without adding things you didn’t write. Your CV is unchanged.',
  llm_unavailable: 'Couldn’t reach the AI. Your CV is unchanged — try again.',
  llm_output_invalid: 'The AI sent back something we couldn’t use. Your CV is unchanged — try again.',
  stale_job: 'Tailoring took too long and was stopped. Your CV is unchanged — try again.',
  quota_exceeded: 'Daily limit reached, try tomorrow.',
};

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
  const { id } = useParams();
  const job = useTailorJob(id);
  const [retryError, setRetryError] = useState(null);
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    setRetryError(null);
    try {
      await startTailor(id, 'all');
      job.restart();
    } catch (e) {
      setRetryError(e);
    } finally {
      setRetrying(false);
    }
  }

  const done = job.phase === 'ready';
  const jd = job.resume?.jd;
  const meta = [jd?.role, jd?.company].filter(Boolean).join(' · ');
  const failure = job.phase === 'failed' ? (FAILURE[job.resume?.errorCode] ?? 'Tailoring didn’t finish. Your CV is unchanged — try again.') : null;

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 72px' }}>
      {meta && <div className="hc-lbl">{meta}</div>}
      <h1 className="hc-disp" style={{ margin: '6px 0 0', fontSize: 'clamp(28px,3.2vw,40px)', lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.035em' }}>
        {done ? 'Your CV is ready.' : failure ? 'Tailoring didn’t finish.' : 'Tailoring your CV…'}
      </h1>
      <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--hc-ink-muted)' }}>Using your saved profile. This usually takes under a minute.</p>

      <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
        <div className="hc-card" role="status" aria-live="polite" style={{ flex: '1 1 360px', minWidth: 0, padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TAILOR_STEPS.map(([key, label], i) => <StepRow key={key} label={label} state={i < job.step ? 'done' : i === job.step && job.phase === 'polling' ? 'active' : 'pending'} />)}
          <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--hc-ink-muted)' }}>Every rewritten bullet is checked against what you wrote. If something can’t be tailored without inventing, we leave it as it is and tell you.</p>
          {done && (
            <div className="hc-rise" style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <Link className="hc-btn-p is-lg" to={`/cv/${id}`}>See your CV<ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          )}
          {failure && <ErrorBanner error={failure} action={{ label: retrying ? 'Starting…' : 'Try again', onClick: retry }} />}
          {job.phase === 'timeout' && <ErrorBanner error="This is taking longer than usual. Your CV is safe — check again in a moment." action={{ label: 'Check again', onClick: job.restart }} />}
          {job.phase === 'error' && <ErrorBanner error={job.error} action={{ label: 'Check again', onClick: job.restart }} />}
          <ErrorBanner error={retryError} />
          {!done && <Link className="hc-back" to="/resumes" style={{ marginTop: 4 }}>Back to resumes — tailoring carries on</Link>}
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
