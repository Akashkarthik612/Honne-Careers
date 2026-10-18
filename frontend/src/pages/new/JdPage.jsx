import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Sparkles, Upload } from 'lucide-react';
import PageTitle from '@/components/PageTitle';
import SetupSteps from '@/components/SetupSteps';
import { countWords, guessJobMeta, hasProfile } from '@/data/cvModel';
import { useAppStore } from '@/state/appStore';

// Step 3 of new-resume setup (design: PasteJd.dc.html).
// First-time users (no profile yet) can upload a CV to pre-fill, then check details in the wizard.
// Returning users go straight to tailoring their saved profile (TAIL-2: tailoring needs a profile).

const MAX_WORDS = 1000; // TAIL-1
const UPLOAD_TYPES = ['.pdf', '.docx', '.tex']; // PROF-2

export default function JdPage() {
  const { draft, setDraft, profile } = useAppStore();
  const returning = hasProfile(profile);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState(null);
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

  // PROF-5: reject what we can't read, by extension, before anything is uploaded. Parsing is mocked:
  // the wizard pre-fills from the sample profile until the parse endpoint exists. TODO(PROF-2)
  function acceptFile(file) {
    if (!file) return;
    const ok = UPLOAD_TYPES.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!ok) { setUploadError(`We can’t read “${file.name}”. Upload a PDF, DOCX or .tex file.`); return; }
    setUploadError(null);
    setUploadOpen(false);
    setDraft({ upload: file.name });
  }

  const goTo = returning ? '/tailoring' : '/new/details';
  const goLabel = returning ? 'Tailor my CV' : 'Continue to your details';

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
          <span>Using your saved profile · {profile.personal.name}</span>
          <Link to="/profile" style={{ fontWeight: 700, textDecoration: 'none', padding: '4px 8px' }}>Edit</Link>
        </div>
      )}

      <div className="hc-card" style={{ marginTop: 20, padding: 20 }}>
        {!returning && (
          <div style={{ marginBottom: 12 }}>
            {draft.upload ? (
              <div className="hc-rise" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 13.5, background: '#E8F5EC', color: 'var(--hc-success)', borderRadius: 12, padding: '10px 12px' }}>
                <Check size={15} strokeWidth={2.6} aria-hidden="true" />
                <span style={{ fontWeight: 600 }}>{draft.upload} — we’ll pre-fill your details from it.</span>
                <button type="button" onClick={() => setDraft({ upload: null })} style={{ marginLeft: 'auto', border: 0, background: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--hc-success)', cursor: 'pointer', minHeight: 32 }}>Remove</button>
              </div>
            ) : uploadOpen ? (
              <div className="hc-rise" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button" className={`hc-drop${dragOver ? ' is-over' : ''}`} onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); acceptFile(e.dataTransfer.files[0]); }}
                  style={{ width: '100%', minHeight: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--hc-ink)' }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700 }}>Drop your CV here, or <span style={{ color: 'var(--hc-brand)' }}>browse</span></span>
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

      <div style={{ marginTop: 22, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Link className="hc-back" to="/new/mode"><ArrowLeft size={16} aria-hidden="true" />Back</Link>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
          {returning && canGo && <Link className="hc-btn-t" to="/new/details">Review step by step instead</Link>}
          {canGo ? (
            <Link className="hc-btn-p is-lg" to={goTo}>
              {returning && <Sparkles size={16} aria-hidden="true" />}{goLabel}{!returning && <ArrowRight size={16} aria-hidden="true" />}
            </Link>
          ) : (
            <span className="hc-btn-off" aria-disabled="true">{goLabel}</span>
          )}
        </div>
      </div>
    </main>
  );
}
