import { useEffect, useRef, useState } from 'react';
import { FUNNEL_COLORS, LOOP_R, LOOP_STEPS, MONTHS, barWidth, clamp01, loopNodePos } from '../landingData';
import { useReducedMotion } from '../landingHooks';
import { Reveal } from './parts';

const RING = 2 * Math.PI * LOOP_R;

// 06 — the learning loop: the ring fills step by step as the section scrolls in; picking a step
// highlights the matching panel of the sample analytics.
export default function LearningLoop() {
  const reduce = useReducedMotion();
  const trackRef = useRef(null);
  const [scrolledShown, setScrolledShown] = useState(0);
  const [sel, setSel] = useState(0);
  const [month, setMonth] = useState('oct');

  useEffect(() => {
    if (reduce) return undefined;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const prog = clamp01((window.innerHeight * 0.9 - r.top) / (r.height * 0.75));
      const n = Math.ceil(prog * LOOP_STEPS.length);
      setScrolledShown((prev) => Math.max(prev, n)); // only ever fills
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduce]);

  const shown = reduce ? LOOP_STEPS.length : Math.max(scrolledShown, sel + 1);
  const M = MONTHS[month];
  const panel = LOOP_STEPS[sel].panel;
  const box = (k) => ({
    borderRadius: 12, padding: k === 'kpi' ? 0 : 12, transition: 'box-shadow .3s ease,background .3s ease',
    ...(k === 'kpi' ? {} : { border: '1px solid #F1EFEC' }),
    ...(panel === k ? { boxShadow: '0 0 0 2px #6655E8', background: '#FCFBFF' } : {}),
  });

  return (
    <section id="loop" aria-labelledby="lp-h" style={{ borderTop: '1px solid #E8E6E3' }}>
      <div className="wrap frame sec">
        <Reveal>
          <div className="lbl">06 — The learning loop</div>
          <h2 id="lp-h" className="h2">Your next application should be <span className="serif" style={{ color: '#6655E8', fontSize: '1.08em' }}>smarter</span> <span className="lead">than your last.</span></h2>
          <p className="sub">Every week, Honne looks at what you sent and what came back, then adjusts the plan. It shows patterns in your own data. It can&apos;t know why a company said no, and it won&apos;t pretend to.</p>

          <div ref={trackRef} className="g2" style={{ marginTop: 36, display: 'grid', gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)', gap: 18, alignItems: 'start' }}>
            <div className="card" style={{ padding: 18 }}>
              <svg viewBox="0 0 400 400" style={{ width: '100%', maxWidth: 400, height: 'auto', display: 'block', margin: '0 auto' }} aria-hidden="true">
                <circle cx="200" cy="200" r={LOOP_R} style={{ fill: 'none', stroke: '#F1EFEC', strokeWidth: 3 }}></circle>
                <circle cx="200" cy="200" r={LOOP_R} transform="rotate(-90 200 200)" style={{ fill: 'none', stroke: '#6655E8', strokeWidth: 3, strokeLinecap: 'round', strokeDasharray: RING.toFixed(1), strokeDashoffset: (RING * (1 - shown / LOOP_STEPS.length)).toFixed(1), transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)' }}></circle>
                <text x="200" y="194" textAnchor="middle" style={{ fontFamily: "'Plus Jakarta Sans',Arial,sans-serif", fontSize: 17, fontWeight: 700, fill: '#171717' }}>Every week,</text>
                <text x="200" y="216" textAnchor="middle" style={{ fontFamily: "'Plus Jakarta Sans',Arial,sans-serif", fontSize: 17, fontWeight: 700, fill: '#7A7593' }}>a little sharper</text>
                {LOOP_STEPS.map((s, i) => {
                  const { x, y } = loopNodePos(i);
                  const on = i < shown;
                  const isSel = i === sel;
                  return (
                    <g key={s.t} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
                      <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r={isSel ? 24 : 20} style={{ fill: isSel ? '#6655E8' : on ? '#FFFFFF' : '#F3F1EE', stroke: on ? '#6655E8' : '#E8E6E3', strokeWidth: 2, transition: 'all .3s ease' }}></circle>
                      <text x={x.toFixed(1)} y={(y + 5).toFixed(1)} textAnchor="middle" style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 13, fontWeight: 600, pointerEvents: 'none', fill: isSel ? '#FFFFFF' : on ? '#6655E8' : '#6E6B78' }}>{i + 1}</text>
                    </g>
                  );
                })}
              </svg>
              <div role="tablist" aria-label="Loop steps" style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {LOOP_STEPS.map((s, i) => {
                  const isSel = i === sel;
                  const on = i < shown;
                  return (
                    <button key={s.t} type="button" role="tab" aria-selected={isSel} onClick={() => setSel(i)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%', textAlign: 'left', minHeight: 44, padding: '10px 12px', borderRadius: 10, border: 0, cursor: 'pointer', color: '#171717', background: isSel ? '#F4F2FF' : 'transparent', opacity: on ? 1 : 0.6, transition: 'background .2s ease,opacity .3s ease' }}>
                      <span className="mono" style={{ fontSize: 12, paddingTop: 2, color: on ? '#6655E8' : '#6E6B78' }}>0{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{s.t}</span>
                        {isSel && <span className="rise" style={{ display: 'block', marginTop: 2, fontSize: 13, lineHeight: 1.5, color: '#666666' }}>{s.d}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #F1EFEC', background: '#FCFCFB' }}>
                <span className="h" style={{ fontSize: 15, fontWeight: 700 }}>Your search</span>
                <div className="seg" role="group" aria-label="Month">
                  <button type="button" className={`segb${month === 'sep' ? ' on' : ''}`} onClick={() => setMonth('sep')} aria-pressed={month === 'sep'}>September</button>
                  <button type="button" className={`segb${month === 'oct' ? ' on' : ''}`} onClick={() => setMonth('oct')} aria-pressed={month === 'oct'}>October</button>
                </div>
                <span style={{ flex: 1 }}></span><span className="tag">SAMPLE DATA</span>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={box('kpi')}>
                  <div className="kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
                    {M.kpi.map(([t, v]) => (
                      <div key={t} style={{ border: '1px solid #F1EFEC', borderRadius: 10, padding: '10px 12px', background: '#FFFFFF' }}>
                        <div style={{ fontSize: 12, color: '#666666' }}>{t}</div>
                        <div key={`${month}-${v}`} className="h rise" style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={box('funnel')}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Stages</div>
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {M.funnel.map(([t, v], i) => (
                        <div key={t}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#666666' }}><span>{t}</span><strong style={{ color: '#171717' }}>{v}</strong></div>
                          <div style={{ marginTop: 4, height: 8, borderRadius: 99, background: '#F3F1EE', overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 99, transition: 'width .5s cubic-bezier(.2,.8,.2,1)', width: barWidth(v, M.funnel[0][1]), background: FUNNEL_COLORS[i] }}></div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={box('src')}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Replies by how you applied</div>
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {M.src.map(([t, sent, replied]) => (
                        <div key={t}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span>{t}</span><strong>{replied} of {sent} replied</strong></div>
                          <div style={{ marginTop: 4, height: 8, borderRadius: 99, background: '#F3F1EE', overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 99, transition: 'width .5s cubic-bezier(.2,.8,.2,1)', width: barWidth(replied, sent), background: t === 'Cold' ? '#B4500F' : '#0F7A5C' }}></div></div>
                          <div style={{ marginTop: 3, fontSize: 11.5, color: '#6E6B78' }}>{Math.round((replied / sent) * 100)}% reply rate</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={box('recs')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 13, fontWeight: 600 }}>For next week</span><span className="mono" style={{ fontSize: 11, color: '#B4500F' }}>@strategist</span></div>
                  <div key={month} className="rise" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {M.recs.map((r) => (
                      <div key={r} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, lineHeight: 1.5 }}>
                        <span style={{ flex: 'none', width: 16, height: 16, marginTop: 3, borderRadius: 5, border: '2px solid #6655E8' }}></span>{r}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12.5, color: '#666666', fontStyle: 'italic' }}>{M.note}</div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
