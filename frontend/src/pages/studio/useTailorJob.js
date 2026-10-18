import { useCallback, useEffect, useRef, useState } from 'react';

// The four reported steps of a tailoring job (TAIL-3). `time` is the UI's estimate, shown beside the step.
export const TAILOR_STEPS = [
  { label: 'Reading the job description', time: '' },
  { label: 'Matching your experience to the JD', time: '' },
  { label: 'Rewriting your bullets for this role', time: '~15s' },
  { label: 'Building your ATS-safe PDF', time: '~20s' },
];

const STEP_MS = 1100;

// Simulated job: advances one step every STEP_MS, then calls onDone.
// Replace the interval with polling/streaming of the backend job once the tailoring API exists.
export default function useTailorJob(onDone) {
  const [step, setStep] = useState(-1);
  const timer = useRef(null);
  const doneRef = useRef(onDone);

  useEffect(() => { doneRef.current = onDone; }, [onDone]);
  useEffect(() => () => clearInterval(timer.current), []);

  const start = useCallback((context) => {
    clearInterval(timer.current);
    setStep(0);
    let s = 0;
    timer.current = setInterval(() => {
      s += 1;
      if (s >= TAILOR_STEPS.length) {
        clearInterval(timer.current);
        setStep(-1);
        doneRef.current(context);
      } else {
        setStep(s);
      }
    }, STEP_MS);
  }, []);

  const cancel = useCallback(() => {
    clearInterval(timer.current);
    setStep(-1);
  }, []);

  return { step, running: step >= 0, start, cancel };
}
