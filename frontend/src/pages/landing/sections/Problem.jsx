import { useEffect, useRef, useState } from 'react';
import { FIX_CARDS, FIX_COLS, OLD_LOOP, PAINS, cardFrame, clamp01, easeInOut, fixColX } from '../landingData';
import { NARROW, useJump, useMedia, useReducedMotion, useScrollTo } from '../landingHooks';
import { Reveal } from './parts';

const TRACK_PX = 1640;      // scroll distance that drives the scene on desktop
const STICKY_MAX_PX = 860;  // the pinned stage is never taller than this

// 02 — the problem, then "From scattered to sorted": on desktop, scrolling through the track
// sorts nine chaos cards into the five Honne steps. On phones and with reduced motion the
// two buttons switch between the states instead.
export default function Problem() {
  const reduce = useReducedMotion();
  const narrow = useMedia(NARROW);
  const useScroll = !reduce && !narrow;
  const scrollTo = useScrollTo();
  const jump = useJump();
  const trackRef = useRef(null);
  const [scrollP, setScrollP] = useState(0);
  const [manualP, setManualP] = useState(0);
  const P = useScroll ? scrollP : manualP;

  useEffect(() => {
    if (!useScroll) return undefined;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const span = Math.max(1, r.height - Math.min(window.innerHeight, STICKY_MAX_PX));
      const p = clamp01(-r.top / span);
      setScrollP((prev) => (Math.abs(p - prev) > 0.004 || (p !== prev && (p === 0 || p === 1)) ? p : prev));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [useScroll]);

  const setProblem = (target) => {
    const el = trackRef.current;
    if (!useScroll || !el) { setManualP(target); return; }
    const r = el.getBoundingClientRect();
    scrollTo(r.top + window.scrollY + (r.height - Math.min(window.innerHeight, STICKY_MAX_PX)) * target);
  };

  const isOrder = P >= 0.5;
  const eP = easeInOut(clamp01(P));
  const hint = useScroll ? (P < 0.05 ? 'Scroll to sort it out ↓' : P > 0.95 ? 'Sorted.' : 'Sorting…') : '';
  const arrow = (on, last) => ({ fontSize: 13, color: on ? '#6655E8' : '#C9C5BE', opacity: last ? 0 : 1 });

  return (
    <section id="problem" aria-labelledby="prob-h">
      <div className="wrap frame sec" style={{ paddingBottom: 24 }}>
        <Reveal>
          <div className="lbl">02 — The problem</div>
          <h2 id="prob-h" className="h" style={{ margin: '16px 0 0', fontSize: 'clamp(46px,7.4vw,108px)', lineHeight: 0.96, letterSpacing: '-0.055em', fontWeight: 700 }}>
            100 applications.<br />Zero replies.<br /><span className="lead">Zero clarity.</span>
          </h2>
          <p style={{ margin: '26px 0 0', fontSize: 'clamp(19px,2vw,24px)', lineHeight: 1.45, color: '#171717', maxWidth: 720 }}>If you’re looking for a job right now, some of this will sound familiar.</p>
          <div style={{ marginTop: 40, borderTop: '1px solid #E8E6E3' }}>
            {PAINS.map((p) => (
              <div key={p.n} className="painrow">
                <div style={{ paddingTop: 8 }}>
                  <span className="mono" style={{ fontSize: 12, letterSpacing: '.06em', color: '#6655E8' }}>{p.n} · {p.tag}</span>
                  {p.hot && <div style={{ marginTop: 8 }}><span className="pill" style={{ background: '#171717', color: '#FFFFFF' }}>The one nobody fixes</span></div>}
                </div>
                <div>
                  <div className="h" style={{ fontSize: 'clamp(25px,2.9vw,38px)', lineHeight: 1.12, letterSpacing: '-0.035em', fontWeight: 700 }}>{p.t}</div>
                  <div style={{ marginTop: 10, fontSize: 17, lineHeight: 1.6, color: '#666666', maxWidth: 660 }}>{p.d}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 44, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
            <p className="h" style={{ margin: 0, fontSize: 'clamp(26px,3vw,40px)', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.1, maxWidth: 760 }}>It’s not you. <span className="lead">It’s the way everyone is told to apply.</span></p>
            <a className="btn-s" href="#problem-track" onClick={jump('problem-track')}>See what changes ↓</a>
          </div>
        </Reveal>
      </div>

      <div className="wrap frame" style={{ padding: 0, borderTop: '1px solid #E8E6E3' }}>
        <div id="problem-track" ref={trackRef} style={{ position: 'relative', ...(useScroll ? { height: TRACK_PX } : {}) }}>
          <div style={{ ...(useScroll ? { position: 'sticky', top: 0, height: `min(100vh,${STICKY_MAX_PX}px)` } : {}), display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '96px 32px 72px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '20px 40px' }}>
              <div style={{ maxWidth: 620 }}>
                <div className="lbl">The fix</div>
                <h3 className="h2" style={{ fontSize: 'clamp(30px,3.6vw,46px)' }}>From scattered <span className="lead">to sorted.</span></h3>
                <p className="sub" style={{ fontSize: 17 }}>Same job search. Five clear steps instead of one endless loop of apply, wait, repeat.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                <div className="seg" role="group" aria-label="Compare">
                  <button type="button" className={`segb${isOrder ? '' : ' on'}`} onClick={() => setProblem(0)} aria-pressed={!isOrder}>The usual way</button>
                  <button type="button" className={`segb${isOrder ? ' on' : ''}`} onClick={() => setProblem(1)} aria-pressed={isOrder}>With Honne</button>
                </div>
                <span className="mono hideM" style={{ fontSize: 11.5, color: '#6E6B78' }}>{hint}</span>
              </div>
            </div>

            <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, opacity: (1 - 0.6 * eP).toFixed(2) }}>
                <span className="mono" style={{ fontSize: 11, color: '#6E6B78', width: 64 }}>USUAL</span>
                {OLD_LOOP.map((t, i) => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#6E6B78' }}>{t}</span><span style={arrow(false, i === OLD_LOOP.length - 1)}>→</span>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, opacity: (0.35 + 0.65 * eP).toFixed(2) }}>
                <span className="mono" style={{ fontSize: 11, color: '#6655E8', width: 64 }}>HONNE</span>
                {FIX_COLS.map((t, i) => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#171717' }}>{t}</span><span style={arrow(true, i === FIX_COLS.length - 1)}>→</span>
                  </span>
                ))}
              </div>
            </div>

            {/* desktop stage */}
            <div className="hideM stage" aria-hidden="true">
              {FIX_COLS.map((t, i) => (
                <div key={t} style={{ position: 'absolute', top: 0, left: `${fixColX(i)}%`, width: '18.6%', paddingBottom: 8, borderBottom: `1px solid ${P > 0.5 ? '#DCD5FF' : 'transparent'}`, opacity: easeInOut(clamp01((P - 0.35) / 0.5)).toFixed(3), transition: 'border-color .3s ease' }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: '#6655E8' }}>0{i + 1}</span> <span style={{ fontSize: 13, fontWeight: 700 }}>{t}</span>
                </div>
              ))}
              {FIX_CARDS.map((c, i) => {
                const f = cardFrame(c, i, P);
                return (
                  <div key={c.a} className={`pcard${f.t > 0.5 ? ' sorted' : ''}`} style={{ transform: `translate(${f.left.toFixed(2)}cqw,${f.top.toFixed(2)}cqh) rotate(${f.rot.toFixed(2)}deg)`, zIndex: f.t > 0.5 ? 2 : 1 }}>
                    <div style={{ position: 'relative', minHeight: 44 }}>
                      <div style={{ position: 'absolute', inset: 0, opacity: (1 - f.t).toFixed(3) }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#3A3A3A' }}>{c.a}</div>
                        <div style={{ marginTop: 3, fontSize: 12, color: '#6E6B78' }}>{c.as}</div>
                      </div>
                      <div style={{ position: 'relative', opacity: f.t.toFixed(3) }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{c.b}</div>
                        <div style={{ marginTop: 3, fontSize: 12, color: '#666666' }}>{c.bs}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* phone list */}
            <div className="showM" style={{ marginTop: 20 }}>
              {isOrder ? (
                <div key="order" className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {FIX_CARDS.map((c) => (
                    <div key={c.b} className="card" style={{ padding: '12px 14px', borderLeft: '3px solid #6655E8' }}>
                      <div className="mono" style={{ fontSize: 11, color: '#6655E8' }}>{FIX_COLS[c.o[0]].toUpperCase()}</div>
                      <strong style={{ fontSize: 14 }}>{c.b}</strong> <span style={{ fontSize: 13, color: '#666666' }}>· {c.bs}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div key="chaos" className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {FIX_CARDS.slice(0, 6).map((c, i) => (
                    <div key={c.a} style={{ background: '#FFFFFF', border: '1px solid #E8E6E3', borderRadius: 12, padding: '12px 14px', transform: `rotate(${i % 2 ? 1 : -1}deg)` }}>
                      <strong style={{ fontSize: 14 }}>{c.a}</strong> <span style={{ fontSize: 13, color: '#6E6B78' }}>· {c.as}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
