import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Download, FileText, Maximize2, MessageCircle, Plus, Upload } from 'lucide-react';
import CvDoc from '@/components/CvDoc';
import { TAILOR_STEPS } from './useTailorJob';

// Right half of the CV studio. One panel, four states: new (add a CV), profile (saved, waiting for a JD),
// gen (tailoring job running), ready (tailored CV preview).

const TITLES = { new: 'Add your CV', profile: 'Your CV', gen: 'Tailoring your CV…', ready: 'Your tailored CV' };
const ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const formatTag = { fontSize: 11, fontWeight: 700, color: 'var(--hc-ink-muted)', border: '1px solid var(--hc-hairline)', background: '#FFFFFF', borderRadius: 8, padding: '5px 9px' };

function AddCv({ onFile, onLatex }) {
  const [src, setSrc] = useState('upload');
  const [over, setOver] = useState(false);
  const [latex, setLatex] = useState('');
  const fileInput = useRef(null);

  function handleDrop(e) {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div className="hc-rise" style={{ marginTop: 14, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {src === 'upload' ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <button
            type="button"
            className={'hc-drop' + (over ? ' is-over' : '')}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={handleDrop}
            aria-label="Upload your CV"
            style={{ flex: 1, minHeight: 240, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--hc-ink)', padding: 24 }}
          >
            <span className="hc-floaty" aria-hidden="true" style={{ width: 60, height: 60, borderRadius: 18, background: '#FFFFFF', border: '1px solid #C9D3F7', boxShadow: '0 10px 24px rgba(63,95,216,.14)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--hc-brand)' }}>
              <Upload size={26} />
            </span>
            <span className="hc-disp" style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>Drop your CV here</span>
            <span style={{ fontSize: 14, color: 'var(--hc-ink-muted)' }}>or click to browse</span>
            <span style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <span className="hc-mono" style={formatTag}>PDF</span>
              <span className="hc-mono" style={formatTag}>DOCX</span>
            </span>
          </button>
          <div style={{ textAlign: 'center' }}>
            <button type="button" className="hc-link-btn" onClick={() => setSrc('latex')} style={{ fontSize: 14, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 4, minHeight: 36 }}>
              or paste your LaTeX code instead
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <label htmlFor="latex" className="hc-lbl">Your LaTeX source</label>
            <button type="button" className="hc-link-btn" onClick={() => setSrc('upload')} style={{ fontSize: 13, fontWeight: 600, minHeight: 32 }}>← Upload a file instead</button>
          </div>
          <textarea
            id="latex"
            className="hc-mono"
            value={latex}
            onChange={(e) => setLatex(e.target.value)}
            placeholder={'\\documentclass[letterpaper,11pt]{article} …'}
            style={{ flex: 1, minHeight: 200, resize: 'none', border: '1px solid #2E3766', borderRadius: 14, padding: '14px 16px', fontSize: 12.5, lineHeight: 1.6, background: '#0F1324', color: '#C9D3F7', outline: 'none' }}
          />
          <div><button type="button" className="hc-btn-p" disabled={!latex.trim()} onClick={() => onLatex(latex)}>Import LaTeX</button></div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--hc-ink-faint)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em' }}>
        <span style={{ flex: 1, height: 1, background: 'var(--hc-hairline)' }} />OR<span style={{ flex: 1, height: 1, background: 'var(--hc-hairline)' }} />
      </div>
      <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: 14, border: '1px solid var(--hc-hairline)', borderRadius: 16, padding: '16px 18px', textDecoration: 'none', color: 'var(--hc-ink)', background: '#FFFFFF' }}>
        <span aria-hidden="true" style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, background: 'var(--hc-ink)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={20} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="hc-disp" style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>Create a new CV from scratch</span>
          <span style={{ display: 'block', marginTop: 2, fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>No CV yet? Fill in your details once — we handle the rest.</span>
        </span>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </div>
  );
}

function ProfileSaved() {
  const bar = (w, c = 'var(--hc-hairline)') => ({ height: 3, borderRadius: 9, background: c, width: w });
  return (
    <div className="hc-rise" style={{ marginTop: 16, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', border: '1.5px dashed var(--hc-hairline)', borderRadius: 16, padding: 24 }}>
      <span aria-hidden="true" style={{ width: 84, height: 108, borderRadius: 8, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', boxShadow: '0 10px 24px rgba(22,26,43,.08)', display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 10px' }}>
        <span style={{ height: 5, width: '60%', margin: '0 auto', borderRadius: 9, background: 'var(--hc-ink)' }} />
        <span style={bar('100%')} /><span style={bar('80%')} /><span style={bar('90%', '#C9D3F7')} /><span style={bar('70%')} /><span style={bar('85%', '#C9D3F7')} />
      </span>
      <div className="hc-disp" style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Your profile is saved.</div>
      <p style={{ margin: 0, maxWidth: 360, fontSize: 14.5, lineHeight: 1.55, color: 'var(--hc-ink-muted)' }}>
        Paste a job description on the left and hit <strong style={{ color: 'var(--hc-ink)' }}>Tailor my CV</strong>. Your tailored CV shows up here.
      </p>
    </div>
  );
}

function StepIcon({ state }) {
  if (state === 'done') {
    return <span style={{ flex: 'none', width: 22, height: 22, borderRadius: 99, background: 'var(--hc-success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#FFFFFF" strokeWidth={3} aria-hidden="true" /></span>;
  }
  if (state === 'active') {
    return (
      <svg className="hc-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flex: 'none' }}>
        <circle cx="12" cy="12" r="9" stroke="#E4E6EE" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="#3F5FD8" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  return <span style={{ flex: 'none', width: 22, height: 22, borderRadius: 99, border: '2px solid var(--hc-hairline)', display: 'inline-block' }} />;
}

const stepRow = (state) => ({
  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, fontSize: 14, fontWeight: 600,
  ...(state === 'active' ? { background: '#EEF1FD', color: 'var(--hc-ink)' }
    : state === 'done' ? { background: '#FFFFFF', color: 'var(--hc-ink)', border: '1px solid var(--hc-hairline)' }
      : { background: '#FFFFFF', color: 'var(--hc-ink-faint)', border: '1px solid #F0F1F5' }),
});

function Generating({ step }) {
  const sk = (width, extra) => <div className="hc-sk" style={{ width, ...extra }} />;
  return (
    <div className="hc-rise" style={{ marginTop: 16, flex: 1, minHeight: 0, display: 'flex', flexWrap: 'wrap', gap: 18, overflow: 'auto' }}>
      <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ol aria-label="Tailoring progress" style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: 0, padding: 0, listStyle: 'none' }}>
          {TAILOR_STEPS.map((s, i) => {
            const state = i < step ? 'done' : i === step ? 'active' : 'pending';
            return (
              <li key={s.label} style={stepRow(state)} aria-current={state === 'active' ? 'step' : undefined}>
                <StepIcon state={state} />
                <span style={{ flex: 1, minWidth: 0 }}>{s.label}</span>
                <span className="hc-mono" style={{ fontSize: 11.5, color: 'var(--hc-ink-muted)' }}>{s.time}</span>
              </li>
            );
          })}
        </ol>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--hc-ink-muted)' }}>
          Bullets follow <strong style={{ color: 'var(--hc-ink)' }}>“Accomplished X, measured by Y, by doing Z”</strong> — using only what’s in your profile. The PDF is compiled with LaTeX so every ATS reads it cleanly.
        </p>
      </div>
      <div aria-hidden="true" style={{ flex: '1 1 240px', minWidth: 0, background: '#EEF0F5', borderRadius: 14, padding: 16 }}>
        <div style={{ background: '#FFFFFF', borderRadius: 6, padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: '100%' }}>
          {sk('46%', { height: 14, margin: '0 auto' })}
          {sk('80%', { height: 7, margin: '0 auto 8px' })}
          {sk('28%')}{sk('100%')}{sk('92%')}{sk('84%')}
          {sk('28%', { marginTop: 8 })}{sk('90%')}{sk('76%')}
          {sk('28%', { marginTop: 8 })}{sk('66%')}
        </div>
      </div>
    </div>
  );
}

function Ready({ template, onOpenPreview, onMakeChanges }) {
  return (
    <div className="hc-rise" style={{ marginTop: 14, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" className="hc-paperwrap" onClick={onOpenPreview} aria-label="Open full CV preview" style={{ border: 0, cursor: 'zoom-in', fontFamily: 'inherit', display: 'block', width: '100%' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', boxShadow: '0 1px 2px rgba(22,26,43,.06), 0 12px 30px rgba(22,26,43,.10)', borderRadius: 4, overflow: 'hidden' }}>
          <CvDoc template={template} />
        </div>
      </button>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <button type="button" className="hc-link-btn" onClick={onOpenPreview} style={{ fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36 }}>
          <Maximize2 size={14} aria-hidden="true" />Full preview
        </button>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="hc-btn-s" onClick={onMakeChanges}><MessageCircle size={15} aria-hidden="true" />Make changes</button>
          {/* TODO(SAVE-1): download the compiled PDF and save CV + JD as an application record. */}
          <button type="button" className="hc-btn-p"><Download size={16} aria-hidden="true" />Download PDF</button>
        </div>
      </div>
    </div>
  );
}

export default function CvPanel({ phase, step, template, profileSource, onFile, onLatex, onChangeSource, onOpenPreview, onMakeChanges }) {
  return (
    <section aria-label="Your CV" className="hc-card" style={{ flex: '1.2 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', padding: '20px 22px', height: 'clamp(600px, calc(100vh - 210px), 880px)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 38 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--hc-brand-tint)', color: 'var(--hc-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={15} /></span>
          <h2 className="hc-disp" style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{TITLES[phase]}</h2>
        </div>
        {phase !== 'new' && (
          <span className="hc-chip" style={{ background: '#F3F4F8', color: 'var(--hc-ink)' }}>
            <Check size={14} color="var(--hc-success)" strokeWidth={2.4} aria-hidden="true" />
            Profile: {profileSource}
            <button type="button" className="hc-link-btn" onClick={onChangeSource} style={{ paddingLeft: 4, fontSize: 12.5, fontWeight: 700, minHeight: 24 }}>Change</button>
          </span>
        )}
      </div>

      {phase === 'new' && <AddCv onFile={onFile} onLatex={onLatex} />}
      {phase === 'profile' && <ProfileSaved />}
      {phase === 'gen' && <Generating step={step} />}
      {phase === 'ready' && <Ready template={template} onOpenPreview={onOpenPreview} onMakeChanges={onMakeChanges} />}
    </section>
  );
}
