import { Reveal } from './parts';

// Spokes from the hub; dots travel along them (SMIL), hidden with reduced motion (.mdot).
const SPOKES = [[260, 62], [440, 150], [410, 370], [110, 370], [80, 150]];
const DOTS = [
  ['#6655E8', 0, 'M260 62 L260 220', 4], ['#2F5FD0', 0.5, 'M440 150 L260 220', 4], ['#0F7A5C', 1, 'M410 370 L260 220', 4],
  ['#B4500F', 1.5, 'M110 370 L260 220', 4], ['#6655E8', 2, 'M260 220 L80 150', 4], ['#B9B0F5', 1.3, 'M260 220 L440 150', 3],
];
const NODES = [[200, 40, 120, 260, 'Your profile'], [380, 128, 120, 440, 'Your CVs'], [340, 348, 140, 410, 'Job descriptions'], [40, 348, 140, 110, 'Applications']];

// 05 — Honne IQ: one shared context every agent reads.
export default function HonneIq() {
  return (
    <section id="iq" aria-labelledby="iq-h" style={{ borderTop: '1px solid #E8E6E3', background: 'radial-gradient(60% 70% at 72% 50%,#F1EEFF 0%,rgba(241,238,255,0) 70%),radial-gradient(40% 50% at 90% 20%,#FDEFF5 0%,rgba(253,239,245,0) 70%)' }}>
      <div className="wrap frame sec">
        <Reveal className="g2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,5fr) minmax(0,6fr)', gap: 48, alignItems: 'center' }}>
          <div>
            <span className="lbl">Honne IQ</span>
            <h2 id="iq-h" className="h2">Your career context. <span className="lead">Working together.</span></h2>
            <p className="sub">Keep your profile and application records together. When you need to follow up or prepare for an interview, open the job description and the resume you downloaded for that role.</p>
            <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="card" style={{ padding: 16, background: '#FFFFFF' }}><strong>Application history</strong><p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55, color: '#666666' }}>Update your status as you apply, hear back or get an interview.</p></div>
              <div className="card" style={{ padding: 16, borderColor: '#D9D2FB', background: '#FAF9FF' }}><strong>Advice with context</strong><p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55, color: '#171717' }}>Ask an agent for help using the profile and application activity you’ve saved.</p></div>
            </div>
          </div>
          <div className="card" style={{ padding: 12, background: 'rgba(255,255,255,.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
            <svg viewBox="0 0 520 440" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Honne IQ in the centre, connected to your profile, CVs, job descriptions, applications and agents, with information flowing between them">
              <g style={{ stroke: '#DCD5FF', strokeWidth: 1.5 }}>
                {SPOKES.map(([x, y]) => <line key={`${x}-${y}`} x1="260" y1="220" x2={x} y2={y}></line>)}
              </g>
              <g className="mdot">
                {DOTS.map(([fill, begin, path, r]) => (
                  <circle key={path} r={r} style={{ fill }}><animateMotion dur="2.6s" begin={`${begin}s`} repeatCount="indefinite" path={path}></animateMotion></circle>
                ))}
              </g>
              <circle cx="260" cy="220" r="70" style={{ fill: '#EDE9FF' }}></circle>
              <circle cx="260" cy="220" r="54" style={{ fill: '#6655E8' }}></circle>
              <text x="260" y="216" textAnchor="middle" style={{ fontFamily: "'Plus Jakarta Sans',Arial,sans-serif", fontSize: 16, fontWeight: 700, fill: '#FFFFFF' }}>Honne IQ</text>
              <text x="260" y="235" textAnchor="middle" style={{ fontFamily: 'Inter,Arial,sans-serif', fontSize: 11, fill: '#F3F1FF' }}>tell it once</text>
              <g style={{ fontFamily: 'Inter,Arial,sans-serif', fontSize: 13, fontWeight: 600, fill: '#171717' }}>
                {NODES.map(([x, y, w, tx, label]) => (
                  <g key={label}>
                    <rect x={x} y={y} width={w} height="44" rx="12" style={{ fill: '#FFFFFF', stroke: '#E8E6E3' }}></rect>
                    <text x={tx} y={y + 27} textAnchor="middle">{label}</text>
                  </g>
                ))}
                <rect x="20" y="128" width="120" height="44" rx="12" style={{ fill: '#F0EDFF', stroke: '#D9D2FB' }}></rect>
                <text x="80" y="155" textAnchor="middle" style={{ fill: '#4A3BC4' }}>Your agents</text>
              </g>
            </svg>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
