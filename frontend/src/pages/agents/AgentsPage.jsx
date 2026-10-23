import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import AgentAvatar from '@/components/AgentAvatar';
import PageTitle from '@/components/PageTitle';
import { ErrorBanner, PageLoading } from '@/components/Status';
import { EXAMPLES, knowledgeLabels, toAgentList } from '@/data/agentsAdapter';
import { CV_WRITER } from '@/data/chatAdapter';
import useResource from '@/hooks/useResource';
import { deleteAgent, listAgents } from '@/services/api';

// Agents list (Day_3 §2.1): the user's agents (Chat / Edit / Delete), Honne's built-in agents, and
// "New agent" — disabled with the reason at the limit (CUST-4). Empty state offers two examples.

const meta = (a) => [a.version > 1 ? `v${a.version}` : null, `${a.chatCount} chat${a.chatCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ');

function Chips({ keys }) {
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
      {knowledgeLabels(keys).map((k) => <span key={k} style={{ fontSize: 11.5, fontWeight: 600, background: '#F3F4F8', borderRadius: 999, padding: '3px 8px' }}>{k}</span>)}
    </span>
  );
}

function ConfirmDelete({ agent, busy, onCancel, onConfirm }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(14,18,38,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="ag-del-title" className="hc-rise" style={{ width: '100%', maxWidth: 420, background: '#FFFFFF', borderRadius: 20, padding: 24, boxShadow: '0 30px 80px rgba(14,18,38,.3)' }}>
        <h2 id="ag-del-title" className="hc-disp" style={{ margin: 0, fontSize: 21, fontWeight: 800 }}>Delete @{agent.handle}?</h2>
        <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.55, color: 'var(--hc-ink-muted)' }}>You won’t be able to call it any more. Chats it already answered stay as they are.</p>
        <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="hc-btn-s" onClick={onCancel} autoFocus>Cancel</button>
          <button type="button" disabled={busy} onClick={onConfirm} style={{ minHeight: 44, padding: '0 18px', borderRadius: 999, border: 0, background: 'var(--hc-warm)', color: '#FFFFFF', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: busy ? 'progress' : 'pointer' }}>Delete agent</button>
        </div>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const navigate = useNavigate();
  const load = useCallback(async () => toAgentList(await listAgents()), []);
  const res = useResource(load);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const chat = (handle) => navigate('/chat', { state: { agent: handle } });

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteAgent(confirm.id);
      res.setData((d) => ({ ...d, mine: d.mine.filter((a) => a.id !== confirm.id), atLimit: false }));
      setConfirm(null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const list = res.data;
  return (
    <main style={{ width: '100%', maxWidth: 1040, margin: '0 auto', padding: '40px 24px 64px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="hc-lbl">Agents · they only read your own data</div>
          <PageTitle before="Your" accent="agents" size="clamp(30px,3.4vw,42px)" style={{ marginTop: 6 }} />
          <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--hc-ink-muted)', maxWidth: 620 }}>Make an agent for anything ours don’t do yet. Call any of them in a chat by typing @ and its name.</p>
        </div>
        {list && (list.atLimit
          ? <span className="hc-btn-off" aria-disabled="true" title={`You have ${list.limit} agents, the most during the beta. Delete one to make another.`} style={{ minHeight: 44, fontSize: 14 }}>New agent · limit of {list.limit} reached</span>
          : <Link className="hc-btn-p" to="/agents/new"><Plus size={15} strokeWidth={2.4} aria-hidden="true" />New agent</Link>)}
      </div>

      {res.loading && <PageLoading />}
      <ErrorBanner error={res.error} action={{ label: 'Retry', onClick: res.reload }} />
      <ErrorBanner error={error} />

      {list && (
        <>
          <section aria-labelledby="mine-h" style={{ marginTop: 28 }}>
            <h2 id="mine-h" className="hc-disp" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Made by you <span className="hc-mono" style={{ fontSize: 13, color: 'var(--hc-ink-muted)' }}>{list.mine.length} / {list.limit}</span></h2>
            {list.mine.length === 0 ? (
              <div className="hc-card" style={{ marginTop: 12, padding: 22, borderRadius: 16 }}>
                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6 }}>An agent is a short set of instructions — what to look at and what to give you — that runs on your profile, resumes and Database. Write it once, then call it in any chat.</p>
                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                  {EXAMPLES.slice(0, 2).map((x) => (
                    <Link key={x.handle} to="/agents/new" state={{ example: x.handle }} className="hc-agent is-link">
                      <span className="hc-mono" style={{ fontSize: 13.5, fontWeight: 700 }}>Start from @{x.handle}</span>
                      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--hc-ink-muted)' }}>{x.description}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {list.mine.map((a) => (
                  <div key={a.id} className="hc-agent">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AgentAvatar agent={a} size={32} />
                      <span style={{ minWidth: 0 }}><span className="hc-mono" style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>@{a.handle}</span><span style={{ display: 'block', fontSize: 11.5, color: 'var(--hc-ink-muted)' }}>Made by you · {meta(a)}</span></span>
                    </span>
                    <span style={{ fontSize: 13, lineHeight: 1.5, color: '#3D4357' }}>{a.description}</span>
                    <Chips keys={a.knowledge} />
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      <button type="button" className="hc-btn-sm" onClick={() => chat(a.handle)} style={{ border: 0, background: 'var(--hc-brand)', color: '#FFFFFF' }}><MessageSquare size={14} aria-hidden="true" />Chat</button>
                      <Link className="hc-btn-sm" to={`/agents/${a.id}/edit`} style={{ border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink)', textDecoration: 'none' }}><Pencil size={14} aria-hidden="true" />Edit</Link>
                      <button type="button" className="hc-btn-sm" onClick={() => setConfirm(a)} aria-label={`Delete @${a.handle}`} style={{ border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-warm)' }}><Trash2 size={14} aria-hidden="true" />Delete</button>
                    </span>
                  </div>
                ))}
                {!list.atLimit && (
                  <Link to="/agents/new" style={{ minHeight: 150, border: '1.5px dashed #C9D3F7', borderRadius: 16, background: '#F7F8FD', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textDecoration: 'none', color: 'var(--hc-brand)', fontWeight: 700, fontSize: 14, textAlign: 'center', padding: 14 }}>
                    <Plus size={18} strokeWidth={2.4} aria-hidden="true" />Create an agent
                  </Link>
                )}
              </div>
            )}
          </section>

          <section aria-labelledby="ours-h" style={{ marginTop: 32 }}>
            <h2 id="ours-h" className="hc-disp" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Honne agents</h2>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {[{ ...CV_WRITER, knowledge: ['profile'] }, ...list.builtin].map((a) => (
                <div key={a.handle} className="hc-agent">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AgentAvatar agent={{ ...a, kind: 'builtin' }} size={32} />
                    <span className="hc-mono" style={{ fontSize: 13.5, fontWeight: 700 }}>@{a.handle}</span>
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: '#3D4357' }}>{a.description}</span>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
                    {a.kind === 'link'
                      ? <Link className="hc-btn-sm" to={a.to} style={{ border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink)', textDecoration: 'none' }}>Tailor a CV</Link>
                      : <button type="button" className="hc-btn-sm" onClick={() => chat(a.handle)} style={{ border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink)' }}><MessageSquare size={14} aria-hidden="true" />Chat</button>}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {confirm && <ConfirmDelete agent={confirm} busy={busy} onCancel={() => setConfirm(null)} onConfirm={remove} />}
    </main>
  );
}
