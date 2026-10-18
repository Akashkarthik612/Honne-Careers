// "How this CV fits the job": the three P1 scores (ANA-1..3). Values are the design's sample analysis
// until the analysis API returns real scores with evidence (ANA-4).

const MATCHED = ['Java', 'Kafka', 'AWS', 'SQL', 'Event-driven', 'Mentoring', 'Reliability'];
const MISSING = ['Kubernetes'];
const LEVEL_COLOR = { Strong: 'var(--hc-success)', Yes: 'var(--hc-success)', Partial: '#B45309', None: 'var(--hc-warm)' };
const REQUIREMENTS = [
  ['Years of backend', '4 yrs · needs 3+', 'var(--hc-success)'],
  ['Event-driven systems at scale', 'Strong'],
  ['Mentoring and code review', 'Yes'],
  ['Distributed-systems design', 'Partial'],
  ['Kubernetes', 'None'],
];
const SCORES = { keyword: 88, experience: 74, narrative: 81 };

function ScoreRing({ value, color, label }) {
  const text = value == null ? '—' : `${value}%`;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`${label} score ${text}`} style={{ flex: 'none' }}>
      <circle cx="42" cy="42" r="34" fill="none" stroke="#EEF0F5" strokeWidth="8" />
      <circle
        cx="42" cy="42" r="34" transform="rotate(-90 42 42)" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        style={{ strokeDasharray: `${((value ?? 0) * 2.136).toFixed(1)} 214`, transition: 'stroke-dasharray 1.2s cubic-bezier(.2,.8,.2,1)' }}
      />
      <text x="42" y="48" textAnchor="middle" style={{ fontFamily: "'Hanken Grotesk', Arial, sans-serif", fontSize: 20, fontWeight: 800, fill: '#161A2B' }}>{text}</text>
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
      {value != null && <div className="hc-rise" style={{ marginTop: 16 }}>{children}</div>}
    </div>
  );
}

export default function AnalysisSection({ ready }) {
  const v = (key) => (ready ? SCORES[key] : null);

  return (
    <section aria-label="Analysis" style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="hc-lbl" style={{ color: 'var(--hc-brand)' }}>Analysis</div>
          <h2 className="hc-disp" style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em' }}>How this CV fits the job</h2>
        </div>
        {!ready && <span style={{ fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>Scores appear once your CV is generated.</span>}
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <ScoreCard title="Keyword match" blurb="Skills and terms from the JD that appear in your CV." value={v('keyword')} color="#3F5FD8">
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--hc-success)' }}>Matched · {MATCHED.length}</div>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {MATCHED.map((k) => <span key={k} className="hc-chip" style={{ background: '#E8F5EC', color: 'var(--hc-success)' }}>{k}</span>)}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: 'var(--hc-warm)' }}>Missing · {MISSING.length}</div>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {MISSING.map((k) => <span key={k} className="hc-chip" style={{ background: '#FFF4EE', color: 'var(--hc-warm)' }}>{k}</span>)}
            <span style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>Not in your profile, so we didn’t add it.</span>
          </div>
        </ScoreCard>

        <ScoreCard title="Experience match" blurb="Does what you’ve actually done match what they need? Keywords alone don’t get you hired." value={v('experience')} color="#3F5FD8">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
            {REQUIREMENTS.map(([req, level, color]) => (
              <div key={req} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>{req}</span><span style={{ fontWeight: 700, color: color || LEVEL_COLOR[level] }}>{level}</span>
              </div>
            ))}
          </div>
        </ScoreCard>

        <ScoreCard title="JD–CV narrative alignment" blurb="Does your CV tell the same story as the job?" value={v('narrative')} color="#15803D" accent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, lineHeight: 1.5 }}>
            <div><span style={{ fontWeight: 700 }}>The JD’s story:</span> <span style={{ color: 'var(--hc-ink-muted)' }}>a backend engineer who owns high-scale event systems and grows juniors.</span></div>
            <div><span style={{ fontWeight: 700 }}>Your CV’s top third:</span> <span style={{ color: 'var(--hc-ink-muted)' }}>cut latency with Kafka on AWS, owned settlement, mentored interns.</span></div>
            <div style={{ background: '#EEF1FD', color: 'var(--hc-brand-hover)', borderRadius: 10, padding: '10px 12px' }}><strong>Try:</strong> open your first bullet with “Owned” — ownership is the JD’s first ask.</div>
          </div>
        </ScoreCard>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 14, alignItems: 'flex-start', background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 16, padding: '16px 18px' }}>
        <span className="hc-mono" style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, background: 'var(--hc-ink)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700 }}>7s</span>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--hc-ink-muted)' }}>
          <strong style={{ color: 'var(--hc-ink)' }}>About narrative alignment.</strong> A recruiter scans a CV in about 7 seconds, often after reading twenty others. They carry the job’s story in their head — what this person must own and deliver. If your CV’s top lines tell that same story, you get picked. This score shows how well yours does, so you can tune it for the human reader, not just the ATS.
        </p>
      </div>
    </section>
  );
}
