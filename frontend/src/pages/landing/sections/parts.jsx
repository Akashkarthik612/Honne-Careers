import { useReveal } from '../landingHooks';

// Small pieces shared by the landing sections.

export function Chevron({ size = 14, dir = 'right' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'right' ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'}></path>
    </svg>
  );
}

export function Check({ size = 14, width = 2.6, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      <path d="M20 6 9 17l-5-5"></path>
    </svg>
  );
}

// Two-path line icon (the agents' icons are two strokes each).
export function Icon2({ d1, d2, size = 16, width = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      <path d={d1}></path><path d={d2}></path>
    </svg>
  );
}

export function Logo() {
  return (
    <span style={{ width: 30, height: 30, borderRadius: 9, background: '#171717', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true">
      <svg width="20" height="17" viewBox="-50 -40 100 80">
        <path style={{ fill: 'none', stroke: '#FFFFFF', strokeWidth: 5, strokeLinejoin: 'round' }} d="M-36 8 C-46 6 -46 -12 -34 -14 C-36 -28 -18 -34 -10 -26 C-6 -36 10 -36 14 -26 C24 -34 40 -26 36 -12 C48 -8 46 10 36 12 C38 26 20 32 12 24 C6 32 -10 32 -14 24 C-26 32 -42 22 -36 8 Z"></path>
        <circle cx="-10" cy="4" r="5" style={{ fill: '#FFFFFF' }}></circle>
        <circle cx="12" cy="4" r="5" style={{ fill: '#FFFFFF' }}></circle>
      </svg>
    </span>
  );
}

export function Wordmark({ size = 18 }) {
  return <span className="h" style={{ fontSize: size, fontWeight: 700, letterSpacing: '-0.03em' }}>Honne <span style={{ fontWeight: 500, color: '#666666' }}>Careers</span></span>;
}

// Rises into view once, the first time it scrolls on screen.
export function Reveal({ as: Tag = 'div', className = '', children, ...rest }) {
  const [ref, seen] = useReveal();
  return <Tag ref={ref} className={`rv${seen ? ' seen' : ''} ${className}`} {...rest}>{children}</Tag>;
}

// Shared pastel ribbon gradients; the hero and the final CTA both paint with them.
export function RibbonDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        <linearGradient id="lp-rA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ECE8FF"></stop><stop offset=".5" stopColor="#BDB3FF"></stop><stop offset="1" stopColor="#A9C8FF"></stop></linearGradient>
        <linearGradient id="lp-rB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFEDE3"></stop><stop offset=".5" stopColor="#FFCADD"></stop><stop offset="1" stopColor="#CDBEFF"></stop></linearGradient>
        <linearGradient id="lp-rC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E0EAFF"></stop><stop offset=".5" stopColor="#B2A6FF"></stop><stop offset="1" stopColor="#F7C1DA"></stop></linearGradient>
        <pattern id="lp-rL" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><rect width="1" height="7" fill="#FFFFFF" opacity=".4"></rect></pattern>
      </defs>
    </svg>
  );
}
