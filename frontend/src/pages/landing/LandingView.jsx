import { Link } from 'react-router-dom';
import elegantTemplate from '@/assets/elegant-template.png';

// Landing page ported from the Claude Design canvas "Honne Careers Landing Page" (Main.dc.html).
// Markup only; LandingPage.jsx owns state. Styles live in landing.css, scoped under .hc-landing.

export default function LandingView({ words, wordShift }) {
  return (
    <div className="hc-landing" style={{ width: '100%', background: '#FAFAFA', overflowX: 'hidden' }}>

    {/* NAV */}
    <header style={{ position: 'sticky', top: '0', zIndex: '20', background: 'rgba(250,250,250,.82)', backdropFilter: 'saturate(1.4) blur(14px)', WebkitBackdropFilter: 'saturate(1.4) blur(14px)', borderBottom: '1px solid rgba(228,230,238,.8)' }}>
      <nav aria-label="Main" style={{ maxWidth: '1240px', margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <a href="#top" aria-label="Honne Careers home" style={{ textDecoration: 'none', color: '#161A2B', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '32px', height: '32px', borderRadius: '9px', background: '#FFFFFF', border: '1px solid #E4E6EE', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="20" viewBox="-50 -40 100 80" aria-hidden="true"><path className="br" style={{ strokeWidth: '3.5' }} d="M-36 8 C-46 6 -46 -12 -34 -14 C-36 -28 -18 -34 -10 -26 C-6 -36 10 -36 14 -26 C24 -34 40 -26 36 -12 C48 -8 46 10 36 12 C38 26 20 32 12 24 C6 32 -10 32 -14 24 C-26 32 -42 22 -36 8 Z"></path><circle className="pu" cx="-10" cy="4" r="5"></circle><circle className="pu" cx="12" cy="4" r="5"></circle></svg>
          </span>
          <span className="disp" style={{ fontWeight: '800', fontSize: '21px', letterSpacing: '-0.03em' }}>Honne <span style={{ fontWeight: '500', color: '#5A6075' }}>Careers</span></span>
        </a>
        <div className="navlinks" style={{ fontSize: '15px', fontWeight: '500' }}>
          <a href="#agents" style={{ color: '#161A2B', textDecoration: 'none' }}>Agents</a>
          <a href="#how" style={{ color: '#161A2B', textDecoration: 'none' }}>How it works</a>
          <a href="#ats" style={{ color: '#161A2B', textDecoration: 'none' }}>ATS</a>
          <a href="#templates" style={{ color: '#161A2B', textDecoration: 'none' }}>Templates</a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link to="/login" style={{ color: '#161A2B', textDecoration: 'none', fontSize: '15px', fontWeight: '500', padding: '12px 12px' }}>Log in</Link>
          <Link className="btn" to="/login" style={{ background: '#161A2B', color: '#FFFFFF', textDecoration: 'none', fontSize: '15px', fontWeight: '600', padding: '11px 20px', borderRadius: '999px', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>Join the beta</Link>
        </div>
      </nav>
    </header>

    {/* HERO */}
    <section id="top" style={{ position: 'relative' }}>
      <div className="hero-bg" aria-hidden="true" style={{ position: 'absolute', inset: '0', pointerEvents: 'none' }}></div>
      <div style={{ position: 'relative', maxWidth: '1240px', margin: '0 auto', padding: '40px 24px 32px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '40px' }}>
        <div style={{ flex: '1 1 460px', minWidth: '0' }}>
          <a className="rise" href="#how" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#FFFFFF', border: '1px solid #E4E6EE', color: '#161A2B', textDecoration: 'none', borderRadius: '999px', padding: '6px 14px 6px 6px', fontSize: '13px', fontWeight: '600', boxShadow: '0 1px 2px rgba(22,26,43,.05)' }}>
            <span style={{ background: '#E9ECF9', color: '#3F5FD8', borderRadius: '999px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span className="dot" style={{ width: '6px', height: '6px', borderRadius: '999px', background: '#3F5FD8', display: 'inline-block' }}></span>New</span>
            Meet Honne IQ — your whole job search in one place
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
          </a>
          <h1 className="disp rise d1" style={{ margin: '24px 0 0', fontSize: 'clamp(44px,5.8vw,78px)', lineHeight: '1.0', fontWeight: '800', letterSpacing: '-0.04em' }}>
            Stop applying <span className="serif" style={{ color: '#C2410C', fontSize: '1.1em' }}>blind.</span><br />
            Start getting<br />
            <span style={{ display: 'inline-block', height: '1.08em', overflow: 'hidden', verticalAlign: 'bottom' }}>
              <span style={{ display: 'flex', flexDirection: 'column', transform: `translateY(${wordShift})`, transition: 'transform .7s cubic-bezier(.7,0,.2,1)' }}>
                {words.map((w) => (
                  <span key={w} style={{ display: 'block', height: '1.08em', lineHeight: '1.08em', color: '#3F5FD8' }}>{w}</span>
                ))}
              </span>
            </span>
          </h1>
          <p className="rise d2" style={{ margin: '24px 0 0', fontSize: 'clamp(17px,1.5vw,20px)', lineHeight: '1.55', color: '#5A6075', maxWidth: '540px' }}>
            <strong style={{ color: '#161A2B' }}>Specialised AI agents for every repetitive and thinking task</strong> in your job search — all working on your Honne IQ.<br />
            <strong style={{ color: '#161A2B' }}>Built for the worst job market in a decade.</strong>
          </p>
          <div className="rise d3" style={{ marginTop: '30px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <Link className="btn" to="/login" style={{ background: '#3F5FD8', color: '#FFFFFF', textDecoration: 'none', fontSize: '17px', fontWeight: '600', padding: '16px 28px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '10px', minHeight: '54px', boxShadow: '0 1px 0 rgba(255,255,255,.25) inset,0 8px 20px rgba(63,95,216,.28)' }}>
              Ready to get hired
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
            </Link>
            <a className="btn" href="#how" style={{ background: '#FFFFFF', color: '#161A2B', textDecoration: 'none', fontSize: '17px', fontWeight: '600', padding: '16px 26px', borderRadius: '999px', border: '1px solid #E4E6EE', display: 'inline-flex', alignItems: 'center', minHeight: '54px' }}>See how it works</a>
          </div>
          <div className="rise d4" style={{ marginTop: '30px', display: 'flex', alignItems: 'flex-start', gap: '12px', maxWidth: '540px', padding: '16px 18px', background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px' }}>
            <span style={{ flex: 'none', width: '34px', height: '34px', borderRadius: '10px', background: '#161A2B', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z"></path><path d="M9 12l2 2 4-4"></path></svg>
            </span>
            <span style={{ fontSize: '14px', lineHeight: '1.5', color: '#5A6075' }}><strong style={{ color: '#161A2B' }}>Built from 5,000+ real applications</strong> — ours and our friends’, job hunting after Master’s and PhDs in Paris, Berlin and India. Made for today’s post-AI market, where blind applying stopped working.</span>
          </div>
        </div>

        {/* OPEN AGENT SCENE */}
        <div className="rise d3" style={{ flex: '1 1 520px', minWidth: '0', maxWidth: '640px', marginTop: '30px' }}>
          <svg className="scene" viewBox="0 0 600 500" width="100%" role="img" aria-label="Line-drawn brain agents at work: a CV writer drafts a CV that flows to an analyst, then to an advisor, then up to a strategist planning what went wrong on a whiteboard; a fifth agent waits to be customised" style={{ display: 'block', overflow: 'visible' }}>

            {/* route the CV travels */}
            <path className="trail" d="M184 362 C200 380 214 384 228 384 M258 380 C310 340 380 336 424 356 M440 350 C440 260 410 200 388 152"></path>
            <line className="desk" x1="30" y1="446" x2="570" y2="446"></line>

            {/* WHITEBOARD + STRATEGIST */}
            <rect className="board" x="235" y="22" width="220" height="128" rx="6"></rect>
            <line x1="245" y1="150" x2="445" y2="150" style={{ stroke: '#161A2B', strokeWidth: '3', strokeLinecap: 'round' }}></line>
            <path className="limb" d="M262 150 L254 172 M428 150 L436 172"></path>
            <text className="btitle" x="250" y="44">WEEK 6 · WHAT WENT WRONG?</text>
            <line className="dash" x1="250" y1="52" x2="440" y2="52"></line>
            <g className="st1"><text className="bitem" x="250" y="72">✕ 14 blind applications</text></g>
            <line className="strike" x1="262" y1="68" x2="382" y2="68"></line>
            <g className="st2"><text className="bitem" x="250" y="92">✕ 0 referrals asked</text></g>
            <line className="strike" x1="262" y1="88" x2="362" y2="88" style={{ animationDelay: '1.2s' }}></line>
            <g className="st4"><text className="bitem" x="250" y="116">→ 5 sure-shot applications</text></g>
            <g className="st5"><text className="bitem" x="250" y="136">→ 3 referral asks</text></g>
            <ellipse className="circ" cx="306" cy="132" rx="62" ry="11"></ellipse>

            <g transform="translate(168 104)">
              <g className="bob4">
                <path className="limb" d="M-10 26 L-12 40 M10 26 L12 40"></path>
                <ellipse className="foot" cx="-14" cy="41" rx="5" ry="2.5"></ellipse>
                <ellipse className="foot" cx="14" cy="41" rx="5" ry="2.5"></ellipse>
                <path className="limb" d="M-38 14 Q-46 22 -44 30"></path>
                <path className="br" d="M-36 8 C-46 6 -46 -12 -34 -14 C-36 -28 -18 -34 -10 -26 C-6 -36 10 -36 14 -26 C24 -34 40 -26 36 -12 C48 -8 46 10 36 12 C38 26 20 32 12 24 C6 32 -10 32 -14 24 C-26 32 -42 22 -36 8 Z"></path>
                <path className="fold" d="M-22 -18 C-14 -14 -24 -6 -16 -2 M22 -18 C14 -14 24 -6 16 -2 M0 -30 C-3 -22 3 -16 0 -8 M-34 -2 C-28 0 -30 8 -24 10"></path>
                <path className="brow" d="M-18 -6 L-6 -4 M6 -8 L18 -6"></path>
                <g className="blink"><circle className="ew" cx="-11" cy="6" r="6.5"></circle><circle className="ew" cx="11" cy="6" r="6.5"></circle></g>
                <circle className="pu" cx="-8" cy="5" r="3"></circle><circle className="pu" cx="14" cy="5" r="3"></circle>
                <path className="mline" d="M-5 20 L6 18"></path>
                <g transform="translate(-40 -14)"><path className="sweat drip" style={{ animationDelay: '.5s' }} d="M0 -5 C3 -1 4 2 0 4 C-4 2 -3 -1 0 -5Z"></path></g>
                <g className="mark">
                  <path className="limb" d="M36 6 Q50 -2 60 -12"></path>
                  <circle className="hand" cx="60" cy="-12" r="3.6"></circle>
                  <polygon points="60,-14 68,-26 72,-23 63,-11" style={{ fill: '#161A2B' }}></polygon>
                </g>
              </g>
              <text className="nm" x="0" y="66">Strategist</text>
              <text className="sg" x="0" y="81">What went wrong? Plan next week.</text>
            </g>

            {/* CUSTOM AGENT (waiting) */}
            <g transform="translate(534 58)">
              <g className="ghost">
                <g transform="scale(.62)">
                  <path className="gbr" d="M-36 8 C-46 6 -46 -12 -34 -14 C-36 -28 -18 -34 -10 -26 C-6 -36 10 -36 14 -26 C24 -34 40 -26 36 -12 C48 -8 46 10 36 12 C38 26 20 32 12 24 C6 32 -10 32 -14 24 C-26 32 -42 22 -36 8 Z"></path>
                  <path className="gclosed" d="M-16 6 Q-11 10 -6 6 M6 6 Q11 10 16 6"></path>
                  <circle className="gplus" cx="-40" cy="-26" r="11"></circle>
                  <path className="gplusx" d="M-40 -31 V-21 M-45 -26 H-35"></path>
                </g>
                <text className="zz2" x="22" y="-18">z</text>
                <text className="zz2" x="30" y="-28" style={{ animationDelay: '1.4s' }}>z</text>
              </g>
              <text className="nm" x="0" y="42">+ Your agent</text>
              <text className="sg" x="0" y="57">waiting to be customised</text>
            </g>

            {/* CV WRITER */}
            <g transform="translate(95 398)">
              <g className="bob">
                <rect className="paper" x="44" y="-30" width="54" height="66" rx="4"></rect>
                <text className="dt" x="52" y="-21">CV</text>
                <line className="wl wl1" x1="52" y1="-12" x2="88" y2="-12"></line>
                <line className="wl wl2" x1="52" y1="-2" x2="88" y2="-2"></line>
                <line className="wl wl3" x1="52" y1="8" x2="88" y2="8"></line>
                <line className="wl wl4" x1="52" y1="18" x2="88" y2="18"></line>
                <line className="wl wl5" x1="52" y1="28" x2="80" y2="28"></line>
                <path className="limb" d="M-10 26 L-12 40 M10 26 L12 40"></path>
                <ellipse className="foot" cx="-14" cy="41" rx="5" ry="2.5"></ellipse>
                <ellipse className="foot" cx="14" cy="41" rx="5" ry="2.5"></ellipse>
                <path className="limb" d="M-38 14 Q-48 22 -46 32"></path>
                <path className="br" d="M-36 8 C-46 6 -46 -12 -34 -14 C-36 -28 -18 -34 -10 -26 C-6 -36 10 -36 14 -26 C24 -34 40 -26 36 -12 C48 -8 46 10 36 12 C38 26 20 32 12 24 C6 32 -10 32 -14 24 C-26 32 -42 22 -36 8 Z"></path>
                <path className="fold" d="M-22 -18 C-14 -14 -24 -6 -16 -2 M22 -18 C14 -14 24 -6 16 -2 M0 -30 C-3 -22 3 -16 0 -8 M-34 -2 C-28 0 -30 8 -24 10"></path>
                <path className="brow" d="M-18 -4 L-7 -8 M7 -8 L18 -4"></path>
                <g className="blink"><circle className="ew" cx="-11" cy="6" r="6.5"></circle><circle className="ew" cx="11" cy="6" r="6.5"></circle></g>
                <circle className="pu" cx="-9" cy="8" r="3"></circle><circle className="pu" cx="13" cy="8" r="3"></circle>
                <path className="mline" d="M-6 19 Q-3 16 0 19 Q3 22 6 19"></path>
                <g transform="translate(-40 -12)"><path className="sweat drip" d="M0 -5 C3 -1 4 2 0 4 C-4 2 -3 -1 0 -5Z"></path></g>
                <g transform="translate(40 -18)"><path className="sweat drip" style={{ animationDelay: '.85s' }} d="M0 -5 C3 -1 4 2 0 4 C-4 2 -3 -1 0 -5Z"></path></g>
                <g transform="translate(52 -12)">
                  <g className="pencil">
                    <path className="limb" d="M12 -10 Q4 2 -10 14"></path>
                    <polygon className="pb" points="2,-7 7,-2 23,-18 18,-23"></polygon>
                    <polygon className="pe" points="18,-23 23,-18 26,-21 21,-26"></polygon>
                    <polygon className="pb" points="0,0 2,-7 7,-2"></polygon>
                    <polygon className="pg" points="0,0 0.8,-2.8 2.8,-0.8"></polygon>
                    <circle className="hand" cx="12" cy="-11" r="4"></circle>
                  </g>
                </g>
              </g>
              <text className="nm" x="15" y="66">CV Writer</text>
              <text className="sg" x="15" y="81">Tailoring a CV for every JD</text>
            </g>

            {/* ANALYST */}
            <g transform="translate(300 392)">
              <g className="bob2">
                <g transform="translate(-96 -6)">
                  <g className="doc"><rect className="paper" x="0" y="0" width="34" height="44" rx="3"></rect><text className="dt" x="5" y="11">JD</text><line className="dl" x1="5" y1="18" x2="29" y2="18"></line><line className="dl" x1="5" y1="25" x2="25" y2="25"></line><line className="dl" x1="5" y1="32" x2="27" y2="32"></line></g>
                </g>
                <g transform="translate(-96 -6)">
                  <g className="doc" style={{ animationDelay: '2s' }}><rect className="paper" x="0" y="0" width="34" height="44" rx="3"></rect><text className="dt" x="5" y="11">CV</text><line className="dl" x1="5" y1="18" x2="29" y2="18"></line><line className="dl" x1="5" y1="25" x2="23" y2="25"></line><line className="dl" x1="5" y1="32" x2="29" y2="32"></line></g>
                </g>
                <g transform="translate(-96 -6)">
                  <g className="doc" style={{ animationDelay: '4s' }}><rect className="paper" x="0" y="0" width="34" height="44" rx="3"></rect><text className="dt" x="5" y="11">OFFER</text><line className="dl" x1="5" y1="18" x2="27" y2="18"></line><line className="dl" x1="5" y1="25" x2="29" y2="25"></line><line className="dl" x1="5" y1="32" x2="19" y2="32"></line></g>
                </g>
                <g transform="translate(58 -4)">
                  <rect className="paper" x="0" y="0" width="46" height="58" rx="4"></rect>
                  <rect x="15" y="-3" width="16" height="7" rx="2" style={{ fill: '#161A2B' }}></rect>
                  <text className="dt" x="6" y="15">REPORT</text>
                  <rect className="rbar" x="8" y="34" width="6" height="16" rx="1.5"></rect>
                  <rect className="rbar" x="17" y="26" width="6" height="24" rx="1.5" style={{ animationDelay: '.4s' }}></rect>
                  <rect className="rbar" x="26" y="38" width="6" height="12" rx="1.5" style={{ animationDelay: '.8s' }}></rect>
                  <rect className="rbar" x="35" y="20" width="6" height="30" rx="1.5" style={{ animationDelay: '1.2s' }}></rect>
                </g>
                <path className="limb" d="M-40 12 Q-52 18 -60 22"></path>
                <path className="limb" d="M40 12 Q50 18 58 22"></path>
                <path className="limb" d="M-10 26 L-12 40 M10 26 L12 40"></path>
                <ellipse className="foot" cx="-14" cy="41" rx="5" ry="2.5"></ellipse>
                <ellipse className="foot" cx="14" cy="41" rx="5" ry="2.5"></ellipse>
                <path className="br" d="M-36 8 C-46 6 -46 -12 -34 -14 C-36 -28 -18 -34 -10 -26 C-6 -36 10 -36 14 -26 C24 -34 40 -26 36 -12 C48 -8 46 10 36 12 C38 26 20 32 12 24 C6 32 -10 32 -14 24 C-26 32 -42 22 -36 8 Z"></path>
                <path className="fold" d="M-22 -18 C-14 -14 -24 -6 -16 -2 M22 -18 C14 -14 24 -6 16 -2 M0 -30 C-3 -22 3 -16 0 -8 M34 -2 C28 0 30 8 24 10"></path>
                <path className="brow" d="M-20 -8 L-7 -5 M7 -5 L20 -8"></path>
                <g className="blink2"><circle className="ew" cx="-11" cy="6" r="5"></circle><circle className="ew" cx="11" cy="6" r="5"></circle></g>
                <g className="scan"><circle className="pu" cx="-11" cy="6.5" r="2.6"></circle><circle className="pu" cx="11" cy="6.5" r="2.6"></circle></g>
                <circle className="glass" cx="-11" cy="6" r="9"></circle>
                <circle className="glass" cx="11" cy="6" r="9"></circle>
                <path className="brow" d="M-2 5 Q0 2 2 5 M-20 4 L-34 0 M20 4 L34 0"></path>
                <path className="mline" d="M-7 19 L3 19"></path>
                <polygon className="cig" points="2,17.5 26,20.5 26,23.5 2,20.5"></polygon>
                <polygon className="cigf" points="2,17.5 8,18.2 8,21.2 2,20.5"></polygon>
                <circle className="ember" cx="26.5" cy="22" r="2.2"></circle>
                <circle className="smk" cx="29" cy="17" r="2.6"></circle>
                <circle className="smk" cx="29" cy="17" r="2.6" style={{ animationDelay: '.9s' }}></circle>
                <circle className="smk" cx="29" cy="17" r="2.6" style={{ animationDelay: '1.8s' }}></circle>
                <g transform="translate(-40 -16)"><path className="sweat drip" style={{ animationDelay: '.4s' }} d="M0 -5 C3 -1 4 2 0 4 C-4 2 -3 -1 0 -5Z"></path></g>
              </g>
              <text className="nm" x="0" y="72">Analyst</text>
              <text className="sg" x="0" y="87">Which applications actually worked?</text>
            </g>

            {/* ADVISOR */}
            <g transform="translate(500 382)">
              <rect className="bubble" x="-104" y="-116" width="200" height="44" rx="14"></rect>
              <polygon className="bubble" points="-34,-73 -18,-73 -30,-58"></polygon>
              <rect x="-33" y="-75" width="14" height="4" style={{ fill: '#FFFFFF' }}></rect>
              <text className="say" x="-90" y="-89">Ask for a referral first.</text>
              <text className="say" x="-90" y="-89" style={{ animationDelay: '3s' }}>Skip this one — weak match.</text>
              <text className="say" x="-90" y="-89" style={{ animationDelay: '6s' }}>Follow up in 3 days.</text>
              <g className="bob3">
                <path className="pants" d="M-10 50 L-11 58 M10 50 L11 58"></path>
                <path className="suit" d="M-22 24 L22 24 L27 50 L-27 50 Z"></path>
                <path className="shirt" d="M-8 24 L8 24 L0 38 Z"></path>
                <path className="tie" d="M0 27 L-3 31 L0 44 L3 31 Z"></path>
                <path className="lapel" d="M-8 24 L-3 40 M8 24 L3 40"></path>
                <g className="wag"><path className="sleeve" d="M-22 30 Q-36 18 -40 2"></path><circle className="hand" cx="-40" cy="0" r="3.8"></circle></g>
                <path className="br" d="M-36 8 C-46 6 -46 -12 -34 -14 C-36 -28 -18 -34 -10 -26 C-6 -36 10 -36 14 -26 C24 -34 40 -26 36 -12 C48 -8 46 10 36 12 C38 26 20 32 12 24 C6 32 -10 32 -14 24 C-26 32 -42 22 -36 8 Z"></path>
                <path className="fold" d="M-22 -18 C-14 -14 -24 -6 -16 -2 M22 -18 C14 -14 24 -6 16 -2 M0 -30 C-3 -22 3 -16 0 -8"></path>
                <path className="brow" d="M-17 -6 L-7 -9 M7 -9 L17 -6"></path>
                <g className="blink"><circle className="ew" cx="-11" cy="5" r="6"></circle><circle className="ew" cx="11" cy="5" r="6"></circle></g>
                <circle className="pu" cx="-13" cy="3.5" r="2.8"></circle><circle className="pu" cx="9" cy="3.5" r="2.8"></circle>
                <ellipse className="pu talk" cx="0" cy="19" rx="4" ry="3"></ellipse>
                <g transform="translate(38 -16)"><path className="sweat drip" style={{ animationDelay: '1.1s' }} d="M0 -5 C3 -1 4 2 0 4 C-4 2 -3 -1 0 -5Z"></path></g>
              </g>
              <text className="nm" x="0" y="82">Advisor</text>
              <text className="sg" x="0" y="97">Where to apply? Who can refer me?</text>
            </g>

            {/* the CV that travels writer → analyst → advisor → whiteboard */}
            <g transform="translate(176 352)">
              <g className="fly">
                <rect className="paper" x="0" y="0" width="22" height="28" rx="2" style={{ strokeWidth: '1.4' }}></rect>
                <text className="dt" x="4" y="9" style={{ fontSize: '6px' }}>CV</text>
                <line className="dl" x1="4" y1="14" x2="18" y2="14"></line>
                <line className="dl" x1="4" y1="19" x2="16" y2="19"></line>
                <line className="dl" x1="4" y1="24" x2="18" y2="24"></line>
              </g>
            </g>
          </svg>
        </div>
      </div>

      {/* three USPs */}
      <div style={{ position: 'relative', maxWidth: '1240px', margin: '0 auto', padding: '24px 24px 88px' }}>
        <div className="rv" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '1px', background: '#E4E6EE', border: '1px solid #E4E6EE', borderRadius: '20px', overflow: 'hidden' }}>
          <div style={{ background: '#FFFFFF', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span className="mono" style={{ fontSize: '12px', color: '#3F5FD8' }}>01</span><span className="disp" style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.01em' }}>CVs tailored, truthfully</span></div>
            <p style={{ margin: '10px 0 0', fontSize: '15px', lineHeight: '1.55', color: '#5A6075' }}>Built on 5,000+ real applications. Matched to every JD. Never a fake skill.</p>
          </div>
          <div style={{ background: '#FFFFFF', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span className="mono" style={{ fontSize: '12px', color: '#3F5FD8' }}>02</span><span className="disp" style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.01em' }}>Honne IQ remembers it all</span></div>
            <p style={{ margin: '10px 0 0', fontSize: '15px', lineHeight: '1.55', color: '#5A6075' }}>Every application, CV, JD, referral and note — in one knowledge layer.</p>
          </div>
          <div style={{ background: '#FFFFFF', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><span className="mono" style={{ fontSize: '12px', color: '#3F5FD8' }}>03</span><span className="disp" style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.01em' }}>Agents that guide you</span></div>
            <p style={{ margin: '10px 0 0', fontSize: '15px', lineHeight: '1.55', color: '#5A6075' }}>A weekly read on what’s working — and what to do next. No more guessing.</p>
          </div>
        </div>
      </div>
    </section>

    {/* PROBLEM */}
    <section style={{ background: '#FFFFFF', borderTop: '1px solid #E4E6EE' }}>
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '112px 24px 40px' }}>
        <div className="rv" style={{ textAlign: 'center', maxWidth: '900px', margin: '0 auto' }}>
          <div className="eyebrow" style={{ color: '#C2410C' }}>Sound familiar?</div>
          <h2 className="disp" style={{ margin: '18px 0 0', fontSize: 'clamp(30px,4vw,50px)', lineHeight: '1.12', fontWeight: '700', letterSpacing: '-0.03em' }}>
            “Paste your JD. Download your CV.”<br />
            <span className="serif" style={{ color: '#C2410C', fontSize: '1.12em' }}>Months later</span> — still no reply?
          </h2>
        </div>
        <div className="rv" style={{ textAlign: 'center', marginTop: '56px' }}>
          <div className="disp" style={{ fontSize: 'clamp(64px,11vw,150px)', lineHeight: '.92', fontWeight: '800', letterSpacing: '-0.055em' }}>
            It’s <span className="serif" style={{ color: '#3F5FD8', fontSize: '1.08em' }}>not you.</span>
          </div>
          <p style={{ margin: '26px auto 0', maxWidth: '600px', fontSize: 'clamp(18px,1.8vw,22px)', lineHeight: '1.5', color: '#5A6075' }}>
            The market changed after the AI boom. Blind applying stopped working. <strong style={{ color: '#161A2B' }}>You need two things.</strong>
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 24px 112px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: '24px' }}>
        <div className="rv" style={{ background: '#FAFAFA', border: '1px solid #E4E6EE', borderRadius: '28px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <div className="mono" style={{ fontSize: '12px', color: '#3F5FD8' }}>NEED 01</div>
            <h3 className="disp" style={{ margin: '10px 0 0', fontSize: 'clamp(24px,2.4vw,32px)', lineHeight: '1.12', fontWeight: '800', letterSpacing: '-0.025em' }}>A CV tailored to <span className="serif" style={{ color: '#3F5FD8', fontSize: '1.1em' }}>this</span> job.</h3>
            <p style={{ margin: '8px 0 0', fontSize: '16px', color: '#5A6075' }}>Not a template. Not invented skills. Your real experience, matched to the JD.</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'stretch', flex: '1' }}>
            <div style={{ flex: '1 1 200px', background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '18px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '.08em', color: '#5A6075' }}>JOB DESCRIPTION</div>
              <div style={{ marginTop: '8px', fontSize: '13px', lineHeight: '1.5', color: '#161A2B' }}>SDE-2, Backend · Bengaluru</div>
              <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <span className="kw">Java<span className="ov st1">Java</span></span>
                <span className="kw">Kafka<span className="ov st2">Kafka</span></span>
                <span className="kw">AWS<span className="ov st3">AWS</span></span>
                <span className="kw">Mentoring<span className="ov st4">Mentoring</span></span>
              </div>
            </div>
            <div style={{ flex: '1 1 200px', background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '18px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '.08em', color: '#5A6075' }}>YOUR CV</div>
                <span className="st5" style={{ fontSize: '11px', fontWeight: '700', color: '#15803D', background: '#E8F5EC', borderRadius: '999px', padding: '4px 9px', whiteSpace: 'nowrap' }}>Tailored ✓</span>
              </div>
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="cvl" style={{ width: '94%' }}><div className="ov st1"></div></div>
                <div className="cvl" style={{ width: '78%' }}></div>
                <div className="cvl" style={{ width: '86%' }}><div className="ov st2"></div></div>
                <div className="cvl" style={{ width: '70%' }}><div className="ov st3"></div></div>
                <div className="cvl" style={{ width: '58%' }}></div>
                <div className="cvl" style={{ width: '82%' }}><div className="ov st4"></div></div>
              </div>
              <div className="st5" style={{ marginTop: '14px', fontSize: '12px', color: '#5A6075' }}>Nothing invented. Everything relevant, up top.</div>
            </div>
          </div>
        </div>

        <div className="rv" style={{ background: '#FAFAFA', border: '1px solid #E4E6EE', borderRadius: '28px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <div className="mono" style={{ fontSize: '12px', color: '#3F5FD8' }}>NEED 02</div>
            <h3 className="disp" style={{ margin: '10px 0 0', fontSize: 'clamp(24px,2.4vw,32px)', lineHeight: '1.12', fontWeight: '800', letterSpacing: '-0.025em' }}>Someone <span className="serif" style={{ color: '#3F5FD8', fontSize: '1.1em' }}>beside you</span>, guiding you.</h3>
            <p style={{ margin: '8px 0 0', fontSize: '16px', color: '#5A6075' }}>A clear track toward your goal — instead of firing applications into the void.</p>
          </div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '12px', flex: '1', display: 'flex', alignItems: 'center' }}>
            <svg viewBox="0 0 520 250" width="100%" role="img" aria-label="Left: blind applying scatters applications that end in rejections. Right: a guided path goes from you to a tailored CV, a referral, an interview and an offer." style={{ display: 'block' }}>
              <text className="cap" x="20" y="26" style={{ fill: '#C2410C' }}>BLIND APPLYING</text>
              <text className="cap" x="286" y="26" style={{ fill: '#3F5FD8' }}>GUIDED BY HONNE</text>
              <line x1="262" y1="40" x2="262" y2="232" style={{ stroke: '#E4E6EE', strokeWidth: '1.5', strokeDasharray: '4 5' }}></line>
              <circle className="you" cx="40" cy="210" r="7"></circle>
              <text className="cpl" x="30" y="236">You</text>
              <path className="blindl" d="M40 210 L210 60"></path>
              <path className="blindl" d="M40 210 L232 150" style={{ animationDelay: '.5s' }}></path>
              <path className="blindl" d="M40 210 L120 52" style={{ animationDelay: '1s' }}></path>
              <path className="blindl" d="M40 210 L226 220" style={{ animationDelay: '1.5s' }}></path>
              <path className="blindl" d="M40 210 L170 110" style={{ animationDelay: '2s' }}></path>
              <path className="bx" d="M204 54 L216 66 M216 54 L204 66"></path>
              <path className="bx" d="M226 144 L238 156 M238 144 L226 156" style={{ animationDelay: '.5s' }}></path>
              <path className="bx" d="M114 46 L126 58 M126 46 L114 58" style={{ animationDelay: '1s' }}></path>
              <path className="bx" d="M220 214 L232 226 M232 214 L220 226" style={{ animationDelay: '1.5s' }}></path>
              <path className="bx" d="M164 104 L176 116 M176 104 L164 116" style={{ animationDelay: '2s' }}></path>
              <circle className="you" cx="300" cy="210" r="7"></circle>
              <text className="cpl" x="290" y="236">You</text>
              <path className="gtrack" d="M300 210 Q340 210 360 180 T410 140 T460 100 T500 54"></path>
              <path className="guide" d="M300 210 Q340 210 360 180 T410 140 T460 100 T500 54"></path>
              <g className="st2"><circle className="cp" cx="360" cy="180" r="7"></circle><text className="cpl" x="372" y="196">Tailored CV</text></g>
              <g className="st3"><circle className="cp" cx="410" cy="140" r="7"></circle><text className="cpl" x="422" y="156">Referral</text></g>
              <g className="st4"><circle className="cp" cx="460" cy="100" r="7"></circle><text className="cpl" x="472" y="116">Interview</text></g>
              <g className="st5"><line x1="500" y1="54" x2="500" y2="22" style={{ stroke: '#161A2B', strokeWidth: '2.4', strokeLinecap: 'round' }}></line><polygon points="500,22 518,28 500,34" style={{ fill: '#15803D' }}></polygon><text className="cpl" x="494" y="64" style={{ textAnchor: 'end' }}>Offer</text></g>
            </svg>
          </div>
        </div>
      </div>
    </section>

    {/* AGENTS */}
    <section id="agents" style={{ background: '#FAFAFA', borderTop: '1px solid #E4E6EE' }}>
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '112px 24px' }}>
        <div className="rv" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px' }}>
          <div style={{ maxWidth: '720px' }}>
            <div className="eyebrow" style={{ color: '#3F5FD8' }}>Your agents</div>
            <h2 className="disp" style={{ margin: '14px 0 0', fontSize: 'clamp(36px,4.6vw,58px)', lineHeight: '1.02', fontWeight: '800', letterSpacing: '-0.04em' }}>A few specialised agents. <span className="serif" style={{ color: '#3F5FD8', fontSize: '1.08em' }}>One goal:</span> your job.</h2>
          </div>
          <p style={{ margin: '0', maxWidth: '400px', fontSize: '17px', lineHeight: '1.55', color: '#5A6075' }}>They read your Honne IQ — applications, referrals, what you’re doing — and track, analyse and optimise your search with you.</p>
        </div>

        <div style={{ marginTop: '52px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: '20px' }}>
          <div className="rv lift" style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '24px', padding: '28px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '18px', background: '#F3F4F8', border: '1px solid #E4E6EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="56" height="50" viewBox="-50 -40 110 90" aria-hidden="true"><path className="br" d="M-36 8 C-46 6 -46 -12 -34 -14 C-36 -28 -18 -34 -10 -26 C-6 -36 10 -36 14 -26 C24 -34 40 -26 36 -12 C48 -8 46 10 36 12 C38 26 20 32 12 24 C6 32 -10 32 -14 24 C-26 32 -42 22 -36 8 Z"></path><path className="fold" d="M-22 -18 C-14 -14 -24 -6 -16 -2 M22 -18 C14 -14 24 -6 16 -2"></path><circle className="ew" cx="-11" cy="6" r="6.5"></circle><circle className="ew" cx="11" cy="6" r="6.5"></circle><circle className="pu" cx="-9" cy="8" r="3"></circle><circle className="pu" cx="13" cy="8" r="3"></circle><g transform="translate(36 30)"><polygon className="pb" points="2,-7 7,-2 23,-18 18,-23"></polygon><polygon className="pb" points="0,0 2,-7 7,-2"></polygon><polygon className="pe" points="18,-23 23,-18 26,-21 21,-26"></polygon></g></svg>
            </div>
            <h3 className="disp" style={{ margin: '22px 0 0', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.01em' }}>CV Writer</h3>
            <p style={{ margin: '8px 0 0', fontSize: '16px', lineHeight: '1.55', color: '#5A6075' }}>Tailors your CV to every JD — truthfully. Learned from 5,000+ applications and recruiter advice.</p>
          </div>
          <div className="rv lift" style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '24px', padding: '28px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '18px', background: '#F3F4F8', border: '1px solid #E4E6EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="56" height="50" viewBox="-50 -40 100 80" aria-hidden="true"><path className="br" d="M-36 8 C-46 6 -46 -12 -34 -14 C-36 -28 -18 -34 -10 -26 C-6 -36 10 -36 14 -26 C24 -34 40 -26 36 -12 C48 -8 46 10 36 12 C38 26 20 32 12 24 C6 32 -10 32 -14 24 C-26 32 -42 22 -36 8 Z"></path><path className="fold" d="M-22 -18 C-14 -14 -24 -6 -16 -2 M22 -18 C14 -14 24 -6 16 -2"></path><circle className="pu" cx="-11" cy="6.5" r="2.8"></circle><circle className="pu" cx="11" cy="6.5" r="2.8"></circle><circle className="glass" cx="-11" cy="6" r="9"></circle><circle className="glass" cx="11" cy="6" r="9"></circle><path className="brow" d="M-2 5 Q0 2 2 5"></path></svg>
            </div>
            <h3 className="disp" style={{ margin: '22px 0 0', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.01em' }}>Analyst</h3>
            <p style={{ margin: '8px 0 0', fontSize: '16px', lineHeight: '1.55', color: '#5A6075' }}>Reads every CV, JD and reply you’ve logged. Tells you what’s working — and what isn’t.</p>
          </div>
          <div className="rv lift" style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '24px', padding: '28px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '18px', background: '#F3F4F8', border: '1px solid #E4E6EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="56" height="56" viewBox="-50 -40 100 96" aria-hidden="true"><path className="suit" d="M-22 24 L22 24 L27 50 L-27 50 Z"></path><path className="shirt" d="M-8 24 L8 24 L0 38 Z"></path><path className="tie" d="M0 27 L-3 31 L0 44 L3 31 Z"></path><path className="br" d="M-36 8 C-46 6 -46 -12 -34 -14 C-36 -28 -18 -34 -10 -26 C-6 -36 10 -36 14 -26 C24 -34 40 -26 36 -12 C48 -8 46 10 36 12 C38 26 20 32 12 24 C6 32 -10 32 -14 24 C-26 32 -42 22 -36 8 Z"></path><path className="fold" d="M-22 -18 C-14 -14 -24 -6 -16 -2 M22 -18 C14 -14 24 -6 16 -2"></path><circle className="ew" cx="-11" cy="5" r="6"></circle><circle className="ew" cx="11" cy="5" r="6"></circle><circle className="pu" cx="-11" cy="5" r="2.8"></circle><circle className="pu" cx="11" cy="5" r="2.8"></circle></svg>
            </div>
            <h3 className="disp" style={{ margin: '22px 0 0', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.01em' }}>Advisor</h3>
            <p style={{ margin: '8px 0 0', fontSize: '16px', lineHeight: '1.55', color: '#5A6075' }}>Tells you where to apply, who to ask for a referral, and when to follow up. Sure shots first.</p>
          </div>
          <div className="rv lift" style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '24px', padding: '28px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '18px', background: '#F3F4F8', border: '1px solid #E4E6EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="60" height="50" viewBox="-50 -40 124 90" aria-hidden="true"><rect className="board" x="44" y="-30" width="28" height="36" rx="3" style={{ strokeWidth: '2' }}></rect><path className="dl" d="M49 -20 H67 M49 -12 H63 M49 -4 H66" style={{ strokeDasharray: 'none' }}></path><path className="br" d="M-36 8 C-46 6 -46 -12 -34 -14 C-36 -28 -18 -34 -10 -26 C-6 -36 10 -36 14 -26 C24 -34 40 -26 36 -12 C48 -8 46 10 36 12 C38 26 20 32 12 24 C6 32 -10 32 -14 24 C-26 32 -42 22 -36 8 Z"></path><path className="fold" d="M-22 -18 C-14 -14 -24 -6 -16 -2 M22 -18 C14 -14 24 -6 16 -2"></path><circle className="ew" cx="-11" cy="6" r="6.5"></circle><circle className="ew" cx="11" cy="6" r="6.5"></circle><circle className="pu" cx="-8" cy="5" r="3"></circle><circle className="pu" cx="14" cy="5" r="3"></circle></svg>
            </div>
            <h3 className="disp" style={{ margin: '22px 0 0', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.01em' }}>Strategist</h3>
            <p style={{ margin: '8px 0 0', fontSize: '16px', lineHeight: '1.55', color: '#5A6075' }}>Looks at what went wrong this week and plans the next one — so you never start from scratch.</p>
          </div>

          <div className="rv" style={{ gridColumn: '1 / -1', background: '#12141C', color: '#F2F3F7', borderRadius: '28px', padding: 'clamp(28px,4vw,48px)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '36px', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden="true" style={{ position: 'absolute', right: '-90px', top: '-90px', width: '280px', height: '280px', borderRadius: '999px', border: '1px dashed #3A4577' }}></div>
            <div aria-hidden="true" style={{ position: 'absolute', right: '-30px', top: '-30px', width: '160px', height: '160px', borderRadius: '999px', border: '1px dashed #3A4577' }}></div>
            <div style={{ flex: 'none', width: '112px', height: '112px', borderRadius: '28px', border: '1.5px dashed #3A4577', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <svg width="84" height="74" viewBox="-56 -44 112 90" aria-hidden="true"><g className="ghost"><path className="ghostbr" d="M-36 8 C-46 6 -46 -12 -34 -14 C-36 -28 -18 -34 -10 -26 C-6 -36 10 -36 14 -26 C24 -34 40 -26 36 -12 C48 -8 46 10 36 12 C38 26 20 32 12 24 C6 32 -10 32 -14 24 C-26 32 -42 22 -36 8 Z"></path><path className="closed" d="M-16 6 Q-11 10 -6 6 M6 6 Q11 10 16 6"></path><circle className="plus" cx="-40" cy="-26" r="11"></circle><path className="plusx" d="M-40 -31 V-21 M-45 -26 H-35"></path></g></svg>
            </div>
            <div style={{ flex: '1 1 380px', minWidth: '0', position: 'relative' }}>
              <div className="eyebrow" style={{ color: '#FB8A4C' }}>Only on Honne</div>
              <h3 className="disp" style={{ margin: '12px 0 0', fontSize: 'clamp(28px,3.4vw,44px)', lineHeight: '1.06', fontWeight: '800', letterSpacing: '-0.03em' }}>Missing something? <span className="serif" style={{ color: '#9DB0F6', fontSize: '1.1em' }}>Create your own agent.</span></h3>
              <p style={{ margin: '14px 0 0', fontSize: '17px', lineHeight: '1.55', color: '#A3A8B8', maxWidth: '560px' }}>Describe the problem in plain words. Your agent works on your Honne IQ — just as good as ours.</p>
            </div>
            <a className="btn" href="#how" style={{ position: 'relative', background: '#FFFFFF', color: '#161A2B', textDecoration: 'none', fontSize: '16px', fontWeight: '700', padding: '15px 24px', borderRadius: '999px', minHeight: '52px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>See how <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></a>
          </div>
        </div>
      </div>
    </section>

    {/* HOW IT WORKS */}
    <section id="how" style={{ background: '#FFFFFF', borderTop: '1px solid #E4E6EE' }}>
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '112px 24px' }}>
        <div className="rv" style={{ textAlign: 'center', maxWidth: '760px', margin: '0 auto' }}>
          <div className="eyebrow" style={{ color: '#3F5FD8' }}>How it works</div>
          <h2 className="disp" style={{ margin: '14px 0 0', fontSize: 'clamp(36px,4.6vw,58px)', lineHeight: '1.02', fontWeight: '800', letterSpacing: '-0.04em' }}>Everything in one place. <span className="serif" style={{ color: '#3F5FD8', fontSize: '1.08em' }}>In one click.</span></h2>
          <p style={{ margin: '16px auto 0', maxWidth: '560px', fontSize: '18px', lineHeight: '1.55', color: '#5A6075' }}>Restart from where it didn’t work — not from scratch.</p>
        </div>

        {/* step 1 (dark): JD in, CV preview + download out */}
        <div style={{ marginTop: '64px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '40px' }}>
          <div className="rv" style={{ flex: '1 1 600px', minWidth: '0', maxWidth: '720px', background: '#12141C', border: '1px solid #232A4D', borderRadius: '24px', padding: '18px', boxShadow: '0 30px 60px rgba(14,18,38,.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '2px 6px 14px' }}>
              <div style={{ display: 'flex', gap: '6px' }} aria-hidden="true"><span style={{ width: '10px', height: '10px', borderRadius: '99px', background: '#2E3766', display: 'inline-block' }}></span><span style={{ width: '10px', height: '10px', borderRadius: '99px', background: '#2E3766', display: 'inline-block' }}></span><span style={{ width: '10px', height: '10px', borderRadius: '99px', background: '#2E3766', display: 'inline-block' }}></span></div>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#A3A8B8' }}>Honne Careers · CV builder</span>
              <span style={{ width: '46px' }}></span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '14px' }}>
              <div style={{ background: '#181C2C', border: '1px solid #2A3157', borderRadius: '16px', padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '.08em', color: '#9DB0F6' }}>PASTE YOUR JOB DESCRIPTION</div>
                <div style={{ marginTop: '10px', background: '#0E1226', border: '1px solid #2E3766', borderRadius: '12px', padding: '12px 14px', fontSize: '13px', lineHeight: '1.6', color: '#E9ECF9' }}>SDE-2, Backend · Freshworks, Chennai. Build high-scale services in Java and Kafka on AWS. Mentor two juniors and own on-call…</div>
                <div style={{ marginTop: '12px', fontSize: '11px', fontWeight: '700', letterSpacing: '.08em', color: '#A3A8B8' }}>MATCHED FROM YOUR PROFILE</div>
                <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '12px', fontWeight: '600' }}>
                  <span className="st1" style={{ color: '#C9D3F7', background: '#1F2540', border: '1px solid #3A4577', borderRadius: '999px', padding: '5px 10px' }}>✓ Java</span>
                  <span className="st2" style={{ color: '#C9D3F7', background: '#1F2540', border: '1px solid #3A4577', borderRadius: '999px', padding: '5px 10px' }}>✓ Kafka</span>
                  <span className="st3" style={{ color: '#C9D3F7', background: '#1F2540', border: '1px solid #3A4577', borderRadius: '999px', padding: '5px 10px' }}>✓ AWS</span>
                  <span className="st4" style={{ color: '#C9D3F7', background: '#1F2540', border: '1px solid #3A4577', borderRadius: '999px', padding: '5px 10px' }}>✓ Mentoring</span>
                </div>
              </div>
              <div style={{ background: '#181C2C', border: '1px solid #2A3157', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '.08em', color: '#9DB0F6' }}>PREVIEW</span><span style={{ fontSize: '11px', color: '#A3A8B8' }}>Jake’s Resume</span></div>
                <div className="jk" style={{ background: '#FFFFFF', borderRadius: '8px', padding: '12px 14px', flex: '1', minHeight: '170px' }}>
                  <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700' }}>Arjun Mehta</div>
                  <div style={{ textAlign: 'center', fontSize: '5.6px', marginTop: '2px' }}>+91 98xxx xxxxx | arjun@mail.com | linkedin.com/in/arjun | github.com/arjun</div>
                  <div className="h st1">Experience</div>
                  <div className="st1"><div className="r"><b>Software Engineer</b><span>2023 – Present</span></div><ul><li>Built Kafka pipelines in Java handling 2M events/day on AWS</li><li>Mentored two interns through their first production launch</li></ul></div>
                  <div className="h st2">Projects</div>
                  <div className="st2"><div className="r"><b>Payments ledger</b><span className="i">Java, PostgreSQL, Docker</span></div></div>
                  <div className="h st3">Education</div>
                  <div className="st3"><div className="r"><b>M.Sc. Computer Science</b><span>2023</span></div></div>
                  <div className="h st4">Technical Skills</div>
                  <div className="st4 r"><span>Java, Kafka, AWS, PostgreSQL, Docker</span></div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', position: 'relative' }}>
                  <span className="press7" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#4D70EB', color: '#FFFFFF', fontSize: '14px', fontWeight: '600', borderRadius: '999px', padding: '10px 16px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v12M6 10l6 6 6-6M5 20h14"></path></svg>Download CV
                  </span>
                  <svg className="cursor7" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style={{ position: 'absolute', left: '92px', top: '18px' }}><path d="M4 2l16 10-7 1.5L9.5 21z" style={{ fill: '#FFFFFF', stroke: '#12141C', strokeWidth: '1.5' }}></path></svg>
                  <span className="st6" style={{ fontSize: '12px', fontWeight: '600', color: '#4ADE80' }}>✓ CV + JD saved to Honne IQ</span>
                </div>
              </div>
            </div>
          </div>
          <div className="rv" style={{ flex: '1 1 280px', minWidth: '0' }}>
            <div className="mono" style={{ fontSize: '13px', color: '#3F5FD8' }}>STEP 01</div>
            <h3 className="disp" style={{ margin: '10px 0 0', fontSize: 'clamp(26px,2.8vw,36px)', lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.03em' }}>Paste your JD. Preview. Download.</h3>
            <p style={{ margin: '12px 0 0', fontSize: '17px', lineHeight: '1.55', color: '#5A6075' }}>Your CV builds itself from your real profile. Hit download — the CV and its JD are saved together.</p>
          </div>
        </div>

        <svg className="curvy" viewBox="0 0 1000 110" width="100%" aria-hidden="true" style={{ margin: '8px 0' }}><path className="flow" d="M290 4 C290 74 720 36 720 98"></path><polygon className="flowhead" points="711,96 729,96 720,108"></polygon></svg>
        <div className="downarrow" aria-hidden="true" style={{ justifyContent: 'center', margin: '20px 0' }}><svg width="24" height="40" viewBox="0 0 24 40"><path className="flow" d="M12 2 V30"></path><polygon className="flowhead" points="5,28 19,28 12,38"></polygon></svg></div>

        {/* step 2 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', flexDirection: 'row-reverse', alignItems: 'center', gap: '40px' }}>
          <div className="rv" style={{ flex: '1 1 560px', minWidth: '0', maxWidth: '680px', background: '#FAFAFA', border: '1px solid #E4E6EE', borderRadius: '24px', padding: '24px' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '14px 18px', borderBottom: '1px solid #E4E6EE' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '8px', height: '8px', borderRadius: '99px', background: '#4D70EB', display: 'inline-block' }}></span><span className="disp" style={{ fontSize: '16px', fontWeight: '700' }}>Honne IQ</span><span style={{ fontSize: '12px', color: '#5A6075' }}>· your applications</span></div>
                <span style={{ fontSize: '12px', color: '#5A6075' }}>Synced with Drive &amp; Notion</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: '580px', fontSize: '13px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '60px 1.1fr 0.7fr 0.9fr 0.9fr 1.4fr', gap: '10px', padding: '10px 18px', fontSize: '11px', fontWeight: '700', letterSpacing: '.06em', color: '#5A6075', background: '#FAFAFA', borderBottom: '1px solid #E4E6EE' }}><span>DATE</span><span>COMPANY</span><span>JD</span><span>CV USED</span><span>REFERRAL</span><span>YOUR REMARKS</span></div>
                  <div className="st1" style={{ display: 'grid', gridTemplateColumns: '60px 1.1fr 0.7fr 0.9fr 0.9fr 1.4fr', gap: '10px', padding: '12px 18px', borderBottom: '1px solid #F0F1F5', alignItems: 'center' }}><span style={{ color: '#5A6075' }}>12 Oct</span><span style={{ fontWeight: '600' }}>Razorpay</span><span style={{ color: '#3F5FD8' }}>JD ↗</span><span style={{ color: '#3F5FD8' }}>CV v3 ↗</span><span style={{ color: '#15803D', fontWeight: '600' }}>Yes</span><span style={{ color: '#5A6075' }}>Interview Thu</span></div>
                  <div className="st2" style={{ display: 'grid', gridTemplateColumns: '60px 1.1fr 0.7fr 0.9fr 0.9fr 1.4fr', gap: '10px', padding: '12px 18px', borderBottom: '1px solid #F0F1F5', alignItems: 'center' }}><span style={{ color: '#5A6075' }}>13 Oct</span><span style={{ fontWeight: '600' }}>Zerodha</span><span style={{ color: '#3F5FD8' }}>JD ↗</span><span style={{ color: '#3F5FD8' }}>CV v2 ↗</span><span style={{ color: '#5A6075' }}>No</span><span style={{ color: '#5A6075' }}>No reply yet</span></div>
                  <div className="st3" style={{ display: 'grid', gridTemplateColumns: '60px 1.1fr 0.7fr 0.9fr 0.9fr 1.4fr', gap: '10px', padding: '12px 18px', borderBottom: '1px solid #F0F1F5', alignItems: 'center' }}><span style={{ color: '#5A6075' }}>15 Oct</span><span style={{ fontWeight: '600' }}>Swiggy</span><span style={{ color: '#3F5FD8' }}>JD ↗</span><span style={{ color: '#3F5FD8' }}>CV v3 ↗</span><span style={{ color: '#15803D', fontWeight: '600' }}>Asked</span><span style={{ color: '#5A6075' }}>College senior on team</span></div>
                  <div className="st4 newrow" style={{ display: 'grid', gridTemplateColumns: '60px 1.1fr 0.7fr 0.9fr 0.9fr 1.4fr', gap: '10px', padding: '12px 18px', alignItems: 'center' }}><span style={{ color: '#5A6075' }}>17 Oct</span><span style={{ fontWeight: '600' }}>Freshworks</span><span style={{ color: '#3F5FD8' }}>JD ↗</span><span style={{ color: '#3F5FD8' }}>CV v4 ↗</span><span style={{ color: '#5A6075' }}>—</span><span style={{ color: '#5A6075' }}>Just applied</span></div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#5A6075', textAlign: 'right' }}>Sample data</div>
          </div>
          <div className="rv" style={{ flex: '1 1 280px', minWidth: '0' }}>
            <div className="mono" style={{ fontSize: '13px', color: '#3F5FD8' }}>STEP 02</div>
            <h3 className="disp" style={{ margin: '10px 0 0', fontSize: 'clamp(26px,2.8vw,36px)', lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.03em' }}>Honne IQ remembers everything.</h3>
            <p style={{ margin: '12px 0 0', fontSize: '17px', lineHeight: '1.55', color: '#5A6075' }}>Date, company, JD, CV used, referral, your notes. Not another spreadsheet — a knowledge layer your agents can read.</p>
          </div>
        </div>

        <svg className="curvy" viewBox="0 0 1000 110" width="100%" aria-hidden="true" style={{ margin: '8px 0' }}><path className="flow" d="M720 4 C720 74 280 36 280 98"></path><polygon className="flowhead" points="271,96 289,96 280,108"></polygon></svg>
        <div className="downarrow" aria-hidden="true" style={{ justifyContent: 'center', margin: '20px 0' }}><svg width="24" height="40" viewBox="0 0 24 40"><path className="flow" d="M12 2 V30"></path><polygon className="flowhead" points="5,28 19,28 12,38"></polygon></svg></div>

        {/* step 3 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '40px' }}>
          <div className="rv" style={{ flex: '1 1 560px', minWidth: '0', maxWidth: '660px', background: '#FAFAFA', border: '1px solid #E4E6EE', borderRadius: '24px', padding: '24px' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '24px 26px', boxShadow: '0 12px 32px rgba(22,26,43,.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '.08em', color: '#3F5FD8' }}>ANALYST + STRATEGIST · WEEKLY REPORT</div>
                  <div className="disp" style={{ marginTop: '6px', fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em' }}>Your search, week 6</div>
                </div>
                <span style={{ fontSize: '11px', color: '#5A6075', border: '1px solid #E4E6EE', borderRadius: '999px', padding: '4px 10px', whiteSpace: 'nowrap' }}>Sample</span>
              </div>
              <div className="st1" style={{ marginTop: '18px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#161A2B' }}>Summary</div>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '7px' }}><div style={{ height: '7px', borderRadius: '99px', background: '#E4E6EE', width: '96%' }}></div><div style={{ height: '7px', borderRadius: '99px', background: '#E4E6EE', width: '82%' }}></div></div>
              </div>
              <div style={{ marginTop: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px' }}>
                <div className="st2" style={{ background: '#E8F5EC', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#15803D' }}>What’s working</div>
                  <div style={{ marginTop: '6px', fontSize: '13px', lineHeight: '1.5', color: '#161A2B' }}>Every reply came from a referral or a strong match.</div>
                </div>
                <div className="st3" style={{ background: '#FFF4EE', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#C2410C' }}>What’s not</div>
                  <div style={{ marginTop: '6px', fontSize: '13px', lineHeight: '1.5', color: '#161A2B' }}>Most applications this week were blind — no referral, weak fit.</div>
                </div>
              </div>
              <div className="st4" style={{ marginTop: '18px' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#161A2B' }}>Next week</div>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ width: '18px', height: '18px', borderRadius: '5px', background: '#3F5FD8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg></span>5 targeted applications, sure shots only</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ width: '18px', height: '18px', borderRadius: '5px', background: '#3F5FD8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg></span>3 referral asks at companies you’ve already applied to</div>
                </div>
              </div>
            </div>
          </div>
          <div className="rv" style={{ flex: '1 1 280px', minWidth: '0' }}>
            <div className="mono" style={{ fontSize: '13px', color: '#3F5FD8' }}>STEP 03</div>
            <h3 className="disp" style={{ margin: '10px 0 0', fontSize: 'clamp(26px,2.8vw,36px)', lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.03em' }}>Your agents report back. <span className="serif" style={{ color: '#3F5FD8', fontSize: '1.08em' }}>Every week.</span></h3>
            <p style={{ margin: '12px 0 0', fontSize: '17px', lineHeight: '1.55', color: '#5A6075' }}>What worked, what didn’t, and exactly what to do next. Research that used to take hours — in one click.</p>
          </div>
        </div>

        <svg className="curvy" viewBox="0 0 1000 110" width="100%" aria-hidden="true" style={{ margin: '8px 0' }}><path className="flow" d="M280 4 C280 74 700 36 700 98"></path><polygon className="flowhead" points="691,96 709,96 700,108"></polygon></svg>
        <div className="downarrow" aria-hidden="true" style={{ justifyContent: 'center', margin: '20px 0' }}><svg width="24" height="40" viewBox="0 0 24 40"><path className="flow" d="M12 2 V30"></path><polygon className="flowhead" points="5,28 19,28 12,38"></polygon></svg></div>

        {/* step 4: agent builder */}
        <div style={{ display: 'flex', flexWrap: 'wrap', flexDirection: 'row-reverse', alignItems: 'center', gap: '40px' }}>
          <div className="rv" style={{ flex: '1 1 640px', minWidth: '0', maxWidth: '760px', background: '#FAFAFA', border: '1px solid #E4E6EE', borderRadius: '24px', padding: '18px' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 12px 32px rgba(22,26,43,.06)' }}>
              {/* builder top bar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '12px 16px', borderBottom: '1px solid #E4E6EE' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#F3F4F8', border: '1px dashed #9AA0B4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="22" height="18" viewBox="-50 -40 100 80" aria-hidden="true"><path className="br" style={{ strokeDasharray: '6 6', strokeWidth: '3' }} d="M-36 8 C-46 6 -46 -12 -34 -14 C-36 -28 -18 -34 -10 -26 C-6 -36 10 -36 14 -26 C24 -34 40 -26 36 -12 C48 -8 46 10 36 12 C38 26 20 32 12 24 C6 32 -10 32 -14 24 C-26 32 -42 22 -36 8 Z"></path><circle className="pu" cx="-10" cy="4" r="5"></circle><circle className="pu" cx="12" cy="4" r="5"></circle></svg>
                  </span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700' }}>@follow-up</div>
                    <div style={{ fontSize: '11px', color: '#5A6075' }}>Your agent · draft</div>
                  </div>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '13px', fontWeight: '700', color: '#FFFFFF', background: '#3F5FD8', borderRadius: '999px', padding: '8px 14px' }}>Save agent</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
                {/* left: build */}
                <div style={{ padding: '16px', borderRight: '1px solid #E4E6EE', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#161A2B' }}>Instructions</div>
                    <div style={{ marginTop: '8px', border: '1px solid #E4E6EE', borderRadius: '10px', padding: '10px 12px', fontSize: '12.5px', color: '#161A2B', background: '#FAFAFA', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      <span className="mono type">Follow up with every recruiter after 5 days</span><span className="caret"></span>
                    </div>
                    <div className="st2" style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', lineHeight: '1.45', color: '#3F5FD8', background: '#EEF1FD', borderRadius: '10px', padding: '8px 10px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', marginTop: '1px' }}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"></path></svg>
                      <span>Tip: give it your Honne IQ so it knows who you applied to and when.</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#161A2B' }}>Knowledge &amp; tools</div>
                    <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <span className="tool on3"><span style={{ width: '7px', height: '7px', borderRadius: '99px', background: '#4D70EB', display: 'inline-block' }}></span>Honne IQ</span>
                      <span className="tool on4">Gmail</span>
                      <span className="tool on4">Google Calendar</span>
                      <span className="tool">LinkedIn notes</span>
                    </div>
                  </div>
                </div>
                {/* right: preview */}
                <div style={{ padding: '16px', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '220px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '12px', fontWeight: '700', color: '#161A2B' }}>Preview</span><span style={{ fontSize: '11px', color: '#5A6075' }}>Try it before you save</span></div>
                  <div className="st4" style={{ alignSelf: 'flex-end', maxWidth: '85%', background: '#161A2B', color: '#FFFFFF', fontSize: '12.5px', lineHeight: '1.45', borderRadius: '14px 14px 4px 14px', padding: '9px 12px' }}>Who should I follow up with today?</div>
                  <div className="st5" style={{ alignSelf: 'flex-start', maxWidth: '92%', background: '#FFFFFF', border: '1px solid #E4E6EE', color: '#161A2B', fontSize: '12.5px', lineHeight: '1.5', borderRadius: '14px 14px 14px 4px', padding: '10px 12px' }}>
                    <strong>3 recruiters</strong> — Zerodha, Swiggy and Freshworks haven’t replied in 5+ days. I’ve drafted a short follow-up for each in Gmail.
                  </div>
                  <div className="st6" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: '#15803D', background: '#E8F5EC', borderRadius: '999px', padding: '6px 10px' }}>✓ 3 drafts ready</div>
                </div>
              </div>
            </div>
          </div>
          <div className="rv" style={{ flex: '1 1 280px', minWidth: '0' }}>
            <div className="mono" style={{ fontSize: '13px', color: '#3F5FD8' }}>STEP 04</div>
            <h3 className="disp" style={{ margin: '10px 0 0', fontSize: 'clamp(26px,2.8vw,36px)', lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.03em' }}>Need something else? Build your own agent.</h3>
            <p style={{ margin: '12px 0 0', fontSize: '17px', lineHeight: '1.55', color: '#5A6075' }}>Write what you need in plain words, pick what it can use, and try it right there. It works on your search like ours do.</p>
          </div>
        </div>
      </div>
    </section>

    {/* ATS */}
    <section id="ats" style={{ background: '#FAFAFA', borderTop: '1px solid #E4E6EE' }}>
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '112px 24px' }}>
        <div className="rv" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px' }}>
          <div style={{ maxWidth: '700px' }}>
            <div className="eyebrow" style={{ color: '#3F5FD8' }}>Applicant tracking systems</div>
            <h2 className="disp" style={{ margin: '14px 0 0', fontSize: 'clamp(36px,4.6vw,58px)', lineHeight: '1.02', fontWeight: '800', letterSpacing: '-0.04em' }}>Tailored for <span className="serif" style={{ color: '#3F5FD8', fontSize: '1.08em' }}>every</span> leading ATS.</h2>
          </div>
          <p style={{ margin: '0', maxWidth: '420px', fontSize: '17px', lineHeight: '1.55', color: '#5A6075' }}>Built on recruiter advice and our own 5,000+ applications through these systems — so your CV reads right, everywhere.</p>
        </div>
        <div className="rv" style={{ marginTop: '48px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '20px 22px' }}><div className="disp" style={{ fontSize: '20px', fontWeight: '700' }}>Workday</div><div style={{ marginTop: '6px', fontSize: '12px', fontWeight: '600', color: '#15803D' }}>✓ Tuned</div></div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '20px 22px' }}><div className="disp" style={{ fontSize: '20px', fontWeight: '700' }}>Greenhouse</div><div style={{ marginTop: '6px', fontSize: '12px', fontWeight: '600', color: '#15803D' }}>✓ Tuned</div></div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '20px 22px' }}><div className="disp" style={{ fontSize: '20px', fontWeight: '700' }}>Lever</div><div style={{ marginTop: '6px', fontSize: '12px', fontWeight: '600', color: '#15803D' }}>✓ Tuned</div></div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '20px 22px' }}><div className="disp" style={{ fontSize: '20px', fontWeight: '700' }}>iCIMS</div><div style={{ marginTop: '6px', fontSize: '12px', fontWeight: '600', color: '#15803D' }}>✓ Tuned</div></div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '20px 22px' }}><div className="disp" style={{ fontSize: '20px', fontWeight: '700' }}>Oracle Taleo</div><div style={{ marginTop: '6px', fontSize: '12px', fontWeight: '600', color: '#15803D' }}>✓ Tuned</div></div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '20px 22px' }}><div className="disp" style={{ fontSize: '20px', fontWeight: '700' }}>SuccessFactors</div><div style={{ marginTop: '6px', fontSize: '12px', fontWeight: '600', color: '#15803D' }}>✓ Tuned</div></div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '20px 22px' }}><div className="disp" style={{ fontSize: '20px', fontWeight: '700' }}>SmartRecruiters</div><div style={{ marginTop: '6px', fontSize: '12px', fontWeight: '600', color: '#15803D' }}>✓ Tuned</div></div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '20px 22px' }}><div className="disp" style={{ fontSize: '20px', fontWeight: '700' }}>Ashby</div><div style={{ marginTop: '6px', fontSize: '12px', fontWeight: '600', color: '#15803D' }}>✓ Tuned</div></div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '20px 22px' }}><div className="disp" style={{ fontSize: '20px', fontWeight: '700' }}>Workable</div><div style={{ marginTop: '6px', fontSize: '12px', fontWeight: '600', color: '#15803D' }}>✓ Tuned</div></div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '20px 22px' }}><div className="disp" style={{ fontSize: '20px', fontWeight: '700' }}>Teamtailor</div><div style={{ marginTop: '6px', fontSize: '12px', fontWeight: '600', color: '#15803D' }}>✓ Tuned</div></div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '20px 22px' }}><div className="disp" style={{ fontSize: '20px', fontWeight: '700' }}>BambooHR</div><div style={{ marginTop: '6px', fontSize: '12px', fontWeight: '600', color: '#15803D' }}>✓ Tuned</div></div>
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '16px', padding: '20px 22px' }}><div className="disp" style={{ fontSize: '20px', fontWeight: '700' }}>Jobvite</div><div style={{ marginTop: '6px', fontSize: '12px', fontWeight: '600', color: '#15803D' }}>✓ Tuned</div></div>
        </div>

        <div className="rv" style={{ marginTop: '40px', background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '24px', padding: 'clamp(24px,3.5vw,40px)', display: 'flex', flexWrap: 'wrap', gap: '28px', alignItems: 'center' }}>
          <div style={{ flex: '1 1 380px', minWidth: '0' }}>
            <div className="disp" style={{ fontSize: 'clamp(26px,3vw,38px)', lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.03em' }}>We don’t game the ATS. The goal is <span className="serif" style={{ color: '#3F5FD8', fontSize: '1.1em' }}>the job.</span></div>
            <p style={{ margin: '12px 0 0', fontSize: '17px', lineHeight: '1.55', color: '#5A6075' }}>Not an interview you can’t hold. Your CV tells the truth — just told well.</p>
          </div>
          <div style={{ flex: '1 1 280px', minWidth: '0', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '600', border: '1px solid #E4E6EE', borderRadius: '999px', padding: '10px 16px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>No fake skills</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '600', border: '1px solid #E4E6EE', borderRadius: '999px', padding: '10px 16px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>No keyword stuffing</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '600', border: '1px solid #E4E6EE', borderRadius: '999px', padding: '10px 16px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>No invented experience</span>
          </div>
        </div>
      </div>
    </section>

    {/* TEMPLATES */}
    <section id="templates" style={{ background: '#FFFFFF', borderTop: '1px solid #E4E6EE' }}>
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '112px 24px' }}>
        <div className="rv" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px' }}>
          <div style={{ maxWidth: '680px' }}>
            <div className="eyebrow" style={{ color: '#3F5FD8' }}>Templates</div>
            <h2 className="disp" style={{ margin: '14px 0 0', fontSize: 'clamp(36px,4.6vw,58px)', lineHeight: '1.02', fontWeight: '800', letterSpacing: '-0.04em' }}>ATS-friendly. <span className="serif" style={{ color: '#3F5FD8', fontSize: '1.08em' }}>Recruiter-approved.</span></h2>
          </div>
          <p style={{ margin: '0', maxWidth: '380px', fontSize: '17px', lineHeight: '1.55', color: '#5A6075' }}>Start with the template recruiters see most. More on the way.</p>
        </div>
        <div style={{ marginTop: '48px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: '20px' }}>
          {/* Jake's Resume */}
          <div className="rv lift" style={{ background: '#F3F4F8', borderRadius: '20px', padding: '18px' }}>
            <div className="jk" style={{ aspectRatio: '3/4', background: '#FFFFFF', borderRadius: '10px', padding: '16px 16px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(22,26,43,.06),0 10px 24px rgba(22,26,43,.06)' }}>
              <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: '700', letterSpacing: '.01em' }}>Jake Ryan</div>
              <div style={{ textAlign: 'center', fontSize: '5.6px', marginTop: '3px' }}>123-456-7890 | jake@su.edu | linkedin.com/in/jake | github.com/jake</div>
              <div className="h">Education</div>
              <div className="r" style={{ marginTop: '2px' }}><b>Southwestern University</b><span>Georgetown, TX</span></div>
              <div className="r i"><span>Bachelor of Arts in Computer Science, Minor in Business</span><span>Aug. 2018 – May 2021</span></div>
              <div className="r" style={{ marginTop: '2px' }}><b>Blinn College</b><span>Bryan, TX</span></div>
              <div className="r i"><span>Associate’s in Liberal Arts</span><span>Aug. 2014 – May 2018</span></div>
              <div className="h">Experience</div>
              <div className="r" style={{ marginTop: '2px' }}><b>Undergraduate Research Assistant</b><span>June 2020 – Present</span></div>
              <div className="r i"><span>Texas A&amp;M University</span><span>College Station, TX</span></div>
              <ul><li>Developed a REST API using FastAPI and PostgreSQL to store data from learning management systems</li><li>Developed a full-stack web application using Flask, React, PostgreSQL and Docker to analyze GitHub data</li><li>Explored ways to visualize GitHub collaboration in a classroom setting</li></ul>
              <div className="r" style={{ marginTop: '2px' }}><b>Information Technology Support Specialist</b><span>Sep. 2018 – Present</span></div>
              <div className="r i"><span>Southwestern University</span><span>Georgetown, TX</span></div>
              <ul><li>Communicate with managers to set up campus computers used on campus</li><li>Assess and troubleshoot computer problems brought by students, faculty and staff</li></ul>
              <div className="h">Projects</div>
              <div className="r" style={{ marginTop: '2px' }}><span><b>Gitlytics</b> | <span className="i">Python, Flask, React, PostgreSQL, Docker</span></span><span>June 2020 – Present</span></div>
              <ul><li>Developed a full-stack web application using Flask serving a REST API with React as the frontend</li><li>Implemented GitHub OAuth to get data from user’s repositories</li></ul>
              <div className="h">Technical Skills</div>
              <div className="r" style={{ display: 'block', marginTop: '2px' }}><b>Languages:</b> Java, Python, C/C++, SQL (Postgres), JavaScript, HTML/CSS, R</div>
              <div className="r" style={{ display: 'block' }}><b>Frameworks:</b> React, Node.js, Flask, JUnit, WordPress, Material-UI, FastAPI</div>
              <div className="r" style={{ display: 'block' }}><b>Developer Tools:</b> Git, Docker, TravisCI, Google Cloud Platform, VS Code</div>
            </div>
            <div style={{ padding: '16px 4px 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}><span className="disp" style={{ fontSize: '18px', fontWeight: '700' }}>Jake’s Resume</span><span style={{ fontSize: '12px', fontWeight: '600', color: '#15803D', background: '#E8F5EC', borderRadius: '999px', padding: '4px 10px' }}>ATS-safe</span></div>
            <div style={{ padding: '4px 4px 0', fontSize: '13px', color: '#5A6075' }}>The engineer’s favourite. One page, single column.</div>
          </div>
          {/* Elegant */}
          <div className="rv" style={{ background: '#F3F4F8', borderRadius: '20px', padding: '18px' }}>
            <div style={{ aspectRatio: '3/4', background: '#FFFFFF', borderRadius: '10px', overflow: 'hidden', border: '1px dashed #C9CDD9' }}>
              <img src={elegantTemplate} alt="Elegant resume template preview" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block', opacity: '.45' }} />
            </div>
            <div style={{ padding: '16px 4px 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}><span className="disp" style={{ fontSize: '18px', fontWeight: '700', color: '#5A6075' }}>Elegant</span><span style={{ fontSize: '12px', fontWeight: '600', color: '#5A6075', background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '999px', padding: '4px 10px' }}>Coming soon</span></div>
            <div style={{ padding: '4px 4px 0', fontSize: '13px', color: '#5A6075' }}>Formal and refined, with clear section rules.</div>
          </div>
          {/* Classic: coming soon */}
          <div className="rv" style={{ background: '#F3F4F8', borderRadius: '20px', padding: '18px' }}>
            <div style={{ aspectRatio: '3/4', background: '#FFFFFF', borderRadius: '10px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '8px', opacity: '.45', border: '1px dashed #C9CDD9' }}>
              <div style={{ height: '11px', borderRadius: '99px', width: '52%', background: '#161A2B', margin: '0 auto' }}></div>
              <div style={{ height: '5px', borderRadius: '99px', width: '70%', background: '#E4E6EE', margin: '0 auto 6px' }}></div>
              <div style={{ height: '1px', background: '#161A2B' }}></div>
              <div style={{ height: '6px', borderRadius: '99px', width: '30%', background: '#161A2B', marginTop: '6px' }}></div>
              <div style={{ height: '6px', borderRadius: '99px', width: '94%', background: '#E4E6EE' }}></div><div style={{ height: '6px', borderRadius: '99px', width: '88%', background: '#E4E6EE' }}></div><div style={{ height: '6px', borderRadius: '99px', width: '76%', background: '#E4E6EE' }}></div>
              <div style={{ height: '6px', borderRadius: '99px', width: '30%', background: '#161A2B', marginTop: '6px' }}></div>
              <div style={{ height: '6px', borderRadius: '99px', width: '90%', background: '#E4E6EE' }}></div><div style={{ height: '6px', borderRadius: '99px', width: '82%', background: '#E4E6EE' }}></div>
            </div>
            <div style={{ padding: '16px 4px 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}><span className="disp" style={{ fontSize: '18px', fontWeight: '700', color: '#5A6075' }}>Classic</span><span style={{ fontSize: '12px', fontWeight: '600', color: '#5A6075', background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '999px', padding: '4px 10px' }}>Coming soon</span></div>
          </div>
          {/* Modern: coming soon */}
          <div className="rv" style={{ background: '#F3F4F8', borderRadius: '20px', padding: '18px' }}>
            <div style={{ aspectRatio: '3/4', background: '#FFFFFF', borderRadius: '10px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '8px', opacity: '.45', border: '1px dashed #C9CDD9' }}>
              <div style={{ height: '12px', borderRadius: '99px', width: '58%', background: '#3F5FD8' }}></div>
              <div style={{ height: '5px', borderRadius: '99px', width: '44%', background: '#E4E6EE', marginBottom: '8px' }}></div>
              <div style={{ height: '6px', borderRadius: '99px', width: '26%', background: '#3F5FD8', marginTop: '4px' }}></div>
              <div style={{ height: '6px', borderRadius: '99px', width: '94%', background: '#E4E6EE' }}></div><div style={{ height: '6px', borderRadius: '99px', width: '86%', background: '#E4E6EE' }}></div><div style={{ height: '6px', borderRadius: '99px', width: '72%', background: '#E4E6EE' }}></div>
              <div style={{ height: '6px', borderRadius: '99px', width: '26%', background: '#3F5FD8', marginTop: '6px' }}></div>
              <div style={{ height: '6px', borderRadius: '99px', width: '90%', background: '#E4E6EE' }}></div><div style={{ height: '6px', borderRadius: '99px', width: '80%', background: '#E4E6EE' }}></div>
            </div>
            <div style={{ padding: '16px 4px 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}><span className="disp" style={{ fontSize: '18px', fontWeight: '700', color: '#5A6075' }}>Modern</span><span style={{ fontSize: '12px', fontWeight: '600', color: '#5A6075', background: '#FFFFFF', border: '1px solid #E4E6EE', borderRadius: '999px', padding: '4px 10px' }}>Coming soon</span></div>
          </div>
        </div>
      </div>
    </section>

    {/* FOUNDER QUOTE */}
    <section style={{ background: '#12141C', color: '#F2F3F7' }}>
      <div style={{ maxWidth: '1020px', margin: '0 auto', padding: '128px 24px' }}>
        <div className="rv serif" aria-hidden="true" style={{ fontSize: '140px', lineHeight: '.6', color: '#4D70EB', height: '60px' }}>“</div>
        <blockquote className="rv" style={{ margin: '24px 0 0', padding: '0' }}>
          <p className="disp" style={{ margin: '0', fontSize: 'clamp(26px,3.4vw,44px)', lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.025em' }}>
            The hardest thing ever? Applying to <span className="serif" style={{ color: '#FB8A4C', fontSize: '1.1em' }}>hundreds</span> every day and getting nothing back. No dopamine hit. Just slowly losing your self-confidence.
          </p>
          <p className="disp" style={{ margin: '28px 0 0', fontSize: 'clamp(26px,3.4vw,44px)', lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.025em', color: '#A3A8B8' }}>
            That won’t work in today’s market — or tomorrow’s.
          </p>
          <p className="disp" style={{ margin: '28px 0 0', fontSize: 'clamp(26px,3.4vw,44px)', lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.025em' }}>
            So stay conscious. Apply where you have a <span className="serif" style={{ color: '#9DB0F6', fontSize: '1.1em' }}>sure shot.</span> Get referrals. Track what you’re doing. And start again from where it didn’t work — <span style={{ textDecoration: 'underline', textDecorationColor: '#4D70EB', textDecorationThickness: '4px', textUnderlineOffset: '8px' }}>not from scratch.</span>
          </p>
          <footer style={{ marginTop: '40px', display: 'flex', alignItems: 'center', gap: '14px', fontSize: '16px', color: '#A3A8B8' }}>
            <span style={{ width: '40px', height: '2px', background: '#4D70EB', display: 'inline-block' }}></span>
            The founders of Honne Careers
          </footer>
        </blockquote>
      </div>
    </section>

    {/* COMMUNITY BETA */}
    <section id="start" style={{ background: '#FAFAFA' }}>
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '112px 24px' }}>
        <div className="rv" style={{ background: '#131C52', color: '#FFFFFF', borderRadius: '32px', padding: 'clamp(36px,6vw,80px)', position: 'relative', overflow: 'hidden', textAlign: 'center', boxShadow: '0 30px 70px rgba(19,28,82,.25)' }}>
          <div aria-hidden="true" style={{ position: 'absolute', left: '-80px', bottom: '-140px', width: '320px', height: '320px', borderRadius: '999px', background: '#1C2870' }}></div>
          <div aria-hidden="true" style={{ position: 'absolute', right: '-40px', top: '-70px', width: '200px', height: '200px', borderRadius: '999px', background: '#1C2870' }}></div>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', letterSpacing: '.08em', background: 'rgba(255,255,255,.14)', borderRadius: '999px', padding: '8px 14px' }}><span className="dot" style={{ width: '7px', height: '7px', borderRadius: '99px', background: '#4ADE80', display: 'inline-block' }}></span>COMMUNITY BETA · NOW OPEN</div>
            <h2 className="disp" style={{ margin: '20px auto 0', maxWidth: '780px', fontSize: 'clamp(36px,4.8vw,62px)', lineHeight: '1.02', fontWeight: '800', letterSpacing: '-0.04em' }}>Test it with us. <span className="serif" style={{ fontSize: '1.1em' }}>Shape it with us.</span></h2>
            <p style={{ margin: '18px auto 0', maxWidth: '560px', fontSize: '18px', lineHeight: '1.55', color: '#E9ECF9' }}>Tell us how you search. What works for you becomes a feature for everyone.</p>
            <div style={{ marginTop: '34px', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
              <Link className="btn" to="/login" style={{ minHeight: '58px', borderRadius: '999px', padding: '0 32px', fontSize: '17px', fontWeight: '700', background: '#FFFFFF', color: '#131C52', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>Join the beta
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
              </Link>
            </div>
            <p style={{ margin: '16px 0 0', fontSize: '14px', color: '#A9B6EE' }}>Free during the beta. No card required.</p>
          </div>
        </div>
      </div>
    </section>

    {/* FOOTER */}
    <footer style={{ borderTop: '1px solid #E4E6EE', background: '#FAFAFA' }}>
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px', fontSize: '14px', color: '#5A6075' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}><span className="disp" style={{ fontWeight: '800', fontSize: '19px', letterSpacing: '-0.03em', color: '#161A2B' }}>Honne <span style={{ fontWeight: '500', color: '#5A6075' }}>Careers</span></span><span>Apply with intent.</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '22px' }}>
          <a href="#agents" style={{ color: '#5A6075', textDecoration: 'none' }}>Agents</a>
          <a href="#templates" style={{ color: '#5A6075', textDecoration: 'none' }}>Templates</a>
          <a href="#privacy" style={{ color: '#5A6075', textDecoration: 'none' }}>Privacy</a>
          <span>© 2026 Honne Careers</span>
        </div>
      </div>
    </footer>

    </div>
  );
}
