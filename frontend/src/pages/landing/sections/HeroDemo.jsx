import { useCallback, useEffect, useState } from 'react';
import {
  DASH_APPS, HERO_BULLETS, HERO_CURSOR, HERO_STEPS, HERO_TABS, HERO_URL, heroDbRows, nextHeroStep,
} from '../landingData';
import { useOnScreen, useReducedMotion } from '../landingHooks';
import { Check } from './parts';

const ARIA = 'Sample demo in three steps: a job description is pasted and the CV is tailored to it; the JD and the exact CV sent are saved together in one row; then your week at a glance.';
const FLIP_OUT_MS = 340;
const FLIP_SWAP_MS = 40;
const FIRST_DELAY_MS = 1300; // let the entrance animation finish before the demo starts

const mono105 = { fontSize: 10.5, letterSpacing: '.05em', color: '#6E6B78', height: 22 };
const cvHead = { marginTop: 8, fontSize: 10, fontVariant: 'small-caps', letterSpacing: '.06em', borderBottom: '1px solid #111111' };
const popCard = { position: 'absolute', top: 150, background: '#FFFFFF', border: '1px solid #E8E6E3', borderRadius: 12, boxShadow: '0 18px 40px rgba(23,23,23,.16)', overflow: 'hidden', zIndex: 3 };
const popHead = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderBottom: '1px solid #F1EFEC', fontSize: 11 };
const popFoot = { padding: '6px 10px', borderTop: '1px solid #F1EFEC', fontSize: 10.5, color: '#666666' };
const docChip = (bg, fg) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, borderRadius: 6, padding: '3px 7px', whiteSpace: 'nowrap', background: bg, color: fg });
const kpiBox = { border: '1px solid #F1EFEC', borderRadius: 10, padding: '9px 10px' };

