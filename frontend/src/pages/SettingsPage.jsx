import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { GitHubIcon, GoogleIcon } from '@/components/BrandIcons';
import { ErrorBanner, PageLoading } from '@/components/Status';
import { templateName } from '@/data/templates';
import { resetTime, toUsage } from '@/data/usage';
import useResource from '@/hooks/useResource';
import useSignOut from '@/hooks/useSignOut';
import { deleteMe, getApplication, getChat, getProfile, getSettings, getUsage, listAgents, listApplications, listChats, listResumes, saveSettings } from '@/services/api';
import { ApiError, errorText } from '@/services/apiClient';
import { signOut as forgetSession } from '@/services/authService';
import { useAuth } from '@/state/auth';

// Settings (design: Settings.dc.html): account, beta limits, preferences, data & privacy.
// Preferences live in GET/PUT /settings and save as they change (no row yet = the defaults).
// Beta limits show today's usage from GET /me/usage (limits: backend/config/limits.yaml). There are
// no plans, prices or payment details in the beta, so nothing here mentions them.

const h2 = { margin: '0 0 14px', fontSize: 20, fontWeight: 800 };

function BetaLimits() {
  const load = useCallback(() => getUsage().then(toUsage), []);
  const res = useResource(load);
  return (
    <section id="st-limits" className="hc-card hc-sec" aria-labelledby="h-limits">
      <h2 id="h-limits" className="hc-disp" style={h2}>Beta limits</h2>
      <p style={{ margin: '0 0 14px', fontSize: 14.5, lineHeight: 1.55, color: 'var(--hc-ink-muted)' }}>Everyone gets the same limits while we test with real users.</p>
      {res.loading && <PageLoading label="Loading your usage…" />}
      <ErrorBanner error={res.error} style={{ marginTop: 0 }} action={{ label: 'Retry', onClick: res.reload }} />
      {res.data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {res.data.rows.map((r) => (
              <div key={r.key} style={{ border: `1px solid ${r.full ? '#F2C4B8' : 'var(--hc-hairline)'}`, background: r.full ? '#FDF3F0' : 'var(--hc-ground)', borderRadius: 14, padding: '14px 16px' }}>
                <div className="hc-lbl">{r.label}</div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }}>
                  {r.used} <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--hc-ink-muted)' }}>/ {r.limit}{r.unit ? ` ${r.unit}` : ''}</span>
                </div>
                <div role="meter" aria-label={r.label} aria-valuemin={0} aria-valuemax={r.limit} aria-valuenow={r.used} style={{ marginTop: 10, height: 6, borderRadius: 99, background: '#E4E6EE', overflow: 'hidden' }}>
                  <div style={{ width: `${r.limit ? Math.min(100, (100 * r.used) / r.limit) : 100}%`, height: '100%', background: r.full ? 'var(--hc-warm)' : 'var(--hc-brand)' }} />
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--hc-ink-muted)' }}>Daily limits start again at {resetTime(res.data.resetsAt)} your time. Deleting an agent frees a place for a new one.</p>
        </>
      )}
    </section>
  );
}

