import { createContext, useContext } from 'react';
import { SAMPLE_JD, SAMPLE_PROFILE } from '@/data/sampleCv';
import { emptyProfile, toDoc } from '@/data/cvModel';

// Client-side stand-in for the P1 API (profile, resumes, settings). Lives for the browser session only.
// `?user=new` on first load starts as a first-time user: no profile, no resumes (the design's "first visit").

export const AppStoreContext = createContext(null);

export function useAppStore() {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used inside <AppStoreProvider>');
  return store;
}

function withSkill(profile, group, skill) {
  return { ...profile, skills: { ...profile.skills, [group]: [...profile.skills[group], skill] } };
}

function sampleResumes() {
  const tailoredDoc = toDoc(withSkill(SAMPLE_PROFILE, 'tools', 'Docker'), {
    b1: 'Cut payment-event latency by 38% (p95) by moving the ledger service to Kafka Streams in Java on AWS',
    b2: 'Owned the settlement pipeline end to end, scaling it to 2M events/day with zero data loss through idempotent consumers and replay tooling',
    pb1: 'Built a double-entry ledger in Java and PostgreSQL that sustained 1,000 TPS in k6 load tests',
  });
  const base = { template: 'jake', addedSkills: ['Docker'], doc: tailoredDoc, jd: SAMPLE_JD };
  return [
    { ...base, id: 'cv1', role: 'SDE-2 Backend', company: 'Freshworks', mode: 'jd', status: 'ready', updated: 'Updated 2 h ago' },
    { ...base, id: 'cv2', role: 'Backend Engineer', company: 'Razorpay', mode: 'jd', status: 'ready', updated: 'Updated yesterday' },
    { ...base, id: 'cv3', role: 'Platform Engineer', company: 'Swiggy', mode: 'jd', status: 'draft', step: 2, updated: 'Updated 3 days ago' },
    { ...base, id: 'cv4', role: '', company: '', title: 'General backend CV', mode: 'scratch', status: 'ready', updated: 'Updated last week', addedSkills: [], doc: toDoc(SAMPLE_PROFILE), jd: '' },
  ];
}

export function initialStoreState() {
  const isNew = new URLSearchParams(window.location.search).get('user') === 'new';
  return {
    profile: isNew ? emptyProfile() : SAMPLE_PROFILE,
    profileSavedAt: isNew ? null : 'Last saved 2 h ago.',
    resumes: isNew ? [] : sampleResumes(),
    draft: blankDraft(),
    settings: { name: SAMPLE_PROFILE.personal.name, askSave: true, emails: false },
  };
}

// The resume being set up: template → mode → JD (→ wizard or tailoring).
export function blankDraft() {
  return { template: 'jake', mode: 'jd', jd: '', company: '', role: '', upload: null };
}

export const resumeTitle = (r) => r.title || [r.role, r.company].filter(Boolean).join(' · ') || 'Untitled resume';
