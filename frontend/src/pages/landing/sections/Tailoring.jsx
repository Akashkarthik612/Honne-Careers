import { useState } from 'react';
import { Reveal } from './parts';

const original = 'Built a campus placement tracker as a final-year project.';
const tailored = 'Built and tested REST endpoints for a campus placement tracker using Python, FastAPI and PostgreSQL.';

export default function Tailoring() {
  const [isTailored, setTailored] = useState(true);
  return (
    <section id="tailor" className="launch-section" aria-labelledby="tailor-title">
      <div className="wrap frame sec"><Reveal className="launch-split">
        <div>
          <span className="lbl">02 · Tailor</span>
          <h2 id="tailor-title" className="h2">Tailor every resume for the role.</h2>
          <p className="sub">Paste a job description. Honne highlights the requirements and brings relevant experience from your profile into the CV. You can review the draft before downloading it.</p>
        </div>
        <div className="review-sheet">
          <div className="sheet-heading"><strong>Junior Backend Engineer</strong><span className="tag">Sample job</span></div>
          <div className="review-excerpt">
            <small>Job description</small>
            <p>Build and test <mark>REST APIs</mark> using <mark>Python</mark> and <mark>PostgreSQL</mark>. Docker experience is a plus.</p>
          </div>
          <div className="check-options" role="group" aria-label="CV version">
            <button type="button" aria-pressed={!isTailored} onClick={() => setTailored(false)}>Original bullet</button>
            <button type="button" aria-pressed={isTailored} onClick={() => setTailored(true)}>Tailored bullet</button>
          </div>
          <p className="check-result rise" key={isTailored} aria-live="polite">{isTailored ? tailored : original}</p>
          <small className="tailor-gap">Flagged for review · Docker is missing from the sample profile.</small>
        </div>
      </Reveal></div>
    </section>
  );
}
