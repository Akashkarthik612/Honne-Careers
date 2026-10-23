import { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, FlaskConical, X } from 'lucide-react';
import { ErrorBanner, PageLoading } from '@/components/Status';
import {
  CONNECTORS_SOON, DESCRIPTION_MAX, EXAMPLES, GUARDRAILS_MAX, INSTRUCTIONS_MAX, KNOWLEDGE, KNOWLEDGE_SOON, agentToForm, blankForm,
  fieldErrors, formToRequest, formToUpdate, normaliseHandle, slugHandle, toAgent, toAgentList, validateAgent,
} from '@/data/agentsAdapter';
import useResource from '@/hooks/useResource';
import { createAgent, getAgent, listAgents, updateAgent } from '@/services/api';
import TryItDrawer from './TryItDrawer';

// Agent builder (design: Agents.dc.html), for /agents/new and /agents/:id/edit. Day 3 adds the one-line
// Description (shown on cards and in the @ picker) and "Try it" (CUST-3). Editing saves a new version;
// chats keep the version that answered them. Errors show on their field and are never auto-fixed.

const card = { padding: 18 };
const h2 = { margin: 0, fontSize: 15.5, fontWeight: 700 };
const sub = { margin: '2px 0 0', fontSize: 13, color: 'var(--hc-ink-muted)' };
const fieldErr = (text) => text && <div role="alert" style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--hc-warm)' }}>{text}</div>;
const counter = (n, max) => <span className="hc-mono" style={{ fontSize: 11.5, color: n > max ? 'var(--hc-warm)' : 'var(--hc-ink-muted)' }}>{n.toLocaleString('en-US')} / {max.toLocaleString('en-US')}</span>;

