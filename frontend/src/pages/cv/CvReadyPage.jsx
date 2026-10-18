import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AlertCircle, Check, ChevronDown, Download, Maximize2, PenLine, X } from 'lucide-react';
import CvDoc from '@/components/CvDoc';
import { docChanges, docToCv, docToProfile } from '@/data/cvModel';
import { templateName } from '@/data/templates';
import { PdfBuildError, buildPdf } from '@/services/mockApi';
import { resumeTitle, useAppStore } from '@/state/appStore';
import AnalysisSection from './AnalysisSection';

// "Your CV is ready" (design: Preview.dc.html): download, what changed, full screen, analysis.

function WhiteSpinner() {
  return (
    <svg className="hc-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,.35)" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function CvReadyPage() {
  const { id } = useParams();
  const { resumes, settings, saveProfile } = useAppStore();
  const resume = resumes.find((r) => r.id === id);

  const [dl, setDl] = useState('idle'); // idle | busy | done | fail
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [changesOpen, setChangesOpen] = useState(true);
  const [full, setFull] = useState(false);

  if (!resume) return <Navigate to="/resumes" replace />;

  const cv = docToCv(resume.doc);
  const changes = docChanges(resume.doc);
  const added = resume.addedSkills ?? [];
  const meta = [resumeTitle(resume), templateName(resume.template)].join(' · ');

  // SAVE-1: build the PDF and save the application record. With "Ask before saving" off in Settings,
  // edits always go to the profile.
  async function download() {
    setDl('busy');
    try {
      await buildPdf({ resumeId: resume.id });
      if (!settings.askSave || saveToProfile) saveProfile(docToProfile(resume.doc));
      setDl('done');
    } catch (e) {
      if (!(e instanceof PdfBuildError)) throw e;
      setDl('fail');
    }
  }

  const summary = [changes.length && plural(changes.length, 'bullet'), added.length && plural(added.length, 'skill')].filter(Boolean).join(' · ');

  return (
    <>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 80px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div className="hc-lbl">{meta}</div>
            <h1 className="hc-disp" style={{ margin: '6px 0 0', fontSize: 'clamp(28px,3.2vw,40px)', lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.035em' }}>
              Your CV is <span className="hc-serif" style={{ color: 'var(--hc-brand)', fontSize: '1.1em' }}>ready.</span>
            </h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
              <Link className="hc-btn-s" to={`/new/details?resume=${resume.id}&step=experience`} style={{ minHeight: 46, padding: '0 18px', fontSize: 14.5 }}><PenLine size={16} aria-hidden="true" />Edit</Link>
              {(dl === 'idle' || dl === 'fail') && <button type="button" className="hc-btn-p" onClick={download}><Download size={16} aria-hidden="true" />Download PDF</button>}
              {dl === 'busy' && <span role="status" className="hc-btn-p" style={{ background: 'var(--hc-brand-hover)', cursor: 'progress' }}><WhiteSpinner />Building your PDF…</span>}
              {dl === 'done' && <button type="button" className="hc-btn-p" onClick={download} style={{ background: 'var(--hc-success)', boxShadow: 'none' }}><Check size={16} strokeWidth={2.6} aria-hidden="true" />Downloaded</button>}
            </div>
            {settings.askSave && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer', minHeight: 32 }}>
                <input type="checkbox" checked={saveToProfile} onChange={(e) => setSaveToProfile(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--hc-brand)', margin: 0 }} />
                Also save these changes to my profile
              </label>
            )}
          </div>
        </div>

        {dl === 'fail' && (
          <div role="alert" className="hc-rise hc-err" style={{ marginTop: 14, borderRadius: 14, padding: '12px 14px', fontSize: 14 }}>
            <AlertCircle size={16} color="var(--hc-warm)" aria-hidden="true" />
            <span style={{ flex: '1 1 240px' }}><strong>Couldn’t build the PDF.</strong> Your edits are saved.</span>
            <button type="button" onClick={download} style={{ minHeight: 40, padding: '0 14px', borderRadius: 999, border: '1px solid var(--hc-warm)', background: '#FFFFFF', color: '#9A3412', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Try again</button>
          </div>
        )}

        <div style={{ marginTop: 20, background: '#EEF0F5', borderRadius: 20, padding: 'clamp(14px,3vw,32px)', position: 'relative' }}>
          <button type="button" className="hc-btn-s" onClick={() => setFull(true)} style={{ position: 'absolute', top: 14, right: 14, minHeight: 40, fontSize: 13.5, zIndex: 2 }}>
            <Maximize2 size={14} aria-hidden="true" />Full screen
          </button>
          <div style={{ maxWidth: 794, margin: '0 auto', boxShadow: '0 2px 4px rgba(22,26,43,.06), 0 18px 44px rgba(22,26,43,.14)', borderRadius: 3, overflow: 'hidden', background: '#FFFFFF' }}>
            <CvDoc cv={cv} template={resume.template} />
          </div>
        </div>

        {(changes.length > 0 || added.length > 0) && (
          <section className="hc-card" style={{ marginTop: 20 }}>
            <button type="button" onClick={() => setChangesOpen((o) => !o)} aria-expanded={changesOpen} style={{ width: '100%', minHeight: 60, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', border: 0, background: 'transparent', fontFamily: 'inherit', color: 'var(--hc-ink)', cursor: 'pointer', textAlign: 'left' }}>
              <span className="hc-disp" style={{ fontSize: 18, fontWeight: 700, flex: 1 }}>What changed</span>
              <span className="hc-chip" style={{ background: 'var(--hc-brand-tint)', color: 'var(--hc-brand-hover)' }}>{summary}</span>
              <ChevronDown size={18} aria-hidden="true" style={{ flex: 'none', transition: 'transform .2s ease', transform: `rotate(${changesOpen ? 180 : 0}deg)` }} />
            </button>
            {changesOpen && (
              <div className="hc-rise" style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {changes.map((c) => (
                  <div key={c.id} style={{ border: '1px solid var(--hc-hairline)', borderRadius: 14, padding: 14 }}>
                    <div className="hc-lbl" style={{ marginBottom: 8 }}>{c.where}</div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--hc-ink-muted)', textDecoration: 'line-through', textDecorationColor: 'var(--hc-ink-faint)' }}>{c.before}</div>
                    <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.55, background: '#EEF1FD', borderRadius: 10, padding: '8px 10px' }}>{c.after}</div>
                  </div>
                ))}
                {added.length > 0 && (
                  <div style={{ border: '1px solid var(--hc-hairline)', borderRadius: 14, padding: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                    <span className="hc-lbl">Skills you added</span>
                    {added.map((s) => <span key={s} className="hc-chip" style={{ background: '#E8F5EC', color: 'var(--hc-success)' }}>+ {s}</span>)}
                    <span style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>Added by you from the JD suggestions.</span>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {resume.jd && <AnalysisSection />}
      </main>

      {full && (
        <div
          role="dialog" aria-modal="true" aria-label="CV full screen"
          onKeyDown={(e) => { if (e.key === 'Escape') setFull(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(14,18,38,.6)', overflow: 'auto', padding: '24px 16px' }}
        >
          <div style={{ maxWidth: 880, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
              <button type="button" className="hc-btn-s" onClick={() => setFull(false)} aria-label="Close full screen" autoFocus><X size={16} aria-hidden="true" />Close</button>
            </div>
            <div style={{ boxShadow: '0 30px 80px rgba(14,18,38,.35)', borderRadius: 3, overflow: 'hidden', background: '#FFFFFF' }}>
              <CvDoc cv={cv} template={resume.template} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