// The hero's product demo: paste & tailor → flip → saved together → flip → your week, on a loop.
// Tabs jump to a scene; with reduced motion nothing moves and each tab shows its finished state.
export default function HeroDemo() {
  const reduce = useReducedMotion();
  const [boxRef, onScreen] = useOnScreen();
  const [demo, setDemo] = useState(() => ({ hs: reduce ? 8 : 0, fl: 0, to: 0, first: true }));

  // Changing scene flips the card: out (fl 1) → swap content edge-on (fl 2) → back in (fl 0).
  const go = useCallback((n) => setDemo((d) => (
    !reduce && HERO_STEPS[d.hs].sc !== HERO_STEPS[n].sc ? { hs: d.hs, fl: 1, to: n } : { hs: n, fl: 0, to: n }
  )), [reduce]);

  useEffect(() => {
    if (reduce) return undefined;
    if (demo.fl === 1) {
      const t = setTimeout(() => setDemo((d) => ({ hs: d.to, fl: 2, to: d.to })), FLIP_OUT_MS);
      return () => clearTimeout(t);
    }
    if (demo.fl === 2) {
      const t = setTimeout(() => setDemo((d) => ({ ...d, fl: 0 })), FLIP_SWAP_MS);
      return () => clearTimeout(t);
    }
    if (!onScreen) return undefined; // paused while scrolled away
    const t = setTimeout(() => go(nextHeroStep(demo.hs)), HERO_STEPS[demo.hs].d + (demo.first ? FIRST_DELAY_MS : 0));
    return () => clearTimeout(t);
  }, [demo, reduce, onScreen, go]);

  const HS = HERO_STEPS[demo.hs];
  const cpos = HERO_CURSOR[HS.cur] || ['50%', 300];
  const kwOn = HS.jd === 2;
  const kw = { transition: 'background .3s ease', ...(kwOn ? { background: '#E6F4EE', color: '#0B5E46', borderRadius: 3, padding: '0 2px' } : {}) };
  const kwGap = { transition: 'background .3s ease', ...(kwOn ? { background: '#F3F1EE', borderRadius: 3, padding: '0 2px', textDecoration: 'underline dotted', textUnderlineOffset: 3 } : {}) };
  const done = HS.status === 'done';

  return (
    <div ref={boxRef} className="dashwrap" style={{ position: 'relative', padding: '12px 0 8px' }}>
      <div className="dash" role="img" aria-label={ARIA} style={{ background: '#FFFFFF', border: '1px solid #E8E6E3', borderRadius: 16, boxShadow: '0 2px 4px rgba(23,23,23,.03),0 30px 80px rgba(60,48,140,.14)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 14px', borderBottom: '1px solid #F1EFEC', background: '#FCFCFB', position: 'relative', zIndex: 2 }}>
          <span style={{ display: 'flex', gap: 6 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 9, height: 9, borderRadius: 99, background: '#E8E6E3' }}></span>)}</span>
          <span className="mono" style={{ fontSize: 11, color: '#6E6B78', background: '#F3F1EE', borderRadius: 6, padding: '3px 10px' }}>{HERO_URL[HS.sc]}</span>
          <span style={{ flex: 1 }}></span><span className="tag">SAMPLE DATA</span>
        </div>
        <div style={{ perspective: 1600, background: '#FFFFFF' }}>
          <div className={`flip${demo.fl === 1 ? ' out' : demo.fl === 2 ? ' in' : ''}`}>
            {HS.sc === 'A' && <SceneA HS={HS} kw={kw} kwGap={kwGap} done={done} />}
            {HS.sc === 'B' && <SceneB HS={HS} />}
            {HS.sc === 'C' && <SceneC />}
            {HS.cur && !reduce && (
              <div className="cursor" style={{ left: cpos[0], top: cpos[1] }} aria-hidden="true">
                {HS.click ? <span key={demo.hs} className="ripple"></span> : null}
                <svg width="20" height="22" viewBox="0 0 20 22" style={{ position: 'relative', display: 'block', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))' }}>
                  <path d="M2 1.5 L2 18 L6.5 13.8 L9.6 20.5 L12.6 19.1 L9.6 12.6 L15.8 12.6 Z" style={{ fill: '#171717', stroke: '#FFFFFF', strokeWidth: 1.4, strokeLinejoin: 'round' }}></path>
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      <div role="tablist" aria-label="Demo steps" style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {HERO_TABS.map(([n, label, sc, first, last]) => {
          const on = HS.sc === sc;
          return (
            <button key={n} type="button" role="tab" className="htab" aria-selected={on} onClick={() => go(reduce ? last : first)}>
              <span className="mono" style={{ fontSize: 11, color: on ? '#B9B0F5' : '#6655E8' }}>{n}</span>{label}
            </button>
          );
        })}
      </div>

      {HS.sc === 'C' && (
        <>
          <div className="floatchip di" style={{ animationDelay: '1.6s', position: 'absolute', left: -28, bottom: 58, display: 'flex', alignItems: 'center', gap: 10, background: '#FFFFFF', border: '1px solid #E8E6E3', borderRadius: 12, padding: '10px 14px', boxShadow: '0 14px 36px rgba(23,23,23,.10)', fontSize: 13 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: '#FFF2E8', color: '#B4500F', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 7l9 6 9-6"></path></svg>
            </span>
            <span><strong>Follow-up drafted</strong> for Groww<br /><span style={{ color: '#666666', fontSize: 12 }}>Waiting for your OK</span></span>
          </div>
          <div className="floatchip di" style={{ animationDelay: '1.75s', position: 'absolute', right: -12, top: -14, display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', border: '1px solid #E8E6E3', borderRadius: 999, padding: '7px 12px 7px 8px', boxShadow: '0 12px 30px rgba(23,23,23,.08)', fontSize: 12.5, fontWeight: 600 }}>
            <span style={{ width: 22, height: 22, borderRadius: 99, background: '#E6F4EE', color: '#0F7A5C', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true"><Check size={12} /></span>
            Zoho replied · interview booked
          </div>
        </>
      )}
    </div>
  );
}

// Scene A: paste the JD, the CV gets tailored.
function SceneA({ HS, kw, kwGap, done }) {
  const focused = HS.jd === 0 && HS.cur === 'aJd';
  return (
    <div style={{ position: 'absolute', inset: 0, padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14 }}>
        <div style={{ minWidth: 0, position: 'relative' }}>
          <div className="mono" style={mono105}>1 · PASTE THE JOB DESCRIPTION</div>
          <div style={{ height: 238, borderRadius: 12, background: '#FBFAF8', padding: 12, overflow: 'hidden', transition: 'border-color .2s ease,box-shadow .2s ease', border: `1px solid ${focused ? '#6655E8' : '#E8E6E3'}`, boxShadow: focused ? '0 0 0 3px rgba(102,85,232,.14)' : 'none' }}>
            {!HS.jd ? (
              <span style={{ fontSize: 12.5, color: '#6E6B78' }}>Paste the job description here<span className="caret"></span></span>
            ) : (
              <div className="rise">
                <div style={{ fontSize: 13, fontWeight: 700 }}>SDE-2, Backend · Freshworks</div>
                <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.65, color: '#3A3A3A' }}>
                  You’ll <span style={kw}>design event-driven services</span> in <span style={kw}>Java and Kafka</span> on AWS, <span style={kw}>improve reliability and latency</span>, and <span style={kw}>mentor junior engineers</span>. 3+ years of backend experience. <span style={kwGap}>Kubernetes</span> is a plus.
                </p>
              </div>
            )}
          </div>
          {HS.key ? (
            <div className="rise" style={{ position: 'absolute', left: '34%', top: 178, display: 'flex', alignItems: 'center', gap: 4, background: '#171717', color: '#FFFFFF', borderRadius: 8, padding: '5px 8px', fontSize: 11.5, fontWeight: 600, boxShadow: '0 8px 20px rgba(23,23,23,.2)' }}>
              <span className="mono" style={{ border: '1px solid rgba(255,255,255,.35)', borderRadius: 4, padding: '0 4px' }}>Ctrl</span>+<span className="mono" style={{ border: '1px solid rgba(255,255,255,.35)', borderRadius: 4, padding: '0 4px' }}>V</span>
            </div>
          ) : null}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="mono" style={mono105}>2 · YOUR CV, TAILORED</div>
          <div style={{ height: 238, background: '#FFFFFF', border: '1px solid #E8E6E3', borderRadius: 6, padding: '12px 14px', fontFamily: "'Times New Roman',Georgia,serif", color: '#111111', boxShadow: '0 8px 22px rgba(23,23,23,.06)', overflow: 'hidden' }}>
            <div style={{ textAlign: 'center', fontSize: 15, letterSpacing: '.04em', fontVariant: 'small-caps' }}>Arjun Mehta</div>
            <div style={{ textAlign: 'center', fontSize: 9.5, marginTop: 1 }}>Chennai · arjun.mehta@mail.com</div>
            <div style={cvHead}>Experience</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10.5 }}><strong>Software Engineer</strong><span>2021 – Now</span></div>
            <div style={{ fontSize: 10, fontStyle: 'italic' }}>Northwind Fintech</div>
            <ul style={{ margin: '4px 0 0', paddingLeft: 14, fontSize: 10.5, lineHeight: 1.45 }}>
              {HERO_BULLETS.map((b, i) => {
                const tailored = i < (HS.b || 0);
                return (
                  <li key={i} style={{ marginTop: 3, transition: 'background .3s ease', ...(tailored ? { background: '#F1EEFF', borderRadius: 2, boxShadow: '-6px 0 0 #F1EEFF,3px 0 0 #F1EEFF' } : { color: '#4A4A4A' }) }}>
                    {tailored ? b[1] : b[0]}
                  </li>
                );
              })}
            </ul>
            <div style={cvHead}>Skills</div>
            <div style={{ marginTop: 3, fontSize: 10 }}>Java, Kafka Streams, Spring Boot, AWS, SQL</div>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: done ? '#0F7A5C' : '#171717' }}>
            {done ? '✓ Tailored. 3 lines reworded, nothing added.' : (HS.status || 'Waiting for a job description')}
          </div>
          <div style={{ marginTop: 6, height: 5, borderRadius: 99, background: '#ECE9FB', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: '#6655E8', transition: 'width .6s ease', width: `${HS.prog || 0}%` }}></div>
          </div>
        </div>
        <div style={{ position: 'relative', flex: 'none' }}>
          {HS.toast ? <div className="rise" style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 8px)', whiteSpace: 'nowrap', background: '#E6F4EE', color: '#0F7A5C', borderRadius: 8, padding: '5px 9px', fontSize: 11.5, fontWeight: 700 }}>✓ Saved to your Database</div> : null}
          <span style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 34, padding: '0 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, transition: 'all .15s ease',
            background: HS.pressed ? '#4F3FCC' : HS.prog === 100 ? '#6655E8' : '#EEECF6',
            color: HS.prog === 100 ? '#FFFFFF' : '#8A86A0',
            transform: HS.pressed ? 'scale(.95)' : 'none',
          }}>Download &amp; save</span>
        </div>
      </div>
    </div>
  );
}

