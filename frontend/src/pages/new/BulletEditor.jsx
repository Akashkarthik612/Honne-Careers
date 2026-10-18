import { Check, PenLine, Sparkles, X } from 'lucide-react';

// One CV bullet in the wizard. States (bullet.status): plain | edited | kept → editable textarea;
// busy → tailoring skeleton; review → tailored text with Keep / Revert. `bullet.err` is null,
// 'ai' (TailorUnavailableError) or { violations } (TruthCheckError, TRUTH-3: the text stays unchanged).

const KIND = { metric: 'a metric', tool: 'a tool', employer: 'an employer', date: 'a date' };

function describe(violations) {
  const parts = violations.map((v) => `${KIND[v.kind] ?? v.kind} (“${v.value}”)`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
}

const alert = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, background: '#FFF4EE', color: '#9A3412', borderRadius: 10, padding: '10px 12px', fontSize: 13, lineHeight: 1.5 };

export default function BulletEditor({ bullet, label, canTailor, onEdit, onTailor, onRetry, onDismiss, onKeep, onRevert, onRemove }) {
  const { status, err } = bullet;
  const editable = status === 'plain' || status === 'edited' || status === 'kept';
  const review = status === 'review';

  return (
    <div style={{ borderRadius: 14, padding: 12, background: '#FFFFFF', ...(review ? { border: '1.5px solid var(--hc-brand)', boxShadow: '0 0 0 3px rgba(63,95,216,.08)' } : { border: '1px solid var(--hc-hairline)' }) }}>
      {editable && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="hc-sr-only" htmlFor={bullet.id}>{label}</label>
          <textarea id={bullet.id} className="hc-ta" rows={2} value={bullet.text} onChange={(e) => onEdit(e.target.value)} />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {status === 'edited' && <span className="hc-tag" style={{ background: '#F3F4F8', color: 'var(--hc-ink)' }}><PenLine size={12} strokeWidth={2.2} aria-hidden="true" />Edited by you</span>}
              {status === 'kept' && <span className="hc-tag" style={{ background: 'var(--hc-brand-tint)', color: 'var(--hc-brand-hover)' }}>Tailored ✓</span>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {canTailor && (
                <button type="button" className="hc-btn-sm" onClick={onTailor} disabled={!bullet.text.trim()} style={{ border: '1px solid #C9D3F7', background: '#F7F8FD', color: 'var(--hc-brand-hover)' }}>
                  <Sparkles size={13} aria-hidden="true" />Tailor to JD
                </button>
              )}
              <button type="button" className="hc-btn-sm" onClick={onRemove} aria-label={`Remove ${label}`} style={{ border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink-muted)', width: 36, padding: 0 }}>
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
          {err === 'ai' && (
            <div role="alert" style={alert}>
              <span style={{ flex: '1 1 200px' }}><strong>Couldn’t reach the AI, try again.</strong> Your bullet is unchanged.</span>
              <button type="button" className="hc-btn-sm" onClick={onRetry} style={{ border: '1px solid var(--hc-warm)', background: '#FFFFFF', color: '#9A3412' }}>Retry</button>
            </div>
          )}
          {err && err !== 'ai' && (
            <div role="alert" style={alert}>
              <span style={{ flex: '1 1 220px' }}><strong>We couldn’t tailor this without adding things you didn’t write:</strong> {describe(err.violations)}. Your bullet is unchanged.</span>
              <button type="button" className="hc-btn-sm" onClick={onDismiss} style={{ border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink)' }}>Dismiss</button>
            </div>
          )}
        </div>
      )}

      {status === 'busy' && (
        <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '6px 2px' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--hc-brand)' }}>Tailoring to the JD…</span>
          <div className="hc-sk" style={{ width: '94%' }} /><div className="hc-sk" style={{ width: '70%' }} />
        </div>
      )}

      {review && (
        <div className="hc-rise" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--hc-ink-muted)', textDecoration: 'line-through', textDecorationColor: 'var(--hc-ink-faint)' }}>{bullet.original}</div>
          <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--hc-ink)', background: '#EEF1FD', border: '1px solid #C9D3F7', borderRadius: 10, padding: '10px 12px' }}>{bullet.tailored}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <button type="button" className="hc-btn-sm" onClick={onKeep} style={{ border: 0, background: 'var(--hc-brand)', color: '#FFFFFF' }}><Check size={13} strokeWidth={3} aria-hidden="true" />Keep</button>
            <button type="button" className="hc-btn-sm" onClick={onRevert} style={{ border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink)' }}>Revert</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--hc-ink-muted)' }}>Accomplished X, measured by Y, by doing Z — only using what you wrote.</div>
        </div>
      )}
    </div>
  );
}
