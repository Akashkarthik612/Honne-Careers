import { useEffect, useRef, useState } from 'react';
import { ORIG_BULLETS, ORIG_SKILLS, SAMPLE_JDS, countReqs, gapNote } from '../landingData';
import { useReducedMotion } from '../landingHooks';
import { Reveal } from './parts';

const ANALYSE_MS = 850;
const HL = {
  m: { background: '#E6F4EE', color: '#0B5E46', borderRadius: 4, padding: '1px 3px' },
  p: { background: '#FFF2E8', color: '#8F3F0B', borderRadius: 4, padding: '1px 3px' },
  g: { background: '#F3F1EE', color: '#3A3A3A', borderRadius: 4, padding: '1px 3px', textDecoration: 'underline dotted', textUnderlineOffset: 3 },
};
const DOT = { m: '#0F7A5C', p: '#B4500F', g: '#9A968F' };
const cvHead = { marginTop: 12, fontSize: 13, fontVariant: 'small-caps', letterSpacing: '.06em', borderBottom: '1px solid #111111', paddingBottom: 2 };

// 04 — CV tailoring: pick a sample job, see what it asks for, flip the CV between original and tailored.
export default function Tailoring() {
  const reduce = useReducedMotion();
  const [jdId, setJdId] = useState('fw');
  const [tailored, setTailored] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pickJd = (id) => {
    if (id === jdId) return;
    clearTimeout(timer.current);
    setJdId(id);
    setAnalyzing(true);
    timer.current = setTimeout(() => setAnalyzing(false), reduce ? 10 : ANALYSE_MS);
  };

  const J = SAMPLE_JDS[jdId];
  const gap = gapNote(J);
  const bullets = tailored
    ? J.bullets.map(([t, why]) => ({ t, why }))
    : ORIG_BULLETS.map((t) => ({ t, why: '' }));

  return (
    <section id="tailor" aria-labelledby="tl-h" style={{ borderTop: '1px solid #E8E6E3' }}>
      <div className="wrap frame sec">
        <Reveal>
          <div className="split">
            <div>
              <div className="lbl">04 — CV tailoring</div>
              <h2 id="tl-h" className="h2">Every opportunity is different. <span className="lead">Your application should be too.</span></h2>
            </div>
            <p className="sub" style={{ margin: '0 0 6px' }}>Pick a job. Honne reads it, finds what it asks for, and rewords your real experience to match. Anything you don&apos;t have is flagged, never added.</p>
          </div>

          <div className="card" style={{ marginTop: 34, overflow: 'hidden', boxShadow: '0 24px 60px rgba(23,23,23,.06)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #F1EFEC', background: '#FCFCFB' }}>
              <div className="seg" role="tablist" aria-label="Example jobs" style={{ flexWrap: 'wrap' }}>
                {Object.entries(SAMPLE_JDS).map(([id, jd]) => (
                  <button key={id} type="button" role="tab" className={`segb${id === jdId ? ' on' : ''}`} aria-selected={id === jdId} onClick={() => pickJd(id)}>{jd.tab}</button>
                ))}
              </div>
              <span style={{ flex: 1 }}></span>
              <div className="seg" role="group" aria-label="CV version">
                <button type="button" className={`segb${tailored ? '' : ' on'}`} onClick={() => setTailored(false)} aria-pressed={!tailored}>Original</button>
                <button type="button" className={`segb${tailored ? ' on' : ''}`} onClick={() => setTailored(true)} aria-pressed={tailored}>Tailored</button>
              </div>
              <span className="tag">SAMPLE DATA</span>
            </div>

            <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
              <div style={{ padding: 20, borderRight: '1px solid #F1EFEC', minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 11, color: '#6E6B78' }}>JOB DESCRIPTION</div>
                <div className="h" style={{ marginTop: 6, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{J.title}</div>
                <p style={{ margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.75, color: '#3A3A3A' }}>
                  {J.segs.map(([t, k], i) => <span key={i} style={k && !analyzing ? { ...HL[k], transition: 'background .3s ease' } : undefined}>{t}</span>)}
                </p>

                <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #F1EFEC' }} aria-live="polite">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 11, color: '#6E6B78' }}>ANALYSIS</span>
                    {analyzing && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#6655E8' }}>
                        <svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" style={{ stroke: '#E4DFFF', strokeWidth: 3 }}></circle><path d="M21 12a9 9 0 0 0-9-9" style={{ stroke: '#6655E8', strokeWidth: 3, strokeLinecap: 'round' }}></path></svg>
                        Reading the JD…
                      </span>
                    )}
                  </div>
                  {analyzing ? (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {['70%', '90%', '60%'].map((w) => <div key={w} className="skel" style={{ height: 14, width: w }}></div>)}
                    </div>
                  ) : (
                    <div key={jdId} className="rise">
                      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <span className="pill" style={{ background: '#E6F4EE', color: '#0F7A5C' }}>{countReqs(J, 'm')} matched</span>
                        <span className="pill" style={{ background: '#FFF2E8', color: '#B4500F' }}>{countReqs(J, 'p')} partial</span>
                        <span className="pill" style={{ background: '#F3F1EE', color: '#4A4A4A' }}>{countReqs(J, 'g')} not in your profile</span>
                      </div>
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {J.reqs.map(([t, k, ev]) => (
                          <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13.5, lineHeight: 1.45 }}>
                            <span style={{ flex: 'none', width: 8, height: 8, borderRadius: 99, transform: 'translateY(-1px)', background: DOT[k] }}></span>
                            <span style={{ flex: 1, minWidth: 0 }}><strong>{t}</strong> <span style={{ color: '#666666' }}>— {ev}</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: 20, background: '#F5F4F1', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 11, color: '#6E6B78' }}>{tailored ? 'TAILORED CV · JAKE’S RESUME' : 'ORIGINAL CV · JAKE’S RESUME'}</span>
                  <span style={{ fontSize: 12, color: '#666666' }}>{tailored ? 'Highlighted lines were reworded' : 'As saved in your profile'}</span>
                </div>
                <div style={{ marginTop: 10, background: '#FFFFFF', borderRadius: 4, boxShadow: '0 10px 30px rgba(23,23,23,.08)', padding: '26px 28px', fontFamily: "'Times New Roman',Georgia,serif", color: '#111111' }}>
                  <div style={{ textAlign: 'center', fontSize: 24, letterSpacing: '.04em', fontVariant: 'small-caps' }}>Arjun Mehta</div>
                  <div style={{ textAlign: 'center', fontSize: 12, marginTop: 3 }}>Chennai, India · arjun.mehta@mail.com · linkedin.com/in/arjunmehta</div>
                  <div style={{ ...cvHead, marginTop: 14 }}>Experience</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 13.5 }}><strong>Software Engineer</strong><span>Jul 2021 – Present</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontStyle: 'italic' }}><span>Northwind Fintech</span><span>Bengaluru, India</span></div>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
                    {bullets.map((b, i) => (
                      <li key={`${jdId}-${tailored}-${i}`} className="rise" style={{ marginTop: 4, animationDelay: `${i * 0.04}s`, ...(b.why ? { background: '#F4F2FF', boxShadow: '-10px 0 0 #F4F2FF,6px 0 0 #F4F2FF', borderRadius: 3 } : {}) }}>
                        {b.t}
                        {b.why && <span className="mono" style={{ display: 'block', fontSize: 10.5, color: '#5847D6', marginTop: 2 }}>matches: {b.why}</span>}
                      </li>
                    ))}
                  </ul>
                  <div style={cvHead}>Technical Skills</div>
                  <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}><strong>Languages &amp; tools:</strong> <span style={tailored ? { background: '#F4F2FF', borderRadius: 3 } : undefined}>{tailored ? J.skills : ORIG_SKILLS}</span></div>
                  <div style={cvHead}>Education</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 13 }}><strong>Anna University</strong><span>2016 – 2020</span></div>
                  <div style={{ fontSize: 12.5, fontStyle: 'italic' }}>B.E. Computer Science and Engineering</div>
                </div>
                {gap && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFFFFF', border: '1px solid #E8E6E3', borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.5 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B4500F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', marginTop: 2 }}><circle cx="12" cy="12" r="9"></circle><path d="M12 7v6M12 16.5v.5"></path></svg>
                    <span><strong>{gap.names}</strong> {gap.rest}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
