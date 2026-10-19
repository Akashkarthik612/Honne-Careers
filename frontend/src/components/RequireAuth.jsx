import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/state/auth';

// Guards every app screen (AUTH-1). Signed out → /login, remembering where the user was going.
export default function RequireAuth({ children }) {
  const { status } = useAuth();
  const { pathname, search } = useLocation();

  if (status === 'checking') {
    return <div role="status" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--hc-ink-muted)', fontSize: 15 }}>Checking your sign-in…</div>;
  }
  if (status === 'anon') {
    return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />;
  }
  return children;
}
