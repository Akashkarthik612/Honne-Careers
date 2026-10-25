import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useJump } from '../landingHooks';
import { Chevron, Logo, Wordmark } from './parts';

const LINKS = [['how', 'Agents'], ['tailor', 'CV tailoring'], ['loop', 'Learning loop'], ['templates', 'Templates']];

// Sticky nav: clear over the hero, frosted with a hairline once the page scrolls.
export default function Nav() {
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8);
  const jump = useJump(() => setMenu(false));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const blur = scrolled ? 'saturate(1.4) blur(12px)' : 'none';
  return (
    <header className="e0" style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: scrolled || menu ? 'rgba(251,250,248,.86)' : 'rgba(251,250,248,0)',
      backdropFilter: blur, WebkitBackdropFilter: blur,
      borderBottom: `1px solid ${scrolled ? '#E8E6E3' : 'transparent'}`,
      transition: 'background .2s ease,border-color .2s ease',
    }}>
      <div className="wrap" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 64 }}>
        <a href="#top" onClick={jump(0)} aria-label="Honne Careers, back to top" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#171717', minHeight: 44, marginRight: 18 }}>
          <Logo /><Wordmark />
        </a>
        <nav className="navlinks" aria-label="Sections" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {LINKS.map(([id, label]) => <a key={id} className="navl" href={`#${id}`} onClick={jump(id)}>{label}</a>)}
        </nav>
        <div style={{ flex: 1 }}></div>
        <Link className="navl navlinks" to="/login" style={{ display: 'inline-flex' }}>Sign in</Link>
        <Link className="btn-p" to="/login" style={{ minHeight: 40, padding: '0 16px', fontSize: 14 }}>Get started <Chevron size={13} /></Link>
        <button type="button" className="menubtn iconbtn" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d={menu ? 'M6 6l12 12M18 6 6 18' : 'M4 7h16M4 12h16M4 17h16'}></path>
          </svg>
        </button>
      </div>
      {menu && (
        <div className="rise" style={{ borderTop: '1px solid #E8E6E3', background: '#FFFFFF', padding: '8px 16px 16px', display: 'flex', flexDirection: 'column' }}>
          {LINKS.map(([id, label]) => <a key={id} className="navl" href={`#${id}`} onClick={jump(id)}>{label}</a>)}
          <Link className="navl" to="/login">Sign in</Link>
        </div>
      )}
    </header>
  );
}
