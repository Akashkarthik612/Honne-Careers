import { useCallback, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Sparkles, Trash2 } from 'lucide-react';
import CvDoc from '@/components/CvDoc';
import SkillChips from '@/components/SkillChips';
import SpokenLanguagesEditor from '@/components/SpokenLanguagesEditor';
import { ErrorBanner, PageLoading } from '@/components/Status';
import { BULLET_TAILOR_CONCURRENCY } from '@/config/limits';
import {
  STEP_SECTIONS, WIZARD_ORDER, bulletToDoc, mergePrefill, openSuggestions, prefillToDoc, sectionPatch, toResume, validateDoc,
} from '@/data/cvAdapter';
import {
  SKILL_GROUPS, blankBullet, blankEducation, blankProject, blankRole, docToCv, ensureEntries, settleDoc,
} from '@/data/cvModel';
import { templateName } from '@/data/templates';
import useResource from '@/hooks/useResource';
import { getProfile, getResume, patchResume, saveResumeToProfile, settleBullet, tailorBullet } from '@/services/api';
import { ApiError, errorText } from '@/services/apiClient';
import { useAppStore } from '@/state/appStore';
import BulletEditor from './BulletEditor';

// "Your details" wizard (design: Wizard.dc.html, WizardEdit.dc.html). Five steps with a live preview.
// `?resume=<id>` (required; created on the Mode or JD page), `?step=<key>` opens a step directly.
// Leaving a step autosaves that section (PATCH /resumes/{id}, expected_version → 409 if another tab saved).
// In a tailored resume each bullet can be tailored to the JD and kept or reverted (TAIL-4, B5, B6).
// "Preview" saves every section, marks the wizard done, and — for a first-time user — saves the facts as
// their profile (B6 save to profile; the server keeps facts, never AI wording).

const ORDER = WIZARD_ORDER;
const LABELS = { personal: 'Personal', experience: 'Experience', projects: 'Projects', education: 'Education', skills: 'Skills' };
const TITLES = { personal: 'Personal details', experience: 'Experience', projects: 'Projects', education: 'Education', skills: 'Skills' };
const SUBS = {
  personal: 'How recruiters reach you.',
  experience: 'Your real work. Tailor each bullet to this JD — or keep it as you wrote it.',
  projects: 'Things you built. Same rule: only what you did.',
  education: 'Degrees and where you studied.',
  skills: 'Only skills you really have.',
};
const SCRATCH_SUBS = { ...SUBS, experience: 'Your real work, in your own words.' };

const PERSONAL_FIELDS = [['name', 'Full name'], ['city', 'City, country'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['linkedin', 'LinkedIn', 'url', 'https://linkedin.com/in/…'], ['github', 'GitHub', 'url', 'https://github.com/…'], ['portfolio', 'Portfolio', 'url', 'https://…']];
const ROLE_FIELDS = [['role', 'Role'], ['company', 'Company'], ['start', 'Start'], ['end', 'End'], ['location', 'Location']];
const EDU_FIELDS = [['school', 'School'], ['degree', 'Degree'], ['years', 'Years'], ['city', 'City']];

const DOC_KEY = { experience: 'roles', projects: 'projects' };
const TAILORABLE = new Set(['plain', 'kept']); // "Tailor all" leaves the user's own wording alone (B5)

function Field({ id, label, value, onChange, type = 'text', placeholder, error }) {
  return (
    <div className="hc-f">
      <label className="hc-flabel" htmlFor={id}>{label}</label>
      <input id={id} className="hc-in" type={type} value={value} placeholder={placeholder} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} onChange={(e) => onChange(e.target.value)} />
      {error && <span id={`${id}-err`} style={{ fontSize: 12.5, color: 'var(--hc-warm)', fontWeight: 600 }}>{error}</span>}
    </div>
  );
}

