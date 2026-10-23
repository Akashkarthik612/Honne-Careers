import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { HonneMark } from '@/components/HonneMark';
import { ErrorBanner, PageLoading } from '@/components/Status';
import { toAgentList } from '@/data/agentsAdapter';
import { leadingMention } from '@/data/chatAdapter';
import useChat from '@/hooks/useChat';
import useResource from '@/hooks/useResource';
import { listAgents } from '@/services/api';
import { useAppStore } from '@/state/appStore';
import { useAuth } from '@/state/auth';
import AnswerPanel from './AnswerPanel';
import Composer from './Composer';
import Message from './Message';

// Chat with agents (design: Chat.dc.html; Day_3 §2.3). /chat is a new chat, /chat/:id an existing one.
// A message goes to the agent named with @ at its start, else the one that answered last. A turn runs in
// the background: its steps show live, and the user can leave and come back (useChat polls).
// Arriving with { agent } (from an agent card) starts the draft with "@agent "; with { message } (from
// Home's chat bar) that message is sent at once.

const SUGGESTIONS = [
  '@analyst which applications should I follow up on this week?',
  '@analyst what’s working in my search so far?',
  '@advisor where should I apply next, given my profile?',
  '@advisor who could I ask for a referral, and how?',
];

const agentByHandle = (agents, handle) => (agents && handle ? [...agents.builtin, ...agents.mine].find((a) => a.handle === handle) ?? null : null);

