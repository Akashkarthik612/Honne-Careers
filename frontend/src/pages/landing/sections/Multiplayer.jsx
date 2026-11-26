import { useEffect, useState } from 'react';
import { useReducedMotion } from '../landingHooks';
import { Chevron, Reveal } from './parts';

const steps = ['Create an agent', 'Give it a prompt', 'Review the history', 'Get a strategy'];
const prompt = 'Review my last 50 saved applications. Where might I be targeting the wrong roles? Use the job requirements and recorded replies. Tell me what to change for my next 10 applications.';

export default function Multiplayer() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || reduce) return undefined;
    const timer = window.setTimeout(() => {
      if (step === steps.length - 1) setPlaying(false);
      else setStep(step + 1);
    }, step === 1 ? 5200 : 4000);
    return () => window.clearTimeout(timer);
  }, [playing, step, reduce]);

  function play() {
    if (reduce) {
      setStep((step + 1) % steps.length);
    } else if (playing) {
      setPlaying(false);
    } else {
      if (step === steps.length - 1) setStep(0);
      setPlaying(true);
    }
  }

  return (
    <section id="multiplayer" className="launch-section multiplayer-section" aria-labelledby="multiplayer-title">
      <div className="wrap frame sec">
        <Reveal className="launch-split">
          <div>
            <span className="lbl">05 · Multiplayer AI</span>
            <h2 id="multiplayer-title" className="h2">Build AI agents around <span className="lead">your job search.</span></h2>
            <p className="sub"><strong>Ran out of free AI credits halfway through tailoring a CV?</strong> In Honne, the work you’ve already done carries forward. Save the CV and job description together, then give an agent instructions for what to do with them.</p>
            <ul className="multiplayer-uses">
              <li><strong>Strategy</strong> Review application patterns and decide what to apply for next.</li>
              <li><strong>Follow-ups</strong> Draft a message using the role and the CV you prepared.</li>
              <li><strong>Interview prep</strong> Turn the job requirements and your experience into practice questions.</li>
            </ul>
          </div>
          <div className="review-sheet multiplayer-demo">
            <div className="sheet-heading"><strong>My Job Strategist</strong><span className="tag">Sample data</span></div>
            <div className="check-options multiplayer-steps" role="group" aria-label="Strategist demo steps">
              {steps.map((label, index) => (
                <button type="button" aria-pressed={index === step} key={label} onClick={() => { setPlaying(false); setStep(index); }}>
                  {label}
                </button>
              ))}
            </div>
            <div className="multiplayer-stage" aria-live={playing && !reduce ? 'off' : 'polite'}>
              <div key={step} className="rise">
                {step === 0 && <>
                  <h3>Create a custom agent</h3>
                  <dl><dt>Name</dt><dd>My Job Strategist</dd><dt>Can read</dt><dd>Profile and saved applications</dd></dl>
                </>}
                {step === 1 && <>
                  <h3>Tell it what to look for</h3>
                  <blockquote>{prompt}</blockquote>
                </>}
                {step === 2 && <>
                  <h3>Reviewing 50 saved applications</h3>
                  <dl><dt>Role requirements</dt><dd>18 asked for 3+ years of experience.</dd><dt>Recorded replies</dt><dd>3 callbacks, all from graduate or junior roles.</dd><dt>CV evidence</dt><dd>Python API and tests in the campus placement project.</dd></dl>
                </>}
                {step === 3 && <>
                  <h3>What to change for the next 10</h3>
                  <p>None of the 18 roles asking for 3+ years logged a callback. All three recorded callbacks came from graduate or junior roles.</p>
                  <p><strong>Next move:</strong> Prioritize roles that accept project experience. Lead with the Python API and tests from your placement tracker.</p>
                </>}
              </div>
            </div>
            <button type="button" className="btn-s" onClick={play}>
              {reduce ? 'Next step' : playing ? 'Pause demo' : step === steps.length - 1 ? 'Replay demo' : 'Play demo'}
              <Chevron size={14} />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