function Form({ initial, agent, atLimit, limit }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [serverErrors, setServerErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);       // the saved agent
  const [trying, setTrying] = useState(false);
  const [current, setCurrent] = useState(agent);  // the agent as last saved (row_version for the next save)
  const editing = Boolean(current);

  const errors = validateAgent(form);
  const canSave = !Object.keys(errors).length && !atLimit;
  const handle = normaliseHandle(form.name);
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setServerErrors({}); };
  // A field's error: the server's, or ours once the field has something in it (empty fields don't shout).
  const show = (key) => serverErrors[key] || (form[key] ? errors[key] : null) || null;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const r = editing ? await updateAgent(current.id, formToUpdate(form, current.rowVersion)) : await createAgent(formToRequest(form));
      setCurrent(toAgent(r));
      setSaved(toAgent(r));
    } catch (e) {
      const byField = fieldErrors(e);
      if (byField) setServerErrors(byField); else setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <main className="hc-rise" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', minHeight: '100vh' }}>
        <div className="hc-card" style={{ maxWidth: 460, width: '100%', textAlign: 'center', padding: '30px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, borderRadius: 16 }}>
          <span style={{ width: 52, height: 52, borderRadius: 16, background: '#E8F5EC', color: 'var(--hc-success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden="true"><Check size={28} strokeWidth={2.6} /></span>
          <h1 className="hc-disp" style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}><span className="hc-mono" style={{ fontSize: '.85em' }}>@{saved.handle}</span> is ready.</h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--hc-ink-muted)' }}>
            Type <span className="hc-mono" style={{ color: 'var(--hc-ink)' }}>@{saved.handle}</span> in any chat to call it. {saved.version > 1 ? `This is version ${saved.version}; older chats keep the version they used.` : 'It also shows on your Home.'}
          </p>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            <button type="button" className="hc-btn-p" onClick={() => navigate('/chat', { state: { agent: saved.handle } })}>Open a chat</button>
            <Link className="hc-btn-s" to="/agents">Your agents</Link>
            <button type="button" className="hc-btn-s" onClick={() => setSaved(null)}>Edit agent</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(246,247,250,.94)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid var(--hc-hairline)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="hc-disp" style={{ margin: 0, fontSize: 18, fontWeight: 800, flex: 1 }}>
            {editing ? <>Edit <span className="hc-mono" style={{ fontSize: '.85em' }}>@{current.handle}</span></> : <>Create an <span className="hc-serif" style={{ color: 'var(--hc-brand)', fontSize: '1.1em' }}>agent</span></>}
          </h1>
          <Link to="/agents" aria-label="Close" style={{ width: 40, height: 40, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--hc-ink)', border: '1px solid var(--hc-hairline)', background: '#FFFFFF' }}><X size={16} aria-hidden="true" /></Link>
        </div>
      </header>

      <main style={{ flex: 1, width: '100%', maxWidth: 760, margin: '0 auto', padding: '28px 24px 48px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: '0 0 4px', fontSize: 13.5, lineHeight: 1.55, color: 'var(--hc-ink-muted)' }}>Our agents handle CVs, analysis and advice. If you need something else, describe it here — your agent uses your profile and Database, just like ours.</p>
        {atLimit && <ErrorBanner error={`You have ${limit} agents, the most during the beta. Delete one to make another.`} style={{ marginTop: 0 }} />}

        <section className="hc-card" style={card} aria-labelledby="a-name">
          <h2 id="a-name" style={h2}>Agent name</h2>
          <p style={sub}>You’ll call it in chat by typing @ and its name.</p>
          <div className="hc-focus-within" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${show('name') ? 'var(--hc-warm)' : 'var(--hc-hairline)'}`, borderRadius: 12, background: 'var(--hc-ground)', paddingLeft: 14 }}>
            <span className="hc-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--hc-brand)' }} aria-hidden="true">@</span>
            <label htmlFor="ag-name" className="hc-sr-only">Agent name</label>
            <input id="ag-name" type="text" value={form.name} maxLength={31} autoComplete="off" spellCheck={false} placeholder="interview-prep" aria-invalid={Boolean(show('name'))}
              onChange={(e) => set({ name: slugHandle(e.target.value) })}
              style={{ flex: 1, minWidth: 0, minHeight: 44, border: 0, outline: 'none', background: 'transparent', fontFamily: 'var(--hc-font-mono)', fontSize: 14, color: 'var(--hc-ink)' }} />
          </div>
          {show('name') ? fieldErr(show('name')) : <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>{handle ? `You’ll type @${handle} to call it.` : 'Lower case, no spaces — e.g. interview-prep.'}</div>}
        </section>

        <section className="hc-card" style={card} aria-labelledby="a-desc">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <h2 id="a-desc" style={h2}>Description</h2>{counter(form.description.length, DESCRIPTION_MAX)}
          </div>
          <p style={sub}>One line on what it’s for. Shown on your Home and when you type @.</p>
          <label htmlFor="ag-desc" className="hc-sr-only">Description</label>
          <input id="ag-desc" className="hc-in" style={{ marginTop: 12 }} value={form.description} maxLength={DESCRIPTION_MAX + 20} placeholder="Drafts follow-ups for applications with no reply"
            aria-invalid={Boolean(show('description'))} onChange={(e) => set({ description: e.target.value })} />
          {fieldErr(show('description'))}
        </section>

        <section className="hc-card" style={card} aria-labelledby="a-instr">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <h2 id="a-instr" style={h2}>Instructions</h2>{counter(form.instructions.length, INSTRUCTIONS_MAX)}
          </div>
          <p style={sub}>What should it do, step by step? Plain words are fine.</p>
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>Start from an example:</span>
            {EXAMPLES.map((x) => (
              <button key={x.handle} type="button" className="hc-ex"
                onClick={() => set({ instructions: x.instructions, name: form.name || x.handle, description: form.description || x.description })}>{x.label}</button>
            ))}
          </div>
          <label htmlFor="ag-instr" className="hc-sr-only">Instructions</label>
          <textarea id="ag-instr" className="hc-ta" value={form.instructions} aria-invalid={Boolean(show('instructions'))} onChange={(e) => set({ instructions: e.target.value })}
            placeholder="e.g. Before each interview, read the JD and my CV for that company from the Database. Give me 10 likely questions and a short answer outline for each, using only my real experience."
            style={{ marginTop: 10, minHeight: 130 }} />
          {fieldErr(show('instructions'))}
        </section>

        <section className="hc-card" style={card} aria-labelledby="a-kn">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 id="a-kn" style={h2}>Knowledge</h2>
              <p style={sub}>What it can read. It only ever reads your own data, and never changes it.</p>
            </div>
            <span className="hc-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--hc-ink-muted)', paddingTop: 4 }}>{form.knowledge.length} selected</span>
          </div>
          <div style={{ marginTop: 12, border: '1px solid var(--hc-hairline)', borderRadius: 12, overflow: 'hidden' }}>
            {KNOWLEDGE.map((k) => (
              <label key={k.key} className="hc-src" htmlFor={`kn-${k.key}`}>
                <span style={{ flex: 'none', width: 28, height: 28, borderRadius: 8, background: 'var(--hc-brand-tint)', color: 'var(--hc-brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }} aria-hidden="true">{k.ic}</span>
                <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{k.label}</span><span style={{ display: 'block', fontSize: 12, color: 'var(--hc-ink-muted)' }}>{k.help}</span></span>
                <input id={`kn-${k.key}`} type="checkbox" checked={form.knowledge.includes(k.key)} style={{ width: 20, height: 20, accentColor: 'var(--hc-brand)', margin: 0 }}
                  onChange={() => set({ knowledge: form.knowledge.includes(k.key) ? form.knowledge.filter((x) => x !== k.key) : [...form.knowledge, k.key] })} />
              </label>
            ))}
            {KNOWLEDGE_SOON.map((k) => (
              <div key={k.key} className="hc-src" aria-disabled="true">
                <span style={{ flex: 'none', width: 28, height: 28, borderRadius: 8, background: '#F0F1F5', color: 'var(--hc-ink-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }} aria-hidden="true">{k.ic}</span>
                <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{k.label}</span><span style={{ display: 'block', fontSize: 12 }}>{k.help}</span></span>
                <span className="hc-soon">SOON</span>
              </div>
            ))}
          </div>
          {fieldErr(serverErrors.knowledge || (form.knowledge.length === 0 && errors.knowledge))}
          <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600 }}>Connect more</div>
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
            {CONNECTORS_SOON.map((c) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--hc-hairline)', borderRadius: 12, padding: '8px 8px 8px 12px', minHeight: 44, color: 'var(--hc-ink-muted)' }}>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{c}</span><span className="hc-soon">SOON</span>
              </div>
            ))}
          </div>
        </section>

        <section className="hc-card" style={card} aria-labelledby="a-guard">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
            <h2 id="a-guard" style={h2}>Guardrails</h2>{counter(form.guardrails.length, GUARDRAILS_MAX)}
          </div>
          <p style={sub}>What your agent must never do. We’ve added the Honne basics; ours always apply too.</p>
          <label htmlFor="ag-guard" className="hc-sr-only">Guardrails</label>
          <textarea id="ag-guard" className="hc-ta" value={form.guardrails} aria-invalid={Boolean(show('guardrails'))} onChange={(e) => set({ guardrails: e.target.value })} style={{ marginTop: 10, minHeight: 92 }} />
          {fieldErr(show('guardrails'))}
        </section>

        <ErrorBanner error={error} action={error?.code === 'stale_version' ? { label: 'Reload', onClick: () => window.location.reload() } : null} />
      </main>

      <footer style={{ position: 'sticky', bottom: 0, zIndex: 10, background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderTop: '1px solid var(--hc-hairline)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '10px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Link className="hc-btn-s" to="/agents">Cancel</Link>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button type="button" className="hc-btn-s" disabled={Boolean(Object.keys(errors).length)} onClick={() => setTrying(true)}
              title={Object.keys(errors).length ? 'Add a name, description and instructions first' : 'Send a test message; nothing is saved'}
              style={{ opacity: Object.keys(errors).length ? 0.55 : 1, cursor: Object.keys(errors).length ? 'default' : 'pointer' }}>
              <FlaskConical size={15} aria-hidden="true" />Try it
            </button>
            {canSave
              ? <button type="button" className="hc-btn-p" onClick={save} disabled={busy} style={{ minHeight: 44, fontSize: 14, cursor: busy ? 'progress' : 'pointer' }}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Save agent'}</button>
              : <span className="hc-btn-off" aria-disabled="true" style={{ minHeight: 44, fontSize: 14, padding: '0 20px' }}>{atLimit ? 'Agent limit reached' : 'Add a name, description and instructions'}</span>}
          </div>
        </div>
      </footer>

      {trying && <TryItDrawer form={form} onClose={() => setTrying(false)} />}
    </div>
  );
}

// The empty Agents list links here with { example: 'follow-up' } to start from one of the examples.
function startForm(exampleHandle) {
  const x = EXAMPLES.find((e) => e.handle === exampleHandle);
  return x ? { ...blankForm(), name: x.handle, description: x.description, instructions: x.instructions } : blankForm();
}

export default function AgentBuilderPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const load = useCallback(async () => {
    if (id) return { agent: toAgent(await getAgent(id)), list: null };
    return { agent: null, list: toAgentList(await listAgents()) };
  }, [id]);
  const res = useResource(load);

  if (res.loading) return <main style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px' }}><PageLoading /></main>;
  if (res.error) return <main style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px' }}><ErrorBanner error={res.error} action={{ label: 'Retry', onClick: res.reload }} /></main>;
  const { agent, list } = res.data;
  return <Form key={id ?? 'new'} initial={agent ? agentToForm(agent) : startForm(state?.example)} agent={agent} atLimit={Boolean(list?.atLimit)} limit={list?.limit} />;
}
