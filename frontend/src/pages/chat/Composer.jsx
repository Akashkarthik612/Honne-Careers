import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ChevronDown, Paperclip } from 'lucide-react';
import AgentAvatar from '@/components/AgentAvatar';
import { MESSAGE_MAX, knowledgeLabels } from '@/data/agentsAdapter';
import { insertMention, mentionQuery, pickerGroups } from '@/data/chatAdapter';

// The chat composer (design: Chat.dc.html). Typing @ opens the agent picker (Honne agents, then yours),
// filtered as you type; ↑/↓ move, Enter or Tab picks, Esc closes; Enter sends, Shift+Enter is a new line.
// @cv-writer opens the tailor flow instead (onPickLink). Auto routing and attachments are not built yet.

export default function Composer({ agents, agent, draft, setDraft, onSend, onStop, busy, disabled, placeholder, onPickLink }) {
  const input = useRef(null);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(null);   // Esc hides the picker until the text changes
  const query = agents && draft !== dismissed ? mentionQuery(draft) : null;
  const groups = query == null ? null : pickerGroups(agents, query);
  const options = groups ? [...groups.builtin, ...groups.mine] : [];
  const at = Math.min(active, Math.max(0, options.length - 1));

  function pick(a) {
    if (a.kind === 'link') { onPickLink(a); return; }
    setDraft(insertMention(draft, a.handle));
    setActive(0);
    input.current?.focus();
  }

  function onKeyDown(e) {
    if (groups && options.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((at + 1) % options.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((at - 1 + options.length) % options.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(options[at]); return; }
    }
    if (groups && e.key === 'Escape') { e.preventDefault(); setDismissed(draft); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  }

  const option = (a, i) => (
    <button key={a.handle} type="button" role="option" aria-selected={i === at} className="hc-pick" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(a)}>
      <AgentAvatar agent={a.kind === 'link' ? { ...a, kind: 'builtin' } : a} />
      <span style={{ minWidth: 0 }}>
        <span className="hc-mono" style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>@{a.handle}</span>
        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--hc-ink-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.description}</span>
      </span>
    </button>
  );

  return (
    <div style={{ position: 'relative' }}>
      {groups && (
        <div role="listbox" aria-label="Agents" className="hc-rise" style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(100% + 8px)', maxWidth: 420, maxHeight: 360, overflow: 'auto', background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 16, boxShadow: '0 20px 50px rgba(22,26,43,.16)', padding: 6, zIndex: 5 }}>
          {groups.builtin.length > 0 && <div className="hc-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', color: 'var(--hc-ink-muted)', padding: '8px 10px 4px' }}>HONNE AGENTS</div>}
          {groups.builtin.map((a, i) => option(a, i))}
          {groups.mine.length > 0 && <div className="hc-mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', color: 'var(--hc-ink-muted)', padding: '10px 10px 4px' }}>YOUR AGENTS</div>}
          {groups.mine.map((a, i) => option(a, groups.builtin.length + i))}
          {groups.none && <div style={{ padding: '14px 10px', fontSize: 13.5, color: 'var(--hc-ink-muted)' }}>No agent called <span className="hc-mono" style={{ color: 'var(--hc-ink)' }}>@{query}</span>. <Link to="/agents/new" style={{ fontWeight: 700, textDecoration: 'none' }}>Create it</Link></div>}
          <Link to="/agents/new" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 10px', marginTop: 4, borderTop: '1px solid #F0F1F5', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>+ Create an agent</Link>
        </div>
      )}

      <form className="hc-composer" onSubmit={(e) => { e.preventDefault(); onSend(); }}>
        <label htmlFor="chat-in" className="hc-sr-only">Message your agents</label>
        <textarea
          id="chat-in" ref={input} rows={1} autoComplete="off" maxLength={MESSAGE_MAX} disabled={disabled} placeholder={placeholder}
          value={draft} onChange={(e) => { setDraft(e.target.value); setActive(0); }} onKeyDown={onKeyDown}
          aria-autocomplete="list" aria-expanded={Boolean(groups)}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <button type="button" className="hc-icb" aria-label="Attach a file (coming soon)" title="Attach a file — coming soon" disabled><Paperclip size={18} aria-hidden="true" /></button>
          <span className="hc-tool">
            <span style={{ width: 7, height: 7, borderRadius: 99, background: agent ? 'var(--hc-success)' : 'var(--hc-ink-faint)', display: 'inline-block' }} />
            <span style={{ color: 'var(--hc-ink-muted)' }}>Knowledge</span> <strong>{agent ? knowledgeLabels(agent.knowledge).join(' + ') : 'Pick an agent'}</strong>
          </span>
          <span className="hc-tool" title="Auto picks the right agent for you — coming soon" aria-disabled="true" style={{ color: 'var(--hc-ink-muted)' }}>
            {agent ? <span className="hc-mono" style={{ color: 'var(--hc-ink)', fontWeight: 700 }}>@{agent.handle}</span> : 'Auto'}<ChevronDown size={12} aria-hidden="true" />{!agent && <span className="hc-soon">SOON</span>}
          </span>
          <span className="hc-mono hc-hint" style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--hc-ink-muted)' }}>@ agents · ↵ send</span>
          {busy
            ? <button type="button" onClick={onStop} aria-label="Stop watching" title="Stop watching (the answer still arrives)" style={{ marginLeft: 'auto', flex: 'none', width: 40, height: 40, borderRadius: 12, border: 0, background: 'var(--hc-ink)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><span style={{ width: 12, height: 12, borderRadius: 2, background: '#FFFFFF', display: 'inline-block' }} /></button>
            : <button type="submit" aria-label="Send" disabled={disabled || !draft.trim()} style={{ marginLeft: 'auto', flex: 'none', width: 40, height: 40, borderRadius: 12, border: 0, background: 'var(--hc-brand)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: disabled || !draft.trim() ? 0.55 : 1 }}><ArrowUp size={18} strokeWidth={2.2} aria-hidden="true" /></button>}
        </div>
      </form>
    </div>
  );
}
