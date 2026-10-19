import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Sparkles, Upload } from 'lucide-react';
import PageTitle from '@/components/PageTitle';
import SetupSteps from '@/components/SetupSteps';
import { ErrorBanner, PageLoading } from '@/components/Status';
import { countWords, guessJobMeta } from '@/data/cvModel';
import useResource from '@/hooks/useResource';
import { createResume, getProfile, setJd, startTailor, uploadCv, uploadLatex } from '@/services/api';
import { ApiError, errorText } from '@/services/apiClient';
import { useAppStore } from '@/state/appStore';

// Step 3 of new-resume setup (design: PasteJd.dc.html).
// First-time users (no saved profile) can upload a CV to pre-fill (POST /uploads), then check details in
// the wizard. Returning users tailor their saved profile straight away (TAIL-2: tailoring needs a profile):
// POST /resumes (the server copies the profile in) -> PUT /jd -> POST /tailor -> /tailoring/:id.

const MAX_WORDS = 1000; // TAIL-1
const UPLOAD_TYPES = ['.pdf', '.docx', '.tex']; // PROF-2
const LATEX_MAX_CHARS = 100_000; // the API's cap on pasted LaTeX

export default function JdPage() {
  const navigate = useNavigate();
  const { draft, setDraft } = useAppStore();
  const profile = useResource(getProfile);
  const returning = Boolean(profile.data);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(null); // null | 'details' | 'tailor'
  const [failed, setFailed] = useState(null); // { kind, error } of the last failed attempt
  const created = useRef(null); // { id, jdText } once made, so Retry continues instead of duplicating
  const [dragOver, setDragOver] = useState(false);
  const [metaTouched, setMetaTouched] = useState(Boolean(draft.company || draft.role));
  const fileInput = useRef(null);

  const words = countWords(draft.jd);
  const tooLong = words > MAX_WORDS;
  const canGo = words > 0 && !tooLong;
  const countText = words.toLocaleString('en-US');

  function onJd(jd) {
    setDraft(metaTouched ? { jd } : { jd, ...guessJobMeta(jd) });
  }

  // PROF-2/PROF-5: reject what we can't read by extension first; the API then rejects unreadable content
  // (scans, corrupt files) with a reason, shown as is. .tex is sent as text: parsed, never compiled (PDF-3).
  async function acceptFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!UPLOAD_TYPES.some((ext) => name.endsWith(ext))) { setUploadError(`We can’t read “${file.name}”. Upload a PDF, DOCX or .tex file.`); return; }
    setUploadError(null);
    setUploading(true);
    try {
      let res;
      if (name.endsWith('.tex')) {
        const text = await file.text();
        if (text.length > LATEX_MAX_CHARS) { setUploadError('This .tex file is too long to read.'); return; }
        res = await uploadLatex(text);
      } else {
        res = await uploadCv(file);
      }
      setDraft({ upload: { filename: file.name, prefill: res.prefill, resumeId: null } });
      setUploadOpen(false);
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      setUploadError(errorText(e));
    } finally {
      setUploading(false);
    }
  }

  // Creates the resume and stores the JD. Each step runs once, so Retry after a failure picks up where it
  // stopped; a resume made before a later step failed stays on the dashboard as a draft.
  const prepare = useCallback(async () => {
    if (!created.current) {
      const title = [draft.role, draft.company].filter(Boolean).join(' · ') || null;
      const resume = await createResume({ template: draft.template, mode: 'tailored', title });
      created.current = { id: resume.id, jdText: null };
    }
    if (created.current.jdText !== draft.jd) {
      await setJd(created.current.id, { text: draft.jd, company: draft.company, role: draft.role });
      created.current.jdText = draft.jd;
    }
    return created.current.id;
  }, [draft]);

  async function go(kind) {
    setBusy(kind);
    setFailed(null);
    try {
      const id = await prepare();
      if (kind === 'tailor') {
        await startTailor(id, 'all');
        navigate(`/tailoring/${id}`);
      } else {
        if (draft.upload) setDraft({ upload: { ...draft.upload, resumeId: id } });
        navigate(`/new/details?resume=${id}`);
      }
    } catch (e) {
      setFailed({ kind, error: e });
      setBusy(null);
    }
  }

  const goLabel = returning ? 'Tailor my CV' : 'Continue to your details';
  const primary = returning ? 'tailor' : 'details';
  const wrap = (children) => <main className="hc-wrap" style={{ maxWidth: 960 }}>{children}</main>;
  if (profile.loading) return wrap(<PageLoading />);
  if (profile.error) return wrap(<ErrorBanner error={profile.error} action={{ label: 'Retry', onClick: profile.reload }} />);
  const name = profile.data?.content.header.name;

  return (
    <main className="hc-wrap" style={{ maxWidth: 960 }}>
      <SetupSteps current={2} />
      <PageTitle before="Paste the" accent="job description" style={{ marginTop: 24 }} />
      <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--hc-ink-muted)' }}>
        {returning ? 'We’ll tailor your saved profile to it. You can review every change after.' : 'Next, you’ll check your details step by step — tailored to this job.'}
      </p>

      {returning && (
        <div style={{ marginTop: 16, display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, fontSize: 13.5, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 999, padding: '6px 8px 6px 12px' }}>
          <Check size={14} strokeWidth={2.6} color="var(--hc-success)" aria-hidden="true" />
          <span>Using your saved profile{name ? ` · ${name}` : ''}</span>
          <Link to="/profile" style={{ fontWeight: 700, textDecoration: 'none', padding: '4px 8px' }}>Edit</Link>
        </div>
      )}

      <div className="hc-card" style={{ marginTop: 20, padding: 20 }}>
        {!returning && (
          <div style={{ marginBottom: 12 }}>
            {draft.upload ? (
              <div className="hc-rise" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 13.5, background: '#E8F5EC', color: 'var(--hc-success)', borderRadius: 12, padding: '10px 12px' }}>
                <Check size={15} strokeWidth={2.6} aria-hidden="true" />
                <span style={{ fontWeight: 600 }}>{draft.upload.filename} — we’ll pre-fill your details from it.</span>
                <button type="button" onClick={() => setDraft({ upload: null })} style={{ marginLeft: 'auto', border: 0, background: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--hc-success)', cursor: 'pointer', minHeight: 32 }}>Remove</button>
              </div>
            ) : uploadOpen ? (
              <div className="hc-rise" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button" className={`hc-drop${dragOver ? ' is-over' : ''}`} onClick={() => fileInput.current?.click()} disabled={uploading} aria-busy={uploading}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); acceptFile(e.dataTransfer.files[0]); }}
                  style={{ width: '100%', minHeight: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--hc-ink)' }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{uploading ? 'Reading your CV…' : <>Drop your CV here, or <span style={{ color: 'var(--hc-brand)' }}>browse</span></>}</span>
                  <span className="hc-mono" style={{ fontSize: 11.5, color: 'var(--hc-ink-muted)' }}>PDF · DOCX · .tex</span>
                </button>
                <input ref={fileInput} type="file" accept={UPLOAD_TYPES.join(',')} hidden onChange={(e) => { acceptFile(e.target.files[0]); e.target.value = ''; }} />
                {uploadError && <div role="alert" className="hc-err"><AlertCircle size={16} color="var(--hc-warm)" aria-hidden="true" />{uploadError}</div>}
                <button type="button" className="hc-btn-t" onClick={() => { setUploadOpen(false); setUploadError(null); }} style={{ fontSize: 13, alignSelf: 'flex-start', color: 'var(--hc-ink-muted)' }}>Not now</button>
              </div>
            ) : (
              <button type="button" className="hc-btn-t" onClick={() => setUploadOpen(true)} style={{ fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>
                <Upload size={15} aria-hidden="true" />
                Have a CV already? <span style={{ color: 'var(--hc-brand)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Upload PDF, DOCX or LaTeX to pre-fill</span>
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <label htmlFor="jd" style={{ fontSize: 14, fontWeight: 700 }}>Job description</label>
          <span className="hc-mono" style={{ fontSize: 12, fontWeight: 700, color: tooLong ? 'var(--hc-warm)' : 'var(--hc-ink-muted)' }}>{countText} / 1000 words</span>
        </div>
        <div className="hc-focus-within" style={{ borderRadius: 14, padding: '16px 18px', background: 'var(--hc-ground)', border: tooLong ? '1.5px solid var(--hc-warm)' : '1px solid var(--hc-hairline)' }}>
          <textarea
            id="jd" className="hc-jd" aria-describedby="jd-help" aria-invalid={tooLong}
            placeholder={'Paste the full job description here…\n\nInclude the title, responsibilities, requirements and nice-to-haves.'}
            value={draft.jd} onChange={(e) => onJd(e.target.value)}
          />
        </div>
        {tooLong && (
          <div role="alert" className="hc-rise hc-err" style={{ marginTop: 10, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <AlertCircle size={16} color="var(--hc-warm)" aria-hidden="true" style={{ flex: 'none', marginTop: 2 }} />
            <span><strong>This JD is {countText} words — the limit is 1,000.</strong> Trim the “About us” and benefits parts; keep the role, responsibilities and requirements.</span>
          </div>
        )}
        <p id="jd-help" style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>Paste the whole post — requirements matter most.</p>

        {words > 0 && (
          <div className="hc-rise" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--hc-hairline)' }}>
            <div style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)', marginBottom: 10 }}>We found these in the JD. Fix them if they’re wrong.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div className="hc-f"><label className="hc-flabel" htmlFor="co">Company</label><input id="co" className="hc-in" type="text" value={draft.company} onChange={(e) => { setMetaTouched(true); setDraft({ company: e.target.value }); }} /></div>
              <div className="hc-f"><label className="hc-flabel" htmlFor="ro">Role</label><input id="ro" className="hc-in" type="text" value={draft.role} onChange={(e) => { setMetaTouched(true); setDraft({ role: e.target.value }); }} /></div>
            </div>
          </div>
        )}
      </div>

      <ErrorBanner error={failed?.error} action={failed && { label: 'Try again', onClick: () => go(failed.kind) }} />

      <div style={{ marginTop: 22, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Link className="hc-back" to="/new/mode"><ArrowLeft size={16} aria-hidden="true" />Back</Link>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
          {returning && canGo && <button type="button" className="hc-btn-t" onClick={() => go('details')} disabled={busy !== null}>{busy === 'details' ? 'Opening…' : 'Review step by step instead'}</button>}
          {canGo && !uploading ? (
            <button type="button" className="hc-btn-p is-lg" onClick={() => go(primary)} disabled={busy !== null} aria-busy={busy === primary}>
              {returning && <Sparkles size={16} aria-hidden="true" />}{busy === primary ? 'Starting…' : goLabel}{!returning && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          ) : (
            <span className="hc-btn-off" aria-disabled="true">{goLabel}</span>
          )}
        </div>
      </div>
    </main>
  );
}
