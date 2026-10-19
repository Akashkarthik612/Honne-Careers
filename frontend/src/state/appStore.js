import { createContext, useContext } from 'react';

// Client-only state: the new-resume setup draft (template → mode → JD → wizard or tailoring) before and
// while the resume is created on the server. Everything the user owns (profile, resumes, settings) is
// loaded from the API by each screen; nothing is seeded here.

export const AppStoreContext = createContext(null);

export function useAppStore() {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error('useAppStore must be used inside <AppStoreProvider>');
  return store;
}

// upload: { filename, prefill } after POST /uploads; the wizard pre-fills from it once (PROF-2, PROF-4).
export function blankDraft() {
  return { template: 'jake', mode: 'jd', jd: '', company: '', role: '', upload: null };
}
