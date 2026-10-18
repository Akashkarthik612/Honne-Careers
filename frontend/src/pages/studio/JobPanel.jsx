import { ArrowRight, ClipboardList, Lock, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { HonneMark } from '@/components/HonneMark';

// Left half of the CV studio: the job description, and (once a CV exists) the "Make changes" chat.

export const JD_WORD_LIMIT = 1000;
const SUGGESTIONS = ['Lead with ownership', 'Keep it to one page', 'Highlight mentoring', 'Shorten the Projects section'];

const tabStyle = (on) => (on
  ? { background: '#FFFFFF', color: 'var(--hc-ink)', boxShadow: '0 1px 3px rgba(22,26,43,.12)' }
  : { background: 'transparent', color: 'var(--hc-ink-muted)' });

function JdTab({ jd, onJdChange, words, hasProfile, ready, generating, onTailor }) {
  const tooLong = words > JD_WORD_LIMIT;
  const canTailor = hasProfile && words > 0 && !tooLong && !generating;
  const hint = tooLong
    ? `That’s over ${JD_WORD_LIMIT.toLocaleString()} words — trim it to the role, requirements and nice-to-haves.`
    : 'Paste the whole post — requirements matter most.';

  return (
    <div style={{ marginTop: 14, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="hc-focus-within" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', border: '1px solid var(--hc-hairline)', borderRadius: 14, padding: '16px 18px', background: 'var(--hc-ground)' }}>
        <textarea
          aria-label="Job description"
          className="hc-jd"
          value={jd}
          onChange={(e) => onJdChange(e.target.value)}
          placeholder={'Paste the full job description here…\n\nInclude the title, responsibilities, requirements and nice-to-haves. The more you paste, the better the match. Max 1,000 words.'}
        />
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 12.5, color: tooLong ? 'var(--hc-warm)' : 'var(--hc-ink-muted)', fontWeight: tooLong ? 600 : 400 }}>{hint}</span>
        {hasProfile ? (
          <button type="button" className="hc-btn-p" onClick={onTailor} disabled={!canTailor}>
            <Sparkles size={16} aria-hidden="true" />
            {ready ? 'Tailor again' : 'Tailor my CV'}
          </button>
        ) : (
          <span title="Add your CV first" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 46, padding: '0 18px', borderRadius: 999, background: '#EEF0F5', color: 'var(--hc-ink-faint)', fontSize: 14, fontWeight: 700 }}>
            Tailor my CV<Lock size={15} aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}

function ChatTab({ messages, draft, onDraftChange, onSend }) {
  function handleSubmit(e) {
    e.preventDefault();
    onSend(draft);
  }

  return (
    <div style={{ marginTop: 14, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div aria-live="polite" style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 2px' }}>
        {messages.map((m, i) => {
          const ai = m.role === 'ai';
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', justifyContent: ai ? 'flex-start' : 'flex-end' }}>
              {ai && (
                <span aria-hidden="true" style={{ flex: 'none', width: 30, height: 30, borderRadius: 9, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HonneMark width={18} height={16} />
                </span>
              )}
              <div style={{
                maxWidth: '82%', fontSize: 14, lineHeight: 1.5, padding: '10px 14px',
                ...(ai
                  ? { background: '#F3F4F8', color: 'var(--hc-ink)', borderRadius: '16px 16px 16px 4px' }
                  : { background: 'var(--hc-ink)', color: '#FFFFFF', borderRadius: '16px 16px 4px 16px' }),
              }}>
                {m.text}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {SUGGESTIONS.map((t) => <button key={t} type="button" className="hc-sugg" onClick={() => onSend(t)}>{t}</button>)}
      </div>
      <form onSubmit={handleSubmit} className="hc-focus-within" style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--hc-hairline)', borderRadius: 16, padding: '4px 6px 4px 16px', background: 'var(--hc-ground)' }}>
        <label htmlFor="chat-in" className="hc-sr-only">Tell us what to change</label>
        <input id="chat-in" className="hc-chatin" type="text" autoComplete="off" placeholder="e.g. Lead with ownership and keep it to one page" value={draft} onChange={(e) => onDraftChange(e.target.value)} />
        <button type="submit" aria-label="Send" style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, border: 0, background: 'var(--hc-brand)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
      <div style={{ fontSize: 12, color: 'var(--hc-ink-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <ShieldCheck size={13} color="var(--hc-success)" strokeWidth={2.4} aria-hidden="true" />
        Changes only use what’s in your profile — nothing gets invented.
      </div>
    </div>
  );
}

export default function JobPanel({ tab, onTab, chatAvailable, jd, onJdChange, words, hasProfile, ready, generating, onTailor, messages, draft, onDraftChange, onSend }) {
  const left = chatAvailable ? tab : 'jd';

  return (
    <section aria-label="Job description and chat" className="hc-card" style={{ flex: '1 1 440px', minWidth: 0, display: 'flex', flexDirection: 'column', padding: '16px 20px 20px', height: 'clamp(600px, calc(100vh - 210px), 880px)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div role="tablist" aria-label="Left panel" style={{ display: 'flex', gap: 4, background: '#F3F4F8', borderRadius: 999, padding: 3 }}>
          <button type="button" role="tab" className="hc-ltab" aria-selected={left === 'jd'} onClick={() => onTab('jd')} style={tabStyle(left === 'jd')}>
            <ClipboardList size={15} aria-hidden="true" />Job description
          </button>
          {chatAvailable && (
            <button type="button" role="tab" className="hc-ltab" aria-selected={left === 'chat'} onClick={() => onTab('chat')} style={tabStyle(left === 'chat')}>
              <MessageCircle size={15} aria-hidden="true" />Make changes
            </button>
          )}
        </div>
        {left === 'jd' && (
          <span className="hc-mono" style={{ fontSize: 12, color: words > JD_WORD_LIMIT ? 'var(--hc-warm)' : 'var(--hc-ink-faint)' }}>
            {words} / {JD_WORD_LIMIT} words
          </span>
        )}
      </div>

      {left === 'jd'
        ? <JdTab jd={jd} onJdChange={onJdChange} words={words} hasProfile={hasProfile} ready={ready} generating={generating} onTailor={onTailor} />
        : <ChatTab messages={messages} draft={draft} onDraftChange={onDraftChange} onSend={onSend} />}
    </section>
  );
}