function Switch({ id, label, help, on, onFlip }) {
  return (
    <div className="hc-row">
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div id={id} style={{ fontSize: 14.5, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--hc-ink-muted)' }}>{help}</div>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={id} onClick={onFlip} style={{ flex: 'none', position: 'relative', width: 52, height: 30, borderRadius: 999, border: 0, cursor: 'pointer', padding: 0, transition: 'background-color .2s ease', background: on ? 'var(--hc-brand)' : '#C9CDD9' }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 25 : 3, width: 24, height: 24, borderRadius: 99, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(22,26,43,.25)', transition: 'left .2s ease' }} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const res = useResource(getSettings);
  const wrap = (children) => <main style={{ maxWidth: 880, margin: '0 auto', padding: '28px 20px 80px' }}>{children}</main>;
  if (res.loading) return wrap(<PageLoading label="Loading your settings…" />);
  if (res.error) return wrap(<ErrorBanner error={res.error} action={{ label: 'Retry', onClick: res.reload }} />);
  return <SettingsForm initial={res.data} />;
}

function SettingsForm({ initial }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const signOut = useSignOut();
  const [settings, setSettingsState] = useState(initial);
  const [nameInput, setNameInput] = useState(initial.display_name ?? '');
  const [prefError, setPrefError] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [exportNote, setExportNote] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const shownName = settings.display_name || user.name;
  const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : null;
  const initials = shownName.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

  // Saves the whole row (last write wins). On failure the switch shows the stored value again.
  async function setSettings(patch) {
    const next = { ...settings, ...patch };
    setSettingsState(next);
    setPrefError(null);
    try {
      setSettingsState(await saveSettings(next));
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      setSettingsState(settings);
      setPrefError(e);
    }
  }

  function saveName() {
    const name = nameInput.trim() || null; // empty = use the Google account name
    if (name !== settings.display_name) setSettings({ display_name: name });
  }

  // AUTH-3 / data export: the saved profile, every resume (with content), every application in the
  // Database (with its JD, CV sent and notes), the user's agents and every chat, as the API returns them.
  async function downloadData() {
    setExportError(null);
    setExportNote(null);
    let data;
    try {
      const [profile, resumes, list, agentList, chatList] = await Promise.all([getProfile(), listResumes(), listApplications(), listAgents(), listChats()]);
      const inBatches = async (items, get) => { // 5 at a time: bounded load on the API
        const out = [];
        for (let i = 0; i < items.length; i += 5) out.push(...await Promise.all(items.slice(i, i + 5).map(get)));
        return out;
      };
      const applications = await inBatches(list.items, (a) => getApplication(a.id));
      const chats = await inBatches(chatList.items, (c) => getChat(c.id));
      // The chat list stops at the server's cap: say so in the file and on screen, never cut silently.
      const chatsCapped = chatList.items.length >= chatList.limit;
      data = {
        exported_at: new Date().toISOString(), profile, resumes, applications, agents: agentList.mine, chats, settings,
        ...(chatsCapped ? { note: `Only your latest ${chatList.limit} chats are included.` } : {}),
      };
      setExportNote(chatsCapped ? `Downloaded. Only your latest ${chatList.limit} chats are included.` : null);
    } catch (e) {
      setExportError(e);
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'honne-careers-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // AUTH-3: the server deletes files, the sign-in and every row first; only then is local state cleared.
  // The Supabase user is gone by then, so signing out only forgets the session in this browser.
  async function removeAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMe();
    } catch (e) {
      setDeleteError(errorText(e));
      setDeleting(false);
      return;
    }
    await forgetSession({ scope: 'local' });
    navigate('/', { replace: true });
  }

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '28px 20px 80px' }}>
      <h1 className="hc-disp" style={{ margin: 0, fontSize: 'clamp(30px,3.4vw,42px)', lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.035em' }}>
        <span className="hc-serif" style={{ color: 'var(--hc-brand)', fontSize: '1.1em' }}>Settings</span>
      </h1>
      <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--hc-ink-muted)' }}>Your account, beta limits and preferences.</p>

      <nav aria-label="Settings sections" style={{ marginTop: 16, display: 'flex', gap: 2, overflowX: 'auto', background: '#EEF0F5', borderRadius: 999, padding: 4, width: 'fit-content', maxWidth: '100%' }}>
        <a className="hc-jump" href="#st-account">Account</a><a className="hc-jump" href="#st-limits">Beta limits</a><a className="hc-jump" href="#st-prefs">Preferences</a><a className="hc-jump" href="#st-data">Data &amp; privacy</a>
      </nav>

      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section id="st-account" className="hc-card hc-sec" aria-labelledby="h-acc">
          <h2 id="h-acc" className="hc-disp" style={h2}>Account</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" width={52} height={52} referrerPolicy="no-referrer" style={{ borderRadius: 99, objectFit: 'cover' }} />
              : <span style={{ width: 52, height: 52, borderRadius: 99, background: 'var(--hc-ink)', color: '#FFFFFF', fontSize: 17, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</span>}
            <div><div style={{ fontSize: 16, fontWeight: 700 }}>{shownName}</div>{memberSince && <div style={{ fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>Member since {memberSince}</div>}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div className="hc-f"><label className="hc-flabel" htmlFor="st-name">Display name</label><input id="st-name" className="hc-in" type="text" maxLength={120} value={nameInput} placeholder={user.name} onChange={(e) => setNameInput(e.target.value)} onBlur={saveName} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></div>
            <div className="hc-f">
              <label className="hc-flabel" htmlFor="st-email">Email</label>
              <input id="st-email" className="hc-in" type="email" value={user.email} readOnly aria-describedby="st-email-help" />
              <span id="st-email-help" style={{ fontSize: 12, color: 'var(--hc-ink-muted)' }}>Comes from your Google account.</span>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="hc-lbl" style={{ marginBottom: 6 }}>Sign-in methods</div>
            <div className="hc-row">
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 600 }}><GoogleIcon size={20} />Google</span>
              {user.provider === 'google' && <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--hc-success)', background: '#E8F5EC', borderRadius: 999, padding: '5px 10px' }}>Connected</span>}
            </div>
            <div className="hc-row">
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 600 }}><GitHubIcon size={20} />GitHub</span>
              {/* AUTH-1: GitHub comes after the beta; Google is the only sign-in for now. */}
              <span className="hc-soon" title="GitHub sign-in is coming soon">COMING SOON</span>
            </div>
          </div>
        </section>

        <BetaLimits />

        <section id="st-prefs" className="hc-card hc-sec" aria-labelledby="h-prefs">
          <h2 id="h-prefs" className="hc-disp" style={{ ...h2, marginBottom: 6 }}>Preferences</h2>
          <div className="hc-row">
            <div><div style={{ fontSize: 14.5, fontWeight: 600 }}>Default template</div><div style={{ fontSize: 13, color: 'var(--hc-ink-muted)' }}>Used for new resumes.</div></div>
            <span style={{ fontSize: 14, fontWeight: 600, border: '1px solid var(--hc-hairline)', borderRadius: 999, padding: '0 14px', minHeight: 40, display: 'inline-flex', alignItems: 'center' }}>{templateName('jake')}</span>
          </div>
          <Switch id="tg-save" label="Ask before saving resume edits to my profile" help="Shows the “Also save to my profile” checkbox on Preview." on={settings.ask_before_save} onFlip={() => setSettings({ ask_before_save: !settings.ask_before_save })} />
          <Switch id="tg-email" label="Product update emails" help="At most one a month. Never shared." on={settings.product_emails} onFlip={() => setSettings({ product_emails: !settings.product_emails })} />
          <ErrorBanner error={prefError} />
        </section>

        <section id="st-data" className="hc-card hc-sec" aria-labelledby="h-data">
          <h2 id="h-data" className="hc-disp" style={{ ...h2, marginBottom: 6 }}>Data &amp; privacy</h2>
          <div className="hc-row">
            <div><div style={{ fontSize: 14.5, fontWeight: 600 }}>Download your data</div><div style={{ fontSize: 13, color: 'var(--hc-ink-muted)' }}>Your profile, all resumes, your applications and settings, as JSON.</div></div>
            <button type="button" className="hc-btn-s" onClick={downloadData}>Download</button>
          </div>
          <ErrorBanner error={exportError} />
          {exportNote && <div role="status" style={{ marginTop: 6, fontSize: 13, color: 'var(--hc-ink-muted)' }}>{exportNote}</div>}
          <div className="hc-row">
            <div><div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--hc-warm)' }}>Delete account</div><div style={{ fontSize: 13, color: 'var(--hc-ink-muted)' }}>Removes your profile, resumes and sign-in. This can’t be undone.</div></div>
            <button type="button" className="hc-btn-s" onClick={() => setConfirmDelete(true)} style={{ color: 'var(--hc-warm)', borderColor: '#F3C7B3' }}>Delete account</button>
          </div>
        </section>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '4px 2px' }}>
          <span style={{ fontSize: 13, color: 'var(--hc-ink-muted)' }}>Changes save automatically.</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {signOut.error && <span role="alert" style={{ fontSize: 13, color: 'var(--hc-warm)' }}>{signOut.error}</span>}
            <button type="button" className="hc-btn-s" onClick={signOut.signOut} disabled={signOut.busy}><LogOut size={16} aria-hidden="true" />{signOut.busy ? 'Signing out…' : 'Sign out'}</button>
          </span>
        </div>
      </div>

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(14,18,38,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delacc-title" className="hc-rise" style={{ width: '100%', maxWidth: 420, background: '#FFFFFF', borderRadius: 20, padding: 24, boxShadow: '0 30px 80px rgba(14,18,38,.3)' }}>
            <h2 id="delacc-title" className="hc-disp" style={{ margin: 0, fontSize: 21, fontWeight: 800 }}>Delete your account?</h2>
            <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.55, color: 'var(--hc-ink-muted)' }}>Your profile, all resumes and your sign-in will be removed. This can’t be undone.</p>
            {deleteError && <p role="alert" style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--hc-warm)' }}>{deleteError}</p>}
            <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="hc-btn-s" onClick={() => { setConfirmDelete(false); setDeleteError(null); }} disabled={deleting} autoFocus>Cancel</button>
              <button type="button" onClick={removeAccount} disabled={deleting} aria-busy={deleting} style={{ minHeight: 44, padding: '0 18px', borderRadius: 999, border: 0, background: 'var(--hc-warm)', color: '#FFFFFF', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: deleting ? 'progress' : 'pointer', opacity: deleting ? 0.7 : 1 }}>{deleting ? 'Deleting…' : 'Delete account'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
