import { SAMPLE_CV } from '@/data/sampleCv';

// One-page CV in the two P1 templates (PDF-1). Switching template only restyles; content is unchanged.

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

export default function CvDoc({ template = 'jake', cv = SAMPLE_CV }) {
  const s = templateStyles(template);
  return (
    <div style={{ width: '100%', background: '#FFFFFF', padding: '36px 40px', fontFamily: '"Times New Roman", Times, Georgia, serif', color: '#111', fontSize: 11.5, lineHeight: 1.38, textAlign: 'left' }}>
      <div style={s.name}>{cv.name}</div>
      <div style={s.contact}>{cv.contact.join(' | ')}</div>

      <div style={s.head}>Experience</div>
      {cv.experience.map((job, i) => (
        <div key={i} style={{ marginTop: i === 0 ? 4 : 2 }}>
          <div style={row}><b>{job.role}</b><span>{job.dates}</span></div>
          <div style={{ ...row, fontStyle: 'italic' }}><span>{job.company}</span><span>{job.location}</span></div>
          <ul style={list}>{job.bullets.map((b, j) => <li key={j} style={{ margin: '1px 0' }}>{b}</li>)}</ul>
        </div>
      ))}

      <div style={s.head}>Projects</div>
      {cv.projects.map((p, i) => (
        <div key={i} style={{ marginTop: 4 }}>
          <div style={row}><span><b>{p.name}</b> | <span style={{ fontStyle: 'italic' }}>{p.tech}</span></span><span>{p.year}</span></div>
          <ul style={list}>{p.bullets.map((b, j) => <li key={j} style={{ margin: '1px 0' }}>{b}</li>)}</ul>
        </div>
      ))}

      <div style={s.head}>Education</div>
      {cv.education.map((e, i) => (
        <div key={i} style={{ marginTop: 4 }}>
          <div style={row}><b>{e.school}</b><span>{e.location}</span></div>
          <div style={{ ...row, fontStyle: 'italic' }}><span>{e.degree}</span><span>{e.years}</span></div>
        </div>
      ))}

      <div style={s.head}>Technical Skills</div>
      <div style={{ marginTop: 4 }}>
        {cv.skills.map(([label, value]) => <div key={label}><b>{label}:</b> {value}</div>)}
      </div>
    </div>
  );
}