export default function ChatPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { resetDraft } = useAppStore();
  const loadAgents = useCallback(async () => toAgentList(await listAgents()), []);
  const agentsRes = useResource(loadAgents);
  const agents = agentsRes.data;
  const c = useChat(id ?? null, { onCreated: (cid) => navigate(`/chat/${cid}`, { replace: true }) });
  const [draft, setDraft] = useState(state?.agent && !id ? `@${state.agent} ` : '');
  const [hint, setHint] = useState(null);
  const [panel, setPanel] = useState(null);     // { kind: 'table' | 'doc', messageId, ref? }
  const [hideLong, setHideLong] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const bottom = useRef(null);
  const sentInitial = useRef(false);

  const messages = c.chat?.messages ?? [];
  const lastAgentHandle = [...messages].reverse().find((m) => m.role === 'assistant')?.agent?.handle ?? null;
  const pending = leadingMention(draft) ?? lastAgentHandle;
  const currentAgent = agentByHandle(agents, pending);

  // Another chat (or New chat): panels and hints belong to the old one.
  const [shownFor, setShownFor] = useState(id);
  if (shownFor !== id) { setShownFor(id); setPanel(null); setHint(null); setHideLong(false); }

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages.length, c.busy]);

  async function send(text = draft) {
    const message = text.trim();
    if (!message || c.busy) return;
    if (!leadingMention(message) && !lastAgentHandle) {
      setDraft(message);  // e.g. from Home's chat bar: kept in the box until an agent is picked
      setHint('Type @ to pick an agent, e.g. @analyst.');
      return;
    }
    setHint(null);
    if (await c.send(message, leadingMention(message) ?? undefined)) setDraft('');
  }

  // Home's chat bar hands its message over once.
  useEffect(() => {
    if (sentInitial.current || id || !state?.message) return;
    sentInitial.current = true;
    send(state.message);
  });

  async function retry() {
    setRetrying(true);
    await c.retry();
    setRetrying(false);
  }

  function newChat() {
    navigate('/chat');
  }

  const panelMessage = panel && messages.find((m) => m.id === panel.messageId);
  const firstName = user.name.split(/\s+/)[0];
  const title = c.chat?.title ?? 'New chat';
  const meta = c.chat
    ? `${messages.length} message${messages.length === 1 ? '' : 's'}${c.chat.deletesOn ? ` · kept until ${new Date(c.chat.deletesOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}`
    : 'Empty · starts fresh';
  const suggestions = agents?.mine[0] ? [`@${agents.mine[0].handle} `, ...SUGGESTIONS.slice(0, 3)] : SUGGESTIONS;
  const errorAction = c.error?.code === 'poll_timeout' ? { label: 'Reload', onClick: c.reload }
    : c.error?.code === 'chat_limit_reached' ? { label: 'Start new chat', onClick: newChat } : null;

  return (
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: 'var(--hc-app-ground)' }}>
      <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <header style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--hc-hairline)', background: '#FFFFFF' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="hc-disp" style={{ margin: 0, fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
            <div className="hc-mono" style={{ fontSize: 11, color: 'var(--hc-ink-muted)' }}>{meta}</div>
          </div>
          <button type="button" className="hc-btn-s" onClick={newChat} style={{ minHeight: 40, fontSize: 13.5 }}>+ New chat</button>
        </header>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {c.loading && <PageLoading label="Loading the chat…" />}
            <ErrorBanner error={c.loadError} action={{ label: 'Retry', onClick: c.reload }} />

            {!c.loading && !c.loadError && !messages.length && (
              <div className="hc-rise" style={{ padding: '8vh 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}>
                <span style={{ width: 56, height: 56, borderRadius: 16, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true"><HonneMark width={36} height={30} /></span>
                <h2 className="hc-disp" style={{ margin: 0, fontSize: 'clamp(26px,3vw,34px)', fontWeight: 800, letterSpacing: '-0.03em' }}>What should we work on, <span className="hc-serif" style={{ color: 'var(--hc-brand)', fontSize: '1.1em' }}>{firstName}?</span></h2>
                <p style={{ margin: 0, fontSize: 15, color: 'var(--hc-ink-muted)' }}>Your agents read your profile, resumes and Database. Type @ to pick one.</p>
                <div style={{ marginTop: 10, width: '100%', maxWidth: 640, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
                  {suggestions.map((s) => <button key={s} type="button" className="hc-sugg" onClick={() => (s.endsWith(' ') ? setDraft(s) : send(s))}>{s.endsWith(' ') ? `${s.trim()} — ${agents.mine[0].description}` : s}</button>)}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <Message key={m.id} message={m} isLast={i === messages.length - 1} onOpenPanel={setPanel} onRetry={retry} retrying={retrying} />
            ))}
            <div ref={bottom} />
          </div>
        </div>

        <div style={{ flex: 'none', padding: '10px 18px 16px', background: 'var(--hc-app-ground)' }}>
          <div style={{ maxWidth: 780, margin: '0 auto' }}>
            {c.full ? (
              <div role="status" style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, background: '#FFF4EE', color: '#9A3412', borderRadius: 14, padding: '10px 12px', fontSize: 13.5, lineHeight: 1.5 }}>
                <span style={{ flex: '1 1 260px' }}><strong>This chat is full.</strong> Start a new chat — your profile and Database come with you.</span>
                <button type="button" onClick={newChat} style={{ minHeight: 36, padding: '0 12px', borderRadius: 999, border: '1px solid var(--hc-warm)', background: '#FFFFFF', color: '#9A3412', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Start new chat</button>
              </div>
            ) : c.long && !hideLong && (
              <div role="status" className="hc-rise" style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, background: '#FFF4EE', color: '#9A3412', borderRadius: 14, padding: '10px 12px', fontSize: 13.5, lineHeight: 1.5 }}>
                <span style={{ flex: '1 1 260px' }}><strong>This chat is getting long</strong>, so answers may get less accurate. Start a new chat — your profile and Database come with you.</span>
                <button type="button" onClick={newChat} style={{ minHeight: 36, padding: '0 12px', borderRadius: 999, border: '1px solid var(--hc-warm)', background: '#FFFFFF', color: '#9A3412', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Start new chat</button>
                <button type="button" onClick={() => setHideLong(true)} aria-label="Dismiss" style={{ width: 32, height: 32, border: 0, background: 'none', color: '#9A3412', cursor: 'pointer', borderRadius: 8 }}>✕</button>
              </div>
            )}
            <ErrorBanner error={c.error} action={errorAction} style={{ marginTop: 0, marginBottom: 10 }} />
            {hint && <div role="alert" style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--hc-warm)' }}>{hint}</div>}
            <ErrorBanner error={agentsRes.error} action={{ label: 'Retry', onClick: agentsRes.reload }} style={{ marginTop: 0, marginBottom: 10 }} />
            <Composer
              agents={agents} agent={currentAgent} draft={draft} setDraft={(v) => { setDraft(v); setHint(null); }}
              onSend={() => send()} onStop={c.stop} busy={c.busy} disabled={c.full || c.loading || Boolean(c.loadError)}
              placeholder={messages.length ? 'Reply, or type @ to hand off to another agent' : 'Ask your agents… type @ to pick one'}
              onPickLink={(a) => { resetDraft(); navigate(a.to); }}
            />
          </div>
        </div>
      </div>

      {panel && panelMessage && <AnswerPanel key={`${panel.kind}-${panel.messageId}`} panel={panel} message={panelMessage} onClose={() => setPanel(null)} />}
    </div>
  );
}
