import { useState } from 'react';
import { BUILDER_KNOWLEDGE, BUILDER_RESP, BUILDER_TEMPLATES, previewHandle } from '../landingData';
import { Reveal } from './parts';

const START = BUILDER_TEMPLATES[0];

// 07 — custom agents: a toy version of the agent builder. Nothing is saved or sent.
export default function Builder() {
  const [tpl, setTpl] = useState(START.id);
  const [name, setName] = useState(START.name);
  const [resp, setResp] = useState(START.resp);
  const [kn, setKn] = useState(START.kn);

  const R = BUILDER_RESP[resp];
  const handle = previewHandle(name);
  const knOn = BUILDER_KNOWLEDGE.filter(([k]) => kn[k]).map(([, label]) => label);
  const pickTpl = (t) => { setTpl(t.id); setName(t.name); setResp(t.resp); setKn({ ...t.kn }); };

  return (
    <section id="builder" aria-labelledby="bd-h" style={{ borderTop: '1px solid #E8E6E3' }}>
      <div className="wrap frame sec">
        <Reveal>
          <div className="split">
            <div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><span className="lbl">07 — Custom agents</span><span className="pill" style={{ background: '#E6F4EE', color: '#0F7A5C' }}>● Available in beta</span></div>
              <h2 id="bd-h" className="h2">Your workflow. <span className="lead">Your agents.</span></h2>
            </div>
            <p className="sub" style={{ margin: '0 0 6px' }}>If our agents don&apos;t do it yet, describe it once. Your agent gets the same context as ours, and you call it in chat with @.</p>
          </div>

          <div className="g2" style={{ marginTop: 34, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 18, alignItems: 'start' }}>
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Start from a template</div>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {BUILDER_TEMPLATES.map((t) => (
                    <button key={t.id} type="button" className={`pillbtn${tpl === t.id ? ' on' : ''}`} onClick={() => pickTpl(t)} aria-pressed={tpl === t.id}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="lp-b-name" style={{ fontSize: 13, fontWeight: 600 }}>Name</label>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', border: '1px solid #E8E6E3', borderRadius: 10, background: '#FBFAF8', paddingLeft: 12 }}>
                  <span className="mono" style={{ color: '#6655E8', fontWeight: 600 }} aria-hidden="true">@</span>
                  <input id="lp-b-name" type="text" value={name} maxLength={40} onChange={(e) => { setName(e.target.value); setTpl(''); }} autoComplete="off" style={{ flex: 1, minWidth: 0, minHeight: 44, border: 0, outline: 'none', background: 'transparent', padding: '0 8px', fontFamily: "'JetBrains Mono',monospace", fontSize: 14, color: '#171717' }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>What should it do?</div>
                <div role="radiogroup" aria-label="Responsibility" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(BUILDER_RESP).map(([k, r]) => {
                    const on = resp === k;
                    return (
                      <button key={k} type="button" role="radio" aria-checked={on} onClick={() => { setResp(k); setTpl(''); }} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: '0 12px', borderRadius: 10, fontSize: 14, fontWeight: 500, textAlign: 'left', cursor: 'pointer', color: '#171717', transition: 'all .16s ease', border: `1px solid ${on ? '#6655E8' : '#E8E6E3'}`, background: on ? '#FAF9FF' : '#FFFFFF' }}>
                        <span style={{ flex: 'none', width: 16, height: 16, borderRadius: 99, transition: 'border .16s ease', border: on ? '5px solid #6655E8' : '1.5px solid #BDB9B2' }}></span>{r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>What can it read?</div>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {BUILDER_KNOWLEDGE.map(([k, label]) => (
                    <button key={k} type="button" className={`pillbtn${kn[k] ? ' on' : ''}`} aria-pressed={!!kn[k]} onClick={() => { setKn((prev) => ({ ...prev, [k]: !prev[k] })); setTpl(''); }}>
                      {kn[k] ? '✓' : '+'} {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="card" style={{ padding: 18, borderStyle: 'dashed', borderColor: '#C9C2F5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 42, height: 42, borderRadius: 12, background: '#171717', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={R.icon}></path></svg>
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{handle}</div>
                    <div style={{ fontSize: 12.5, color: '#666666' }}>Your agent · ready to use in chat</div>
                  </div>
                </div>
                <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.55, color: '#3A3A3A' }}>{R.desc}</p>
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#666666' }}>Reads:</span>
                  {knOn.map((k) => <span key={k} className="pill" style={{ background: '#F3F1EE', color: '#171717' }}>{k}</span>)}
                  {knOn.length === 0 && <span style={{ fontSize: 12.5, color: '#B4500F' }}>Pick at least one source</span>}
                </div>
              </div>
              <div className="card" style={{ padding: 16, background: '#FCFCFB', display: 'flex', flexDirection: 'column', gap: 10 }} aria-live="polite">
                <div className="mono" style={{ fontSize: 10.5, color: '#6E6B78' }}>PREVIEW · CHAT</div>
                <div style={{ alignSelf: 'flex-end', maxWidth: '85%', background: '#F0EDFF', borderRadius: '14px 14px 4px 14px', padding: '10px 12px', fontSize: 13.5, lineHeight: 1.5 }}>
                  <span className="mono" style={{ color: '#5847D6' }}>{handle}</span> {R.ask}
                </div>
                <div key={resp} className="rise" style={{ maxWidth: '92%', background: '#FFFFFF', border: '1px solid #E8E6E3', borderRadius: '14px 14px 14px 4px', padding: '10px 12px', fontSize: 13.5, lineHeight: 1.55 }}>
                  {R.reply}
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#3A3A3A' }}>{R.items.map((i) => <li key={i} style={{ marginTop: 2 }}>{i}</li>)}</ul>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
