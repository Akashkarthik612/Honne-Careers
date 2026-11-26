import { useState } from 'react';
import { Reveal } from './parts';

const checks = [
  ['Keyword match', 'Python and PostgreSQL appear in both the job description and your project. Docker is also requested.'],
  ['Experience match', 'Your placement tracker demonstrates API development. The role also asks for testing experience.'],
  ['Narrative alignment', 'Lead with the API you built and tested. A recruiter can then connect your project to the backend role.'],
];

export function FitPreview() {
  const [selected, setSelected] = useState(0);
  return (
    <section id="fit" className="launch-section fit-section" aria-labelledby="fit-title">
      <div className="wrap frame sec">
        <Reveal className="launch-split">
          <div>
            <span className="lbl">CV fit</span>
            <h2 id="fit-title" className="h2">See how your CV reads to recruiters <span className="lead">before you apply.</span></h2>
            <p className="sub">Compare your CV with the job description. See which requirements your experience supports and which details deserve a clearer example.</p>
          </div>
          <div className="review-sheet">
            <div className="sheet-heading"><strong>Junior Backend Engineer</strong><span className="tag">Sample review</span></div>
            <div className="review-excerpt"><small>Arjun Mehta · Projects</small><p>Built a placement tracker with <mark>Python</mark> and <mark>PostgreSQL</mark>. Wrote tests for application status changes.</p></div>
            <div className="check-options" aria-label="Explore sample checks">{checks.map(([name], index) =>
              <button key={name} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{name}</button>
            )}</div>
            <p className="check-result" aria-live="polite">{checks[selected][1]}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const applications = [
  ['Kaveri Labs', 'Backend Trainee', 'Graduate', 'Interview'],
  ['Deccan Systems', 'Software Engineer', 'Jake’s Resume', 'Applied'],
  ['Marina Studio', 'Marketing Associate', 'Marketing', 'Applied'],
];

export function TrackerPreview() {
  return (
    <section id="tracking" className="launch-section" aria-labelledby="tracking-title">
      <div className="wrap frame sec"><Reveal className="launch-split">
        <div><span className="lbl">Application tracking</span>
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

const plans = [
  ['CV Builder', '399', '200 CVs per month', ['All seven templates', 'Tailored CVs and PDF downloads']],
  ['Job Search', '899', '300 CVs per month', ['Everything in CV Builder', 'Application tracking', 'Outreach and Strategist agents with saved application history']],
  ['Honne Pro', '1,299', 'Unlimited CVs', ['Everything in Job Search', 'Full AI feature access', 'All specialist agents and custom agents']],
];

export function Pricing() {
  return (
    <section id="pricing" className="launch-section" aria-labelledby="pricing-title">
      <div className="wrap frame sec"><Reveal>
        <span className="lbl">Monthly pricing</span>
        <h2 id="pricing-title" className="h2">Choose your job search plan.</h2>
        <p className="sub">Planned launch prices in India. You can try the app before billing opens.</p>
        <div className="launch-plans">{plans.map(([name, price, quota, features]) =>
          <article key={name} className="plan-card"><h3>{name}</h3><p className="plan-price">₹{price}<small> / month</small></p>
            <strong>{quota}</strong><ul>{features.map(feature => <li key={feature}>{feature}</li>)}</ul>
          </article>
        )}</div>
      </Reveal></div>
    </section>
  );
}
