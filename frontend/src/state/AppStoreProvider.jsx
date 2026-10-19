import { useMemo, useState } from 'react';
import { AppStoreContext, blankDraft } from './appStore';

// Holds the new-resume draft (see appStore.js). Server data is not cached here.
export default function AppStoreProvider({ children }) {
  const [draft, setDraftState] = useState(blankDraft);

  const value = useMemo(() => ({
    draft,
    setDraft: (patch) => setDraftState((d) => ({ ...d, ...patch })),
    resetDraft: () => setDraftState(blankDraft()),
  }), [draft]);

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}
