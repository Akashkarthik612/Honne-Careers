import { useRef } from 'react';
import elegantTemplate from '@/assets/elegant-template.png';
import CvDoc from '@/components/CvDoc';
import { profileToCv } from '@/data/cvModel';
import { PREVIEW_PROFILE } from '@/data/templatePreview';
import { useReducedMotion } from '../landingHooks';
import { Chevron, Reveal } from './parts';

const SAMPLE = profileToCv(PREVIEW_PROFILE);
const STEP_PX = 330;
const well = { height: 380, overflow: 'hidden', background: '#F3F1EE', borderRadius: 10 };
const ready = { background: '#E6F4EE', color: '#0F7A5C' };
const soon = { background: '#F3F1EE', color: '#4A4A4A' };

// Grey line sketch of a template we don't ship yet; accent = heading colour.
function Sketch({ accent, centred }) {
  const bar = (w, bg, extra) => ({ height: 6, width: w, borderRadius: 99, background: bg, ...extra });
  return (
    <div style={{ width: 270, height: 360, background: '#FFFFFF', padding: 22, display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.6 }}>
      <div style={{ ...bar(centred ? '52%' : '58%', accent), height: centred ? 11 : 12, ...(centred ? { margin: '0 auto' } : {}) }}></div>
      <div style={bar(centred ? '70%' : '44%', '#E8E6E3', centred ? { margin: '0 auto 6px' } : { marginBottom: 8 })}></div>
      {centred && <div style={{ height: 1, background: accent }}></div>}
      <div style={bar(centred ? '30%' : '26%', accent, { marginTop: 6 })}></div>
      {['100%', '88%', '76%'].map((w) => <div key={w} style={bar(w, '#E8E6E3')}></div>)}
      <div style={bar(centred ? '30%' : '26%', accent, { marginTop: 6 })}></div>
      {['90%', '82%'].map((w) => <div key={w} style={bar(w, '#E8E6E3')}></div>)}
    </div>
  );
}

const CARDS = [
  { name: 'Jake’s Resume', live: true, d: 'One page, single column, the format many engineers already use.' },
  { name: 'Elegant', d: 'Formal, with clear section rules.' },
  { name: 'Classic', d: 'Traditional, centred header.', sketch: <Sketch accent="#171717" centred /> },
  { name: 'Modern', d: 'Accent headings, compact skills.', sketch: <Sketch accent="#6655E8" /> },
];

// 08 — templates: a snap-scrolling row. Jake's is the live one (GET /templates); the rest are "Coming soon".
export default function Templates() {
  const reduce = useReducedMotion();
  const track = useRef(null);
  const scroll = (dx) => track.current?.scrollBy({ left: dx, behavior: reduce ? 'auto' : 'smooth' });

  return (
    <section id="templates" aria-labelledby="tp-h" style={{ borderTop: '1px solid #E8E6E3' }}>
      <div className="wrap frame sec">
        <Reveal>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
            <div>
              <div className="lbl">08 — Templates</div>
              <h2 id="tp-h" className="h2">Built for clarity. <span className="lead">Designed for recruiters.</span></h2>
              <p className="sub">Single column, standard section names, real selectable text. Layouts that are easy for both people and parsers to read.</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="iconbtn" onClick={() => scroll(-STEP_PX)} aria-label="Previous templates"><Chevron size={16} dir="left" /></button>
              <button type="button" className="iconbtn" onClick={() => scroll(STEP_PX)} aria-label="Next templates"><Chevron size={16} /></button>
            </div>
          </div>

          <div ref={track} className="tpltrack" tabIndex={0} aria-label="Templates" data-lenis-prevent-horizontal>
            {CARDS.map((c) => (
              <div key={c.name} className="tplcard">
                <div className="card" style={{ padding: 12 }}>
                  {c.live ? (
                    <div style={{ ...well, position: 'relative' }} aria-hidden="true">
                      <div style={{ position: 'absolute', top: 16, left: '50%', width: 794, marginLeft: -397, transform: 'scale(.34)', transformOrigin: 'top center', boxShadow: '0 10px 40px rgba(23,23,23,.18)' }}>
                        <CvDoc cv={SAMPLE} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ ...well, display: 'flex', justifyContent: 'center', paddingTop: 16 }}>
                      {c.sketch || <img src={elegantTemplate} alt="Elegant template preview" loading="lazy" style={{ width: 270, height: 'auto', alignSelf: 'flex-start', opacity: 0.55, boxShadow: '0 10px 30px rgba(23,23,23,.12)' }} />}
                    </div>
                  )}
                  <div style={{ padding: '12px 4px 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span className="h" style={{ fontSize: 17, fontWeight: 700 }}>{c.name}</span>
                    <span className="pill" style={c.live ? ready : soon}>{c.live ? 'Available' : 'Coming soon'}</span>
                  </div>
                  <div style={{ padding: '2px 4px', fontSize: 13, color: '#666666' }}>{c.d}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
