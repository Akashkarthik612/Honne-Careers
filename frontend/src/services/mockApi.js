import { SAMPLE_TAILORED } from '@/data/sampleCv';

// Backend seams. Each function returns what the real endpoint will, after a delay, and fails with a
// specific error class so screens can show the matching message. Replace the bodies with fetch calls.
//
// `?sim=` in the URL forces a failure, standing in for the design's error-state tweaks:
//   ai-error    → tailorBullet throws TailorUnavailableError
//   truth-error → tailorBullet throws TruthCheckError (TRUTH-2/3)
//   pdf-error   → buildPdf throws PdfBuildError

export class TailorUnavailableError extends Error {
  constructor() { super('Tailoring service unavailable'); this.name = 'TailorUnavailableError'; }
}

// `violations`: [{ kind: 'metric' | 'tool' | 'employer' | 'date', value }] — what the generated text added
// that the profile doesn't contain.
export class TruthCheckError extends Error {
  constructor(violations) { super('Tailored text adds facts not in the profile'); this.name = 'TruthCheckError'; this.violations = violations; }
}

export class PdfBuildError extends Error {
  constructor() { super('PDF build failed'); this.name = 'PdfBuildError'; }
}

const sim = () => new URLSearchParams(window.location.search).get('sim');
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// TAIL-4: one bullet, rewritten for the JD using only the profile fact. `section` picks the sample violation.
// Simulated failures hit first attempts only, so Retry shows the recovery path.
export async function tailorBullet({ bulletId, text, section, retry = false }) {
  await wait(900);
  if (!retry && sim() === 'ai-error') throw new TailorUnavailableError();
  if (!retry && sim() === 'truth-error') {
    throw new TruthCheckError(section === 'projects'
      ? [{ kind: 'tool', value: 'Kubernetes' }]
      : [{ kind: 'metric', value: '40%' }, { kind: 'tool', value: 'Kubernetes' }]);
  }
  return { text: SAMPLE_TAILORED[bulletId] || text };
}

// PDF-2 / SAVE-1: compile the PDF and save the application record. No file is produced yet. TODO(SAVE-1)
export async function buildPdf() {
  await wait(2200);
  if (sim() === 'pdf-error') throw new PdfBuildError();
  return { ok: true };
}

// ANA-1…3: the three analyses. Sample values until the analysis API returns scores with evidence (ANA-4).
export async function runAnalysis() {
  await wait(1400);
  return { keyword: 88, experience: 74, narrative: 81 };
}
