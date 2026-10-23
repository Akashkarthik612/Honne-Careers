import { useState } from 'react';
import { AlertCircle, Check, Copy, FileText, Table2 } from 'lucide-react';
import AgentAvatar from '@/components/AgentAvatar';
import MarkdownLite from '@/components/MarkdownLite';
import { answerToMarkdown, failedText, sourcesSummary, stepsView } from '@/data/chatAdapter';

// One chat message (design: Chat.dc.html). An answer shows its steps (live while running), the text with
// [n] citations, a card for its drafts (Doc panel) and one for the rows it used (Table panel), or, when
// it failed, why — with Retry. The user's message is always kept.

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function Spinner() {
  return (
    <svg className="hc-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="#E4E6EE" strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="#3F5FD8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Steps({ message }) {
  const steps = stepsView(message);
  if (!steps.length) return null;
  return (
    <div className="hc-steps" role="status" aria-live="polite">
      {steps.map((s, i) => (
        <div key={i} className="hc-step">
          {s.state === 'done' ? <Check size={16} strokeWidth={2.6} color="var(--hc-success)" aria-hidden="true" /> : <Spinner />}
          <span style={{ color: s.state === 'active' ? 'var(--hc-ink)' : '#3D4357', fontWeight: s.state === 'active' ? 600 : 400 }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function Card({ icon: Icon, tint, title, sub, onOpen }) {
  return (
    <button type="button" className="hc-acard" onClick={onOpen} aria-label={`Open ${title}`}>
      <span style={{ flex: 'none', width: 40, height: 40, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...tint }} aria-hidden="true"><Icon size={18} /></span>
      <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{title}</span><span style={{ display: 'block', fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>{sub}</span></span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--hc-brand)' }}>Open</span>
    </button>
  );
}

export default function Message({ message, isLast, onOpenPanel, onRetry, retrying }) {
  const [copied, setCopied] = useState(false);
  if (message.role === 'user') return <div className="hc-ubub hc-rise">{message.content}</div>;

  const { agent } = message;
  const copyAnswer = async () => {
    try { await navigator.clipboard.writeText(answerToMarkdown(message)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); }
  };

  return (
    <div className="hc-rise" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="hc-ahdr">
        <AgentAvatar agent={agent} />
        <span className="hc-mono" style={{ fontSize: 14, fontWeight: 700 }}>@{agent.handle}</span>
        {agent.kind === 'user' && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--hc-ink-muted)', background: '#F3F4F8', borderRadius: 999, padding: '2px 8px' }}>Your agent</span>}
        <span className="hc-mono" style={{ fontSize: 11, color: 'var(--hc-ink-muted)' }}>{time(message.createdAt)}</span>
      </div>

      {message.status !== 'failed' && <Steps message={message} />}

      {message.status === 'failed' && (
        <div role="alert" style={{ maxWidth: 560, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, background: '#FFF4EE', color: '#9A3412', borderRadius: 14, padding: '12px 14px', fontSize: 14, lineHeight: 1.5 }}>
          <AlertCircle size={16} color="var(--hc-warm)" aria-hidden="true" />
          <span style={{ flex: '1 1 240px' }}><strong>{failedText(message.errorCode)}</strong> Your message is saved in this chat.</span>
          {isLast && (
            <button type="button" onClick={onRetry} disabled={retrying} style={{ minHeight: 40, padding: '0 14px', borderRadius: 999, border: '1px solid var(--hc-warm)', background: '#FFFFFF', color: '#9A3412', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: retrying ? 'progress' : 'pointer' }}>Retry</button>
          )}
        </div>
      )}

      {message.status === 'ok' && (
        <div className="hc-rise" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MarkdownLite text={message.content} sources={message.sources} onCite={(s) => onOpenPanel({ kind: 'table', messageId: message.id, ref: s.ref })} />
          {(message.drafts.length > 0 || message.sources.length > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {message.drafts.length > 0 && (
                <Card icon={FileText} tint={{ background: '#FFF4EE', color: 'var(--hc-warm)' }} onOpen={() => onOpenPanel({ kind: 'doc', messageId: message.id })}
                  title={`${message.drafts.length} draft${message.drafts.length === 1 ? '' : 's'}`} sub={`Doc · ${message.drafts.map((d) => d.to).join(', ')}`} />
              )}
              {message.sources.length > 0 && (
                <Card icon={Table2} tint={{ background: '#F3F4F8', color: 'var(--hc-ink)' }} onOpen={() => onOpenPanel({ kind: 'table', messageId: message.id })}
                  title="Rows used" sub={`Table · ${sourcesSummary(message.sources)}`} />
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 2 }}>
            <button type="button" className="hc-icb" aria-label="Copy answer" title={copied ? 'Copied' : 'Copy'} onClick={copyAnswer}>{copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}</button>
          </div>
        </div>
      )}
    </div>
  );
}
