import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Download, MoreHorizontal, Plus, Trash2, User } from 'lucide-react';
import PageTitle from '@/components/PageTitle';
import { CvThumb } from '@/components/CvDoc';
import { docToCv, profileSections } from '@/data/cvModel';
import { resumeTitle, useAppStore } from '@/state/appStore';

// "Your resumes" dashboard (design: Dashboard.dc.html, DashboardEmpty.dc.html).

function EmptyArt() {
  const ink = { fill: '#FFFFFF', stroke: '#161A2B' };
  return (
    <svg width="150" height="110" viewBox="0 0 150 110" aria-hidden="true">
      <rect x="76" y="10" width="54" height="72" rx="5" style={{ ...ink, strokeWidth: 2 }} />
      <path d="M86 26 H120 M86 38 H116 M86 50 H120 M86 62 H108" style={{ fill: 'none', stroke: '#161A2B', strokeWidth: 1.6, strokeLinecap: 'round', strokeDasharray: '2 4' }} />
      <g transform="translate(46 64)">
        <path style={{ ...ink, strokeWidth: 2.2, strokeLinejoin: 'round' }} d="M-36 8 C-46 6 -46 -12 -34 -14 C-36 -28 -18 -34 -10 -26 C-6 -36 10 -36 14 -26 C24 -34 40 -26 36 -12 C48 -8 46 10 36 12 C38 26 20 32 12 24 C6 32 -10 32 -14 24 C-26 32 -42 22 -36 8 Z" />
        <path d="M-22 -18 C-14 -14 -24 -6 -16 -2 M22 -18 C14 -14 24 -6 16 -2" style={{ fill: 'none', stroke: '#161A2B', strokeWidth: 1.5, strokeLinecap: 'round', strokeDasharray: '1.5 4' }} />
        <circle cx="-11" cy="6" r="6.5" style={{ ...ink, strokeWidth: 1.6 }} /><circle cx="11" cy="6" r="6.5" style={{ ...ink, strokeWidth: 1.6 }} />
        <circle cx="-8" cy="5" r="3" style={{ fill: '#161A2B' }} /><circle cx="14" cy="5" r="3" style={{ fill: '#161A2B' }} />
        <path d="M-5 19 Q0 22 5 19" style={{ fill: 'none', stroke: '#161A2B', strokeWidth: 2, strokeLinecap: 'round' }} />
      </g>
    </svg>
  );
}

function NewResumeButton({ style }) {
  const { resetDraft } = useAppStore();
  return (
    <Link className="hc-btn-p" to="/new/template" onClick={resetDraft} style={style}>
      <Plus size={16} strokeWidth={2.4} aria-hidden="true" />New resume
    </Link>
  );
}

