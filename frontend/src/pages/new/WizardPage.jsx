import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Sparkles } from 'lucide-react';
import CvDoc from '@/components/CvDoc';
import SkillChips from '@/components/SkillChips';
import {
  SKILL_GROUPS, blankBullet, blankEducation, blankProject, blankRole, docToCv, docToProfile,
  ensureEntries, hasProfile, missingSkills, pruneDoc, settleDoc, toDoc,
} from '@/data/cvModel';
import { SAMPLE_JD_SKILLS, SAMPLE_PROFILE } from '@/data/sampleCv';
import { templateName } from '@/data/templates';
import { TailorUnavailableError, TruthCheckError, tailorBullet } from '@/services/mockApi';
import { useAppStore } from '@/state/appStore';
import BulletEditor from './BulletEditor';

// "Your details" wizard (design: Wizard.dc.html, WizardEdit.dc.html). Five steps with a live preview.
// In JD mode each bullet can be tailored to the JD and kept or reverted (TAIL-4, TRUTH-3).
// `?resume=<id>` continues an existing resume; `?step=<key>` opens a step directly.
// Moving between steps saves a draft resume; "Preview" marks it ready and saves the facts to the profile.

const ORDER = ['personal', 'experience', 'projects', 'education', 'skills'];
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

const PERSONAL_FIELDS = [['name', 'Full name'], ['city', 'City, country'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['linkedin', 'LinkedIn'], ['github', 'GitHub or portfolio']];
const ROLE_FIELDS = [['role', 'Role'], ['company', 'Company'], ['start', 'Start'], ['end', 'End'], ['location', 'Location']];
const EDU_FIELDS = [['school', 'School'], ['degree', 'Degree'], ['years', 'Years'], ['city', 'City']];

const DOC_KEY = { experience: 'roles', projects: 'projects' };

function initialState({ resume, draft, profile, stepParam }) {
  const fromUpload = !resume && draft.upload && !hasProfile(profile); // TODO(PROF-2): parsed upload replaces the sample
  const doc = ensureEntries(settleDoc(resume ? resume.doc : toDoc(fromUpload ? SAMPLE_PROFILE : profile)));
  const mode = resume ? resume.mode : draft.mode;
  const jd = resume ? resume.jd : draft.jd;
  const tailoring = mode === 'jd' && Boolean(jd);
  return {
    doc, mode, jd, tailoring,
    meta: resume ? { role: resume.role, company: resume.company, title: resume.title, template: resume.template } : { role: draft.role, company: draft.company, template: draft.template },
    suggestions: tailoring ? missingSkills(doc.skills, SAMPLE_JD_SKILLS) : [],
    addedSkills: resume?.addedSkills ?? [],
    step: ORDER.includes(stepParam) ? stepParam : 'personal',
  };
}

function Field({ id, label, value, onChange, type = 'text', placeholder }) {
  return (
    <div className="hc-f">
      <label className="hc-flabel" htmlFor={id}>{label}</label>
      <input id={id} className="hc-in" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

const entryBox = { border: '1px solid var(--hc-hairline)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 };

export default function WizardPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const store = useAppStore();
  const existing = store.resumes.find((r) => r.id === params.get('resume')) ?? null;

  const [init] = useState(() => initialState({ resume: existing, draft: store.draft, profile: store.profile, stepParam: params.get('step') }));
  const [doc, setDoc] = useState(init.doc);
  const [step, setStep] = useState(init.step);
  const [suggestions, setSuggestions] = useState(init.suggestions);
  const [addedSkills, setAddedSkills] = useState(init.addedSkills);
  const [resumeId, setResumeId] = useState(existing?.id ?? null);
  const [tab, setTab] = useState('edit');
  const [jdOpen, setJdOpen] = useState(false);

  const { tailoring, mode, jd, meta } = init;
  const idx = ORDER.indexOf(step);
  const subs = tailoring ? SUBS : SCRATCH_SUBS;

  // ── doc updates ────────────────────────────────────────────────────────
  const setPersonal = (key, value) => setDoc((d) => ({ ...d, personal: { ...d.personal, [key]: value } }));
  const patchEntry = (key, id, patch) => setDoc((d) => ({ ...d, [key]: d[key].map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const addEntry = (key, entry) => setDoc((d) => ({ ...d, [key]: [...d[key], entry] }));
  const patchBullet = (key, entryId, bulletId, patch) => setDoc((d) => ({
    ...d, [key]: d[key].map((e) => (e.id !== entryId ? e : { ...e, bullets: e.bullets.map((b) => (b.id === bulletId ? { ...b, ...patch } : b)) })),
  }));
  const addBullet = (key, entryId) => setDoc((d) => ({ ...d, [key]: d[key].map((e) => (e.id === entryId ? { ...e, bullets: [...e.bullets, blankBullet()] } : e)) }));
  const removeBullet = (key, entryId, bulletId) => setDoc((d) => ({ ...d, [key]: d[key].map((e) => (e.id === entryId ? { ...e, bullets: e.bullets.filter((b) => b.id !== bulletId) } : e)) }));
  const setSkills = (group, values) => setDoc((d) => ({ ...d, skills: { ...d.skills, [group]: values } }));

  // TAIL-4: tailor one bullet. Only the two known failures are shown inline; anything else is re-thrown.
  async function tailor(section, entryId, b, retry = false) {
    const key = DOC_KEY[section];
    const before = b.status;
    patchBullet(key, entryId, b.id, { status: 'busy', prev: before, err: null });
    try {
      const res = await tailorBullet({ bulletId: b.id, text: b.text, section, retry });
      patchBullet(key, entryId, b.id, { status: 'review', original: b.text, tailored: res.text });
    } catch (e) {
      if (e instanceof TailorUnavailableError) patchBullet(key, entryId, b.id, { status: before, err: 'ai' });
      else if (e instanceof TruthCheckError) patchBullet(key, entryId, b.id, { status: before, err: { violations: e.violations } });
      else { patchBullet(key, entryId, b.id, { status: before }); throw e; }
    }
  }

  function tailorAll() {
    doc.roles.forEach((r) => r.bullets.forEach((b) => {
      if ((b.status === 'plain' || b.status === 'kept') && b.text.trim()) tailor('experience', r.id, b);
    }));
  }

  function addSuggestion(skill) {
    setSuggestions((s) => s.filter((x) => x !== skill));
    setAddedSkills((a) => [...a, skill]);
    setSkills('tools', [...doc.skills.tools, skill]);
  }

  // ── saving ─────────────────────────────────────────────────────────────
  const resumePayload = (d) => ({
    role: meta.role, company: meta.company, title: meta.title || (mode === 'scratch' ? 'General CV' : undefined),
    mode, jd, template: meta.template, doc: d, addedSkills,
  });

  function goStep(next) {
    setStep(next);
    window.scrollTo({ top: 0 });
    const d = settleDoc(doc);
    const stepNo = ORDER.indexOf(next) + 1;
    const current = store.resumes.find((r) => r.id === resumeId);
    if (current) store.updateResume(resumeId, current.status === 'ready' ? { doc: d, addedSkills } : { doc: d, addedSkills, step: stepNo });
    else setResumeId(store.addResume({ ...resumePayload(d), status: 'draft', step: stepNo }));
  }

  function finish() {
    const d = pruneDoc(settleDoc(doc));
    store.saveProfile(docToProfile(d));
    const payload = { ...resumePayload(d), status: 'ready' };
    let id = resumeId;
    if (store.resumes.some((r) => r.id === id)) store.updateResume(id, payload);
    else id = store.addResume(payload);
    navigate(`/cv/${id}`);
  }

  const backHref = existing ? (existing.status === 'ready' ? `/cv/${existing.id}` : '/resumes') : (mode === 'scratch' ? '/new/mode' : '/new/jd');
  const tabStyle = (on) => ({ minHeight: 40, padding: '0 18px', borderRadius: 999, border: 0, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...(on ? { background: '#FFFFFF', color: 'var(--hc-ink)', boxShadow: '0 1px 3px rgba(22,26,43,.12)' } : { background: 'transparent', color: 'var(--hc-ink-muted)' }) });

  const bulletList = (section, entry) => (
    <>
      {entry.bullets.map((b, i) => (
        <BulletEditor
          key={b.id} bullet={b} label={`Bullet ${i + 1}`} canTailor={tailoring}
          onEdit={(text) => patchBullet(DOC_KEY[section], entry.id, b.id, { text, source: text, status: 'edited', err: null })}
          onTailor={() => tailor(section, entry.id, b)}
          onRetry={() => tailor(section, entry.id, b, true)}
          onDismiss={() => patchBullet(DOC_KEY[section], entry.id, b.id, { err: null })}
          onKeep={() => patchBullet(DOC_KEY[section], entry.id, b.id, { text: b.tailored, status: 'kept' })}
          onRevert={() => patchBullet(DOC_KEY[section], entry.id, b.id, { text: b.original, status: b.prev || 'plain' })}
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
          <div className="hc-lbl">{existing ? 'EDITING' : 'NEW RESUME'} · {templateName(meta.template).toUpperCase()}</div>
          <h1 className="hc-disp" style={{ margin: '4px 0 0', fontSize: 'clamp(24px,2.6vw,32px)', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.03em' }}>
            Your <span className="hc-serif" style={{ color: 'var(--hc-brand)', fontSize: '1.1em' }}>details</span>
          </h1>
        </div>
        {resumeId && (
          <div role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--hc-success)', fontWeight: 600 }}>
            <Check size={14} strokeWidth={2.6} aria-hidden="true" />Saved
          </div>
        )}
      </div>

      <nav aria-label="Steps" style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 999, padding: 5, width: 'fit-content', maxWidth: '100%' }}>
        {ORDER.map((k, i) => {
          const done = i < idx;
          const cur = i === idx;
          return (
            <button
              key={k} type="button" onClick={() => goStep(k)} aria-current={cur ? 'step' : undefined}
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
          {tailoring && (
            <div style={{ background: '#FFFFFF', border: '1px solid #C9D3F7', borderRadius: 16 }}>
              <button type="button" onClick={() => setJdOpen((o) => !o)} aria-expanded={jdOpen} style={{ width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 14, color: 'var(--hc-ink)', cursor: 'pointer', textAlign: 'left' }}>
                <Sparkles size={16} color="var(--hc-brand)" aria-hidden="true" />
                <span style={{ flex: 1, minWidth: 0 }}><span style={{ color: 'var(--hc-ink-muted)' }}>Tailoring to:</span> <strong>{[meta.role, meta.company].filter(Boolean).join(' · ') || 'your job description'}</strong></span>
                <ChevronDown size={16} aria-hidden="true" style={{ flex: 'none', transition: 'transform .2s ease', transform: `rotate(${jdOpen ? 180 : 0}deg)` }} />
              </button>
              {jdOpen && <div className="hc-rise" style={{ margin: '0 16px 16px', padding: '14px 16px', background: 'var(--hc-ground)', border: '1px solid var(--hc-hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-line', maxHeight: 240, overflow: 'auto' }}>{jd}</div>}
            </div>
          )}

          <section className="hc-card" aria-labelledby="step-title" style={{ padding: 22 }}>
            <h2 id="step-title" className="hc-disp" style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{TITLES[step]}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 14.5, color: 'var(--hc-ink-muted)' }}>{subs[step]}</p>

            {step === 'personal' && (
              <div key="personal" className="hc-g2 hc-rise" style={{ marginTop: 18 }}>
                {PERSONAL_FIELDS.map(([k, label, type]) => <Field key={k} id={`p-${k}`} label={label} type={type} value={doc.personal[k]} onChange={(v) => setPersonal(k, v)} />)}
              </div>
            )}

            {step === 'experience' && (
              <div key="experience" className="hc-rise" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {tailoring && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#F7F8FD', border: '1px solid var(--hc-hairline)', borderRadius: 14, padding: '10px 12px 10px 14px' }}>
                    <span style={{ fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>Tailor every bullet you haven’t edited by hand.</span>
                    <button type="button" className="hc-btn-sm" onClick={tailorAll} style={{ border: 0, background: 'var(--hc-brand)', color: '#FFFFFF', minHeight: 40, padding: '0 14px' }}>
                      <Sparkles size={14} aria-hidden="true" />Tailor all bullets
                    </button>
                  </div>
                )}
                {doc.roles.map((r) => (
                  <div key={r.id} style={entryBox}>
                    <div className="hc-g2">
                      {ROLE_FIELDS.map(([k, label]) => <Field key={k} id={`${r.id}-${k}`} label={label} value={r[k]} onChange={(v) => patchEntry('roles', r.id, { [k]: v })} />)}
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
                {doc.projects.map((p) => (
                  <div key={p.id} style={entryBox}>
                    <div className="hc-g2">
                      <Field id={`${p.id}-name`} label="Project name" value={p.name} placeholder="e.g. Rate limiter" onChange={(v) => patchEntry('projects', p.id, { name: v })} />
                      <Field id={`${p.id}-tech`} label="Tech used" value={p.tech} placeholder="e.g. Go, Redis" onChange={(v) => patchEntry('projects', p.id, { tech: v })} />
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
                {doc.education.map((e) => (
                  <div key={e.id} className="hc-g2" style={{ border: '1px solid var(--hc-hairline)', borderRadius: 16, padding: 16 }}>
                    {EDU_FIELDS.map(([k, label]) => <Field key={k} id={`${e.id}-${k}`} label={label} value={e[k]} onChange={(v) => patchEntry('education', e.id, { [k]: v })} />)}
                  </div>
                ))}
                <div><button type="button" className="hc-add" onClick={() => addEntry('education', blankEducation())}>+ Add education</button></div>
              </div>
            )}

            {step === 'skills' && (
              <div key="skills" className="hc-rise" style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {SKILL_GROUPS.map(([k, label]) => <SkillChips key={k} id={`sk-${k}`} label={label} values={doc.skills[k]} onChange={(v) => setSkills(k, v)} />)}
                {tailoring && (init.suggestions.length > 0) && (
                  // TAIL-6: JD skills the profile lacks are offered, never added automatically.
                  <div style={{ background: '#F7F8FD', border: '1px solid #C9D3F7', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ fontSize: 14, lineHeight: 1.5 }}><strong>The JD also mentions: {init.suggestions.join(', ')}.</strong> <span style={{ color: 'var(--hc-ink-muted)' }}>Add only skills you really have.</span></div>
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
                : <button type="button" className="hc-btn-s" onClick={() => goStep(ORDER[idx - 1])}><ArrowLeft size={15} aria-hidden="true" />Back</button>}
              {idx < ORDER.length - 1
                ? <button type="button" className="hc-btn-p" onClick={() => goStep(ORDER[idx + 1])}>Next: {LABELS[ORDER[idx + 1]]}<ArrowRight size={15} aria-hidden="true" /></button>
                : <button type="button" className="hc-btn-p" onClick={finish}>Preview<ArrowRight size={15} aria-hidden="true" /></button>}
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
