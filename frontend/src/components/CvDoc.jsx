// A CV in the P1 templates (PDF-1). Switching template only restyles; content is unchanged.
// This HTML is an approximation of the LaTeX PDF (different font engine): the PDF is the real output,
// so screens that show this for Honne Professional label it "approximate preview".
// `order` is the resume's section order (templates.js sectionOrderOf); `focus` highlights the section
// being edited in the wizard's live preview.
import { Fragment } from 'react';
import { boldParts } from '@/data/cvModel';
import { sectionOrderOf } from '@/data/templates';

const row = { display: 'flex', justifyContent: 'space-between', gap: 12 };
const list = { margin: '3px 0 6px', paddingLeft: 16 };
const link = { color: 'inherit', textDecoration: 'underline' };

function templateStyles(template) {
  if (template === 'honne_professional') {
    // Mirrors render/templates/professional.py: 10pt Latin Modern, bold small-caps rules, tight bullets.
    return {
      pro: true,
      page: { padding: '30px 34px', fontFamily: '"Latin Modern Roman", "CMU Serif", "Times New Roman", Times, serif', fontSize: 11, lineHeight: 1.32 },
      name: { textAlign: 'center', fontSize: 21, lineHeight: 1.1, fontWeight: 700 },
      contact: { textAlign: 'center', fontSize: 9.5, marginTop: 4 },
      head: { marginTop: 10, paddingBottom: 1, fontSize: 12, fontWeight: 700, fontVariant: 'small-caps', letterSpacing: '.03em', borderBottom: '1px solid #111111' },
      bullets: { margin: '2px 0 0', paddingLeft: 17, fontSize: 10.4 },
      small: { fontSize: 10.3 },
    };
  }
  const elegant = template === 'elegant';
  const ink = elegant ? '#1F3A8A' : '#111111';
  return {
    pro: false,
    page: { padding: '36px 40px', fontFamily: '"Times New Roman", Times, Georgia, serif', fontSize: 11.5, lineHeight: 1.38 },
    name: { textAlign: 'center', fontSize: 26, letterSpacing: '.01em', lineHeight: 1.1, color: ink, fontWeight: 700, fontStyle: elegant ? 'italic' : 'normal' },
    contact: { textAlign: 'center', fontSize: 10.5, marginTop: 6, color: ink, fontStyle: elegant ? 'italic' : 'normal' },
    head: {
      marginTop: 12, paddingBottom: 2, fontSize: 13.5, color: ink,
      borderBottom: elegant ? '1px solid #8FA3D9' : '1px solid #111111',
      ...(elegant ? { fontStyle: 'italic', fontWeight: 700 } : { fontVariant: 'small-caps', letterSpacing: '.04em' }),
    },
    bullets: list,
    small: null,
  };
}

// A bullet with its **bold** spans; text with malformed markers shows as typed (the field flags it).
export function BulletText({ text }) {
  const parts = boldParts(text);
  if (!parts) return text;
  return parts.map((p, i) => (p.bold ? <b key={i}>{p.text}</b> : <Fragment key={i}>{p.text}</Fragment>));
}

function Contact({ items, style }) {
  return (
    <div style={style}>
      {items.map((c, i) => (
        <Fragment key={i}>
          {i > 0 && ' | '}
          {c.href ? <a href={c.href} target="_blank" rel="noopener noreferrer" style={link}>{c.text}</a> : c.text}
        </Fragment>
      ))}
    </div>
  );
}

function Section({ id, focus, children }) {
  const on = focus === id;
  return (
    <div style={{ borderRadius: 4, transition: 'background-color .3s ease, box-shadow .3s ease', ...(on ? { background: '#EEF1FD', boxShadow: '0 0 0 8px #EEF1FD' } : null) }}>
      {children}
    </div>
  );
}

const Bullets = ({ items, style }) => (items.length > 0
  ? <ul style={style}>{items.map((b, j) => <li key={j} style={{ margin: '1px 0' }}><BulletText text={b} /></li>)}</ul>
  : null);

