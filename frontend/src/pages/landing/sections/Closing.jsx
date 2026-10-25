import { Link } from 'react-router-dom';
import { useJump } from '../landingHooks';
import { Chevron, Reveal, Wordmark } from './parts';

// From the founders, the final call to action and the footer.
export default function Closing() {
  const jump = useJump();
  return (
    <>
      <section aria-label="From the founders" style={{ borderTop: '1px solid #E8E6E3' }}>
        <div className="wrap frame sec">
          <Reveal as="figure" style={{ margin: 0, maxWidth: 920 }}>
            <div className="lbl">From the founders</div>
            <blockquote className="serif" style={{ margin: '18px 0 0', fontSize: 'clamp(30px,3.6vw,48px)', lineHeight: 1.15, color: '#171717' }}>
              “The hardest thing? Applying to hundreds every day and hearing nothing back. No dopamine hit. Just slowly losing your confidence.”
            </blockquote>
            <p style={{ margin: '24px 0 0', fontSize: 18, lineHeight: 1.6, color: '#666666', maxWidth: 640 }}>So stay conscious. Apply where you have a real shot. Get referrals. Track what you’re doing, and start again from where it didn’t work, not from scratch.</p>
            <figcaption style={{ marginTop: 22, fontSize: 14, fontWeight: 600 }}>The founders of Honne Careers <span style={{ fontWeight: 400, color: '#666666' }}>· learned from 2,000+ applications, ours and our friends’</span></figcaption>
          </Reveal>
        </div>
      </section>

      <section id="cta" aria-labelledby="cta-h" style={{ borderTop: '1px solid #E8E6E3' }}>
        <div className="wrap frame" style={{ padding: '96px 32px' }}>
          <Reveal style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, padding: 'clamp(40px,7vw,88px) clamp(24px,6vw,72px)', background: 'linear-gradient(125deg,#FBFAF8 0%,#F0EDFF 30%,#E2EBFF 55%,#FCE6F0 78%,#FFF1E6 100%)', border: '1px solid #E8E6E3' }}>
            <svg viewBox="0 0 900 1000" aria-hidden="true" style={{ position: 'absolute', right: -260, top: -300, width: 760, height: 840, opacity: 0.55, pointerEvents: 'none' }}>
              <path fill="url(#lp-rA)" d="M330 -20 C 470 210 600 430 900 600 L 900 330 C 740 230 610 110 520 -20 Z"></path>
              <path fill="url(#lp-rB)" opacity=".8" d="M470 -20 C 590 260 700 540 900 900 L 900 580 C 770 420 680 200 640 -20 Z"></path>
            </svg>
            <div style={{ position: 'relative', maxWidth: 640 }}>
              <h2 id="cta-h" className="h" style={{ margin: 0, fontSize: 'clamp(36px,4.8vw,60px)', lineHeight: 1.02, letterSpacing: '-0.045em', fontWeight: 700 }}>
                Your career deserves a <span className="serif" style={{ color: '#6655E8', fontSize: '1.08em' }}>better strategy.</span>
              </h2>
              <p style={{ margin: '20px 0 0', fontSize: 18, lineHeight: 1.6, color: '#4E4E4E' }}>Build stronger applications, stay organized, and approach your next opportunity with clarity.</p>
              <div style={{ marginTop: 30, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <Link className="btn-p" to="/login">Join Honne Careers <Chevron /></Link>
                <a className="btn-s" href="#how" onClick={jump('how')}>Explore the platform</a>
              </div>
              <div style={{ marginTop: 16, fontSize: 13, color: '#666666' }}>Free while in beta.</div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid #E8E6E3' }}>
        <div className="wrap frame" style={{ padding: '40px 32px', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Wordmark size={16} /><span style={{ fontSize: 13, color: '#6E6B78' }}>© 2026</span></div>
          <nav aria-label="Footer" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <a className="navl" href="#how" onClick={jump('how')} style={{ color: '#666666' }}>Agents</a>
            <a className="navl" href="#tailor" onClick={jump('tailor')} style={{ color: '#666666' }}>CV tailoring</a>
            <a className="navl" href="#templates" onClick={jump('templates')} style={{ color: '#666666' }}>Templates</a>
            <Link className="navl" to="/login" style={{ color: '#666666' }}>Sign in</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
