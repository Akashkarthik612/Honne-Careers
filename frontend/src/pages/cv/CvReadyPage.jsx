import { useCallback, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Check, ChevronDown, Database, Download, ExternalLink, Maximize2, PenLine, Plus, X } from 'lucide-react';
import CvDoc, { BulletText } from '@/components/CvDoc';
import { ErrorBanner, PageLoading } from '@/components/Status';
import { shortDate } from '@/data/applications';
import { SKILL_API_CATEGORY, bulletToDoc, openSuggestions, sectionPatch, toResume } from '@/data/cvAdapter';
import { SKILL_GROUPS, docChanges, docToCv } from '@/data/cvModel';
import { templateName } from '@/data/templates';
import useResource from '@/hooks/useResource';
import { buildPdf, confirmSkill, getProfile, getResume, getSettings, patchResume, saveResumeToProfile, settleBullet, startTailor } from '@/services/api';
import { errorText } from '@/services/apiClient';
import { clearPending, isRetryable, markPending, saveWithRetry } from '@/services/applicationSaver';
import AnalysisSection from './AnalysisSection';

// "Your CV is ready" (design: Preview.dc.html): download, what changed, full screen, analysis.
// Download = POST /resumes/{id}/pdf (LaTeX, reused when the content is unchanged) → a short-lived signed
// URL. "Also save to my profile" = POST save-to-profile, which keeps the user's facts and never the AI
// wording (TRUTH-1). Proposed AI bullets can be kept or reverted here (B6).
// After the PDF opens, the download is saved to the Database (SAVE-1: POST /resumes/{id}/application) with a
// bounded retry; if it still fails it is kept as pending and retried on the next visit (applicationSaver.js).
// V4.1: skills the tailor added from the user's own experience can be removed here; JD skills the CV doesn't
// show are only suggestions until the user says "I have this" (POST skills/confirm, this CV only), and
// non-skill gaps (degree, years, language) are listed, never confirmable.

const GAP_LABEL = { qualification: 'Qualification', experience: 'Experience', language: 'Language' };

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
  const load = useCallback(async () => {
    const [resume, settings] = await Promise.all([getResume(id), getSettings()]);
    return { resume: toResume(resume), settings };
  }, [id]);
  const res = useResource(load);

  const wrap = (children) => <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 80px' }}>{children}</main>;
  if (res.loading) return wrap(<PageLoading label="Loading your CV…" />);
  if (res.error) return wrap(<ErrorBanner error={res.error} action={{ label: 'Retry', onClick: res.reload }} />);
  const { resume, settings } = res.data;
  if (resume.state === 'tailoring') return <Navigate to={`/tailoring/${id}`} replace />;
  if (resume.state === 'draft') return <Navigate to={`/new/details?resume=${id}&step=${resume.wizardStep}`} replace />;
  return <CvReady key={resume.rowVersion} initial={resume} askSave={settings.ask_before_save} />;
}

function replaceBullet(doc, bullet) {
  const swap = (entries) => entries.map((e) => ({ ...e, bullets: e.bullets.map((b) => (b.id === bullet.id ? bullet : b)) }));
  return { ...doc, roles: swap(doc.roles), projects: swap(doc.projects) };
}

