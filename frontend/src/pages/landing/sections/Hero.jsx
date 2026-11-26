import { Link } from 'react-router-dom';
import { useJump } from '../landingHooks';
import HeroDemo from './HeroDemo';
import { Chevron } from './parts';

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
        <div className="herogrid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)', gap: 48, alignItems: 'center' }}>
          <div>
            <h1 id="hero-h" className="h e2" style={{ margin: 0, fontSize: 'clamp(40px,5vw,66px)', lineHeight: 1.02, letterSpacing: '-0.045em', fontWeight: 700 }}>
              Tailor your resume. <span className="serif" style={{ color: '#6655E8' }}>Track every application.</span>
            </h1>
            <p className="e3" style={{ margin: '20px 0 0', fontSize: 18, lineHeight: 1.6, color: '#555555', maxWidth: 470 }}>
              Applying for your first job? Turn your degree, projects and internships into a resume for a specific role. Download the PDF and keep it with the job description.
            </p>
            <div className="e4" style={{ marginTop: 26, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Link className="btn-p" to="/new/template?template=graduate">Build my resume <Chevron /></Link>
              <a className="btn-s" href="#templates" onClick={jump('templates')}>Browse templates</a>
            </div>
            <p className="e5" style={{ margin: '14px 0 0', fontSize: 14, color: '#555555' }}>Free during beta. No card required.</p>
          </div>
          <HeroDemo />
        </div>
      </div>

    </section>
  );
}
