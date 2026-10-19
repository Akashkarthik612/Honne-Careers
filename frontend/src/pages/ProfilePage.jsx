import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import PageTitle from '@/components/PageTitle';
import SkillChips from '@/components/SkillChips';
import { ErrorBanner, PageLoading } from '@/components/Status';
import { contentToProfile, profileToContentIn, timeAgo, validateDoc } from '@/data/cvAdapter';
import { SKILL_GROUPS, blankEducation, blankProject, blankRole, emptyProfile, newId, profileSections, toDoc } from '@/data/cvModel';
import useResource from '@/hooks/useResource';
import { getProfile, saveProfile } from '@/services/api';
import { ApiError } from '@/services/apiClient';

// "Your profile" (design: Profile.dc.html). The user's own facts (PROF-1); every new resume starts here.
// Rough notes are fine (PROF-6); every section takes more than one entry (PROF-7).
// GET /profile (404 = no profile yet) and PUT /profile with expected_version (409 = changed elsewhere).

const PERSONAL_FIELDS = [['name', 'Full name'], ['city', 'City, country'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['linkedin', 'LinkedIn', 'url'], ['github', 'GitHub or portfolio', 'url']];
const ROLE_FIELDS = [['role', 'Role'], ['company', 'Company'], ['start', 'Start'], ['end', 'End'], ['location', 'Location']];
const EDU_FIELDS = [['school', 'School'], ['degree', 'Degree'], ['years', 'Years'], ['city', 'City']];
const SECTION_IDS = { personal: 'pf-personal', experience: 'pf-exp', projects: 'pf-proj', education: 'pf-edu', skills: 'pf-skills' };

const entryBox = { border: '1px solid var(--hc-hairline)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 };

function Field({ id, label, value, onChange, type = 'text', error }) {
  return (
    <div className="hc-f">
      <label className="hc-flabel" htmlFor={id}>{label}</label>
      <input id={id} className="hc-in" type={type} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined} onChange={(e) => onChange(e.target.value)} />
      {error && <span id={`${id}-err`} style={{ fontSize: 12.5, color: 'var(--hc-warm)', fontWeight: 600 }}>{error}</span>}
    </div>
  );
}

function SectionHead({ num, id, title, section }) {
  const tag = section.complete
    ? <span className="hc-tag" style={{ background: '#E8F5EC', color: 'var(--hc-success)' }}>Complete</span>
    : <span className="hc-tag" style={{ background: '#FFF4EE', color: '#B45309' }}>{section.hint || 'To do'}</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <span className="hc-num">{num}</span>
      <h2 id={id} className="hc-disp" style={{ margin: 0, fontSize: 20, fontWeight: 800, flex: 1 }}>{title}</h2>
      {tag}
    </div>
  );
}

