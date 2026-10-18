import { useMemo, useState } from 'react';
import { emptyProfile, newId } from '@/data/cvModel';
import { AppStoreContext, blankDraft, initialStoreState } from './appStore';

// Holds the mocked app data and the operations screens call. Each operation maps to one future endpoint.
export default function AppStoreProvider({ children }) {
  const [state, setState] = useState(initialStoreState);

  const actions = useMemo(() => ({
    saveProfile: (profile) => setState((s) => ({ ...s, profile, profileSavedAt: 'Saved ✓ — new resumes will use this.' })),
    setDraft: (patch) => setState((s) => ({ ...s, draft: { ...s.draft, ...patch } })),
    resetDraft: () => setState((s) => ({ ...s, draft: blankDraft() })),
    setSettings: (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),

    // Returns the new resume's id. `resume` carries everything except id/updated.
    addResume: (resume) => {
      const id = newId('cv');
      setState((s) => ({ ...s, resumes: [{ ...resume, id, updated: 'Just now' }, ...s.resumes] }));
      return id;
    },
    updateResume: (id, patch) => setState((s) => ({
      ...s, resumes: s.resumes.map((r) => (r.id === id ? { ...r, ...patch, updated: 'Just now' } : r)),
    })),
    duplicateResume: (id) => setState((s) => {
      const i = s.resumes.findIndex((r) => r.id === id);
      if (i < 0) return s;
      const src = s.resumes[i];
      const copy = { ...src, id: newId('cv'), title: `${src.title || [src.role, src.company].filter(Boolean).join(' · ')} (copy)`, updated: 'Just now' };
      return { ...s, resumes: [...s.resumes.slice(0, i + 1), copy, ...s.resumes.slice(i + 1)] };
    }),
    deleteResume: (id) => setState((s) => ({ ...s, resumes: s.resumes.filter((r) => r.id !== id) })),

    // AUTH-3: removes the profile, resumes and settings. Server-side deletion comes with the account API.
    deleteAccount: () => setState(() => ({
      profile: emptyProfile(), profileSavedAt: null, resumes: [], draft: blankDraft(),
      settings: { name: '', askSave: true, emails: false },
    })),
  }), []);

  const value = useMemo(() => ({ ...state, ...actions }), [state, actions]);
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}
