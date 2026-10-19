import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Bot, Database, FileText, LogOut, Plus, Settings, User } from 'lucide-react';
import { HonneTile, Wordmark } from '@/components/HonneMark';
import useSignOut from '@/hooks/useSignOut';
import { useAppStore } from '@/state/appStore';
import { useAuth } from '@/state/auth';

// Collapsible app sidebar (design: Sidebar.dc.html). Open 248px / collapsed 76px, remembered per browser.
// Below 760px it stays a 76px rail and opens as an overlay.

const STORAGE_KEY = 'honne-sidebar';
const NARROW = '(max-width: 759px)';

function readCollapsed() {
  try { return window.localStorage.getItem(STORAGE_KEY) === 'collapsed'; } catch { return false; }
}

function writeCollapsed(collapsed) {
  try { window.localStorage.setItem(STORAGE_KEY, collapsed ? 'collapsed' : 'open'); } catch { /* storage blocked: keep in memory only */ }
}

// Which nav item a path belongs to; the whole new-resume flow counts as "Resumes".
function activeSection(pathname) {
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'resumes';
}

function PanelIcon({ open }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /><path d={open ? 'M16 10l-2 2 2 2' : 'M14 10l2 2-2 2'} />
    </svg>
  );
}

export default function Sidebar() {
  const { pathname } = useLocation();
  const { resetDraft } = useAppStore();
  const { user } = useAuth();
  const signOut = useSignOut();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const onChange = (e) => { setNarrow(e.matches); setMobileOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Close the mobile overlay on navigation.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) { setLastPath(pathname); setMobileOpen(false); }

  const open = narrow ? mobileOpen : !collapsed;
  const overlay = narrow && mobileOpen;
  const width = open ? 248 : 76;
  const active = activeSection(pathname);

  function toggle() {
    if (narrow) { setMobileOpen((o) => !o); return; }
    setCollapsed((c) => { writeCollapsed(!c); return !c; });
  }

  const item = (on) => ({
    display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, borderRadius: 12, textDecoration: 'none',
    fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden',
    ...(open ? { padding: '0 12px' } : { justifyContent: 'center', padding: 0 }),
    ...(on ? { background: 'var(--hc-brand-tint)', color: 'var(--hc-brand-hover)' } : { color: 'var(--hc-ink)' }),
  });
  const muted = { ...item(false), color: 'var(--hc-ink-muted)' };
  const navItem = (to, key, label, Icon) => (
    <NavLink to={to} title={label} aria-current={active === key ? 'page' : undefined} style={item(active === key)}>
      <Icon size={20} strokeWidth={2} aria-hidden="true" style={{ flex: 'none' }} />{open && <span>{label}</span>}
    </NavLink>
  );
  const soon = (label, Icon) => (
    <span title={`${label} — coming soon`} aria-disabled="true" style={{ ...muted, cursor: 'default' }}>
      <Icon size={20} strokeWidth={2} aria-hidden="true" style={{ flex: 'none' }} />
      {open && <><span style={{ flex: 1 }}>{label}</span><span className="hc-soon">SOON</span></>}
    </span>
  );
  const initials = user.name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

  return (
    <div style={{ flex: 'none', minHeight: 1, transition: 'width .22s ease', width: narrow ? 76 : width }}>
      {overlay && <button type="button" aria-label="Close menu" onClick={toggle} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(14,18,38,.4)', border: 0, cursor: 'default' }} />}
      <aside
        aria-label="Main navigation"
        style={{
          boxSizing: 'border-box', display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderRight: '1px solid var(--hc-hairline)',
          position: 'fixed', left: 0, top: 0, bottom: 0, overflowY: 'auto', transition: 'width .22s ease',
          ...(overlay ? { zIndex: 60, width: 260, boxShadow: '0 20px 60px rgba(14,18,38,.25)' } : { zIndex: 40, width }),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, ...(open ? { justifyContent: 'space-between' } : { flexDirection: 'column' }) }}>
          <Link to="/" aria-label="Honne Careers home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--hc-ink)', minHeight: 44, minWidth: 0 }}>
            <HonneTile size={34} radius={10} mark={[22, 20]} />
            {open && <span style={{ whiteSpace: 'nowrap' }}><Wordmark size={18} /></span>}
          </Link>
          <button
            type="button" onClick={toggle} aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'} aria-expanded={open} title={open ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{ flex: 'none', width: 36, height: 36, borderRadius: 10, border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <PanelIcon open={open} />
          </button>
        </div>

        <div style={{ padding: '6px 12px 10px' }}>
          <Link
            to="/new/template" onClick={resetDraft} aria-label="New resume" title="New resume"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: 999, background: 'var(--hc-brand)', color: '#FFFFFF',
              textDecoration: 'none', fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 6px 16px rgba(63,95,216,.22)',
              ...(open ? { padding: '0 16px' } : { width: 44, margin: '0 auto', padding: 0 }),
            }}
          >
            <Plus size={18} strokeWidth={2.4} aria-hidden="true" style={{ flex: 'none' }} />{open && <span>New resume</span>}
          </Link>
        </div>

        <nav aria-label="Sections" style={{ padding: '4px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItem('/resumes', 'resumes', 'Resumes', FileText)}
          {navItem('/profile', 'profile', 'Profile', User)}
          {soon('Honne IQ', Database)}
          {soon('Agents', Bot)}
        </nav>

        <div style={{ flex: 1 }} />

        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 2, borderTop: '1px solid var(--hc-hairline)' }}>
          {open && (
            <div style={{ margin: '2px 0 8px', background: '#E8F5EC', color: 'var(--hc-success)', borderRadius: 12, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.45 }}>
              <strong>Beta</strong> · free while we test with real users.
            </div>
          )}
          {navItem('/settings', 'settings', 'Settings', Settings)}
          <div title={`${user.name} · ${user.email}`} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, marginTop: 4, ...(open ? { padding: '0 8px' } : { justifyContent: 'center' }) }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" width={32} height={32} referrerPolicy="no-referrer" style={{ flex: 'none', borderRadius: 99, objectFit: 'cover' }} />
              : <span style={{ flex: 'none', width: 32, height: 32, borderRadius: 99, background: 'var(--hc-ink)', color: '#FFFFFF', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</span>}
            {open && (
              <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</span>
                <span style={{ fontSize: 12, color: 'var(--hc-ink-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</span>
              </span>
            )}
          </div>
          <button type="button" onClick={signOut.signOut} disabled={signOut.busy} title={signOut.error ?? 'Sign out'} aria-label="Sign out" style={{ ...muted, border: 0, background: 'none', fontFamily: 'inherit', cursor: signOut.busy ? 'progress' : 'pointer', width: '100%' }}>
            <LogOut size={20} strokeWidth={2} aria-hidden="true" style={{ flex: 'none' }} />{open && <span>{signOut.busy ? 'Signing out…' : 'Sign out'}</span>}
          </button>
          {signOut.error && open && <span role="alert" style={{ fontSize: 12.5, color: 'var(--hc-warm)', padding: '0 12px' }}>{signOut.error}</span>}
        </div>
      </aside>
    </div>
  );
}