function Bullets({ entry, label, hint, onChange }) {
  const set = (bullets) => onChange({ bullets });
  return (
    <>
      <div className="hc-flabel">{label} {hint && <span style={{ fontWeight: 500, color: 'var(--hc-ink-muted)' }}>{hint}</span>}</div>
      {entry.bullets.map((b, i) => (
        <div key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <label className="hc-sr-only" htmlFor={b.id}>{`Bullet ${i + 1}`}</label>
          <textarea id={b.id} className="hc-ta" rows={2} value={b.text} onChange={(e) => set(entry.bullets.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)))} />
          <button type="button" onClick={() => set(entry.bullets.filter((x) => x.id !== b.id))} aria-label={`Remove bullet ${i + 1}`} style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
      <div><button type="button" className="hc-add" onClick={() => set([...entry.bullets, { id: newId('b'), text: '' }])}>+ Add bullet</button></div>
    </>
  );
}

async function loadProfile() {
  const p = await getProfile();
  return p ? { profile: contentToProfile(p.content), version: p.row_version, updatedAt: p.updated_at } : { profile: emptyProfile(), version: null, updatedAt: null };
}

export default function ProfilePage() {
  const res = useResource(loadProfile);
  const wrap = (children) => <main style={{ maxWidth: 880, margin: '0 auto', padding: '28px 20px 120px' }}>{children}</main>;
  if (res.loading) return wrap(<PageLoading label="Loading your profile…" />);
  if (res.error) return wrap(<ErrorBanner error={res.error} action={{ label: 'Retry', onClick: res.reload }} />);
  return <ProfileForm key={res.data.version ?? 'new'} initial={res.data} onReload={res.reload} />;
}

function ProfileForm({ initial, onReload }) {
  const [profile, setProfile] = useState(initial.profile);
  const [version, setVersion] = useState(initial.version);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [errors, setErrors] = useState({});
  const [openRole, setOpenRole] = useState(initial.profile.roles[0]?.id ?? null);

  const sections = profileSections(profile);
  const bySection = Object.fromEntries(sections.map((s) => [s.key, s]));
  const done = sections.filter((s) => s.complete).length;

  const update = (fn) => { setProfile(fn); setDirty(true); setJustSaved(false); };
  const setPersonal = (k, v) => update((p) => ({ ...p, personal: { ...p.personal, [k]: v } }));
  const patch = (key, id, change) => update((p) => ({ ...p, [key]: p[key].map((e) => (e.id === id ? { ...e, ...change } : e)) }));
  const add = (key, entry) => update((p) => ({ ...p, [key]: [...p[key], entry] }));

  function addRole() {
    const role = { ...blankRole(), bullets: [{ id: newId('b'), text: '' }] };
    add('roles', role);
    setOpenRole(role.id);
  }

  async function save() {
    const found = validateDoc(toDoc(profile));
    setErrors(found);
    const badRole = profile.roles.find((r) => found[`${r.id}.company`] || found[`${r.id}.start`]);
    if (badRole) setOpenRole(badRole.id);
    if (Object.keys(found).length) return;
    setSaving(true);
    setSaveError(null);
    try {
      const r = await saveProfile(profileToContentIn(profile), version);
      setVersion(r.row_version);
      setDirty(false);
      setJustSaved(true);
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      setSaveError(e);
    } finally {
      setSaving(false);
    }
  }

  const stale = saveError?.code === 'stale_version';
  const invalid = Object.keys(errors).length > 0;
  const status = saving ? { text: 'Saving…', color: 'var(--hc-ink-muted)' }
    : invalid ? { text: 'Fix the highlighted fields to save.', color: 'var(--hc-warm)' }
      : dirty ? { text: 'You have unsaved changes.', color: '#B45309' }
        : justSaved ? { text: 'Saved ✓ — new resumes will use this.', color: 'var(--hc-success)' }
          : { text: initial.updatedAt ? timeAgo(initial.updatedAt) : 'Not saved yet.', color: 'var(--hc-ink-muted)' };

  return (
    <>
      <main style={{ maxWidth: 880, margin: '0 auto', padding: '28px 20px 120px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <PageTitle before="Your" accent="profile" size="clamp(30px,3.4vw,42px)" />
            <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--hc-ink-muted)', maxWidth: 560 }}>Everything we know about your work. Every new resume starts from here — and we never add anything that isn’t in it.</p>
          </div>
          <span className="hc-tag" style={{ background: 'var(--hc-brand-tint)', color: 'var(--hc-brand-hover)', fontSize: 12.5, padding: '6px 12px' }}>{done} of 5 sections complete</span>
        </div>

        <nav aria-label="Profile sections" style={{ marginTop: 16, display: 'flex', gap: 2, overflowX: 'auto', background: '#EEF0F5', borderRadius: 999, padding: 4, width: 'fit-content', maxWidth: '100%' }}>
          {sections.map((s) => <a key={s.key} className="hc-jump" href={`#${SECTION_IDS[s.key]}`}>{s.label}</a>)}
        </nav>

        <ErrorBanner error={saveError} action={stale ? { label: 'Reload', onClick: onReload } : { label: 'Dismiss', onClick: () => setSaveError(null) }} />

        <form onSubmit={(e) => { e.preventDefault(); save(); }} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section id="pf-personal" className="hc-card hc-sec" aria-labelledby="h-personal">
            <SectionHead num={1} id="h-personal" title="Personal details" section={bySection.personal} />
            <div className="hc-g2">
              {PERSONAL_FIELDS.map(([k, label, type]) => <Field key={k} id={`pf-${k}`} label={label} type={type} value={profile.personal[k]} error={errors[`personal.${k}`]} onChange={(v) => setPersonal(k, v)} />)}
            </div>
          </section>

          <section id="pf-exp" className="hc-card hc-sec" aria-labelledby="h-exp">
            <SectionHead num={2} id="h-exp" title="Experience" section={bySection.experience} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {profile.roles.map((r) => (openRole === r.id ? (
                <div key={r.id} style={entryBox}>
                  <div className="hc-g2">
                    {ROLE_FIELDS.map(([k, label]) => <Field key={k} id={`${r.id}-${k}`} label={label} value={r[k]} error={errors[`${r.id}.${k}`]} onChange={(v) => patch('roles', r.id, { [k]: v })} />)}
                  </div>
                  <Bullets entry={r} label="What you did" hint="— in your own words. Resumes tailor from these." onChange={(c) => patch('roles', r.id, c)} />
                </div>
              ) : (
                <div key={r.id} style={{ border: '1px solid var(--hc-hairline)', borderRadius: 16, padding: '14px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{[r.role, r.company].filter(Boolean).join(' · ') || 'Untitled role'}</div>
                    <div style={{ marginTop: 2, fontSize: 13, color: 'var(--hc-ink-muted)' }}>{[[r.start, r.end].filter(Boolean).join(' – '), r.location.split(',')[0], `${r.bullets.length} bullet${r.bullets.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</div>
                  </div>
                  <button type="button" className="hc-btn-s" style={{ minHeight: 40 }} onClick={() => setOpenRole(r.id)}>Edit</button>
                </div>
              )))}
            </div>
            <div style={{ marginTop: 12 }}><button type="button" className="hc-add" onClick={addRole}>+ Add another role</button></div>
          </section>

          <section id="pf-proj" className="hc-card hc-sec" aria-labelledby="h-proj">
            <SectionHead num={3} id="h-proj" title="Projects" section={bySection.projects} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {profile.projects.map((p) => (
                <div key={p.id} style={entryBox}>
                  <div className="hc-g2">
                    <Field id={`${p.id}-name`} label="Project name" value={p.name} error={errors[`${p.id}.name`]} onChange={(v) => patch('projects', p.id, { name: v })} />
                    <Field id={`${p.id}-tech`} label="Tech used" value={p.tech} onChange={(v) => patch('projects', p.id, { tech: v })} />
                  </div>
                  <Bullets entry={p} label="What it does, and any result" onChange={(c) => patch('projects', p.id, c)} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}><button type="button" className="hc-add" onClick={() => add('projects', { ...blankProject(), bullets: [{ id: newId('b'), text: '' }] })}>+ Add a project</button></div>
          </section>

          <section id="pf-edu" className="hc-card hc-sec" aria-labelledby="h-edu">
            <SectionHead num={4} id="h-edu" title="Education" section={bySection.education} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {profile.education.map((e) => (
                <div key={e.id} className="hc-g2" style={{ border: '1px solid var(--hc-hairline)', borderRadius: 16, padding: 16 }}>
                  {EDU_FIELDS.map(([k, label]) => <Field key={k} id={`${e.id}-${k}`} label={label} value={e[k]} error={errors[`${e.id}.${k}`]} onChange={(v) => patch('education', e.id, { [k]: v })} />)}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}><button type="button" className="hc-add" onClick={() => add('education', blankEducation())}>+ Add education</button></div>
          </section>

          <section id="pf-skills" className="hc-card hc-sec" aria-labelledby="h-skills">
            <SectionHead num={5} id="h-skills" title="Skills" section={bySection.skills} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {SKILL_GROUPS.map(([k, label]) => (
                <SkillChips key={k} id={`pf-sk-${k}`} label={label} values={profile.skills[k]} onChange={(v) => update((p) => ({ ...p, skills: { ...p.skills, [k]: v } }))} />
              ))}
            </div>
          </section>
        </form>
      </main>

      <div style={{ position: 'sticky', bottom: 0, zIndex: 20, background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderTop: '1px solid var(--hc-hairline)' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '12px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span role="status" style={{ fontSize: 13.5, fontWeight: 600, color: status.color }}>{status.text}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link className="hc-btn-s" to="/resumes">Back to resumes</Link>
            <button type="button" className="hc-btn-p is-lg" onClick={save} disabled={saving} aria-busy={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
          </div>
        </div>
      </div>
    </>
  );
}
