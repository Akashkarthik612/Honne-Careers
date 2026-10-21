import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDown, Clock, Columns3, Download, FileText, NotebookPen, Plus, Search, Table2, Trash2, X } from 'lucide-react';
import PageTitle from '@/components/PageTitle';
import CvDoc from '@/components/CvDoc';
import { ErrorBanner, PageLoading } from '@/components/Status';
import {
  REFERRALS, STATUSES, STATUS_STYLE, badgeColors, filterApplications, groupByStatus, longDate, manualToRequest, patchRequest,
  referralLabel, referralStyle, shortDate, statusCounts, statusLabel, summaryOf, toApplicationDetail, toApplicationList, todayYmd,
} from '@/data/applications';
import useResource from '@/hooks/useResource';
import { addApplication, applicationPdf, deleteApplication, getApplication, listApplications, patchApplication } from '@/services/api';
import { useAppStore } from '@/state/appStore';

// "Your applications" Database (design: Database.dc.html, DatabasePeek.dc.html, DatabaseEmpty.dc.html; Day 2).
// Rows come from GET /applications: one per job, saved when a tailored CV is downloaded (SAVE-1) or added by
// hand (IQ-3). Each row is deleted `retention_days` after it was sent (the number comes from the backend).
// The list never carries JD, CV or notes text; the side panel loads them for one row (GET /applications/{id}).
// Edits are PATCHes with the row's version: a stale tab gets 409 and is told to reload, never overwrites.

function Badge({ company, size = 28 }) {
  const big = size > 40;
  return (
    <span
      aria-hidden="true"
      className={big ? 'hc-disp' : undefined}
      style={{
        flex: 'none', width: size, height: size, borderRadius: big ? 14 : 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: big ? 24 : 13, fontWeight: 800, ...badgeColors(company || '?'),
      }}
    >
      {(company || '?').charAt(0)}
    </span>
  );
}

