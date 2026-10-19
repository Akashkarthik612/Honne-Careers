import { useEffect, useState } from 'react';
import { TAILOR_POLL_MAX, TAILOR_POLL_MS } from '@/config/limits';
import { toResume } from '@/data/cvAdapter';
import { getResume } from '@/services/api';

// The tailor job's reported steps (TAIL-3), in the order the backend sets resumes.job_step.
// Reading the JD and matching happen inside one AI call with the rewrite, so they share a step.
export const TAILOR_STEPS = [
  ['reading', 'Reading the job description'],
  ['rewriting', 'Matching and rewriting your bullets'],
  ['checking', 'Checking nothing was invented'],
];

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Polls until the job leaves 'tailoring' or maxPolls run out. Pure (fetch and sleep injected) so it is
// tested without React. Returns { outcome: 'ready' | 'failed' | 'timeout', resume }.
// A failed request throws (ApiError): there is no silent retry.
export async function pollTailorJob({ fetchResume, onUpdate, isCancelled, intervalMs = TAILOR_POLL_MS, maxPolls = TAILOR_POLL_MAX, sleep = wait }) {
  let resume = null;
  for (let n = 0; n < maxPolls; n += 1) {
    if (isCancelled()) return { outcome: 'cancelled', resume };
    resume = await fetchResume();
    onUpdate(resume);
    if (resume.state !== 'tailoring') return { outcome: resume.state === 'failed' ? 'failed' : 'ready', resume };
    await sleep(intervalMs);
  }
  return { outcome: 'timeout', resume };
}

// Hook: { phase: 'polling' | 'ready' | 'failed' | 'timeout' | 'error', resume, step, error, restart }.
// `step` is the index into TAILOR_STEPS (TAILOR_STEPS.length when done).
export default function useTailorJob(resumeId) {
  const [run, setRun] = useState(0);
  const [state, setState] = useState({ phase: 'polling', resume: null, error: null });

  useEffect(() => {
    let cancelled = false;
    pollTailorJob({
      fetchResume: async () => toResume(await getResume(resumeId)),
      onUpdate: (resume) => { if (!cancelled) setState((s) => ({ ...s, resume })); },
      isCancelled: () => cancelled,
    }).then(
      ({ outcome, resume }) => { if (!cancelled && outcome !== 'cancelled') setState({ phase: outcome, resume, error: null }); },
      (error) => { if (!cancelled) setState((s) => ({ ...s, phase: 'error', error })); },
    );
    return () => { cancelled = true; };
  }, [resumeId, run]);

  const restart = () => { setState((s) => ({ ...s, phase: 'polling', error: null })); setRun((r) => r + 1); };
  const at = TAILOR_STEPS.findIndex(([key]) => key === state.resume?.jobStep);
  const step = state.phase === 'ready' ? TAILOR_STEPS.length : Math.max(0, at);
  return { ...state, step, restart };
}
