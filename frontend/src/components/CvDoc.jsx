// One-page CV in the P1 templates (PDF-1). Switching template only restyles; content is unchanged.
// `focus` highlights the section being edited in the wizard's live preview.
import { Fragment } from 'react';
import { boldParts } from '@/data/cvModel';

const row = { display: 'flex', justifyContent: 'space-between', gap: 12 };
const list = { margin: '3px 0 6px', paddingLeft: 16 };

function templateStyles(template) {
  const elegant = template === 'elegant';
  const ink = elegant ? '#1F3A8A' : '#111111';
  return {
    name: { textAlign: 'center', fontSize: 26, letterSpacing: '.01em', lineHeight: 1.1, color: ink, fontWeight: 700, fontStyle: elegant ? 'italic' : 'normal' },
    contact: { textAlign: 'center', fontSize: 10.5, marginTop: 6, color: ink, fontStyle: elegant ? 'italic' : 'normal' },
    head: {
      marginTop: 12, paddingBottom: 2, fontSize: 13.5, color: ink,
      borderBottom: elegant ? '1px solid #8FA3D9' : '1px solid #111111',
      ...(elegant ? { fontStyle: 'italic', fontWeight: 700 } : { fontVariant: 'small-caps', letterSpacing: '.04em' }),
    },
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
          {c.href ? <a href={c.href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>{c.text}</a> : c.text}
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

export default function CvDoc({ cv, template = 'jake', focus = null }) {
  const s = templateStyles(template);
  return (
    <div style={{ width: '100%', background: '#FFFFFF', padding: '36px 40px', fontFamily: '"Times New Roman", Times, Georgia, serif', color: '#111', fontSize: 11.5, lineHeight: 1.38, textAlign: 'left' }}>
      <Section id="personal" focus={focus}>
        <div style={s.name}>{cv.name || 'Your name'}</div>
        {cv.contact.length > 0 && <Contact items={cv.contact} style={s.contact} />}
      </Section>

      {cv.experience.length > 0 && (
        <Section id="experience" focus={focus}>
          <div style={s.head}>Experience</div>
          {cv.experience.map((job, i) => (
            <div key={i} style={{ marginTop: i === 0 ? 4 : 2 }}>
              <div style={row}><b>{job.role}</b><span>{job.dates}</span></div>
              <div style={{ ...row, fontStyle: 'italic' }}><span>{job.company}</span><span>{job.location}</span></div>
              {job.bullets.length > 0 && <ul style={list}>{job.bullets.map((b, j) => <li key={j} style={{ margin: '1px 0' }}><BulletText text={b} /></li>)}</ul>}
            </div>
          ))}
        </Section>
      )}

      {cv.projects.length > 0 && (
        <Section id="projects" focus={focus}>
          <div style={s.head}>Projects</div>
          {cv.projects.map((p, i) => (
            <div key={i} style={{ marginTop: 4 }}>
              <div style={row}><span><b>{p.name}</b>{p.tech && <> | <span style={{ fontStyle: 'italic' }}>{p.tech}</span></>}</span><span>{p.year}</span></div>
              {p.bullets.length > 0 && <ul style={list}>{p.bullets.map((b, j) => <li key={j} style={{ margin: '1px 0' }}><BulletText text={b} /></li>)}</ul>}
            </div>
          ))}
        </Section>
      )}

      {cv.education.length > 0 && (
        <Section id="education" focus={focus}>
          <div style={s.head}>Education</div>
          {cv.education.map((e, i) => (
            <div key={i} style={{ marginTop: 4 }}>
              <div style={row}><b>{e.school}</b><span>{e.location}</span></div>
              <div style={{ ...row, fontStyle: 'italic' }}><span>{e.degree}</span><span>{e.years}</span></div>
            </div>
          ))}
        </Section>
      )}

      {cv.skills.length > 0 && (
        <Section id="skills" focus={focus}>
          <div style={s.head}>Technical Skills</div>
          <div style={{ marginTop: 4 }}>
            {cv.skills.map(([label, value]) => <div key={label}><b>{label}:</b> {value}</div>)}
          </div>
        </Section>
      )}
    </div>
  );
}

// A CV scaled down to a card thumbnail: a 794px-wide page at 30%, centred in a grey well.
export function CvThumb({ cv, height = 200, radius = '19px 19px 0 0' }) {
  return (
    <div aria-hidden="true" style={{ position: 'relative', height, overflow: 'hidden', background: '#EEF0F5', borderRadius: radius }}>
      <div style={{ position: 'absolute', top: 16, left: '50%', width: 794, marginLeft: -397, transform: 'scale(.3)', transformOrigin: 'top center', boxShadow: '0 10px 40px rgba(22,26,43,.18)' }}>
        <CvDoc cv={cv} />
      </div>
    </div>
  );
}