function StatusSelect({ id, value, onChange, label, disabled }) {
  return (
    <>
      <label htmlFor={id} className="hc-sr-only">{label}</label>
      <select id={id} className="hc-sel" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={STATUS_STYLE[value]}>
        {STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </>
  );
}

function ReferralSelect({ id, value, onChange, disabled }) {
  return (
    <>
      <label htmlFor={id} className="hc-sr-only">Referral</label>
      <select id={id} className="hc-sel" value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} style={{ background: '#F3F4F8', ...referralStyle(value) }}>
        <option value="">—</option>
        {REFERRALS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </>
  );
}

function Retention({ days }) {
  return (
    <div className="hc-card" style={{ marginTop: 18, padding: '14px 18px', borderRadius: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px 20px' }}>
      <span className="hc-disp" style={{ fontSize: 18, fontWeight: 800 }}>Saved for {days} days</span>
      <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13.5, lineHeight: 1.5, color: 'var(--hc-ink-muted)', flex: '1 1 320px' }}>
        <Clock size={16} aria-hidden="true" style={{ flex: 'none', marginTop: 2 }} />
        Each application is deleted {days} days after you send it — see “Deletes on”. Download the PDF of anything you want to keep.
      </span>
    </div>
  );
}

function EmptyState({ onAdd }) {
  const { resetDraft } = useAppStore();
  return (
    <div className="hc-card" style={{ marginTop: 16, padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--hc-brand-tint)', color: 'var(--hc-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Table2 size={24} />
      </span>
      <h2 className="hc-disp" style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800 }}>Nothing here yet.</h2>
      <p style={{ margin: 0, maxWidth: 420, fontSize: 15, lineHeight: 1.55, color: 'var(--hc-ink-muted)' }}>Download your first tailored CV and it lands here with its JD — automatically.</p>
      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
        <Link className="hc-btn-p" to="/new/template" onClick={resetDraft}>Make a resume</Link>
        <button type="button" className="hc-btn-s" onClick={onAdd}><Plus size={15} aria-hidden="true" />Add one by hand</button>
      </div>
    </div>
  );
}

function TableView({ rows, onOpen, onStatus, busyId }) {
  const heads = ['Company', 'Role', 'Sent', 'Status', 'Referral', 'CV sent', 'JD', 'Notes', 'Deletes on'];
  return (
    <div className="hc-card" style={{ marginTop: 12, overflow: 'auto', borderRadius: 16, maxHeight: 'calc(100vh - 140px)' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 1080 }}>
        <thead><tr>{heads.map((h) => <th key={h} className="hc-th" scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hc-tr">
              <td className="hc-td">
                <button type="button" className="hc-open" onClick={() => onOpen(r.id, r.hasJd ? 'jd' : 'notes')} aria-label={`Open ${r.company}`}>
                  <Badge company={r.company} />
                  <span>{r.company || '—'}</span>
                  <span className="hc-openhint" aria-hidden="true">OPEN</span>
                </button>
              </td>
              <td className="hc-td">{r.role || '—'}</td>
              <td className="hc-td hc-mono" style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>{shortDate(r.sentAt)}</td>
              <td className="hc-td"><StatusSelect id={`st-${r.id}`} value={r.status} disabled={busyId === r.id} onChange={(s) => onStatus(r, s)} label={`Status for ${r.company}`} /></td>
              <td className="hc-td" style={referralStyle(r.referral)}>{referralLabel(r.referral)}</td>
              <td className="hc-td">
                {r.hasPdf ? (
                  <button type="button" className="hc-file" onClick={() => onOpen(r.id, 'cv')} style={{ cursor: 'pointer' }}>
                    <FileText size={13} color="var(--hc-warm)" aria-hidden="true" />CV sent
                  </button>
                ) : <span style={{ color: 'var(--hc-ink-muted)' }}>—</span>}
              </td>
              <td className="hc-td">
                {r.hasJd
                  ? <button type="button" className="hc-link-btn" onClick={() => onOpen(r.id, 'jd')} style={{ fontSize: 13.5, fontWeight: 600, minHeight: 36 }}>View JD</button>
                  : <span style={{ color: 'var(--hc-ink-muted)' }}>—</span>}
              </td>
              <td className="hc-td">
                {r.hasNotes
                  ? <button type="button" className="hc-link-btn" onClick={() => onOpen(r.id, 'notes')} style={{ fontSize: 13.5, fontWeight: 600, minHeight: 36 }}><NotebookPen size={13} aria-hidden="true" /> Notes</button>
                  : <span style={{ color: 'var(--hc-ink-muted)' }}>—</span>}
              </td>
              <td className="hc-td hc-mono" style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>{shortDate(r.deletesOn)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div style={{ padding: 28, textAlign: 'center', fontSize: 14, color: 'var(--hc-ink-muted)' }}>No applications match. Try another search or status.</div>}
    </div>
  );
}

function BoardView({ rows, onOpen }) {
  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
      {groupByStatus(rows).map((col) => (
        <section key={col.status} aria-label={col.label} style={{ flex: '0 0 260px', background: '#EEF0F5', borderRadius: 16, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, borderRadius: 999, padding: '4px 10px', ...STATUS_STYLE[col.status] }}>{col.label}</span>
            <span className="hc-mono" style={{ fontSize: 12, color: 'var(--hc-ink-muted)' }}>{col.rows.length}</span>
          </div>
          {col.rows.map((r) => (
            <button
              key={r.id} type="button" onClick={() => onOpen(r.id, r.hasJd ? 'jd' : 'notes')}
              style={{ textAlign: 'left', width: '100%', background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 12, padding: 12, fontFamily: 'inherit', color: 'var(--hc-ink)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Badge company={r.company} /><span style={{ fontSize: 14, fontWeight: 700 }}>{r.company || '—'}</span></span>
              <span style={{ fontSize: 13, color: 'var(--hc-ink-muted)' }}>{r.role}</span>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <span className="hc-mono" style={{ fontSize: 11.5, color: 'var(--hc-ink-muted)' }}>{shortDate(r.sentAt)}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--hc-ink-muted)' }}>Deletes {shortDate(r.deletesOn)}</span>
              </span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

function ConfirmDelete({ row, busy, onCancel, onConfirm }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(14,18,38,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="app-del-title" className="hc-rise" style={{ width: '100%', maxWidth: 420, background: '#FFFFFF', borderRadius: 20, padding: 24, boxShadow: '0 30px 80px rgba(14,18,38,.3)' }}>
        <h2 id="app-del-title" className="hc-disp" style={{ margin: 0, fontSize: 21, fontWeight: 800 }}>Delete this application?</h2>
        <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.55, color: 'var(--hc-ink-muted)' }}>{row.company || 'This application'} will be removed with its JD, the CV you sent, its PDF and your notes. This can’t be undone.</p>
        <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="hc-btn-s" onClick={onCancel} autoFocus>Cancel</button>
          <button type="button" disabled={busy} onClick={onConfirm} style={{ minHeight: 44, padding: '0 18px', borderRadius: 999, border: 0, background: 'var(--hc-warm)', color: '#FFFFFF', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: busy ? 'progress' : 'pointer' }}>Delete application</button>
        </div>
      </div>
    </div>
  );
}

// Side panel. Loads the full row (JD text, CV sent, notes, history) for this one application.
function Peek({ id, tab, onTab, onClose, onSaved, onDeleted }) {
  const panel = useRef(null);
  const load = useCallback(async () => toApplicationDetail(await getApplication(id)), [id]);
  const res = useResource(load);
  const [notes, setNotes] = useState(null); // null = untouched, show the saved notes
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { panel.current?.focus(); }, []);

  const row = res.data;
  async function save(change) {
    setBusy(true);
    setError(null);
    try {
      const updated = toApplicationDetail(await patchApplication(row.id, patchRequest(row, change)));
      res.setData(updated);
      onSaved(updated);
      return true;
    } catch (e) {
      setError(e);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveNotes() {
    if (notes === null || notes === row.notes) return;
    if (await save({ notes })) setNotes(null);
  }
  function reload() { setError(null); setNotes(null); res.reload(); }
  async function openPdf() {
    setError(null);
    try {
      const { url } = await applicationPdf(row.id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setError(e);
    }
  }
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteApplication(row.id);
      onDeleted(row.id);
    } catch (e) {
      setError(e);
      setConfirm(false);
      setBusy(false);
    }
  }

  const tabs = [['jd', 'Job description'], ['cv', 'CV sent'], ['notes', 'Notes']];
  const stale = error?.status === 409;
  return (
    <>
      <button type="button" aria-label="Close" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'rgba(14,18,38,.28)', border: 0, cursor: 'default' }} />
      <aside
        ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Application" className="hc-peek"
        onKeyDown={(e) => { if (e.key === 'Escape' && !confirm) onClose(); }}
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 46, width: 'min(760px,100%)', background: '#FFFFFF', borderLeft: '1px solid var(--hc-hairline)', boxShadow: '-20px 0 60px rgba(14,18,38,.18)', display: 'flex', flexDirection: 'column', outline: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--hc-hairline)' }}>
          <span className="hc-lbl">{row ? `Application · ${row.source === 'manual' ? 'added by hand' : 'saved on download'} ${shortDate(row.sentAt)}` : 'Application'}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {row && (
              <button type="button" className="hc-btn-sm" onClick={() => setConfirm(true)} aria-label="Delete this application" style={{ border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-warm)', minHeight: 40 }}>
                <Trash2 size={15} aria-hidden="true" />Delete
              </button>
            )}
            <button type="button" className="hc-btn-sm" onClick={onClose} aria-label="Close" style={{ border: '1px solid var(--hc-hairline)', background: '#FFFFFF', width: 40, minHeight: 40, padding: 0 }}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '24px clamp(16px,4vw,40px) 40px' }}>
          {res.loading && <PageLoading label="Opening…" />}
          {res.error && <ErrorBanner error={res.error} action={{ label: 'Retry', onClick: res.reload }} />}
          {row && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Badge company={row.company} size={52} />
                <div>
                  <h2 className="hc-disp" style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.025em' }}>{row.company || '—'}</h2>
                  <div style={{ fontSize: 15, color: 'var(--hc-ink-muted)' }}>{row.role}</div>
                </div>
              </div>

              <ErrorBanner
                error={stale ? 'This application changed in another tab or by a new download. Reload to see the latest.' : error}
                action={stale ? { label: 'Reload', onClick: reload } : undefined}
              />

              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div className="hc-prop"><span style={{ color: 'var(--hc-ink-muted)' }}>Status</span><span><StatusSelect id="peek-status" value={row.status} disabled={busy} onChange={(status) => save({ status })} label="Status" /></span></div>
                <div className="hc-prop"><span style={{ color: 'var(--hc-ink-muted)' }}>Referral</span><span><ReferralSelect id="peek-referral" value={row.referral} disabled={busy} onChange={(referral) => save({ referral })} /></span></div>
                <div className="hc-prop"><span style={{ color: 'var(--hc-ink-muted)' }}>Sent</span><span className="hc-mono" style={{ fontSize: 13 }}>{longDate(row.sentAt)}</span></div>
                <div className="hc-prop"><span style={{ color: 'var(--hc-ink-muted)' }}>CV sent</span><span style={{ fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>{row.hasPdf ? 'Jake’s Resume · tailored to this JD' : 'Added by hand — no CV saved'}</span></div>
                <div className="hc-prop"><span style={{ color: 'var(--hc-ink-muted)' }}>Deletes on</span><span className="hc-mono" style={{ fontSize: 13 }}>{longDate(row.deletesOn)}</span></div>
                {row.events.length > 1 && (
                  <div className="hc-prop"><span style={{ color: 'var(--hc-ink-muted)' }}>History</span><span style={{ fontSize: 13, color: 'var(--hc-ink-muted)' }}>{row.events.map((e) => `${statusLabel(e.to)} ${shortDate(e.at)}`).join(' → ')}</span></div>
                )}
              </div>

              <div role="tablist" aria-label="Details" style={{ marginTop: 20, display: 'flex', gap: 6, borderBottom: '1px solid var(--hc-hairline)' }}>
                {tabs.map(([key, label]) => (
                  <button key={key} type="button" role="tab" className="hc-ptab" aria-selected={tab === key} onClick={() => onTab(key)}>{label}</button>
                ))}
              </div>

              {tab === 'jd' && (
                <div role="tabpanel" style={{ marginTop: 16, fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-line', background: 'var(--hc-ground)', border: '1px solid var(--hc-hairline)', borderRadius: 14, padding: '18px 20px', color: row.jdText ? 'var(--hc-ink)' : 'var(--hc-ink-muted)' }}>
                  {row.jdText || 'No job description saved for this application.'}
                </div>
              )}
              {tab === 'cv' && (
                <div role="tabpanel" style={{ marginTop: 16 }}>
                  {row.cv ? (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>The CV you downloaded on {longDate(row.sentAt)}.</span>
                        <button type="button" className="hc-btn-p" onClick={openPdf} style={{ minHeight: 40 }}>
                          <Download size={15} aria-hidden="true" />Download PDF
                        </button>
                      </div>
                      <div style={{ background: '#EEF0F5', borderRadius: 14, padding: 14 }}>
                        <div style={{ boxShadow: '0 12px 30px rgba(22,26,43,.10)', borderRadius: 3, overflow: 'hidden' }}><CvDoc cv={row.cv} /></div>
                      </div>
                    </>
                  ) : <p style={{ fontSize: 14, color: 'var(--hc-ink-muted)' }}>Added by hand — there’s no CV saved for this application.</p>}
                </div>
              )}
              {tab === 'notes' && (
                <div role="tabpanel" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label htmlFor="peek-notes" className="hc-flabel">Your notes</label>
                  <textarea
                    id="peek-notes" className="hc-ta" maxLength={5000} value={notes ?? row.notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes}
                    placeholder="Who you spoke to, referral contact, interview dates…" style={{ minHeight: 160, fontSize: 14.5, lineHeight: 1.6 }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--hc-ink-muted)' }}>{busy ? 'Saving…' : 'Saved when you click away.'}</span>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
      {confirm && row && <ConfirmDelete row={row} busy={busy} onCancel={() => setConfirm(false)} onConfirm={remove} />}
    </>
  );
}

const EMPTY_FORM = { company: '', role: '', sentAt: '', status: 'applied', referral: '', notes: '', jdText: '' };

// IQ-3: an application made outside Honne, with or without its JD.
function AddDialog({ onClose, onAdded }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, sentAt: todayYmd() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const ready = form.company.trim() && form.role.trim();

  async function submit(e) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      onAdded(toApplicationDetail(await addApplication(manualToRequest(form))));
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(14,18,38,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form role="dialog" aria-modal="true" aria-labelledby="add-title" onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} className="hc-rise" style={{ width: '100%', maxWidth: 560, maxHeight: 'calc(100vh - 32px)', overflow: 'auto', background: '#FFFFFF', borderRadius: 20, padding: 24, boxShadow: '0 30px 80px rgba(14,18,38,.3)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 id="add-title" className="hc-disp" style={{ margin: 0, fontSize: 21, fontWeight: 800 }}>Add an application</h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--hc-ink-muted)' }}>For jobs you applied to outside Honne. Downloads from Honne are added for you.</p>
        <div className="hc-g2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div className="hc-f"><label htmlFor="add-company" className="hc-flabel">Company</label><input id="add-company" className="hc-in" required maxLength={200} value={form.company} onChange={set('company')} autoFocus /></div>
          <div className="hc-f"><label htmlFor="add-role" className="hc-flabel">Role</label><input id="add-role" className="hc-in" required maxLength={200} value={form.role} onChange={set('role')} /></div>
          <div className="hc-f"><label htmlFor="add-date" className="hc-flabel">Date sent</label><input id="add-date" type="date" className="hc-in" max={todayYmd()} value={form.sentAt} onChange={set('sentAt')} /></div>
          <div className="hc-f">
            <label htmlFor="add-status" className="hc-flabel">Status</label>
            <select id="add-status" className="hc-in" value={form.status} onChange={set('status')}>{STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
          <div className="hc-f">
            <label htmlFor="add-referral" className="hc-flabel">Referral</label>
            <select id="add-referral" className="hc-in" value={form.referral} onChange={set('referral')}><option value="">—</option>{REFERRALS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
        </div>
        <div className="hc-f"><label htmlFor="add-jd" className="hc-flabel">Job description <span style={{ fontWeight: 400, color: 'var(--hc-ink-muted)' }}>(optional)</span></label><textarea id="add-jd" className="hc-ta" maxLength={20000} value={form.jdText} onChange={set('jdText')} style={{ minHeight: 100 }} /></div>
        <div className="hc-f"><label htmlFor="add-notes" className="hc-flabel">Notes <span style={{ fontWeight: 400, color: 'var(--hc-ink-muted)' }}>(optional)</span></label><textarea id="add-notes" className="hc-ta" maxLength={5000} value={form.notes} onChange={set('notes')} /></div>
        <ErrorBanner error={error} style={{ marginTop: 0 }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="hc-btn-s" onClick={onClose}>Cancel</button>
          <button type="submit" className="hc-btn-p" disabled={!ready || busy} style={{ opacity: ready ? 1 : 0.6 }}>{busy ? 'Adding…' : 'Add application'}</button>
        </div>
      </form>
    </div>
  );
}

export default function DatabasePage() {
  const { resetDraft } = useAppStore();
  const load = useCallback(async () => toApplicationList(await listApplications()), []);
  const res = useResource(load);
  const [view, setView] = useState('table');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [peek, setPeek] = useState(null); // { id, tab }
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [rowError, setRowError] = useState(null);

  const replaceRow = (detail) => res.setData((d) => ({ ...d, rows: d.rows.map((r) => (r.id === detail.id ? summaryOf(detail) : r)) }));

  async function changeStatus(row, status) {
    setBusyId(row.id);
    setRowError(null);
    try {
      replaceRow(toApplicationDetail(await patchApplication(row.id, patchRequest(row, { status }))));
    } catch (e) {
      setRowError(e);
    } finally {
      setBusyId(null);
    }
  }

  const header = (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <div className="hc-lbl">Database · saved from every download</div>
        <PageTitle before="Your" accent="applications" size="clamp(30px,3.4vw,42px)" style={{ marginTop: 6 }} />
        <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--hc-ink-muted)', maxWidth: 620 }}>Every time you download a tailored CV, we save it here with the JD and company — so you always know which CV went where.</p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button type="button" className="hc-btn-s" onClick={() => setAdding(true)}><Plus size={15} aria-hidden="true" />Add by hand</button>
        <Link className="hc-btn-p" to="/new/template" onClick={resetDraft}><Plus size={15} strokeWidth={2.4} aria-hidden="true" />New resume</Link>
      </div>
    </div>
  );
  const wrap = (children) => <main style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 20px 72px' }}>{header}{children}</main>;
  if (res.loading) return wrap(<PageLoading label="Loading your applications…" />);
  if (res.error) return wrap(<ErrorBanner error={res.error} action={{ label: 'Retry', onClick: res.reload }} />);

  const { rows, retentionDays } = res.data;
  const shown = filterApplications(rows, query, filter);
  const counts = statusCounts(rows);
  const stale = rowError?.status === 409;

  return wrap(
    <>
      <Retention days={retentionDays} />
      <ErrorBanner
        error={stale ? 'That application changed in another tab or by a new download. Reload to see the latest.' : rowError}
        action={stale ? { label: 'Reload', onClick: () => { setRowError(null); res.reload(); } } : undefined}
      />

      {rows.length === 0 ? <EmptyState onAdd={() => setAdding(true)} /> : (
        <>
          <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div role="tablist" aria-label="Views" style={{ display: 'flex', gap: 2, background: '#EEF0F5', borderRadius: 999, padding: 4 }}>
              <button type="button" role="tab" className="hc-vtab" aria-selected={view === 'table'} onClick={() => setView('table')}><Table2 size={15} aria-hidden="true" />Table</button>
              <button type="button" role="tab" className="hc-vtab" aria-selected={view === 'board'} onClick={() => setView('board')}><Columns3 size={15} aria-hidden="true" />Board</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <label htmlFor="db-q" className="hc-sr-only">Search applications</label>
              <div className="hc-focus-within" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, border: '1px solid var(--hc-hairline)', borderRadius: 999, background: '#FFFFFF', padding: '0 14px', minWidth: 220 }}>
                <Search size={15} color="var(--hc-ink-muted)" aria-hidden="true" />
                <input id="db-q" type="search" placeholder="Search company or role" value={query} onChange={(e) => setQuery(e.target.value)} style={{ border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 14, color: 'var(--hc-ink)', minHeight: 38, flex: 1, minWidth: 0 }} />
              </div>
              <span className="hc-btn-s" style={{ cursor: 'default', minHeight: 40, fontSize: 13.5, padding: '0 14px' }}><ArrowUpDown size={14} aria-hidden="true" />Newest first</span>
            </div>
          </div>
          <div role="group" aria-label="Filter by status" style={{ marginTop: 10, display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {[['all', 'All'], ...STATUSES].map(([k, l]) => (
              <button key={k} type="button" className="hc-fchip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l} <span style={{ opacity: 0.75 }}>{counts[k]}</span></button>
            ))}
          </div>

          {view === 'table'
            ? <TableView rows={shown} onOpen={(id, tab) => setPeek({ id, tab })} onStatus={changeStatus} busyId={busyId} />
            : <BoardView rows={shown} onOpen={(id, tab) => setPeek({ id, tab })} />}
        </>
      )}

      {peek && (
        <Peek
          key={peek.id} id={peek.id} tab={peek.tab} onTab={(tab) => setPeek({ ...peek, tab })} onClose={() => setPeek(null)}
          onSaved={replaceRow}
          onDeleted={(id) => { res.setData((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== id) })); setPeek(null); }}
        />
      )}
      {adding && (
        <AddDialog
          onClose={() => setAdding(false)}
          onAdded={(detail) => {
            res.setData((d) => ({ ...d, rows: [summaryOf(detail), ...d.rows] }));
            setAdding(false);
            setPeek({ id: detail.id, tab: detail.hasJd ? 'jd' : 'notes' });
          }}
        />
      )}
    </>,
  );
}

