import { useState } from 'react';
import { LineChart } from 'lucide-react';
import { ErrorBanner } from '@/components/Status';
import { toAnalysis } from '@/data/cvAdapter';
import { runAnalysis } from '@/services/api';

// "How this CV fits the job": the three P1 analyses (ANA-1…3), run on demand with
// POST /resumes/{id}/analysis. The model judges, Python computes the percentages, and every score comes
// with its evidence (ANA-4). The same content again returns the stored result (0 LLM calls).

const LEVEL_COLOR = { Strong: 'var(--hc-success)', Yes: 'var(--hc-success)', Partial: '#B45309', None: 'var(--hc-warm)' };
const REASON = {
  no_skills_in_jd: 'We found no skills or tools named in this JD, so there’s nothing to match.',
  no_requirements_in_jd: 'We found no clear requirements in this JD to compare against.',
};

function ScoreRing({ value, color, label }) {
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`${label} score ${value}%`} style={{ flex: 'none' }}>
      <circle cx="42" cy="42" r="34" fill="none" stroke="#EEF0F5" strokeWidth="8" />
      <circle cx="42" cy="42" r="34" transform="rotate(-90 42 42)" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" style={{ strokeDasharray: `${(value * 2.136).toFixed(1)} 214` }} />
      <text x="42" y="48" textAnchor="middle" style={{ fontFamily: "'Hanken Grotesk', Arial, sans-serif", fontSize: 20, fontWeight: 800, fill: '#161A2B' }}>{value}%</text>
    </svg>
  );
}

function ScoreCard({ title, blurb, value, color, accent, children }) {
  return (
    <div className="hc-card" style={{ padding: 22, ...(accent ? { borderColor: '#C9D3F7' } : null) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ScoreRing value={value} color={color} label={title} />
        <div>
          <div className="hc-disp" style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
          <div style={{ marginTop: 4, fontSize: 13.5, lineHeight: 1.5, color: 'var(--hc-ink-muted)' }}>{blurb}</div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  );
}

function Spinner({ size = 18 }) {
  return (
    <svg className="hc-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="#E4E6EE" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="#3F5FD8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function AnalysisSection({ resumeId }) {
  const [phase, setPhase] = useState('idle'); // idle | busy | done | fail
  const [scores, setScores] = useState(null);
  const [error, setError] = useState(null);

  async function start() {
    setPhase('busy');
    setError(null);
    try {
      setScores(toAnalysis(await runAnalysis(resumeId)));
      setPhase('done');
    } catch (e) {
      setError(e);
      setPhase('fail');
    }
  }

  const years = scores?.experience.minYears
    ? [`Years of experience`, `${scores.experience.cvYears} yrs · needs ${scores.experience.minYears}+`, scores.experience.cvYears >= scores.experience.minYears ? 'var(--hc-success)' : 'var(--hc-warm)']
    : null;

  return (
    <section aria-label="Analysis" style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="hc-lbl" style={{ color: 'var(--hc-brand)' }}>Analysis</div>
          <h2 className="hc-disp" style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em' }}>How this CV fits the job</h2>
        </div>
        {(phase === 'idle' || phase === 'fail') && <button type="button" className="hc-btn-p" onClick={start}><LineChart size={16} aria-hidden="true" />{phase === 'fail' ? 'Try again' : 'Start analysis'}</button>}
        {phase === 'busy' && (
          <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--hc-brand)', minHeight: 46 }}><Spinner />Analysing…</span>
        )}
      </div>
      <ErrorBanner error={error} />
      {phase === 'idle' && <p style={{ margin: '10px 0 0', fontSize: 14.5, color: 'var(--hc-ink-muted)', maxWidth: 640 }}>See your keyword match, experience match and JD–CV narrative alignment for this job.</p>}

      {phase === 'done' && scores && (
        <div className="hc-rise">
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <ScoreCard title="Keyword match" blurb="Skills and terms from the JD that appear in your CV." value={scores.keyword.score} color="#3F5FD8">
              {scores.keyword.reason && <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--hc-ink-muted)' }}>{REASON[scores.keyword.reason]}</p>}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--hc-success)' }}>Matched · {scores.keyword.matched.length}</div>
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {scores.keyword.matched.map((k) => <span key={k} className="hc-chip" style={{ background: '#E8F5EC', color: 'var(--hc-success)' }}>{k}</span>)}
              </div>
              {scores.keyword.missing.length > 0 && (
                <>
                  <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: 'var(--hc-warm)' }}>Missing · {scores.keyword.missing.length}</div>
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    {scores.keyword.missing.map((k) => <span key={k} className="hc-chip" style={{ background: '#FFF4EE', color: 'var(--hc-warm)' }}>{k}</span>)}
                    <span style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>{scores.keyword.note}</span>
                  </div>
                </>
              )}
            </ScoreCard>

            <ScoreCard title="Experience match" blurb="Does what you’ve actually done match what they need? Keywords alone don’t get you hired." value={scores.experience.score} color="#3F5FD8">
              {scores.experience.reason && <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--hc-ink-muted)' }}>{REASON[scores.experience.reason]}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
                {years && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span>{years[0]}</span><span style={{ fontWeight: 700, color: years[2] }}>{years[1]}</span>
                  </div>
                )}
                {scores.experience.requirements.map((r) => (
                  <div key={r.text} title={r.evidence || undefined} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span>{r.text}</span><span style={{ fontWeight: 700, color: LEVEL_COLOR[r.level] }}>{r.level}</span>
                  </div>
                ))}
              </div>
            </ScoreCard>

            <ScoreCard title="JD–CV narrative alignment" blurb="Does your CV tell the same story as the job?" value={scores.narrative.score} color="#15803D" accent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, lineHeight: 1.5 }}>
                <div><span style={{ fontWeight: 700 }}>The JD’s story:</span> <span style={{ color: 'var(--hc-ink-muted)' }}>{scores.narrative.jdStory}</span></div>
                <div><span style={{ fontWeight: 700 }}>Your CV’s top third:</span> <span style={{ color: 'var(--hc-ink-muted)' }}>{scores.narrative.cvStory}</span></div>
                <div style={{ background: '#EEF1FD', color: 'var(--hc-brand-hover)', borderRadius: 10, padding: '10px 12px' }}><strong>Try:</strong> {scores.narrative.suggestion.replace(/^Try:\s*/i, '')}</div>
              </div>
            </ScoreCard>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 14, alignItems: 'flex-start', background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 16, padding: '16px 18px' }}>
            <span className="hc-mono" style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, background: 'var(--hc-ink)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700 }}>7s</span>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--hc-ink-muted)' }}>
              <strong style={{ color: 'var(--hc-ink)' }}>About narrative alignment.</strong> A recruiter scans a CV in about 7 seconds, often after reading twenty others. They carry the job’s story in their head — what this person must own and deliver. If your CV’s top lines tell that same story, you get picked. This score shows how well yours does, so you can tune it for the human reader, not just the ATS.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
