import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from '@/services/authService';

// Sign out from the Sidebar or Settings: revoke the session, then go to the landing page.
// A failure stays signed in and shows `error`.
export default function useSignOut() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return { signOut: run, busy, error };
}
