import { useState } from 'react';
import { ADVISOR_RECS, AGENTS, AGENT_POS, ANALYST_ROWS, STRATEGIST_BARS } from '../landingData';
import { useJump } from '../landingHooks';
import { Icon2, Reveal } from './parts';

const HUB = [260, 205];

// 03 — your AI team: a list of agents (sticky on desktop, a tab strip on phones), the
// orchestration diagram and a sample of the picked agent's work.
export default function Agents() {
  const [agent, setAgent] = useState('writer');
  const [miniSaved, setMiniSaved] = useState(false);
  const jump = useJump();
  const cur = AGENTS.find((a) => a.id === agent) || AGENTS[0];
  const pick = (id) => { setAgent(id); setMiniSaved(false); };

  return (
    <section id="how" aria-labelledby="ag-h" style={{ borderTop: '1px solid #E8E6E3' }}>
      <div className="wrap frame sec">
        <Reveal>
          <div className="lbl">03 — Your AI team</div>
          <h2 id="ag-h" className="h2">One goal. <span className="lead">A team of specialized agents.</span></h2>
          <p className="sub">Each agent does one job well. They share what they know, so you never brief them twice. Pick one to see its work.</p>

          <div className="agrid" style={{ marginTop: 36, display: 'grid', gridTemplateColumns: '230px minmax(0,1fr)', gap: 28, alignItems: 'start' }}>
            <div className="alist" role="tablist" aria-label="Agents" aria-orientation="vertical">
              {AGENTS.map((a) => {
                const on = a.id === agent;
                return (
                  <button key={a.id} type="button" role="tab" className="aitem" aria-selected={on} onClick={() => pick(a.id)} style={{ '--ac': a.c }}>
                    <span aria-hidden="true" style={{ flex: 'none', width: 34, height: 34, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? a.bg : '#F3F1EE', color: on ? a.c : '#6E6B78', transition: 'all .2s ease', ...(a.id === 'custom' ? { border: '1px dashed #BDB9B2' } : {}) }}>
                      <Icon2 d1={a.d1} d2={a.d2} />
                    </span>
                    <span>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{a.name}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: '#6E6B78' }}>{a.status}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)', gap: 18, alignItems: 'stretch' }}>
              <div className="card hideM" style={{ padding: 16, position: 'relative', background: 'radial-gradient(circle at 50% 46%,#F4F1FF 0,#FFFFFF 62%)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="mono" style={{ fontSize: 11, color: '#6E6B78' }}>HOW THEY CONNECT</span><span className="tag">LIVE DEMO</span></div>
                <Diagram agent={agent} curName={cur.name} onPick={pick} />
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 440 }} role="tabpanel" aria-label={cur.name}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid #F1EFEC' }}>
                  <span aria-hidden="true" style={{ flex: 'none', width: 40, height: 40, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: cur.bg, color: cur.c }}><Icon2 d1={cur.d1} d2={cur.d2} size={18} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span className="h" style={{ fontSize: 17, fontWeight: 700 }}>{cur.name}</span><span className="mono" style={{ fontSize: 12.5, color: cur.ink }}>{cur.handle}</span></div>
                    <div style={{ fontSize: 13.5, color: '#666666', marginTop: 2 }}>{cur.role}</div>
                  </div>
                  <span className="tag">SAMPLE</span>
                </div>
                <div style={{ flex: 1, padding: 18, background: '#FCFCFB' }}>
                  {agent === 'writer' && <WriterPanel />}
                  {agent === 'analyst' && <AnalystPanel />}
                  {agent === 'advisor' && <AdvisorPanel />}
                  {agent === 'strategist' && <StrategistPanel />}
                  {agent === 'custom' && <CustomPanel saved={miniSaved} onSave={() => setMiniSaved(true)} onBuild={jump('builder')} />}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Diagram({ agent, curName, onPick }) {
  return (
    <svg viewBox="0 0 520 420" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`Five agents connected to Honne IQ. ${curName} is selected.`}>
      {AGENTS.map((a, i) => {
        const on = a.id === agent;
        const [x, y] = AGENT_POS[i];
        return (
          <line key={a.id} x1={HUB[0]} y1={HUB[1]} x2={x} y2={y} className={on ? 'flow' : ''}
            style={on ? { stroke: a.c, strokeWidth: 2.5, strokeDasharray: '6 8', strokeLinecap: 'round' } : { stroke: '#E8E6E3', strokeWidth: 1.5 }}></line>
        );
      })}
      <circle cx={HUB[0]} cy={HUB[1]} r="62" style={{ fill: '#F0EDFF' }}></circle>
      <circle cx={HUB[0]} cy={HUB[1]} r="48" style={{ fill: '#6655E8' }}></circle>
      <text x="260" y="201" textAnchor="middle" style={{ fontFamily: "'Plus Jakarta Sans',Arial,sans-serif", fontSize: 14, fontWeight: 700, fill: '#FFFFFF' }}>Honne IQ</text>
      <text x="260" y="219" textAnchor="middle" style={{ fontFamily: 'Inter,Arial,sans-serif', fontSize: 10.5, fill: '#F3F1FF' }}>shared context</text>
      {AGENTS.map((a, i) => {
        const on = a.id === agent;
        const [x, y] = AGENT_POS[i];
        const ty = y + (y < HUB[1] ? (i === 0 ? -44 : 52) : 54);
        return (
          <g key={a.id} onClick={() => onPick(a.id)} style={{ cursor: 'pointer' }}>
            <circle cx={x} cy={y} r={on ? 34 : 28} style={{ fill: on ? a.bg : '#FFFFFF', stroke: on ? a.c : '#E8E6E3', strokeWidth: on ? 2 : 1.5, transition: 'all .25s ease' }}></circle>
            <g transform={`translate(${x - 12} ${y - 12})`} style={{ fill: 'none', stroke: on ? a.c : '#6E6B78', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d={a.d1}></path><path d={a.d2}></path></g>
            <text x={x} y={ty} textAnchor="middle" style={{ fontFamily: 'Inter,Arial,sans-serif', fontSize: 13, fontWeight: on ? 700 : 500, fill: on ? '#171717' : '#666666' }}>{a.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

const jdPill = { background: '#F0EDFF', color: '#5847D6' };

function WriterPanel() {
  return (
    <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: '#666666' }}>Tailoring for <strong style={{ color: '#171717' }}>SDE-2, Backend · Freshworks</strong></div>
      <div className="card" style={{ padding: '14px 16px' }}>
        <div className="mono" style={{ fontSize: 10.5, color: '#6E6B78' }}>BEFORE</div>
        <div style={{ marginTop: 4, fontSize: 14, lineHeight: 1.55, color: '#6E6B78', textDecoration: 'line-through', textDecorationColor: '#CFCBC5' }}>Moved the ledger service to Kafka Streams in Java on AWS; p95 latency went down about 38%.</div>
        <div className="mono" style={{ marginTop: 12, fontSize: 10.5, color: '#6655E8' }}>AFTER</div>
        <div className="typed" style={{ marginTop: 4, fontSize: 14, lineHeight: 1.55 }}>Cut payment-event latency by 38% (p95) by moving the ledger service to <mark style={{ background: '#F0EDFF', color: '#4A3BC4', borderRadius: 4, padding: '0 3px' }}>event-driven</mark> Kafka Streams in Java on AWS.</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12.5, color: '#666666' }}>
        JD words used: {['event-driven', 'latency', 'Kafka'].map((w) => <span key={w} className="pill" style={jdPill}>{w}</span>)}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#E6F4EE', color: '#0F5E47', borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.5 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', marginTop: 2 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        <span>Same facts, same 38%. Only the wording and order change. Nothing is added that isn&apos;t already in your profile.</span>
      </div>
    </div>
  );
}

function AnalystPanel() {
  return (
    <div className="rise">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}><span style={{ fontSize: 13, color: '#666666' }}>SDE-2, Backend · Freshworks</span><span style={{ fontSize: 13 }}><strong>6 of 8</strong> requirements</span></div>
      <div style={{ marginTop: 8, height: 8, borderRadius: 99, background: '#EAF0FD', overflow: 'hidden' }}><div style={{ width: '75%', height: '100%', background: '#2F5FD0', borderRadius: 99 }}></div></div>
      <div className="card" style={{ marginTop: 14, overflow: 'hidden' }}>
        {ANALYST_ROWS.map((r) => (
          <div key={r.req} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1.4fr) auto', gap: 10, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #F3F1EE', fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{r.req}</span><span style={{ color: '#666666' }}>{r.ev}</span><span style={r.style}>{r.s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdvisorPanel() {
  return (
    <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, color: '#666666' }}>Based on your profile and your last 20 applications</div>
      {ADVISOR_RECS.map((r) => (
        <div key={r.n} className="card" style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span className="mono" style={{ flex: 'none', width: 26, height: 26, borderRadius: 8, background: '#E6F4EE', color: '#0F7A5C', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{r.n}</span>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14.5, fontWeight: 600 }}>{r.t}</div><div style={{ marginTop: 3, fontSize: 13, color: '#666666', lineHeight: 1.5 }}>{r.why}</div></div>
          <span style={r.style}>{r.tag}</span>
        </div>
      ))}
    </div>
  );
}

function StrategistPanel() {
  return (
    <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: '#666666' }}>Weekly review · 12 – 18 Oct</div>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {STRATEGIST_BARS.map((b) => (
          <div key={b.t}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{b.t}</span><strong>{b.v}</strong></div>
            <div style={{ marginTop: 5, height: 8, borderRadius: 99, background: '#F3F1EE', overflow: 'hidden' }}><div style={{ height: '100%', width: b.width, borderRadius: 99, background: b.color }}></div></div>
          </div>
        ))}
      </div>
      <div className="g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="card" style={{ padding: '12px 14px' }}><div className="mono" style={{ fontSize: 10.5, color: '#0F7A5C' }}>WORKED</div><div style={{ marginTop: 4, fontSize: 13.5, lineHeight: 1.5 }}>Applications with a referral. Roles asking for 2–4 years.</div></div>
        <div className="card" style={{ padding: '12px 14px' }}><div className="mono" style={{ fontSize: 10.5, color: '#B4500F' }}>DIDN&apos;T</div><div style={{ marginTop: 4, fontSize: 13.5, lineHeight: 1.5 }}>Easy Apply without a referral. Roles asking for 8+ years.</div></div>
      </div>
      <div className="card" style={{ padding: '12px 14px', borderColor: '#F3D8C4', background: '#FFFBF7' }}><div className="mono" style={{ fontSize: 10.5, color: '#B4500F' }}>NEXT WEEK</div><div style={{ marginTop: 4, fontSize: 13.5, lineHeight: 1.5 }}>3 referral asks first, then 5 targeted applications. Follow up with Groww and Flipkart.</div></div>
    </div>
  );
}

const fieldBox = { marginTop: 4, border: '1px solid #E8E6E3', borderRadius: 10, padding: '10px 12px', background: '#FBFAF8' };

function CustomPanel({ saved, onSave, onBuild }) {
  return (
    <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: '#666666' }}>Name</div><div className="mono" style={{ ...fieldBox, fontSize: 14 }}><span style={{ color: '#6655E8' }}>@</span>interview-prep</div></div>
        <div><div style={{ fontSize: 12, fontWeight: 600, color: '#666666' }}>Instructions</div><div style={{ ...fieldBox, fontSize: 13.5, lineHeight: 1.5 }}>Before each interview, read the JD and the CV I sent. Give me likely questions and answers using only my real experience.</div></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#666666', marginRight: 4 }}>Can read</span>
          <span className="pill" style={{ background: '#F3F1EE', color: '#171717' }}>Profile</span><span className="pill" style={{ background: '#F3F1EE', color: '#171717' }}>Applications</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
          {saved && <span className="rise" style={{ fontSize: 13, fontWeight: 600, color: '#0F7A5C' }}>✓ Type @interview-prep in any chat</span>}
          <button type="button" className="btn-p" onClick={onSave} style={{ minHeight: 40, fontSize: 14 }}>{saved ? 'Saved' : 'Save agent'}</button>
        </div>
      </div>
      <a href="#builder" onClick={onBuild} style={{ fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>Try building one yourself ↓</a>
    </div>
  );
}
