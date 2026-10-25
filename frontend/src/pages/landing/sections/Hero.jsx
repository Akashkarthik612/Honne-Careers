import { Link } from 'react-router-dom';
import { ATS_NAMES } from '../landingData';
import { useJump } from '../landingHooks';
import HeroDemo from './HeroDemo';
import { Chevron } from './parts';

const PRINCIPLES = [
  {
    n: '01', t: 'Tailored, truthfully.', d: 'Your real experience, matched to each JD. Never a fake skill.',
    art: (
      <g fill="none" strokeWidth="1" strokeLinejoin="round">
        <path d="M58 8h50l14 14v68" stroke="#BDB9B2" strokeDasharray="3 3"></path>
        <path d="M34 20h56l14 14v66H34z" stroke="#171717" style={{ fill: '#FFFFFF' }}></path>
        <path d="M90 20v14h14" stroke="#171717"></path>
        <path d="M44 46h46M44 56h52M44 66h40M44 76h48" stroke="#BDB9B2"></path>
        <circle cx="112" cy="84" r="13" stroke="#6655E8" style={{ fill: '#FFFFFF' }}></circle>
        <path d="M106 84l4 4 8-8" stroke="#6655E8" strokeWidth="1.6" strokeLinecap="round"></path>
      </g>
    ),
  },
  {
    n: '02', t: 'Remembers everything.', d: 'Every application, CV, JD and referral in one place your agents can read.',
    art: (
      <g fill="none" strokeWidth="1" strokeLinejoin="round">
        <path d="M80 66 L132 84 L80 102 L28 84Z" stroke="#D9D6D1"></path>
        <path d="M80 52 L132 70 L80 88 L28 70Z" stroke="#BDB9B2" style={{ fill: '#FBFAF8' }}></path>
        <path d="M80 38 L132 56 L80 74 L28 56Z" stroke="#8C8880" style={{ fill: '#FBFAF8' }}></path>
        <path d="M80 24 L132 42 L80 60 L28 42Z" stroke="#171717" style={{ fill: '#FFFFFF' }}></path>
        <path d="M60 42h40M66 36h28M66 48h28" stroke="#BDB9B2"></path>
        <circle cx="80" cy="12" r="4" style={{ fill: '#6655E8' }} stroke="none"></circle>
        <path d="M80 16v8" stroke="#6655E8"></path>
      </g>
    ),
  },
  {
    n: '03', t: 'Learns every week.', d: 'A weekly read on what worked, what didn’t, and what to do next.',
    art: (
      <g fill="none" strokeWidth="1">
        <circle cx="80" cy="56" r="38" stroke="#BDB9B2" strokeDasharray="3 4"></circle>
        <path d="M80 18 A38 38 0 0 1 116 44" stroke="#6655E8" strokeWidth="1.6" strokeLinecap="round"></path>
        <path d="M110 40l6 4 2-7" stroke="#6655E8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path>
        {[[80, 18], [116, 68], [102, 88], [58, 88], [44, 68]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" stroke="#171717" style={{ fill: '#FFFFFF' }}></circle>)}
        <path d="M70 56h20M80 46v20" stroke="#171717"></path>
      </g>
    ),
  },
];

export default function Hero() {
  const jump = useJump();
  return (
    <section id="top" aria-labelledby="hero-h" style={{ position: 'relative', overflow: 'hidden' }}>
      <svg viewBox="0 0 900 1000" aria-hidden="true" className="e0" style={{ position: 'absolute', top: -180, right: -220, width: 980, height: 1090, pointerEvents: 'none', WebkitMaskImage: 'linear-gradient(to left,#000 50%,transparent 95%)', maskImage: 'linear-gradient(to left,#000 50%,transparent 95%)' }}>
        <path fill="url(#lp-rC)" opacity=".7" d="M250 -20 C 420 300 640 650 900 1000 L 900 900 C 680 640 500 330 380 -20 Z"></path>
        <path fill="url(#lp-rA)" d="M330 -20 C 470 210 600 430 900 600 L 900 330 C 740 230 610 110 520 -20 Z"></path>
        <path fill="url(#lp-rB)" opacity=".85" d="M470 -20 C 590 260 700 540 900 900 L 900 580 C 770 420 680 200 640 -20 Z"></path>
        <path fill="url(#lp-rL)" d="M330 -20 C 470 210 600 430 900 600 L 900 330 C 740 230 610 110 520 -20 Z"></path>
      </svg>

      <div className="wrap frame" style={{ position: 'relative' }}>
        <div className="herogrid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)', gap: 48, alignItems: 'center', padding: '88px 0 96px' }}>
          <div>
            <div className="e1" style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#171717' }}>
              <span style={{ fontWeight: 600 }}>Agents shaped by 2,000+ real applications</span>
            </div>
            <h1 id="hero-h" className="h e2" style={{ margin: '20px 0 0', fontSize: 'clamp(42px,5.4vw,72px)', lineHeight: 1.0, letterSpacing: '-0.045em', fontWeight: 700 }}>
              Stop applying blindly. <span className="lead">Start searching <span className="serif" style={{ color: '#6655E8', fontSize: '1.08em' }}>strategically.</span></span>
            </h1>
            <p className="e3" style={{ margin: '22px 0 0', fontSize: 18, lineHeight: 1.6, color: '#666666', maxWidth: 520 }}>
              Your job search deserves more than another CV builder. Meet specialized AI agents that help you prepare stronger applications, understand your progress, and make smarter career decisions.
            </p>
            <p className="e3" style={{ margin: '14px 0 0', display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5, lineHeight: 1.55, color: '#4E4E4E', maxWidth: 520 }}>
              <span aria-hidden="true" style={{ flex: 'none', width: 3, alignSelf: 'stretch', borderRadius: 3, background: '#D9D2FB' }}></span>
              <span>Based on the reviews and real job searches of engineers and job seekers in <strong style={{ color: '#171717', fontWeight: 600 }}>France, India and Germany</strong>.</span>
            </p>
            <div className="e4" style={{ marginTop: 30, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Link className="btn-p" to="/login">Get started <Chevron /></Link>
              <a className="btn-s" href="#how" onClick={jump('how')}>See how Honne works</a>
            </div>
            <div className="e5" style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13, color: '#666666' }}>
              <span className="pill" style={{ background: '#E6F4EE', color: '#0F7A5C' }}>● In beta</span>
              <span>Free while we test. No card needed.</span>
            </div>
          </div>
          <HeroDemo />
        </div>
      </div>

      {/* ATS band */}
      <div style={{ borderTop: '1px solid #E8E6E3', borderBottom: '1px solid #E8E6E3', background: 'rgba(255,255,255,.55)' }}>
        <div className="wrap" style={{ padding: 0 }}>
          <div className="atsgrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', borderLeft: '1px solid #E8E6E3' }}>
            {ATS_NAMES.map((n) => <div key={n} className="atscell">{n}</div>)}
          </div>
          <div className="mono" style={{ padding: '12px 32px', borderTop: '1px solid #E8E6E3', borderLeft: '1px solid #E8E6E3', borderRight: '1px solid #E8E6E3', fontSize: 11, letterSpacing: '.08em', color: '#6E6B78' }}>
            CVS DESIGNED WITH THESE APPLICANT TRACKING SYSTEMS IN MIND
          </div>
        </div>
      </div>

      {/* three principles */}
      <div className="wrap" style={{ padding: 0 }}>
        <div className="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', borderLeft: '1px solid #E8E6E3' }}>
          {PRINCIPLES.map((p) => (
            <div key={p.n} className="pcol">
              <svg viewBox="0 0 160 110" width="160" height="110" aria-hidden="true" style={{ display: 'block' }}>{p.art}</svg>
              <div className="mono" style={{ marginTop: 22, fontSize: 11.5, color: '#6655E8' }}>{p.n}</div>
              <p style={{ margin: '8px 0 0', fontSize: 16, lineHeight: 1.5, maxWidth: 300 }}>
                <strong style={{ fontWeight: 600 }}>{p.t}</strong> <span style={{ color: '#666666' }}>{p.d}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
