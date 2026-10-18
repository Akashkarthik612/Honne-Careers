import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import AppHeader, { Avatar } from '@/components/AppHeader';
import { Wordmark } from '@/components/HonneMark';
import CvDoc from '@/components/CvDoc';
import { SAMPLE_CV } from '@/data/sampleCv';

// "Create your CV from scratch" (PROF-1, PROF-6, PROF-7). The form is the profile; every tailored CV is
// built from it. Saving is local until the profile API exists — it returns to the studio's "saved" state.

const SECTIONS = [
  ['p-personal', 'Personal'], ['p-exp', 'Experience'], ['p-proj', 'Projects'], ['p-edu', 'Education'], ['p-skills', 'Skills'],
];

const EMPTY_ROLE = { role: '', company: '', start: '', end: '', notes: '' };
const EMPTY_PROJECT = { name: '', tech: '', notes: '' };
const EMPTY_EDU = { school: '', degree: '', years: '', city: '' };

const PERSONAL_FIELDS = [
  ['name', 'Full name', 'text', 'Arjun Mehta'],
  ['city', 'City, country', 'text', 'Chennai, India'],
  ['email', 'Email', 'email', 'arjun.mehta@mail.com'],
  ['phone', 'Phone', 'tel', '+91 98xxx xxxxx'],
  ['linkedin', 'LinkedIn', 'url', 'linkedin.com/in/arjunmehta'],
  ['github', 'GitHub or portfolio', 'url', 'github.com/arjunm'],
];
const SKILL_FIELDS = [
  ['languages', 'Languages', 'Java, Python, SQL'],
  ['frameworks', 'Frameworks', 'Spring Boot, Kafka Streams, JUnit'],
  ['tools', 'Cloud & tools', 'AWS, Docker, Git, Grafana'],
];

// Rough notes → preview lines. The real bullets are written by the tailoring step, from these facts only.
const notesToLines = (notes) => notes.split(/\n|(?<=\.)\s+/).map((s) => s.trim().replace(/\.$/, '')).filter(Boolean);
const hasAny = (obj) => Object.values(obj).some((v) => (Array.isArray(v) ? v.some(hasAny) : typeof v === 'object' ? hasAny(v) : String(v).trim()));

function toCv(p) {
  return {
    name: p.personal.name || 'Your name',
    contact: [p.personal.city, p.personal.phone, p.personal.email, p.personal.linkedin, p.personal.github].filter(Boolean),
    experience: p.roles.filter(hasAny).map((r) => ({
      role: r.role, company: r.company, location: '', dates: [r.start, r.end].filter(Boolean).join(' – '), bullets: notesToLines(r.notes),
    })),
    projects: p.projects.filter(hasAny).map((pr) => ({ name: pr.name, tech: pr.tech, year: '', bullets: notesToLines(pr.notes) })),
    education: p.education.filter(hasAny).map((e) => ({ school: e.school, location: e.city, degree: e.degree, years: e.years })),
    skills: SKILL_FIELDS.map(([key, label]) => [label, p.skills[key]]).filter(([, v]) => v),
  };
}