function ResumeCard({ resume, menuOpen, onToggleMenu, onDuplicate, onDelete }) {
  const navigate = useNavigate();
  const title = resumeTitle(resume);
  const ready = resume.status === 'ready';
  const jd = resume.mode === 'jd';

  return (
    <article className="hc-card hc-rcard" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <CvThumb cv={docToCv(resume.doc)} />
      <div style={{ padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <h2 className="hc-disp" style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>{title}</h2>
          <button
            type="button" onClick={onToggleMenu} aria-label={`More actions for ${title}`} aria-expanded={menuOpen} aria-haspopup="menu"
            style={{ flex: 'none', width: 36, height: 36, margin: '-4px -6px 0 0', borderRadius: 10, border: 0, background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--hc-ink-muted)' }}
          >
            <MoreHorizontal size={18} aria-hidden="true" />
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span className="hc-chip" style={jd ? { background: 'var(--hc-brand-tint)', color: 'var(--hc-brand-hover)' } : { background: '#F3F4F8', color: 'var(--hc-ink)' }}>{jd ? 'Tailored to JD' : 'From scratch'}</span>
          <span className="hc-chip" style={ready ? { background: '#E8F5EC', color: 'var(--hc-success)' } : { background: '#FFF4EE', color: '#B45309' }}>{ready ? 'Ready' : `Draft · step ${resume.step} of 5`}</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>{resume.updated}</div>
        <div style={{ marginTop: 'auto', paddingTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Link className="hc-btn-p" to={ready ? `/cv/${resume.id}` : `/new/details?resume=${resume.id}&step=experience`} style={{ minHeight: 44, padding: '0 18px', fontSize: 14, flex: '1 1 auto' }}>
            {ready ? 'Open' : 'Continue'}
          </Link>
          {ready && (
            // The PDF is built on the ready screen (SAVE-1); this shortcut opens it there.
            <button type="button" className="hc-btn-s" aria-label={`Download PDF of ${title}`} onClick={() => navigate(`/cv/${resume.id}`)} style={{ padding: '0 14px' }}>
              <Download size={16} aria-hidden="true" />PDF
            </button>
          )}
        </div>
      </div>
      {menuOpen && (
        <div role="menu" style={{ position: 'absolute', zIndex: 20, top: 248, right: 12, width: 180, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 14, boxShadow: '0 16px 40px rgba(22,26,43,.14)', overflow: 'hidden', padding: '4px 0' }}>
          <button type="button" role="menuitem" className="hc-mi" onClick={onDuplicate}><Copy size={16} aria-hidden="true" />Duplicate</button>
          <button type="button" role="menuitem" className="hc-mi" onClick={onDelete} style={{ color: 'var(--hc-warm)' }}><Trash2 size={16} aria-hidden="true" />Delete</button>
        </div>
      )}
    </article>
  );
}

export default function ResumesPage() {
  const { resumes, profile, duplicateResume, deleteResume, resetDraft } = useAppStore();
  const [menu, setMenu] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const done = profileSections(profile).filter((s) => s.complete).length;
  const cta = done === 5 ? 'View profile' : done === 0 ? 'Set up profile' : 'Complete profile';
  const target = resumes.find((r) => r.id === confirmId);

  return (
    <>
      <main className="hc-wrap" style={{ paddingTop: 28 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <PageTitle before="Your" accent="resumes" size="clamp(30px,3.4vw,42px)" />
            <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--hc-ink-muted)' }}>One resume per job. Each one built from your profile.</p>
          </div>
          <NewResumeButton />
        </div>

        <div className="hc-card" style={{ marginTop: 20, padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 18px', borderRadius: 16 }}>
          <span aria-hidden="true" style={{ flex: 'none', width: 36, height: 36, borderRadius: 10, background: 'var(--hc-brand-tint)', color: 'var(--hc-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={18} aria-hidden="true" />
          </span>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Your profile · {done} of 5 sections complete</div>
            <div role="progressbar" aria-label="Profile completeness" aria-valuemin={0} aria-valuemax={5} aria-valuenow={done} style={{ marginTop: 8, height: 6, borderRadius: 99, background: '#EEF0F5', overflow: 'hidden', maxWidth: 360 }}>
              <div style={{ height: '100%', borderRadius: 99, background: 'var(--hc-brand)', width: `${done * 20}%`, transition: 'width .3s ease' }} />
            </div>
          </div>
          <Link to="/profile" className="hc-btn-s">{cta}</Link>
        </div>

        {resumes.length === 0 ? (
          <div className="hc-card hc-rise" style={{ marginTop: 20, padding: 'clamp(32px,6vw,64px) 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
            <EmptyArt />
            <h2 className="hc-disp" style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>No resumes yet.</h2>
            <p style={{ margin: 0, maxWidth: 380, fontSize: 16, lineHeight: 1.55, color: 'var(--hc-ink-muted)' }}>Make your first one in a few minutes. Paste a job description, check your details, download.</p>
            <NewResumeButton style={{ marginTop: 6 }} />
          </div>
        ) : (
          <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
            {resumes.map((r) => (
              <ResumeCard
                key={r.id} resume={r} menuOpen={menu === r.id}
                onToggleMenu={() => setMenu((m) => (m === r.id ? null : r.id))}
                onDuplicate={() => { duplicateResume(r.id); setMenu(null); }}
                onDelete={() => { setConfirmId(r.id); setMenu(null); }}
              />
            ))}
            <Link to="/new/template" onClick={resetDraft} style={{ minHeight: 300, border: '1.5px dashed #C9D3F7', borderRadius: 20, background: '#F7F8FD', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none', color: 'var(--hc-brand)', fontWeight: 700, fontSize: 15 }}>
              <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 14, background: '#FFFFFF', border: '1px solid #C9D3F7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={20} strokeWidth={2.4} />
              </span>
              New resume
            </Link>
          </div>
        )}
      </main>

      {menu !== null && (
        <button type="button" aria-label="Close menu" onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 10, background: 'transparent', border: 0, cursor: 'default' }} />
      )}

      {target && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(14,18,38,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="del-title" className="hc-rise" style={{ width: '100%', maxWidth: 420, background: '#FFFFFF', borderRadius: 20, padding: 24, boxShadow: '0 30px 80px rgba(14,18,38,.3)' }}>
            <h2 id="del-title" className="hc-disp" style={{ margin: 0, fontSize: 21, fontWeight: 800 }}>Delete this resume?</h2>
            <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.55, color: 'var(--hc-ink-muted)' }}>“{resumeTitle(target)}” will be removed. Your profile stays as it is. This can’t be undone.</p>
            <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="hc-btn-s" onClick={() => setConfirmId(null)} autoFocus>Cancel</button>
              <button type="button" onClick={() => { deleteResume(target.id); setConfirmId(null); }} style={{ minHeight: 44, padding: '0 18px', borderRadius: 999, border: 0, background: 'var(--hc-warm)', color: '#FFFFFF', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Delete resume</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