const entryBox = { border: '1px solid var(--hc-hairline)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 };
const stepOf = (section) => ORDER.find((k) => STEP_SECTIONS[k].includes(section));
const hasContent = (entry) => Object.entries(entry).some(([k, v]) => (k === 'bullets' ? v.some((b) => b.text.trim()) : k !== 'id' && typeof v === 'string' && v.trim()));

// Removes a whole role / project / education entry. One click when it's empty; asks first when it
// has content, since the entry and its bullets go with it (saved when the step is left).
function RemoveEntry({ noun, entry, onRemove, disabled }) {
  const [asking, setAsking] = useState(false);
  const btn = { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 12px', borderRadius: 999, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
  if (!asking) {
    return (
      <button type="button" disabled={disabled} onClick={() => (hasContent(entry) ? setAsking(true) : onRemove())} aria-label={`Remove this ${noun}`} style={{ ...btn, border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink-muted)' }}>
        <Trash2 size={14} aria-hidden="true" />Remove
      </button>
    );
  }
  return (
    <div role="group" aria-label={`Remove this ${noun}?`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>Remove this {noun}?</span>
      <button type="button" disabled={disabled} onClick={onRemove} style={{ ...btn, border: 0, background: 'var(--hc-warm)', color: '#FFFFFF' }}>Remove</button>
      <button type="button" onClick={() => setAsking(false)} style={{ ...btn, border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink)' }}>Cancel</button>
    </div>
  );
}

const entryHead = (title, remove) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
    <span className="hc-flabel" style={{ color: 'var(--hc-ink-muted)' }}>{title}</span>
    {remove}
  </div>
);

// Per-bullet failures shown inline. Anything that isn't an API error is a bug: re-thrown, not hidden.
function bulletError(e) {
  if (!(e instanceof ApiError)) throw e;
  if (e.code === 'truth_violation') return { rules: e.details?.rules ?? [] };
  if (e.code === 'llm_unavailable' || e.code === 'llm_output_invalid') return 'ai';
  return { message: errorText(e) };
}

async function runLimited(items, limit, fn) {
  let next = 0;
  const worker = async () => { while (next < items.length) { const item = items[next]; next += 1; await fn(item); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export default function WizardPage() {
  const [params] = useSearchParams();
  const resumeId = params.get('resume');
  const load = useCallback(() => getResume(resumeId).then(toResume), [resumeId]);
  const resource = useResource(load);

  if (!resumeId) return <Navigate to="/resumes" replace />;
  const wrap = (children) => <main style={{ maxWidth: 1440, margin: '0 auto', padding: '20px 20px 72px' }}>{children}</main>;
  if (resource.loading) return wrap(<PageLoading label="Loading your resume…" />);
  if (resource.error) return wrap(<ErrorBanner error={resource.error} action={{ label: 'Retry', onClick: resource.reload }} />);
  if (resource.data.state === 'tailoring') return <Navigate to={`/tailoring/${resumeId}`} replace />;
  // Remount on reload (after a 409) so the form starts from the server's copy.
  return <WizardForm key={resource.data.rowVersion} resume={resource.data} stepParam={params.get('step')} onReload={resource.reload} />;
}

function WizardForm({ resume, stepParam, onReload }) {
  const navigate = useNavigate();
  const { draft, setDraft } = useAppStore();
  const [doc, setDoc] = useState(() => {
    const upload = draft.upload?.resumeId === resume.id ? draft.upload : null;
    return ensureEntries(settleDoc(upload ? mergePrefill(resume.doc, prefillToDoc(upload.prefill)) : resume.doc));
  });
  const [step, setStep] = useState(ORDER.includes(stepParam) ? stepParam : 'personal');
  const [rowVersion, setRowVersion] = useState(resume.rowVersion);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [note, setNote] = useState(null);
  const [tab, setTab] = useState('edit');
  const [jdOpen, setJdOpen] = useState(false);

  const tailoring = resume.mode === 'tailored' && Boolean(resume.jd);
  const editing = resume.wizardStep === 'done';
  const meta = { role: resume.jd?.role ?? '', company: resume.jd?.company ?? '', template: resume.template };
  const suggestions = tailoring ? openSuggestions(resume.missingSkills, doc.skills) : [];
  const idx = ORDER.indexOf(step);
  const subs = tailoring ? SUBS : SCRATCH_SUBS;
  const anyBusy = [...doc.roles, ...doc.projects].some((e) => e.bullets.some((b) => b.status === 'busy'));
  const locked = saving || anyBusy;

  // ── doc updates (local until the step is saved) ─────────────────────────
  const edit = (fn) => { setDoc(fn); setDirty(true); setSaved(false); };
  const setPersonal = (key, value) => edit((d) => ({ ...d, personal: { ...d.personal, [key]: value } }));
  const patchEntry = (key, id, patch) => edit((d) => ({ ...d, [key]: d[key].map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const addEntry = (key, entry) => edit((d) => ({ ...d, [key]: [...d[key], entry] }));
  // Removing every entry leaves the section empty, so it's left off the CV.
  const removeEntry = (key, id) => edit((d) => ({ ...d, [key]: d[key].filter((e) => e.id !== id) }));
  const removeButton = (key, noun, entry) => <RemoveEntry noun={noun} entry={entry} disabled={locked} onRemove={() => removeEntry(key, entry.id)} />;
  // Server-driven bullet changes (busy, tailor/settle results) don't make the step dirty.
  const patchBullet = (key, entryId, bulletId, patch) => setDoc((d) => ({
    ...d, [key]: d[key].map((e) => (e.id !== entryId ? e : { ...e, bullets: e.bullets.map((b) => (b.id === bulletId ? { ...b, ...patch } : b)) })),
  }));
  const editBullet = (key, entryId, bulletId, patch) => { patchBullet(key, entryId, bulletId, patch); setDirty(true); setSaved(false); };
  const addBullet = (key, entryId) => edit((d) => ({ ...d, [key]: d[key].map((e) => (e.id === entryId ? { ...e, bullets: [...e.bullets, blankBullet()] } : e)) }));
  const removeBullet = (key, entryId, bulletId) => edit((d) => ({ ...d, [key]: d[key].map((e) => (e.id === entryId ? { ...e, bullets: e.bullets.filter((b) => b.id !== bulletId) } : e)) }));
  const setSkills = (group, values) => edit((d) => ({ ...d, skills: { ...d.skills, [group]: values } }));

  // ── saving ──────────────────────────────────────────────────────────────
  // PATCHes the given sections in order (versions chain). Returns the new row_version, or null after
  // showing why it didn't save (field errors or the API's message). No retry: the user acts.
  async function saveSections(sections, finalStep = null) {
    const errors = validateDoc(doc, sections);
    setFieldErrors(errors);
    const firstBad = sections.find((s) => Object.keys(validateDoc(doc, [s])).length);
    if (firstBad) { setStep(stepOf(firstBad)); return null; }
    setSaving(true);
    setSaveError(null);
    try {
      let version = rowVersion;
      for (const [i, section] of sections.entries()) {
        const last = i === sections.length - 1;
        const res = await patchResume(resume.id, sectionPatch(doc, section, version, last ? finalStep : null));
        version = res.row_version;
        setRowVersion(version);
      }
      setDirty(false);
      setSaved(true);
      return version;
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      setSaveError(e);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function goStep(next) {
    if (locked || next === step) return;
    // Keeps the dashboard's "Continue" on the step the user reached; a finished resume stays finished.
    const version = await saveSections(STEP_SECTIONS[step], editing ? null : next);
    if (version === null) return;
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  async function finish() {
    if (locked) return;
    const version = await saveSections(ORDER.flatMap((k) => STEP_SECTIONS[k]), 'done');
    if (version === null) return;
    try {
      // First-time user: this resume's facts become their profile (expected_version null = create).
      if ((await getProfile()) === null) await saveResumeToProfile(resume.id, null);
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      setSaveError(e);
      return;
    }
    if (draft.upload?.resumeId === resume.id) setDraft({ upload: null });
    navigate(`/cv/${resume.id}`);
  }

  // ── tailoring (TAIL-4) ──────────────────────────────────────────────────
  // The server tailors the stored bullet, so unsaved edits in this step are saved first.
  async function tailor(section, entryId, b, { saveFirst = true } = {}) {
    if (saveFirst && dirty && (await saveSections([section])) === null) return;
    const key = DOC_KEY[section];
    patchBullet(key, entryId, b.id, { status: 'busy', prev: b.status, err: null });
    try {
      const res = await tailorBullet(resume.id, b.id);
      setRowVersion((v) => Math.max(v, res.row_version));
      patchBullet(key, entryId, b.id, bulletToDoc(res.bullet));
    } catch (e) {
      patchBullet(key, entryId, b.id, { status: b.status, err: bulletError(e) });
    }
  }

  async function tailorAll() {
    if (dirty && (await saveSections(['experience'])) === null) return;
    const queue = doc.roles.flatMap((r) => r.bullets.filter((b) => TAILORABLE.has(b.status) && b.text.trim()).map((b) => [r.id, b]));
    if (!queue.length) {
      setNote('Every bullet here is in your own words, so we left them alone. Tap “Tailor to JD” on any bullet to rewrite it.');
      return;
    }
    setNote(null);
    await runLimited(queue, BULLET_TAILOR_CONCURRENCY, ([entryId, b]) => tailor('experience', entryId, b, { saveFirst: false }));
  }

  async function settle(section, entryId, b, action) {
    const key = DOC_KEY[section];
    try {
      const res = await settleBullet(resume.id, b.id, action, rowVersion);
      setRowVersion(res.row_version);
      patchBullet(key, entryId, b.id, bulletToDoc(res.bullet));
    } catch (e) {
      patchBullet(key, entryId, b.id, { err: bulletError(e) });
    }
  }

  function addSuggestion(skill) {
    setSkills('tools', [...doc.skills.tools, skill]);
  }

  const backHref = editing ? `/cv/${resume.id}` : '/resumes';
  const tabStyle = (on) => ({ minHeight: 40, padding: '0 18px', borderRadius: 999, border: 0, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...(on ? { background: '#FFFFFF', color: 'var(--hc-ink)', boxShadow: '0 1px 3px rgba(22,26,43,.12)' } : { background: 'transparent', color: 'var(--hc-ink-muted)' }) });
  const stale = saveError?.code === 'stale_version';

  const bulletList = (section, entry) => (
    <>
      {entry.bullets.map((b, i) => (
        <BulletEditor
          key={b.id} bullet={b} label={`Bullet ${i + 1}`} canTailor={tailoring} disabled={saving}
          onEdit={(text) => editBullet(DOC_KEY[section], entry.id, b.id, { text, source: text, status: 'edited', err: null })}
          onTailor={() => tailor(section, entry.id, b)}
          onRetry={() => tailor(section, entry.id, b)}
          onDismiss={() => patchBullet(DOC_KEY[section], entry.id, b.id, { err: null })}
          onKeep={() => settle(section, entry.id, b, 'keep')}
          onRevert={() => settle(section, entry.id, b, 'revert')}
          onRemove={() => removeBullet(DOC_KEY[section], entry.id, b.id)}
        />
      ))}
      <div><button type="button" className="hc-add" onClick={() => addBullet(DOC_KEY[section], entry.id)}>+ Add bullet</button></div>
    </>
  );

  return (
    <main style={{ maxWidth: 1440, margin: '0 auto', padding: '20px 20px 72px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="hc-lbl">{editing ? 'EDITING' : 'NEW RESUME'} · {templateName(meta.template).toUpperCase()}</div>
          <h1 className="hc-disp" style={{ margin: '4px 0 0', fontSize: 'clamp(24px,2.6vw,32px)', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.03em' }}>
            Your <span className="hc-serif" style={{ color: 'var(--hc-brand)', fontSize: '1.1em' }}>details</span>
          </h1>
        </div>
        <div role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: saving ? 'var(--hc-ink-muted)' : dirty ? '#B45309' : 'var(--hc-success)' }}>
          {saving ? 'Saving…' : dirty ? 'Unsaved changes — saved when you move on' : (saved || editing) && <><Check size={14} strokeWidth={2.6} aria-hidden="true" />Saved</>}
        </div>
      </div>

      <nav aria-label="Steps" style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 999, padding: 5, width: 'fit-content', maxWidth: '100%' }}>
        {ORDER.map((k, i) => {
          const done = i < idx;
          const cur = i === idx;
          return (
            <button
              key={k} type="button" onClick={() => goStep(k)} disabled={locked} aria-current={cur ? 'step' : undefined}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 14px 0 6px', borderRadius: 999, border: 0, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', ...(cur ? { background: 'var(--hc-brand-tint)', color: 'var(--hc-brand-hover)' } : { background: 'transparent', color: done ? 'var(--hc-ink)' : 'var(--hc-ink-muted)' }) }}
            >
              <span className="hc-mono" style={{ width: 24, height: 24, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, ...(done ? { background: 'var(--hc-brand)', color: '#FFFFFF' } : cur ? { background: '#FFFFFF', color: 'var(--hc-brand)', border: '2px solid var(--hc-brand)' } : { background: '#FFFFFF', color: 'var(--hc-ink-muted)', border: '2px solid var(--hc-hairline)' }) }}>
                {done ? <Check size={11} strokeWidth={3.2} aria-hidden="true" /> : i + 1}
              </span>
              {LABELS[k]}
            </button>
          );
        })}
      </nav>

      <div className="hc-mtabs" role="tablist" aria-label="View" style={{ marginTop: 14, gap: 4, background: '#EEF0F5', borderRadius: 999, padding: 4, width: 'fit-content' }}>
        <button type="button" role="tab" aria-selected={tab === 'edit'} onClick={() => setTab('edit')} style={tabStyle(tab === 'edit')}>Edit</button>
        <button type="button" role="tab" aria-selected={tab === 'preview'} onClick={() => setTab('preview')} style={tabStyle(tab === 'preview')}>Preview</button>
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <div className={tab === 'preview' ? 'hc-mhide' : undefined} style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ErrorBanner error={saveError} style={{ marginTop: 0 }} action={stale ? { label: 'Reload', onClick: onReload } : { label: 'Dismiss', onClick: () => setSaveError(null) }} />
          {tailoring && (
            <div style={{ background: '#FFFFFF', border: '1px solid #C9D3F7', borderRadius: 16 }}>
              <button type="button" onClick={() => setJdOpen((o) => !o)} aria-expanded={jdOpen} style={{ width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 14, color: 'var(--hc-ink)', cursor: 'pointer', textAlign: 'left' }}>
                <Sparkles size={16} color="var(--hc-brand)" aria-hidden="true" />
                <span style={{ flex: 1, minWidth: 0 }}><span style={{ color: 'var(--hc-ink-muted)' }}>Tailoring to:</span> <strong>{[meta.role, meta.company].filter(Boolean).join(' · ') || 'your job description'}</strong></span>
                <ChevronDown size={16} aria-hidden="true" style={{ flex: 'none', transition: 'transform .2s ease', transform: `rotate(${jdOpen ? 180 : 0}deg)` }} />
              </button>
              {jdOpen && <div className="hc-rise" style={{ margin: '0 16px 16px', padding: '14px 16px', background: 'var(--hc-ground)', border: '1px solid var(--hc-hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-line', maxHeight: 240, overflow: 'auto' }}>{resume.jd.text}</div>}
            </div>
          )}

          <section className="hc-card" aria-labelledby="step-title" style={{ padding: 22 }}>
            <h2 id="step-title" className="hc-disp" style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{TITLES[step]}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 14.5, color: 'var(--hc-ink-muted)' }}>{subs[step]}</p>

            {step === 'personal' && (
              <div key="personal" className="hc-g2 hc-rise" style={{ marginTop: 18 }}>
                {PERSONAL_FIELDS.map(([k, label, type, placeholder]) => <Field key={k} id={`p-${k}`} label={label} type={type} placeholder={placeholder} value={doc.personal[k]} error={fieldErrors[`personal.${k}`]} onChange={(v) => setPersonal(k, v)} />)}
              </div>
            )}

            {step === 'experience' && (
              <div key="experience" className="hc-rise" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {tailoring && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#F7F8FD', border: '1px solid var(--hc-hairline)', borderRadius: 14, padding: '10px 12px 10px 14px' }}>
                    <span style={{ fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>Tailor every bullet you haven’t edited by hand.</span>
                    <button type="button" className="hc-btn-sm" onClick={tailorAll} disabled={locked} style={{ border: 0, background: 'var(--hc-brand)', color: '#FFFFFF', minHeight: 40, padding: '0 14px' }}>
                      <Sparkles size={14} aria-hidden="true" />Tailor all bullets
                    </button>
                  </div>
                )}
                {note && <div role="status" style={{ fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>{note}</div>}
                {doc.roles.map((r, i) => (
                  <div key={r.id} style={entryBox}>
                    {entryHead(`Role ${i + 1}`, removeButton('roles', 'role', r))}
                    <div className="hc-g2">
                      {ROLE_FIELDS.map(([k, label]) => <Field key={k} id={`${r.id}-${k}`} label={label} value={r[k]} error={fieldErrors[`${r.id}.${k}`]} onChange={(v) => patchEntry('roles', r.id, { [k]: v })} />)}
                    </div>
                    <div className="hc-flabel" style={{ marginTop: 2 }}>What you did</div>
                    {bulletList('experience', r)}
                  </div>
                ))}
                <div><button type="button" className="hc-add" onClick={() => addEntry('roles', blankRole())}>+ Add another role</button></div>
              </div>
            )}

            {step === 'projects' && (
              <div key="projects" className="hc-rise" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {doc.projects.map((p, i) => (
                  <div key={p.id} style={entryBox}>
                    {entryHead(`Project ${i + 1}`, removeButton('projects', 'project', p))}
                    <div className="hc-g2">
                      <Field id={`${p.id}-name`} label="Project name" value={p.name} placeholder="e.g. Rate limiter" error={fieldErrors[`${p.id}.name`]} onChange={(v) => patchEntry('projects', p.id, { name: v })} />
                      <Field id={`${p.id}-tech`} label="Tech used" value={p.tech} placeholder="e.g. Go, Redis" onChange={(v) => patchEntry('projects', p.id, { tech: v })} />
                      <Field id={`${p.id}-link`} label="Live link (optional, shows as “Click here”)" type="url" value={p.link} placeholder="https://…" error={fieldErrors[`${p.id}.link`]} onChange={(v) => patchEntry('projects', p.id, { link: v })} />
                    </div>
                    <div className="hc-flabel">What it does, and any result</div>
                    {bulletList('projects', p)}
                  </div>
                ))}
                <div><button type="button" className="hc-add" onClick={() => addEntry('projects', blankProject())}>+ Add a project</button></div>
              </div>
            )}

            {step === 'education' && (
              <div key="education" className="hc-rise" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {doc.education.map((e, i) => (
                  <div key={e.id} style={entryBox}>
                    {entryHead(`Education ${i + 1}`, removeButton('education', 'education entry', e))}
                    <div className="hc-g2">
                      {EDU_FIELDS.map(([k, label]) => <Field key={k} id={`${e.id}-${k}`} label={label} value={e[k]} error={fieldErrors[`${e.id}.${k}`]} onChange={(v) => patchEntry('education', e.id, { [k]: v })} />)}
                    </div>
                  </div>
                ))}
                <div><button type="button" className="hc-add" onClick={() => addEntry('education', blankEducation())}>+ Add education</button></div>
              </div>
            )}

            {step === 'skills' && (
              <div key="skills" className="hc-rise" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {SKILL_GROUPS.map(([k, label]) => <SkillChips key={k} id={`sk-${k}`} label={label} values={doc.skills[k]} onChange={(v) => setSkills(k, v)} />)}
                <SpokenLanguagesEditor id="sk-spoken" values={doc.spoken} disabled={saving} onChange={(v) => edit((d) => ({ ...d, spoken: v }))} />
                {tailoring && resume.missingSkills.length > 0 && (
                  // TAIL-6: JD skills the profile lacks are offered, never added automatically.
                  <div style={{ background: '#F7F8FD', border: '1px solid #C9D3F7', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: 14, lineHeight: 1.5 }}><strong>The JD also mentions: {resume.missingSkills.join(', ')}.</strong> <span style={{ color: 'var(--hc-ink-muted)' }}>Add only skills you really have.</span></div>
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {suggestions.map((s) => (
                        <button key={s} type="button" onClick={() => addSuggestion(s)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 12px', borderRadius: 999, border: '1px dashed var(--hc-brand)', background: '#FFFFFF', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--hc-brand-hover)', cursor: 'pointer' }}>+ {s}</button>
                      ))}
                      {suggestions.length === 0 && <span style={{ fontSize: 13, color: 'var(--hc-ink-muted)' }}>Nothing left to suggest.</span>}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--hc-ink-muted)' }}>Nothing is added automatically. A tap moves it into Cloud &amp; tools.</div>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--hc-hairline)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              {idx === 0
                ? <Link className="hc-btn-s" to={backHref}><ArrowLeft size={15} aria-hidden="true" />Back</Link>
                : <button type="button" className="hc-btn-s" onClick={() => goStep(ORDER[idx - 1])} disabled={locked}><ArrowLeft size={15} aria-hidden="true" />Back</button>}
              {idx < ORDER.length - 1
                ? <button type="button" className="hc-btn-p" onClick={() => goStep(ORDER[idx + 1])} disabled={locked} aria-busy={saving}>{saving ? 'Saving…' : <>Next: {LABELS[ORDER[idx + 1]]}<ArrowRight size={15} aria-hidden="true" /></>}</button>
                : <button type="button" className="hc-btn-p" onClick={finish} disabled={locked} aria-busy={saving}>{saving ? 'Saving…' : <>Preview<ArrowRight size={15} aria-hidden="true" /></>}</button>}
            </div>
          </section>
        </div>

        <aside className={tab === 'edit' ? 'hc-mhide' : undefined} aria-label="Live preview" style={{ flex: '1 1 460px', minWidth: 0 }}>
          <div className="hc-card hc-prevcol" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '2px 4px 12px' }}>
              <span className="hc-disp" style={{ fontSize: 16, fontWeight: 700 }}>Live preview</span>
              <span className="hc-mono" style={{ fontSize: 11.5, color: 'var(--hc-ink-muted)' }}>{templateName(meta.template).toUpperCase()} · 1 PAGE</span>
            </div>
            <div style={{ background: '#EEF0F5', borderRadius: 14, padding: 14, maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }}>
              <div style={{ boxShadow: '0 12px 30px rgba(22,26,43,.10)', borderRadius: 3, overflow: 'hidden' }}>
                <CvDoc cv={docToCv(doc)} template={meta.template} focus={step} />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