function Field({ id, label, value, onChange, type = 'text', placeholder }) {
  return (
    <div className="hc-f">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="hc-field" style={{ minHeight: 44, fontSize: 14.5 }} type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Notes({ id, label, value, onChange, placeholder }) {
  return (
    <div className="hc-f">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} className="hc-ta" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Section({ id, num, title, children }) {
  return (
    <section id={id} className="hc-card" style={{ padding: 22, scrollMarginTop: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span className="hc-num">{num}</span>
        <h2 className="hc-disp" style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

const entryBox = { border: '1px solid var(--hc-hairline)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 };

export default function ProfilePage() {
  const navigate = useNavigate();
  const [active, setActive] = useState('p-personal');
  const [personal, setPersonal] = useState({ name: '', city: '', email: '', phone: '', linkedin: '', github: '' });
  const [roles, setRoles] = useState([EMPTY_ROLE]);
  const [projects, setProjects] = useState([EMPTY_PROJECT]);
  const [education, setEducation] = useState([EMPTY_EDU]);
  const [skills, setSkills] = useState({ languages: '', frameworks: '', tools: '' });

  const profile = { personal, roles, projects, education, skills };
  const started = hasAny(profile);
  const cv = useMemo(() => (started ? toCv({ personal, roles, projects, education, skills }) : SAMPLE_CV), [started, personal, roles, projects, education, skills]);

  const edit = (setList, i, key) => (v) => setList((list) => list.map((item, j) => (j === i ? { ...item, [key]: v } : item)));

  function handleSubmit(e) {
    e.preventDefault();
    navigate('/home?state=profile');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--hc-app-ground)' }}>
      <AppHeader>
        <Link to="/home" style={{ textDecoration: 'none', color: 'var(--hc-ink-muted)', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44 }}>
          <ArrowLeft size={16} aria-hidden="true" />Back to CV studio
        </Link>
        <Wordmark />
        <Avatar initials="AM" />
      </AppHeader>

      <main style={{ maxWidth: 1600, margin: '0 auto', padding: '24px 24px 64px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 className="hc-disp" style={{ margin: 0, fontSize: 'clamp(28px,3vw,38px)', lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.035em' }}>
              Create your CV <span className="hc-serif" style={{ color: 'var(--hc-brand)', fontSize: '1.1em' }}>from scratch</span>
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--hc-ink-muted)' }}>Fill this in once. It becomes your profile — every tailored CV is built from it.</p>
          </div>
          <nav aria-label="Sections" style={{ display: 'flex', flexWrap: 'wrap', gap: 2, background: '#EEF0F5', borderRadius: 999, padding: 4 }}>
            {SECTIONS.map(([id, name], i) => (
              <a key={id} className={'hc-step' + (active === id ? ' is-active' : '')} href={`#${id}`} onClick={() => setActive(id)} aria-current={active === id ? 'location' : undefined}>
                {i + 1} · {name}
              </a>
            ))}
          </nav>
        </div>

        <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          <form onSubmit={handleSubmit} style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Section id="p-personal" num={1} title="Personal details">
              <div className="hc-g2">
                {PERSONAL_FIELDS.map(([key, label, type, ph]) => (
                  <Field key={key} id={`pf-${key}`} label={label} type={type} placeholder={ph} value={personal[key]} onChange={(v) => setPersonal((p) => ({ ...p, [key]: v }))} />
                ))}
              </div>
            </Section>

            <Section id="p-exp" num={2} title="Experience">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {roles.map((r, i) => (
                  <div key={i} style={entryBox}>
                    <div className="hc-g2">
                      <Field id={`e${i}r`} label="Role" placeholder="Software Engineer" value={r.role} onChange={edit(setRoles, i, 'role')} />
                      <Field id={`e${i}c`} label="Company" placeholder="Northwind Fintech" value={r.company} onChange={edit(setRoles, i, 'company')} />
                      <Field id={`e${i}s`} label="Start" placeholder="Jul 2021" value={r.start} onChange={edit(setRoles, i, 'start')} />
                      <Field id={`e${i}e`} label="End" placeholder="Present" value={r.end} onChange={edit(setRoles, i, 'end')} />
                    </div>
                    <Notes id={`e${i}d`} label="What did you do? Rough notes are fine." value={r.notes} onChange={edit(setRoles, i, 'notes')}
                      placeholder="Moved ledger service to Kafka Streams — p95 latency down ~38%. Owned settlement pipeline, 2M events/day. Mentored 2 interns." />
                    <div style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)', lineHeight: 1.5 }}>We turn your notes into “Accomplished X, measured by Y, by doing Z” bullets — and never add anything you didn’t do.</div>
                  </div>
                ))}
              </div>
              <button type="button" className="hc-add" style={{ marginTop: 12 }} onClick={() => setRoles((l) => [...l, EMPTY_ROLE])}>+ Add another role</button>
            </Section>

            <Section id="p-proj" num={3} title="Projects">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {projects.map((p, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="hc-g2">
                      <Field id={`pr${i}`} label="Project name" placeholder="Ledger-lite" value={p.name} onChange={edit(setProjects, i, 'name')} />
                      <Field id={`pr${i}t`} label="Tech used" placeholder="Java, Spring Boot, PostgreSQL, Docker" value={p.tech} onChange={edit(setProjects, i, 'tech')} />
                    </div>
                    <Notes id={`pr${i}d`} label="What it does, and any result" placeholder="Double-entry ledger, 1,000 TPS in k6 load tests." value={p.notes} onChange={edit(setProjects, i, 'notes')} />
                  </div>
                ))}
              </div>
              <button type="button" className="hc-add" style={{ marginTop: 12 }} onClick={() => setProjects((l) => [...l, EMPTY_PROJECT])}>+ Add a project</button>
            </Section>

            <Section id="p-edu" num={4} title="Education">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {education.map((ed, i) => (
                  <div key={i} className="hc-g2">
                    <Field id={`ed${i}`} label="School" placeholder="Anna University" value={ed.school} onChange={edit(setEducation, i, 'school')} />
                    <Field id={`ed${i}d`} label="Degree" placeholder="B.E. Computer Science and Engineering" value={ed.degree} onChange={edit(setEducation, i, 'degree')} />
                    <Field id={`ed${i}y`} label="Years" placeholder="2016 – 2020" value={ed.years} onChange={edit(setEducation, i, 'years')} />
                    <Field id={`ed${i}l`} label="City" placeholder="Chennai, India" value={ed.city} onChange={edit(setEducation, i, 'city')} />
                  </div>
                ))}
              </div>
              <button type="button" className="hc-add" style={{ marginTop: 12 }} onClick={() => setEducation((l) => [...l, EMPTY_EDU])}>+ Add education</button>
            </Section>

            <Section id="p-skills" num={5} title="Skills">
              <div className="hc-g2">
                {SKILL_FIELDS.map(([key, label, ph]) => (
                  <Field key={key} id={`sk-${key}`} label={label} placeholder={ph} value={skills[key]} onChange={(v) => setSkills((s) => ({ ...s, [key]: v }))} />
                ))}
              </div>
            </Section>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '4px 2px' }}>
              <span style={{ fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>You can edit your profile any time.</span>
              <button type="submit" className="hc-btn-p" style={{ minHeight: 48, padding: '0 22px' }}>
                Save profile &amp; start tailoring<ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </form>

          <aside className="hc-prev" aria-label="Live preview" style={{ flex: '1 1 520px', minWidth: 0 }}>
            <div className="hc-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '2px 4px 12px' }}>
                <span className="hc-disp" style={{ fontSize: 16, fontWeight: 700 }}>Live preview</span>
                <span style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>Jake’s Resume · {started ? 'your details' : 'sample data'}</span>
              </div>
              <div style={{ background: '#EEF0F5', borderRadius: 14, padding: 16, maxHeight: 'calc(100vh - 170px)', overflow: 'auto' }}>
                <div style={{ boxShadow: '0 12px 30px rgba(22,26,43,.10)', borderRadius: 4, overflow: 'hidden' }}>
                  <CvDoc template="jake" cv={cv} />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
