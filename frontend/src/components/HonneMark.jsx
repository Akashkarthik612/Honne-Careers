// The Honne brain mark, used in app headers, the sign-in card and chat avatars.
const BRAIN = 'M-36 8 C-46 6 -46 -12 -34 -14 C-36 -28 -18 -34 -10 -26 C-6 -36 10 -36 14 -26 C24 -34 40 -26 36 -12 C48 -8 46 10 36 12 C38 26 20 32 12 24 C6 32 -10 32 -14 24 C-26 32 -42 22 -36 8 Z';

export function HonneMark({ width = 22, height = 20 }) {
  return (
    <svg width={width} height={height} viewBox="-50 -40 100 80" aria-hidden="true">
      <path d={BRAIN} fill="#FFFFFF" stroke="#161A2B" strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="-10" cy="4" r="5" fill="#161A2B" />
      <circle cx="12" cy="4" r="5" fill="#161A2B" />
    </svg>
  );
}

// Mark in its rounded tile, as it sits beside the wordmark.
export function HonneTile({ size = 30, radius = 9, mark = [20, 18] }) {
  return (
    <span style={{ width: size, height: size, borderRadius: radius, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <HonneMark width={mark[0]} height={mark[1]} />
    </span>
  );
}

export function Wordmark({ size = 19 }) {
  return (
    <span className="hc-disp" style={{ fontWeight: 800, fontSize: size, letterSpacing: '-0.03em' }}>
      Honne <span style={{ fontWeight: 600, color: 'var(--hc-ink-muted)' }}>Careers</span>
    </span>
  );
}
