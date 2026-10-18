import { useCallback, useEffect, useRef, useState } from 'react';

// The four reported steps of a tailoring job (TAIL-3). The last one is the truth check (TRUTH-2).
export const TAILOR_STEPS = [
  'Reading the job description',
  'Matching your experience',
  'Rewriting your bullets',
  'Checking nothing was invented',
];

const STEP_MS = 1300;

// Simulated job: starts on mount, advances one step every STEP_MS, then calls onDone once per run.
// `step` runs 0…TAILOR_STEPS.length; at the end, `done` is true. Replace the interval with
// polling/streaming of the backend job once the tailoring API exists.
export default function useTailorJob(onDone) {
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const doneRef = useRef(onDone);

  useEffect(() => { doneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    let s = 0;
    const timer = setInterval(() => {
      s += 1;
      setStep(s);
      if (s >= TAILOR_STEPS.length) {
        clearInterval(timer);
        doneRef.current();
      }
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [run]);

  const restart = useCallback(() => { setStep(0); setRun((r) => r + 1); }, []);

  return { step, done: step >= TAILOR_STEPS.length, restart };
}
