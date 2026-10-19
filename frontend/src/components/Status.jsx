import { AlertCircle } from 'lucide-react';
import { errorText } from '@/services/apiClient';

// Loading and error states shared by every screen that talks to the API. Errors are always shown with the
// backend's message and reference (guardrails §3: fail loudly, never fall back to sample data).

export function PageLoading({ label = 'Loading…' }) {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0', fontSize: 14.5, fontWeight: 600, color: 'var(--hc-ink-muted)' }}>
      <svg className="hc-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="#E4E6EE" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="#3F5FD8" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label}
    </div>
  );
}

// `action` is an optional { label, onClick } (Retry, Reload…).
export function ErrorBanner({ error, action, style }) {
  if (!error) return null;
  const text = typeof error === 'string' ? error : errorText(error);
  return (
    <div role="alert" className="hc-err hc-rise" style={{ marginTop: 14, ...style }}>
      <AlertCircle size={16} color="var(--hc-warm)" aria-hidden="true" style={{ flex: 'none' }} />
      <span style={{ flex: '1 1 240px' }}>{text}</span>
      {action && (
        <button type="button" onClick={action.onClick} style={{ minHeight: 36, padding: '0 14px', borderRadius: 999, border: '1px solid var(--hc-warm)', background: '#FFFFFF', color: '#9A3412', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{action.label}</button>
      )}
    </div>
  );
}