// Scene B: the JD and the exact CV, saved together in one row.
function SceneB({ HS }) {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: 16 }}>
      <div style={{ height: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div><div className="h" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>Database</div><div style={{ fontSize: 11.5, color: '#666666' }}>Every job saved with its JD and the exact CV you sent</div></div>
        <span className="mono" style={{ fontSize: 10.5, color: '#6E6B78', whiteSpace: 'nowrap' }}>20 APPLICATIONS</span>
      </div>
      <div style={{ marginTop: 12, border: '1px solid #F1EFEC', borderRadius: 10, overflow: 'hidden' }}>
        <div className="dbgrid" style={{ height: 30, background: '#FCFCFB', borderBottom: '1px solid #F1EFEC', fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, letterSpacing: '.05em', color: '#6E6B78' }}>
          <span>DATE</span><span>COMPANY</span><span>ROLE</span><span style={{ color: '#5847D6' }}>JD</span><span style={{ color: '#5847D6' }}>CV SENT</span><span>STATUS</span>
        </div>
        {heroDbRows(!!HS.newRow).map(([date, co, role, cv, st, [bg, fg], isNew]) => (
          <div key={co} className={`dbgrid${isNew ? ' rise' : ''}`} style={{ height: 40, borderBottom: '1px solid #F7F6F4', fontSize: 12, ...(isNew ? { background: '#F7F5FF', boxShadow: 'inset 3px 0 0 #6655E8' } : {}) }}>
            <span className="mono" style={{ fontSize: 10.5, color: '#6E6B78' }}>{date}</span>
            <span style={{ fontWeight: 700, textOverflow: 'ellipsis' }}>{co}</span>
            <span style={{ color: '#666666', textOverflow: 'ellipsis' }}>{role}</span>
            <span><span className="chipx" style={isNew && HS.jdPop ? { background: '#2F5FD0', color: '#FFFFFF' } : { background: '#EAF0FD', color: '#2F5FD0' }}>JD ↗</span></span>
            <span><span className="chipx" style={isNew && HS.cvPop ? { background: '#6655E8', color: '#FFFFFF' } : { background: '#F0EDFF', color: '#5847D6' }}>{cv} ↗</span></span>
            <span><span style={{ fontSize: 10.5, fontWeight: 600, borderRadius: 999, padding: '3px 8px', background: bg, color: fg }}>{st}</span></span>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 16, right: 16, bottom: 16, display: 'flex', gap: 8, alignItems: 'center', borderRadius: 10, padding: '9px 12px', fontSize: 12, lineHeight: 1.4, transition: 'background .3s ease,color .3s ease', ...(HS.cap ? { background: '#171717', color: '#FFFFFF' } : { background: '#F4F2FF', color: '#4A3BC4' }) }}>
        <Check style={{ flex: 'none' }} /><span>One row: the job, the JD and the exact CV you sent. No spreadsheet. No lost files.</span>
      </div>
      {HS.cvPop ? (
        <div className="rise" style={{ ...popCard, right: 16, width: '46%' }}>
          <div style={popHead}><span style={docChip('#F0EDFF', '#5847D6')}>PDF</span><strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>CV_Freshworks_SDE2_v4.pdf</strong></div>
          <div style={{ padding: '10px 12px', fontFamily: "'Times New Roman',Georgia,serif", fontSize: 10, lineHeight: 1.45, color: '#111111' }}>
            <div style={{ textAlign: 'center', fontSize: 12, fontVariant: 'small-caps', letterSpacing: '.04em' }}>Arjun Mehta</div>
            <div style={{ marginTop: 4, fontVariant: 'small-caps', borderBottom: '1px solid #111111' }}>Experience</div>
            <div style={{ marginTop: 3 }}>• Cut payment-event latency 38% (p95) with event-driven Kafka Streams in Java.</div>
            <div>• Owned a 2M events/day settlement pipeline end to end, with no data loss.</div>
            <div>• Mentored 2 interns through their first production launch.</div>
          </div>
          <div style={popFoot}>Sent 25 Oct · the exact version they saw</div>
        </div>
      ) : null}
      {HS.jdPop ? (
        <div className="rise" style={{ ...popCard, left: '18%', width: '50%' }}>
          <div style={popHead}><span style={docChip('#EAF0FD', '#2F5FD0')}>JD</span><strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>SDE-2, Backend · Freshworks</strong></div>
          <div style={{ padding: '10px 12px', fontSize: 11, lineHeight: 1.55, color: '#3A3A3A' }}>Design and own event-driven services in Java and Kafka on AWS. Improve reliability and latency. Mentor junior engineers. 3+ years of backend experience.</div>
          <div style={popFoot}>Saved 25 Oct · even if the posting is taken down</div>
        </div>
      ) : null}
    </div>
  );
}

// Scene C: your week.
function SceneC() {
  const kpis = [['Applied', '6', null], ['Replies', '3', '#0F7A5C'], ['Interviews', '2', '#2F5FD0'], ['Follow-ups due', '3', '#B4500F']];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr)' }}>
        <div className="dashrail" style={{ borderRight: '1px solid #F1EFEC', padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {['#F0EDFF', '#F3F1EE', '#F3F1EE', '#F3F1EE'].map((bg, i) => <span key={i} style={{ width: 30, height: 30, borderRadius: 8, background: bg }}></span>)}
        </div>
        <div className="dashmain" style={{ padding: 16, minWidth: 0 }}>
          <div className="di" style={{ animationDelay: '.75s', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span className="h" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>This week</span>
            <span className="mono" style={{ fontSize: 11, color: '#6E6B78' }}>19 – 25 OCT</span>
          </div>
          <div className="kpis" style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
            {kpis.map(([t, v, c], i) => (
              <div key={t} className="di" style={{ ...kpiBox, animationDelay: `${0.82 + i * 0.06}s` }}>
                <div style={{ fontSize: 11, color: '#666666' }}>{t}</div>
                <div className="h" style={{ fontSize: 20, fontWeight: 700, ...(c ? { color: c } : {}) }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)', gap: 10 }}>
            <div className="di dashmain" style={{ animationDelay: '1.05s', border: '1px solid #F1EFEC', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '8px 10px', fontSize: 11.5, fontWeight: 600, color: '#666666', borderBottom: '1px solid #F1EFEC' }}>Applications</div>
              {DASH_APPS.map((r) => (
                <div key={r.co} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid #F7F6F4', fontSize: 12 }}>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><strong>{r.co}</strong> <span style={{ color: '#6E6B78' }}>{r.role}</span></span>
                  <span style={r.style}>{r.status}</span>
                </div>
              ))}
            </div>
            <div className="dashside" style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
              <div className="di" style={{ animationDelay: '1.15s', border: '1px solid #E2DDFB', background: '#FAF9FF', borderRadius: 12, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}><span className="mono" style={{ fontWeight: 600, color: '#5847D6' }}>@cv-writer</span><span style={{ color: '#6E6B78' }}>· Freshworks</span></div>
                <div style={{ position: 'relative', height: 16, marginTop: 5, fontSize: 12, fontWeight: 600 }}>
                  <span className="swA" style={{ position: 'absolute', left: 0, top: 0 }}>Tailoring your CV to the JD…</span>
                  <span className="swB" style={{ position: 'absolute', left: 0, top: 0, color: '#0F7A5C' }}>✓ 3 bullets reworded · 0 added</span>
                </div>
                <div style={{ marginTop: 7, height: 5, borderRadius: 99, background: '#ECE9FB', overflow: 'hidden' }}><div className="fillbar" style={{ height: '100%', width: '100%', borderRadius: 99, background: '#6655E8' }}></div></div>
              </div>
              <div className="di" style={{ animationDelay: '1.25s', border: '1px solid #F1EFEC', borderRadius: 12, padding: 10 }}>
                <div className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: '#2F5FD0' }}>@analyst</div>
                <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45 }}>Fit: <strong>6 of 8</strong> requirements. Gap: Kubernetes.</div>
              </div>
              <div className="di" style={{ animationDelay: '1.35s', border: '1px solid #F1EFEC', borderRadius: 12, padding: 10 }}>
                <div className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: '#B4500F' }}>@strategist</div>
                <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45 }}>Every reply this month came after a referral. Ask first.</div>
              </div>
            </div>
          </div>
          <div className="di" style={{ animationDelay: '1.45s', marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #E8E6E3', borderRadius: 999, padding: '5px 5px 5px 14px' }}>
            <span style={{ flex: 1, fontSize: 12.5, color: '#6E6B78' }}>Ask <span className="mono" style={{ color: '#0F7A5C' }}>@advisor</span> what to apply for next…</span>
            <span style={{ width: 28, height: 28, borderRadius: 99, background: '#6655E8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"></path></svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