// One renderer per movable section (backend SectionKey). Each returns null when the section is empty.
// The wizard edits spoken languages and certifications on its Skills step, so they focus as 'skills'.
const SECTIONS = {
  experience: (cv, s, focus) => cv.experience.length > 0 && (
    <Section id="experience" focus={focus}>
      <div style={s.head}>{s.pro ? 'Professional Experience' : 'Experience'}</div>
      {cv.experience.map((job, i) => (
        <div key={i} style={{ marginTop: s.pro ? 6 : (i === 0 ? 4 : 2) }}>
          {s.pro ? (
            <>
              <div style={row}><b>{job.company}</b><span style={s.small}>{job.dates}</span></div>
              <div style={{ ...row, ...s.small }}><i>{job.role}</i><span>{job.location}</span></div>
            </>
          ) : (
            <>
              <div style={row}><b>{job.role}</b><span>{job.dates}</span></div>
              <div style={{ ...row, fontStyle: 'italic' }}><span>{job.company}</span><span>{job.location}</span></div>
            </>
          )}
          <Bullets items={job.bullets} style={s.bullets} />
        </div>
      ))}
    </Section>
  ),
  projects: (cv, s, focus) => cv.projects.length > 0 && (
    <Section id="projects" focus={focus}>
      <div style={s.head}>Projects</div>
      {cv.projects.map((p, i) => (
        <div key={i} style={{ marginTop: 4 }}>
          <div style={row}>
            <span>
              <b>{p.name}</b>
              {p.link && <> | <a href={p.link} target="_blank" rel="noopener noreferrer" style={link}>{s.pro ? 'View project' : 'Click here'}</a></>}
              {!s.pro && p.tech && <> | <span style={{ fontStyle: 'italic' }}>{p.tech}</span></>}
            </span>
            <span style={s.small}>{p.year}</span>
          </div>
          <Bullets items={p.bullets} style={s.bullets} />
        </div>
      ))}
    </Section>
  ),
  education: (cv, s, focus) => cv.education.length > 0 && (
    <Section id="education" focus={focus}>
      <div style={s.head}>Education</div>
      {cv.education.map((e, i) => (
        <div key={i} style={{ marginTop: 4 }}>
          {s.pro ? (
            <>
              <div style={row}><b>{e.school}</b><span style={s.small}>{e.years}</span></div>
              <div style={{ ...row, ...s.small }}><span>{e.degree}</span><span>{e.location}</span></div>
            </>
          ) : (
            <>
              <div style={row}><b>{e.school}</b><span>{e.location}</span></div>
              <div style={{ ...row, fontStyle: 'italic' }}><span>{e.degree}</span><span>{e.years}</span></div>
            </>
          )}
        </div>
      ))}
    </Section>
  ),
  skills: (cv, s, focus) => cv.skills.length > 0 && (
    <Section id="skills" focus={focus}>
      <div style={s.head}>Technical Skills</div>
      <div style={{ marginTop: 4, ...s.small }}>
        {cv.skills.map(([label, value]) => <div key={label}><b>{label}:</b> {value}</div>)}
      </div>
    </Section>
  ),
  certifications: (cv, s, focus) => cv.certifications.length > 0 && (
    <Section id="skills" focus={focus}>
      <div style={s.head}>Certifications</div>
      <div style={{ marginTop: 4, ...s.small }}>
        {s.pro
          ? cv.certifications.map((c, i) => <Fragment key={i}>{i > 0 && ' | '}{c}</Fragment>)
          : cv.certifications.map((c, i) => <div key={i}>{c}</div>)}
      </div>
    </Section>
  ),
  languages: (cv, s, focus) => cv.languages && (
    <Section id="skills" focus={focus}>
      <div style={s.head}>Languages</div>
      <div style={{ marginTop: 4, ...s.small }}>{cv.languages}</div>
    </Section>
  ),
};

export default function CvDoc({ cv, template = 'jake', order = null, focus = null }) {
  const s = templateStyles(template);
  const sections = order ?? sectionOrderOf({ template, sectionOrder: null });
  return (
    <div style={{ width: '100%', background: '#FFFFFF', color: '#111', textAlign: 'left', ...s.page }}>
      <Section id="personal" focus={focus}>
        <div style={s.name}>{cv.name || 'Your name'}</div>
        {cv.contact.length > 0 && <Contact items={cv.contact} style={s.contact} />}
      </Section>
      {sections.map((key) => <Fragment key={key}>{SECTIONS[key]?.(cv, s, focus) || null}</Fragment>)}
    </div>
  );
}

// A CV scaled down to a card thumbnail: a 794px-wide page at 30%, centred in a grey well.
export function CvThumb({ cv, template = 'jake', order = null, height = 200, radius = '19px 19px 0 0' }) {
  return (
    <div aria-hidden="true" style={{ position: 'relative', height, overflow: 'hidden', background: '#EEF0F5', borderRadius: radius }}>
      <div style={{ position: 'absolute', top: 16, left: '50%', width: 794, marginLeft: -397, transform: 'scale(.3)', transformOrigin: 'top center', boxShadow: '0 10px 40px rgba(22,26,43,.18)' }}>
        <CvDoc cv={cv} template={template} order={order} />
      </div>
    </div>
  );
}
