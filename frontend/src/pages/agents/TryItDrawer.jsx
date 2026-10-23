import { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import AgentAvatar from '@/components/AgentAvatar';
import MarkdownLite from '@/components/MarkdownLite';
import { ErrorBanner } from '@/components/Status';
import { MESSAGE_MAX, formToRequest, normaliseHandle } from '@/data/agentsAdapter';
import { previewAgent } from '@/services/api';

// "Try it before you save" (CUST-3): the agent as written right now answers one message at a time.
// Nothing is saved — no agent, no chat — only the message counts toward today's limit.
export default function TryItDrawer({ form, onClose }) {
  const [turns, setTurns] = useState([]);   // [{ q, a: { content, sources, drafts, steps } }]
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const panel = useRef(null);
  const handle = normaliseHandle(form.name) || 'your-agent';
  const agent = { handle, kind: 'user' };

  useEffect(() => { panel.current?.focus(); }, []);

  async function ask(e) {
    e.preventDefault();
    const q = draft.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      const a = await previewAgent(formToRequest(form), q);
      setTurns((t) => [...t, { q, a }]);
      setDraft('');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" aria-label="Close Try it" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(14,18,38,.35)', border: 0, cursor: 'default' }} />
      <aside ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Try @${handle}`} className="hc-drawer hc-peek">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 12px 18px', borderBottom: '1px solid var(--hc-hairline)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="hc-disp" style={{ fontSize: 16, fontWeight: 700 }}>Try <span className="hc-mono" style={{ fontSize: 14 }}>@{handle}</span></div>
            <div style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>Uses your real data. Nothing is saved; each message is answered on its own.</div>
          </div>
          <button type="button" className="hc-icb" onClick={onClose} aria-label="Close"><X size={16} aria-hidden="true" /></button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!turns.length && !busy && <p style={{ margin: 0, fontSize: 14, color: 'var(--hc-ink-muted)' }}>Ask what you’d ask it in a chat, e.g. “Which applications need a follow-up?”</p>}
          {turns.map((t, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="hc-ubub">{t.q}</div>
              <div className="hc-ahdr"><AgentAvatar agent={agent} /><span className="hc-mono" style={{ fontSize: 13.5, fontWeight: 700 }}>@{handle}</span></div>
              {t.a.steps.length > 0 && <div style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>{t.a.steps.map((s) => s.label).join(' · ')}</div>}
              <MarkdownLite text={t.a.content} sources={t.a.sources} />
              {t.a.drafts.map((d, j) => (
                <div key={j} style={{ border: '1px solid var(--hc-hairline)', borderRadius: 12, padding: '10px 12px', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  <strong>To {d.to}</strong>{d.subject ? ` · ${d.subject}` : ''}{'\n'}{d.body}
                </div>
              ))}
              {t.a.note && <div style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>Note: {t.a.note}</div>}
            </div>
          ))}
          {busy && (
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>
              <svg className="hc-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="#E4E6EE" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="#3F5FD8" strokeWidth="3" strokeLinecap="round" /></svg>
              Reading your data and answering…
            </div>
          )}
          <ErrorBanner error={error} style={{ marginTop: 0 }} />
        </div>

        <form onSubmit={ask} style={{ padding: 12, borderTop: '1px solid var(--hc-hairline)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <label htmlFor="try-in" className="hc-sr-only">Test message</label>
          <textarea
            id="try-in" className="hc-ta" rows={2} maxLength={MESSAGE_MAX} value={draft} placeholder="A test message"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) ask(e); }}
          />
          <button type="submit" aria-label="Send test message" disabled={busy || !draft.trim()} style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, border: 0, background: 'var(--hc-brand)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'progress' : 'pointer', opacity: busy || !draft.trim() ? 0.6 : 1 }}>
            <Send size={17} aria-hidden="true" />
          </button>
        </form>
      </aside>
    </>
  );
}
