import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, ArrowUp, ChevronDown, Database, FileText, Paperclip, Plus } from 'lucide-react';
import AgentAvatar from '@/components/AgentAvatar';
import { ErrorBanner } from '@/components/Status';
import { MAX_JD_WORDS } from '@/config/limits';
import { knowledgeLabels, MESSAGE_MAX, toAgentList } from '@/data/agentsAdapter';
import { CV_WRITER } from '@/data/chatAdapter';
import { countWords, guessJobMeta } from '@/data/cvModel';
import useResource from '@/hooks/useResource';
import { listAgents } from '@/services/api';
import { blankDraft, useAppStore } from '@/state/appStore';
import { useAuth } from '@/state/auth';

// Home (design: Home.dc.html): the start page after sign-in. Pasting a JD here starts a tailored resume
// with the Mode step skipped (template → JD page, draft.jdFromHome). Nothing is sent until the JD page.
// Your agents (Day 3) are listed from the API; the chat bar at the bottom sends its message to a new chat.

function greeting(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const sectionTitle = { margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' };
const iconTile = (bg, fg) => ({ flex: 'none', width: 32, height: 32, borderRadius: 10, background: bg, color: fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' });

function AgentCard({ agent, onOpen }) {
  return (
    <button type="button" className="hc-agent is-link" onClick={onOpen} style={{ fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <AgentAvatar agent={agent} size={32} />
        <span style={{ minWidth: 0 }}>
          <span className="hc-mono" style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>@{agent.handle}</span>
          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--hc-ink-muted)' }}>Made by you · {agent.chatCount} chat{agent.chatCount === 1 ? '' : 's'}</span>
        </span>
      </span>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: '#3D4357' }}>{agent.description}</span>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
        {knowledgeLabels(agent.knowledge).map((k) => <span key={k} style={{ fontSize: 11.5, fontWeight: 600, background: '#F3F4F8', borderRadius: 999, padding: '3px 8px' }}>{k}</span>)}
      </span>
    </button>
  );
}

function SoonCard({ icon: Icon, title, children }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 16, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={iconTile('var(--hc-brand-tint)', 'var(--hc-brand)')}><Icon size={17} aria-hidden="true" /></span>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span><span className="hc-soon" style={{ color: 'var(--hc-ink-muted)' }}>SOON</span></div>
        <div style={{ marginTop: 3, fontSize: 12.5, lineHeight: 1.5, color: 'var(--hc-ink-muted)' }}>{children}</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { draft, setDraft, resetDraft } = useAppStore();
  // "Change" on the template picker comes back here with the JD still in the draft.
  const [jd, setJd] = useState(draft.jdFromHome ? draft.jd : '');
  const [ask, setAsk] = useState('');
  const loadAgents = useCallback(async () => toAgentList(await listAgents()), []);
  const agents = useResource(loadAgents);

  const words = countWords(jd);
  const tooLong = words > MAX_JD_WORDS;
  const canGo = words > 0 && !tooLong;
  const firstName = user.name.split(/\s+/)[0];

  // A new resume: the draft starts clean, carrying only this JD and its guessed company/role (SAVE-2).
  function go() {
    setDraft({ ...blankDraft(), jd, ...guessJobMeta(jd), jdFromHome: true });
    navigate('/new/template');
  }

  // The chat bar: the message goes to a new chat, which sends it straight away.
  function askAgents(e) {
    e.preventDefault();
    if (ask.trim()) navigate('/chat', { state: { message: ask.trim() } });
  }

  return (
    <>
      <main style={{ width: '100%', maxWidth: 980, margin: '0 auto', padding: '40px 24px 48px' }}>
      <h1 className="hc-disp" style={{ margin: 0, fontSize: 'clamp(24px,2.4vw,30px)', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.03em' }}>
        {greeting(new Date().getHours())}, <span className="hc-serif" style={{ color: 'var(--hc-brand)', fontSize: '1.1em' }}>{firstName}.</span>
      </h1>
      <p style={{ margin: '4px 0 0', fontSize: 14.5, color: 'var(--hc-ink-muted)' }}>Make a CV for your next job, or ask your agents about your search.</p>

      <section aria-labelledby="new-cv" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <h2 id="new-cv" className="hc-disp" style={sectionTitle}>Create a new resume</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13 }}>
            <Link to="/new/template" onClick={resetDraft} style={{ fontWeight: 600, textDecoration: 'none', minHeight: 32, display: 'inline-flex', alignItems: 'center' }}>Start from scratch</Link>
            <Link to="/resumes" style={{ fontWeight: 600, textDecoration: 'none', color: 'var(--hc-ink-muted)', minHeight: 32, display: 'inline-flex', alignItems: 'center' }}>Your resumes</Link>
          </div>
        </div>

        <div className="hc-card" style={{ marginTop: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, borderRadius: 18, borderColor: '#C9D3F7', boxShadow: '0 12px 30px rgba(63,95,216,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={iconTile('var(--hc-brand)', '#FFFFFF')}><FileText size={16} aria-hidden="true" /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Tailor it to a job</div>
              <div style={{ fontSize: 13, color: 'var(--hc-ink-muted)' }}>Paste the job description. Next you pick a template — and can upload your CV if you have one.</div>
            </div>
          </div>
          <div className="hc-jdbox" style={{ border: `${tooLong ? '1.5px solid var(--hc-warm)' : '1px solid var(--hc-hairline)'}`, borderRadius: 12, background: 'var(--hc-ground)', padding: '12px 14px' }}>
            <label htmlFor="home-jd" className="hc-sr-only">Job description</label>
            <textarea
              id="home-jd" className="hc-jd" style={{ minHeight: 104 }} aria-invalid={tooLong}
              placeholder="Paste the full job description here" value={jd} onChange={(e) => setJd(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <span className="hc-mono" style={{ fontSize: 11.5, fontWeight: tooLong ? 700 : 500, color: tooLong ? 'var(--hc-warm)' : 'var(--hc-ink-muted)' }}>{words.toLocaleString('en-US')} / {MAX_JD_WORDS.toLocaleString('en-US')} words</span>
            </div>
          </div>
          {tooLong && (
            <div role="alert" className="hc-rise hc-err" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <AlertCircle size={16} color="var(--hc-warm)" aria-hidden="true" style={{ flex: 'none', marginTop: 2 }} />
              <span><strong>This JD is {words.toLocaleString('en-US')} words — the limit is 1,000.</strong> Trim the “About us” and benefits parts; keep the role, responsibilities and requirements.</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {canGo
              ? <button type="button" className="hc-btn-p" onClick={go}>Continue — pick a template<ArrowRight size={15} aria-hidden="true" /></button>
              : <span className="hc-btn-off" aria-disabled="true" style={{ minHeight: 44, fontSize: 14 }}>Continue — pick a template</span>}
          </div>
        </div>
      </section>

      <section aria-labelledby="agents-h" style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <h2 id="agents-h" className="hc-disp" style={sectionTitle}>Your agents</h2>
            <div style={{ marginTop: 2, fontSize: 13, color: 'var(--hc-ink-muted)' }}>Type <span className="hc-mono" style={{ fontSize: 12, color: 'var(--hc-ink)' }}>@</span> in the chat bar to call any of them.</div>
          </div>
          <Link className="hc-btn-s" to="/agents/new" style={{ fontSize: 13 }}><Plus size={14} strokeWidth={2.4} aria-hidden="true" />Create agent</Link>
        </div>
        <ErrorBanner error={agents.error} action={{ label: 'Retry', onClick: agents.reload }} />
        {agents.data && (
          <>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {agents.data.mine.map((a) => <AgentCard key={a.id} agent={a} onOpen={() => navigate('/chat', { state: { agent: a.handle } })} />)}
              {!agents.data.atLimit && (
                <Link to="/agents/new" style={{ minHeight: 150, border: '1.5px dashed #C9D3F7', borderRadius: 16, background: '#F7F8FD', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', color: 'var(--hc-brand)', fontWeight: 700, fontSize: 14, textAlign: 'center', padding: 14 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 12, background: '#FFFFFF', border: '1px solid #C9D3F7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true"><Plus size={18} strokeWidth={2.4} /></span>
                  Create an agent
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--hc-ink-muted)' }}>For anything ours don’t do yet</span>
                </Link>
              )}
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>
              <span>Built in:</span>
              {[CV_WRITER, ...agents.data.builtin].map((a) => (
                <Link key={a.handle} to={a.kind === 'link' ? a.to : '/chat'} state={a.kind === 'link' ? undefined : { agent: a.handle }} onClick={a.kind === 'link' ? resetDraft : undefined}
                  className="hc-mono" title={a.description} style={{ fontSize: 12, color: 'var(--hc-ink)', background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 8, padding: '2px 7px', textDecoration: 'none' }}>@{a.handle}</Link>
              ))}
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="soon-h" style={{ marginTop: 32 }}>
        <h2 id="soon-h" className="hc-disp" style={sectionTitle}>Coming soon</h2>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          <SoonCard icon={Database} title="Honne IQ">Connect Drive, Notion and Gmail so every agent knows your whole search.</SoonCard>
          <div style={{ border: '1.5px dashed var(--hc-hairline)', borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--hc-ink-muted)', fontSize: 12.5, lineHeight: 1.5 }}>
            <Plus size={16} aria-hidden="true" style={{ flex: 'none' }} />New features show up here first.
          </div>
        </div>
      </section>
      </main>

      <div className="hc-dock">
        <form className={`hc-dockbar${ask.trim() ? ' is-big' : ''}`} onSubmit={askAgents}>
          <label htmlFor="home-ask" className="hc-sr-only">Ask your agents</label>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <button type="button" className="hc-icb" aria-label="Attach a file (coming soon)" title="Attach a file — coming soon" disabled style={{ width: 40, height: 40, borderRadius: 999 }}><Paperclip size={18} aria-hidden="true" /></button>
            <textarea id="home-ask" className="hc-ask" rows={1} maxLength={MESSAGE_MAX} placeholder="Ask your agents… type @" value={ask}
              onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) askAgents(e); }} />
            <button type="submit" aria-label="Send" disabled={!ask.trim()} style={{ flex: 'none', width: 40, height: 40, borderRadius: 999, border: 0, background: 'var(--hc-brand)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: ask.trim() ? 1 : 0.6 }}><ArrowUp size={17} strokeWidth={2.2} aria-hidden="true" /></button>
          </div>
          <div className="hc-docktools" style={{ flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6, paddingLeft: 44 }}>
            <span className="hc-tool" style={{ minHeight: 32, fontSize: 12.5 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--hc-success)', display: 'inline-block' }} /><span style={{ color: 'var(--hc-ink-muted)' }}>Knowledge</span> <strong>Profile + Database</strong></span>
            <span className="hc-tool" aria-disabled="true" title="Auto picks the right agent for you — coming soon" style={{ minHeight: 32, fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>Auto <ChevronDown size={12} aria-hidden="true" /><span className="hc-soon">SOON</span></span>
            <span className="hc-mono hc-hint" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--hc-ink-muted)' }}>@ agents · ↵ send</span>
          </div>
        </form>
      </div>
    </>
  );
}
