// Sticky app bar shared by the CV studio and the profile form. Children fill the middle and right.
export default function AppHeader({ children }) {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--hc-hairline)' }}>
      <nav aria-label="App" style={{ maxWidth: 1600, margin: '0 auto', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        {children}
      </nav>
    </header>
  );
}

export function Avatar({ initials }) {
  return (
    <span aria-label="Account" style={{ width: 34, height: 34, borderRadius: 99, background: 'var(--hc-ink)', color: '#FFFFFF', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {initials}
    </span>
  );
}
