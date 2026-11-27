import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
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

const plans = [
  {
    name: 'Free',
    price: '0',
    description: 'For your first few applications.',
    features: [
      ['5 tailored CVs per week', 'Use a job description to tailor your CV and download it as a PDF.'],
      ['Free ATS check', 'See how your CV matches the role and where important keywords are missing.'],
    ],
  },
  {
    name: 'Job Search',
    price: '399',
    standardPrice: '549',
    description: 'For an active job search, from the first CV to the follow-up.',
    features: [
      ['Unlimited CVs per month', 'No separate monthly cap. Up to 30 full CV tailoring runs per day.'],
      ['ATS checks and job-specific rewrites', 'Check your match and rewrite relevant CV bullets for the job description, at no extra charge.'],
      ['Save and track applications', 'Keep each job description, the CV you prepared, and the status together.'],
      ['Honne IQ trial pack', 'Limited access to Outreach and Strategist to draft follow-ups and review patterns across saved applications.'],
    ],
  },
  {
    name: 'Honne Pro',
    price: '1,299',
    description: 'For applicants preparing for technical interviews.',
    features: [
      ['Everything in Job Search', 'Tailor, save and track applications throughout your search.'],
      ['Specialist and custom AI agents', 'Use the full specialist team or build an agent around your own workflow.'],
      ['Role-specific interview prep', 'Practise technical and behavioural questions using the job description and your experience.'],
      ['Interview prep roadmaps · planned', 'The goal is to curate study plans with engineers from leading companies and research institutes in Europe and India.'],
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="launch-section pricing-section" aria-labelledby="pricing-title">
      <div className="wrap frame sec"><Reveal>
        <span className="lbl">Pricing in India</span>
        <h2 id="pricing-title" className="h2">From your first CV to your next interview.</h2>
        <p className="sub">Start with a free ATS check. Tailor more CVs, keep track of applications, and prepare for interviews as your search progresses.</p>
        <div className="launch-plans">{plans.map(({ name, price, standardPrice, description, features }) =>
          <article key={name} className={`plan-card${standardPrice ? ' plan-card-featured' : ''}`}>
            <div className="plan-heading">
              <h3>{name}</h3>
              {standardPrice && <span className="tag">Launch offer</span>}
            </div>
            <p className="plan-description">{description}</p>
            <p className="plan-price">₹{price}<small> / month</small></p>
            {standardPrice && <p className="plan-standard">Standard price ₹{standardPrice}/month</p>}
            {price === '0'
              ? <Link className="btn-s plan-action" to="/new/template">Start free</Link>
              : <p className="plan-availability">Paid access coming soon</p>}
            <ul className="plan-features">{features.map(([label, detail]) => (
              <li key={label}>
                <Check size={16} aria-hidden="true" />
                <div><strong>{label}</strong><span>{detail}</span></div>
              </li>
            ))}</ul>
          </article>
        )}</div>
        <div className="pricing-questions">
          <details>
            <summary>How does the 30 CVs per day limit work?</summary>
            <p>Job Search has no separate monthly quota. You can run up to 30 full CV tailorings each day.</p>
          </details>
          <details>
            <summary>Can I try Honne before paying?</summary>
            <p>Yes. Free includes five full CV tailorings a week, ATS checks, and PDF downloads. Paid checkout is coming soon.</p>
          </details>
        </div>
      </Reveal></div>
    </section>
  );
}