function CvReady({ initial, askSave }) {
  const navigate = useNavigate();
  const [resume, setResume] = useState(initial);
  const [dl, setDl] = useState({ phase: 'idle' }); // idle | busy | done {url, pages} | fail {error}
  const [db, setDb] = useState({ phase: 'idle' }); // idle | saving | saved {deletesOn} | skipped | failed {error, pending}
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [settleError, setSettleError] = useState(null);
  const [retryError, setRetryError] = useState(null);
  const [skillError, setSkillError] = useState(null);
  const [skillBusy, setSkillBusy] = useState(null); // the skill being confirmed or removed
  const [category, setCategory] = useState({}); // suggestion -> chosen UI group (default Cloud & tools)
  const [changesOpen, setChangesOpen] = useState(true);
  const [full, setFull] = useState(false);

  const cv = docToCv(resume.doc);
  const changes = docChanges(resume.doc);
  const pending = changes.filter((c) => c.status === 'review').length;
  const added = resume.addedSkills; // added by the tailor because the user's experience shows them
  const suggestions = openSuggestions(resume.missingSkills, resume.doc.skills);
  const meta = [resume.title, templateName(resume.template)].join(' · ');

  // PDF-2, then (unless the user unticked it) save to profile. Each step reports its own failure: a
  // profile save that fails doesn't hide a PDF that was built.
  async function download() {
    setDl({ phase: 'busy' });
    setProfileError(null);
    let pdf;
    try {
      pdf = await buildPdf(resume.id);
    } catch (e) {
      setDl({ phase: 'fail', error: e });
      return;
    }
    setDl({ phase: 'done', url: pdf.url, pages: pdf.page_count });
    window.open(pdf.url, '_blank', 'noopener');
    saveToDatabase(); // its own status line; never blocks or hides the download
    if (askSave && !saveToProfile) return;
    try {
      const profile = await getProfile();
      await saveResumeToProfile(resume.id, profile ? profile.row_version : null);
    } catch (e) {
      setProfileError(e);
    }
  }

  // SAVE-1: the CV downloaded for this JD is the one sent. Retries errors that can fix themselves, then keeps
  // it as pending for the next visit; errors that can't (signed out, CV changed) stop at once.
  async function saveToDatabase() {
    setDb({ phase: 'saving' });
    try {
      const r = await saveWithRetry(resume.id);
      clearPending(resume.id);
      setDb(r.saved ? { phase: 'saved', deletesOn: r.deletes_on } : { phase: 'skipped' });
    } catch (e) {
      const pending = isRetryable(e);
      if (pending) markPending(resume.id);
      setDb({ phase: 'failed', error: e, pending });
    }
  }

  async function settle(bulletId, action) {
    setSettleError(null);
    try {
      const r = await settleBullet(resume.id, bulletId, action, resume.rowVersion);
      setResume((cur) => ({ ...cur, rowVersion: r.row_version, doc: replaceBullet(cur.doc, bulletToDoc(r.bullet)) }));
    } catch (e) {
      setSettleError(e);
    }
  }

  // Both change the CV, so a PDF already built is out of date: the button goes back to "Download PDF".
  async function confirm(name) {
    setSkillError(null);
    setSkillBusy(name);
    try {
      const r = await confirmSkill(resume.id, name, SKILL_API_CATEGORY[category[name] ?? 'tools'], resume.rowVersion);
      setResume((cur) => ({ ...toResume(r), jd: cur.jd }));
      setDl({ phase: 'idle' });
    } catch (e) {
      setSkillError(e);
    } finally {
      setSkillBusy(null);
    }
  }

  async function removeSkill(name) {
    setSkillError(null);
    setSkillBusy(name);
    try {
      const skills = Object.fromEntries(Object.entries(resume.doc.skills).map(([k, v]) => [k, v.filter((s) => s !== name)]));
      const doc = { ...resume.doc, skills };
      const r = await patchResume(resume.id, sectionPatch(doc, 'skills', resume.rowVersion, null));
      setResume((cur) => ({ ...cur, doc, rowVersion: r.row_version, addedSkills: cur.addedSkills.filter((s) => s !== name), pdf: cur.pdf && { ...cur.pdf, upToDate: false } }));
      setDl({ phase: 'idle' });
    } catch (e) {
      setSkillError(e);
    } finally {
      setSkillBusy(null);
    }
  }

  async function retryTailor() {
    setRetryError(null);
    try {
      await startTailor(resume.id, 'all');
      navigate(`/tailoring/${resume.id}`);
    } catch (e) {
      setRetryError(e);
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
              {(dl.phase === 'idle' || dl.phase === 'fail') && <button type="button" className="hc-btn-p" onClick={download}><Download size={16} aria-hidden="true" />Download PDF</button>}
              {dl.phase === 'busy' && <span role="status" className="hc-btn-p" style={{ background: 'var(--hc-brand-hover)', cursor: 'progress' }}><WhiteSpinner />Building your PDF…</span>}
              {dl.phase === 'done' && <a className="hc-btn-p" href={dl.url} target="_blank" rel="noopener noreferrer" style={{ background: 'var(--hc-success)', boxShadow: 'none' }}><Check size={16} strokeWidth={2.6} aria-hidden="true" />Open PDF<ExternalLink size={14} aria-hidden="true" /></a>}
            </div>
            {askSave && dl.phase !== 'done' && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, cursor: 'pointer', minHeight: 32 }}>
                <input type="checkbox" checked={saveToProfile} onChange={(e) => setSaveToProfile(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--hc-brand)', margin: 0 }} />
                Also save these changes to my profile
              </label>
            )}
          </div>
        </div>

        {resume.state === 'failed' && (
          <ErrorBanner error="The last tailoring didn’t finish, so this CV is as it was before." action={{ label: 'Tailor again', onClick: retryTailor }} />
        )}
        <ErrorBanner error={retryError} />
        {dl.phase === 'done' && dl.pages > 1 && <ErrorBanner error={`Your CV runs to ${dl.pages} pages. Recruiters prefer one; trim a few bullets if you can.`} />}
        {db.phase === 'saving' && <p role="status" style={{ margin: '12px 0 0', fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>Saving to your Database…</p>}
        {db.phase === 'saved' && (
          <p role="status" className="hc-rise" style={{ margin: '12px 0 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>
            <Database size={15} color="var(--hc-success)" aria-hidden="true" />
            Saved to your <Link to="/database">Database</Link> with its JD · deletes on {shortDate(db.deletesOn)}
          </p>
        )}
        {db.phase === 'failed' && (
          <ErrorBanner
            error={`We couldn’t save it to your Database${db.pending ? ' (we’ll try again next time you open Honne)' : ''}: ${errorText(db.error)}`}
            action={db.error?.code === 'pdf_outdated' ? { label: 'Download again', onClick: download } : { label: 'Try again', onClick: saveToDatabase }}
          />
        )}
        {profileError && <ErrorBanner error={`Your PDF is ready, but saving to your profile failed: ${errorText(profileError)}`} />}
        {dl.phase === 'fail' && (
          <div role="alert" className="hc-rise hc-err" style={{ marginTop: 14, borderRadius: 14, padding: '12px 14px', fontSize: 14 }}>
            <AlertCircle size={16} color="var(--hc-warm)" aria-hidden="true" />
            <span style={{ flex: '1 1 240px' }}><strong>{errorText(dl.error)}</strong></span>
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
                {pending > 0 && <p style={{ margin: 0, fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>{plural(pending, 'rewritten bullet')} waiting for you. They’re in your CV until you revert them.</p>}
                <ErrorBanner error={settleError} style={{ marginTop: 0 }} />
                {changes.map((c) => (
                  <div key={c.id} style={{ border: '1px solid var(--hc-hairline)', borderRadius: 14, padding: 14 }}>
                    <div className="hc-lbl" style={{ marginBottom: 8 }}>{c.where}</div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--hc-ink-muted)', textDecoration: 'line-through', textDecorationColor: 'var(--hc-ink-faint)' }}>{c.before}</div>
                    <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.55, background: '#EEF1FD', borderRadius: 10, padding: '8px 10px' }}><BulletText text={c.after} /></div>
                    {c.status === 'review' && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                        <button type="button" className="hc-btn-sm" onClick={() => settle(c.id, 'keep')} style={{ border: 0, background: 'var(--hc-brand)', color: '#FFFFFF' }}><Check size={13} strokeWidth={3} aria-hidden="true" />Keep</button>
                        <button type="button" className="hc-btn-sm" onClick={() => settle(c.id, 'revert')} style={{ border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink)' }}>Revert</button>
                      </div>
                    )}
                  </div>
                ))}
                {added.length > 0 && (
                  <div style={{ border: '1px solid var(--hc-hairline)', borderRadius: 14, padding: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                    <span className="hc-lbl">Skills added from your experience</span>
                    {added.map((s) => (
                      <span key={s} className="hc-chip" style={{ background: '#E8F5EC', color: 'var(--hc-success)' }}>
                        + {s}
                        <button type="button" onClick={() => removeSkill(s)} disabled={skillBusy !== null} aria-label={`Remove ${s} from Skills`} style={{ display: 'inline-flex', border: 0, background: 'transparent', padding: 0, color: 'inherit', cursor: 'pointer' }}><X size={13} aria-hidden="true" /></button>
                      </span>
                    ))}
                    <span style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>Your bullets or project tech already show these. Remove any you don’t want listed.</span>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {(suggestions.length > 0 || resume.gaps.length > 0) && (
          <section className="hc-card" style={{ marginTop: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="hc-disp" style={{ fontSize: 18, fontWeight: 700 }}>From the job description</span>
            <ErrorBanner error={skillError} style={{ marginTop: 0 }} />
            {suggestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>The JD asks for these skills and your CV doesn’t show them, so we didn’t add them. Add only skills you really have.</p>
                {suggestions.map((s) => (
                  <div key={s} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                    <span className="hc-chip" style={{ background: '#FFF4E8', color: '#9A3412', flex: 'none' }}>{s}</span>
                    <select aria-label={`Section for ${s}`} value={category[s] ?? 'tools'} onChange={(e) => setCategory((c) => ({ ...c, [s]: e.target.value }))} style={{ minHeight: 36, borderRadius: 10, border: '1px solid var(--hc-hairline)', padding: '0 8px', fontFamily: 'inherit', fontSize: 13, background: '#FFFFFF', color: 'var(--hc-ink)' }}>
                      {SKILL_GROUPS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                    <button type="button" className="hc-btn-sm" onClick={() => confirm(s)} disabled={skillBusy !== null} style={{ border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink)' }}>
                      <Plus size={13} strokeWidth={3} aria-hidden="true" />{skillBusy === s ? 'Adding…' : 'I have this'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {resume.gaps.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="hc-lbl">Other requirements your CV doesn’t show</span>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>
                  {resume.gaps.map((g) => <li key={`${g.kind}:${g.text}`}><strong>{GAP_LABEL[g.kind] ?? g.kind}:</strong> {g.text}</li>)}
                </ul>
                <span style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>These aren’t skills, so they can’t be added here. If you meet one, add it to your profile.</span>
              </div>
            )}
          </section>
        )}

        {resume.jd && <AnalysisSection resumeId={resume.id} />}
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
