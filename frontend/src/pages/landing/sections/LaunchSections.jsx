import { Reveal } from './parts';

const fitScreenshot = `${import.meta.env.BASE_URL}images/cv-fit-analysis.png`;

const scoreCards = [
  ['keywords', 'Keyword match: 50%. Shows terms that appear in the CV and terms that are missing.'],
  ['experience', 'Experience match: 90%. Shows how well the candidate meets each requirement.'],
  ['narrative', 'JD–CV narrative alignment: 100%. Compares the job description with the top third of the CV and suggests an edit.'],
];

export function FitPreview() {
  return (
    <section id="fit" className="launch-section fit-section" aria-labelledby="fit-title">
      <div className="wrap frame sec"><Reveal>
        <span className="lbl">03 · CV fit</span>
        <h2 id="fit-title" className="h2">See how your CV reads to recruiters <span className="lead">before you apply.</span></h2>
        <p className="sub">Check keyword coverage for ATS, compare your experience against the job requirements and see what the top of your CV communicates to a recruiter.</p>
        <figure className="fit-example">
          <img className="fit-desktop" src={fitScreenshot} width="1561" height="820" loading="lazy"
            alt={scoreCards.map(([, description]) => description).join(' ')} />
          <div className="fit-mobile">{scoreCards.map(([key, description]) => (
            <div key={key} className={`fit-slice fit-${key}`}>
              <img src={fitScreenshot} width="1561" height="820" loading="lazy" alt={description} />
            </div>
          ))}</div>
          <figcaption>Example analysis for an AI graduate program.</figcaption>
        </figure>
      </Reveal></div>
    </section>
  );
}

const applications = [
  ['Kaveri Labs', 'Junior Backend Engineer', 'Backend CV', 'Interview'],
  ['Deccan Systems', 'Software Engineer', 'API CV', 'Applied'],
  ['Marina Studio', 'Backend Trainee', 'Trainee CV', 'Applied'],
];

export function TrackerPreview() {
  return (
    <section id="tracking" className="launch-section" aria-labelledby="tracking-title">
      <div className="wrap frame sec"><Reveal className="launch-split">
        <div><span className="lbl">04 · Track</span>
          <h2 id="tracking-title" className="h2">Track every application and the CV you prepared for it.</h2>
          <p className="sub">When a recruiter calls, open the role, job description and saved CV together. Update the status as your application moves forward.</p>
        </div>
        <div className="review-sheet"><div className="sheet-heading"><strong>My applications</strong><span className="tag">Sample history</span></div>
          <table className="history-table"><thead><tr><th>Company &amp; role</th><th>Saved CV</th><th>Status</th></tr></thead>
            <tbody>{applications.map(([company, role, cv, status]) => <tr key={company}><td><strong>{company}</strong><small>{role}</small></td><td>{cv}</td><td><span className={status === 'Interview' ? 'interview-state' : 'applied-state'}>{status}</span></td></tr>)}</tbody>
          </table>
        </div>
      </Reveal></div>
    </section>
  );
}
