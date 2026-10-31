import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, ArrowUp, ArrowUpRight, Briefcase, Calendar, ChartLine, ChevronDown, ChevronRight,
  CircleCheck, Mail, Paperclip, Plus, Sparkles,
} from 'lucide-react';
import { MAX_JD_WORDS } from '@/config/limits';
import { MESSAGE_MAX, toAgentList } from '@/data/agentsAdapter';
import { shortDate, statusLabel, toApplicationList } from '@/data/applications';
import { contentToProfile, openPath, toSummary } from '@/data/cvAdapter';
import { countWords, guessJobMeta } from '@/data/cvModel';
import { HOME_APPLICATIONS, homeInsights, homeStats, profileProgress, recentCvs, STATUS_DOT, teamOf } from '@/data/home';
import { templateName } from '@/data/templates';
import useResource from '@/hooks/useResource';
import { getProfile, listAgents, listApplications, listResumes } from '@/services/api';
import { blankDraft, useAppStore } from '@/state/appStore';
import { useAuth } from '@/state/auth';

// Home dashboard (design: Home.dc.html + HomeNewUser / HomeLoading / HomeError): the start page after sign-in.
// Every number comes from the user's own data (GET /applications, /resumes, /agents, /profile); each card
// loads, fails and retries on its own. Pasting a JD starts a tailored resume with the Mode step skipped
// (template → JD page, draft.jdFromHome); the chat bar sends its message to a new chat.

const rise = (s) => ({ animationDelay: `${s}s` });
const sk = (w, h, extra) => <span className="hc-sk" style={{ display: 'block', width: w, height: h, borderRadius: 8, ...extra }} />;
const muted = { fontSize: 13.5, color: 'var(--hc-ink-muted)' };
const tile = (bg, fg, size = 32) => ({ flex: 'none', width: size, height: size, borderRadius: 10, background: bg, color: fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' });

const KPIS = [
  { key: 'applications', label: 'Applications', sub: 'Total submitted', icon: Briefcase },
  { key: 'replies', label: 'Recruiter replies', sub: 'Responses received', icon: Mail },
  { key: 'interviews', label: 'Active interviews', sub: 'In progress', icon: Calendar },
];
const TEAM_ICON = { analyst: ChartLine, outreach: Mail, fit: CircleCheck };
const INSIGHT_LOOK = {
  start: [Plus, 'var(--hc-brand-tint)', 'var(--hc-brand)'],
  interviews: [Calendar, 'var(--hc-brand-tint)', 'var(--hc-brand)'],
  'follow-up': [Mail, '#FFF4EE', '#B45309'],
  fit: [ChartLine, '#F3F4F8', '#3D4357'],
};

function Kpis({ apps }) {
  const stats = apps.data ? homeStats(apps.data.rows) : null;
  return (
    <section aria-label="Career overview" className="hc-kpis">
      {KPIS.map(({ key, label, sub, icon: Icon }, i) => {
        const value = stats ? stats[key] : '—';
        const aria = `${label}: ${apps.loading ? 'loading' : stats ? value : 'unavailable'}. Open Applications.`;
        return (
          <Link key={key} className="hc-kpi hc-rise" to="/database" aria-label={aria} style={rise(0.06 + i * 0.05)}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={tile('var(--hc-brand-tint)', 'var(--hc-brand)')} aria-hidden="true"><Icon size={16} /></span>
              <ArrowUpRight className="hc-ksup" size={14} color="var(--hc-ink-faint)" aria-hidden="true" />
            </span>
            {apps.loading ? sk(56, 30, { marginTop: 12 }) : <span className="hc-knum">{value}</span>}
            <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
            <span className="hc-ksup" style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>{apps.error ? 'Couldn’t load' : sub}</span>
          </Link>
        );
      })}
    </section>
  );
}

function TailorCard({ jdRef }) {
  const navigate = useNavigate();
  const { draft, setDraft } = useAppStore();
  // "Change" on the template picker comes back here with the JD still in the draft.
  const [jd, setJd] = useState(draft.jdFromHome ? draft.jd : '');
  const words = countWords(jd);
  const tooLong = words > MAX_JD_WORDS;
  const canGo = words > 0 && !tooLong;

  // A new resume: the draft starts clean, carrying only this JD and its guessed company/role (SAVE-2).
  function go() {
    setDraft({ ...blankDraft(), jd, ...guessJobMeta(jd), jdFromHome: true });
    navigate('/new/template');
  }

  return (
    <section id="tailor" aria-labelledby="tl-h" className="hc-card hc-rise" style={{ ...rise(0.2), position: 'relative', overflow: 'hidden', borderRadius: 18, padding: 'clamp(18px,2.6vw,26px)', borderColor: '#C9D3F7', boxShadow: '0 1px 2px rgba(22,26,43,.04), 0 18px 44px rgba(63,95,216,.07)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', right: -140, top: -160, width: 420, height: 320, borderRadius: 999, background: 'radial-gradient(closest-side, rgba(77,112,235,.12), rgba(77,112,235,0))', pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>
        <h2 id="tl-h" className="hc-disp" style={{ margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.02em' }}>Tailor your CV for your next role</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14.5, color: 'var(--hc-ink-muted)' }}>Add a job description and create a CV tailored to the opportunity.</p>
      </div>
      <div className="hc-hjd" style={{ position: 'relative', marginTop: 16 }}>
        <label htmlFor="home-jd" className="hc-sr-only">Job description</label>
        <textarea
          id="home-jd" ref={jdRef} className="hc-jd" aria-describedby="jd-count" aria-invalid={tooLong}
          placeholder="Paste the job description here: the role, responsibilities and requirements."
          value={jd} onChange={(e) => setJd(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 16px 10px', minHeight: 42, alignItems: 'center' }}>
          <span id="jd-count" className="hc-mono" style={{ fontSize: 12, fontWeight: 700, color: tooLong ? 'var(--hc-warm)' : 'var(--hc-ink-muted)' }}>
            {words === 0 ? 'Paste a JD to start' : `${words.toLocaleString('en-US')} / ${MAX_JD_WORDS.toLocaleString('en-US')} words`}
          </span>
        </div>
      </div>
      {tooLong && (
        <div role="alert" className="hc-rise hc-err" style={{ marginTop: 10, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <AlertCircle size={16} color="var(--hc-warm)" aria-hidden="true" style={{ flex: 'none', marginTop: 2 }} />
          <span><strong>That’s over {MAX_JD_WORDS.toLocaleString('en-US')} words.</strong> Trim the “About us” and benefits parts and keep the role, responsibilities and requirements.</span>
        </div>
      )}
      <div className="hc-tailfoot" style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--hc-ink-muted)' }}>Uses only what’s in your profile. Nothing invented.</span>
        <div className="hc-tailfoot" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <Link className="hc-btn-s" to="/resumes">Use a saved CV</Link>
          {canGo
            ? <button type="button" className="hc-btn-p" onClick={go}>Tailor my CV<ArrowRight size={15} aria-hidden="true" /></button>
            : <span className="hc-btn-off" aria-disabled="true" title={tooLong ? `Trim the JD to ${MAX_JD_WORDS.toLocaleString('en-US')} words` : 'Paste a job description first'} style={{ minHeight: 46, padding: '0 22px' }}>Tailor my CV</span>}
        </div>
      </div>
    </section>
  );
}

function Retry({ title, text, res }) {
  return (
    <div role="alert" className="hc-hline" style={{ padding: '28px 18px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
      <strong style={{ fontSize: 15 }}>{title}</strong>
      <span style={muted}>{text}</span>
      {res.error?.correlationId && <span className="hc-mono" style={{ fontSize: 11.5, color: 'var(--hc-ink-muted)' }}>Reference {res.error.correlationId}</span>}
      <button type="button" className="hc-btn-s" onClick={res.reload} style={{ minHeight: 40 }}>Try again</button>
    </div>
  );
}

function ApplicationsCard({ apps }) {
  const rows = apps.data?.rows.slice(0, HOME_APPLICATIONS) ?? [];
  return (
    <section aria-labelledby="ap-h" className="hc-hcard">
      <div className="hc-hhead">
        <h2 id="ap-h">Your applications</h2>
        <Link className="hc-lnk" to="/database">View all applications<ArrowRight size={13} aria-hidden="true" /></Link>
      </div>
      {apps.loading && (
        <div aria-busy="true" aria-label="Loading applications">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="hc-hline" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '0 18px' }}>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>{sk('40%', 12)}{sk('26%', 10)}</span>
              {sk(84, 22, { borderRadius: 999 })}
            </div>
          ))}
        </div>
      )}
      {apps.error && <Retry title="Couldn’t load your applications." text="Your data is safe. This is usually a short connection problem." res={apps} />}
      {apps.data && rows.length === 0 && (
        <div className="hc-hline" style={{ padding: '34px 18px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
          <span style={tile('var(--hc-brand-tint)', 'var(--hc-brand)', 44)} aria-hidden="true"><Briefcase size={20} /></span>
          <strong style={{ fontSize: 15.5 }}>No applications tracked yet.</strong>
          <span style={{ ...muted, maxWidth: 340 }}>Start tracking applications to keep your job search organized. Each one keeps its JD and the exact CV you sent.</span>
          <Link className="hc-btn-s" to="/database?add=1" style={{ marginTop: 6, minHeight: 40 }}>Add an application</Link>
        </div>
      )}
      {rows.length > 0 && (
        <div role="list">
          {rows.map((r) => {
            const [dot, ink] = STATUS_DOT[r.status];
            const company = r.company || 'Company not set';
            return (
              <Link key={r.id} className="hc-hrow" role="listitem" to={`/database?open=${r.id}`} aria-label={`${company}, ${r.role}, ${shortDate(r.sentAt)}, ${statusLabel(r.status)}. View record.`}>
                <span className="c-main" style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{company}</span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--hc-ink-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.role}</span>
                </span>
                <span className="c-date hc-mono" style={{ fontSize: 12, color: 'var(--hc-ink-muted)' }}>{shortDate(r.sentAt)}</span>
                <span className="c-status" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <span style={{ flex: 'none', width: 8, height: 8, borderRadius: 99, background: dot }} /><span style={{ color: ink }}>{statusLabel(r.status)}</span>
                </span>
                <span className="c-view" style={{ fontSize: 13, fontWeight: 600, color: 'var(--hc-brand)', textAlign: 'right' }}>View</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TeamCard({ agents }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const chat = (handle) => navigate('/chat', { state: { agent: handle } });
  const mine = agents.data?.mine ?? [];
  return (
    <section aria-labelledby="ai-h" className="hc-hcard">
      <div style={{ padding: '16px 18px 12px' }}>
        <h2 id="ai-h" className="hc-disp" style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>Your AI career team</h2>
        <p style={{ margin: '3px 0 0', ...muted }}>Get personalized help using your saved career information.</p>
      </div>
      {agents.loading && [1, 2, 3].map((n) => (
        <div key={n} className="hc-hline" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, padding: '0 18px' }}>
          {sk(34, 34, { borderRadius: 10 })}<span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>{sk('50%', 12)}{sk('80%', 10)}</span>
        </div>
      ))}
      {agents.error && <Retry title="Couldn’t load your agents." text="Try again in a moment." res={agents} />}
      {agents.data && teamOf(agents.data.builtin).map((t) => {
        const Icon = TEAM_ICON[t.handle];
        return (
          <button key={t.handle} type="button" className="hc-team" onClick={() => chat(t.handle)}>
            <span style={tile('#F3F4F8', '#3D4357', 34)} aria-hidden="true"><Icon size={16} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14.5, fontWeight: 700 }}>{t.title}</span>
                <span className="hc-mono" style={{ fontSize: 11.5, color: 'var(--hc-ink-muted)' }}>@{t.handle}</span>
              </span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--hc-ink-muted)', lineHeight: 1.45 }}>{t.desc}</span>
            </span>
            <ChevronRight className="hc-chev" size={15} color="var(--hc-ink-faint)" aria-hidden="true" />
          </button>
        );
      })}
      {agents.data && (
        <>
          <div className="hc-hline">
            <button type="button" className="hc-team" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ borderTop: 0 }}>
              <span style={{ ...tile('#F3F4F8', '#3D4357', 34), border: '1px dashed var(--hc-ink-faint)' }} aria-hidden="true"><Sparkles size={16} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700 }}>My custom agents</span>
                  <span className="hc-mono" style={{ fontSize: 11.5, color: 'var(--hc-ink-muted)' }}>{mine.length}</span>
                </span>
                <span style={{ display: 'block', fontSize: 13, color: 'var(--hc-ink-muted)', lineHeight: 1.45 }}>Access the specialized assistants you’ve created.</span>
              </span>
              <ChevronDown size={15} color="var(--hc-ink-faint)" aria-hidden="true" style={{ flex: 'none', transition: 'transform .2s ease', transform: `rotate(${open ? 180 : 0}deg)` }} />
            </button>
            {open && (
              <div className="hc-rise" style={{ padding: '0 18px 14px 64px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {mine.map((a) => (
                  <button key={a.id} type="button" className="hc-mono" onClick={() => chat(a.handle)} title={a.description}
                    style={{ display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '0 12px', borderRadius: 999, border: '1px solid var(--hc-hairline)', background: '#FFFFFF', fontSize: 12.5, fontWeight: 700, color: 'var(--hc-ink)', cursor: 'pointer' }}>@{a.handle}</button>
                ))}
                {mine.length === 0 && <span style={{ fontSize: 13, color: 'var(--hc-ink-muted)' }}>You haven’t created one yet.</span>}
              </div>
            )}
          </div>
          <div className="hc-hline" style={{ padding: '12px 18px' }}>
            <Link className="hc-lnk" to={agents.data.atLimit ? '/agents' : '/agents/new'}><Plus size={14} strokeWidth={2.4} aria-hidden="true" />Create your own AI agent</Link>
          </div>
        </>
      )}
    </section>
  );
}

function InsightsCard({ apps, onTailor }) {
  const navigate = useNavigate();
  const insights = apps.data ? homeInsights(apps.data.rows) : [];
  function act(i) {
    if (i.to === '#tailor') onTailor();
    else navigate(i.to, i.agent ? { state: { agent: i.agent } } : undefined);
  }
  return (
    <section aria-labelledby="in-h" className="hc-hcard">
      <div className="hc-hhead" style={{ alignItems: 'baseline' }}>
        <h2 id="in-h">Career insights</h2>
        <span style={{ fontSize: 12, color: 'var(--hc-ink-muted)' }}>{apps.error ? 'Unavailable right now' : 'Based on your Applications'}</span>
      </div>
      {apps.loading && <div className="hc-hline" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>{sk('80%', 12)}{sk('60%', 12)}</div>}
      {apps.error && <div className="hc-hline" style={{ padding: '16px 18px', ...muted }}>Insights will show once your applications load.</div>}
      {insights.map((i) => {
        const [Icon, bg, fg] = INSIGHT_LOOK[i.key];
        return (
          <div key={i.key} className="hc-hline" style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 18px' }}>
            <span style={{ ...tile(bg, fg, 30), borderRadius: 9 }} aria-hidden="true"><Icon size={15} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{i.text}</div>
              <button type="button" className="hc-lnk" onClick={() => act(i)} style={{ minHeight: 32 }}>{i.cta} →</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function CvsCard({ cvs }) {
  const navigate = useNavigate();
  const list = cvs.data ? recentCvs(cvs.data.resumes) : [];
  return (
    <section aria-labelledby="cv-h" className="hc-hcard">
      <div className="hc-hhead">
        <h2 id="cv-h">Your CVs</h2>
        <Link className="hc-lnk" to="/resumes">View all CVs →</Link>
      </div>
      {cvs.loading && [1, 2, 3].map((n) => (
        <div key={n} className="hc-hline" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '0 18px' }}>
          {sk(30, 36, { borderRadius: 6 })}<span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>{sk('55%', 12)}{sk('30%', 10)}</span>
        </div>
      ))}
      {cvs.error && <Retry title="Couldn’t load your CVs." text="Try again in a moment." res={cvs} />}
      {cvs.data && list.length === 0 && <div className="hc-hline" style={{ padding: '22px 18px', ...muted }}>Your CVs will appear here once you create one.</div>}
      {list.map((c) => {
        const ready = c.state === 'ready';
        return (
          <div key={c.id} className="hc-hline" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 60, padding: '8px 18px' }}>
            <span aria-hidden="true" style={{ flex: 'none', width: 30, height: 36, borderRadius: 5, border: '1px solid var(--hc-hairline)', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 3, padding: '6px 5px' }}>
              <span style={{ height: 2, width: '70%', background: 'var(--hc-ink)', borderRadius: 2 }} />
              {['100%', '100%', '80%'].map((w, n) => <span key={n} style={{ height: 2, width: w, background: 'var(--hc-hairline)', borderRadius: 2 }} />)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>{templateName(c.template)} · {ready ? `updated ${shortDate(c.updatedAt)}` : c.state === 'draft' ? `draft, step ${c.stepNo} of 5` : c.state === 'tailoring' ? 'tailoring…' : 'tailoring didn’t finish'}</span>
            </span>
            <Link to={ready ? `/new/details?resume=${c.id}&step=experience` : openPath(c)} aria-label={`${ready ? 'Edit' : 'Open'} ${c.title}`}
              style={{ display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '0 10px', borderRadius: 999, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>{ready ? 'Edit' : 'Open'}</Link>
            {/* Download happens on the CV page, which also saves the download to the Database (SAVE-1). */}
            {ready && (
              <button type="button" className="hc-btn-sm" onClick={() => navigate(`/cv/${c.id}`)} aria-label={`Download ${c.title} as PDF`}
                style={{ border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink)', fontWeight: 600 }}>Download</button>
            )}
          </div>
        );
      })}
    </section>
  );
}

async function loadResumes() {
  return { resumes: (await listResumes()).map(toSummary) };
}
async function loadProfile() {
  const p = await getProfile();
  return p ? contentToProfile(p.content) : null;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ask, setAsk] = useState('');
  const jdRef = useRef(null);
  const apps = useResource(useCallback(async () => toApplicationList(await listApplications()), []));
  const agents = useResource(useCallback(async () => toAgentList(await listAgents()), []));
  const cvs = useResource(loadResumes);
  const profile = useResource(loadProfile);

  const firstName = user.name.split(/\s+/)[0];
  // New user = nothing tracked and no CV yet; decided only once both have loaded.
  const isNew = apps.data?.rows.length === 0 && cvs.data?.resumes.length === 0;
  const progress = profile.loading || profile.error ? null : profileProgress(profile.data);

  function focusJd() {
    jdRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    jdRef.current?.focus({ preventScroll: true });
  }

  // The chat bar: the message goes to a new chat, which sends it straight away.
  function askAgents(e) {
    e.preventDefault();
    if (ask.trim()) navigate('/chat', { state: { message: ask.trim() } });
  }

  return (
    <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <main className="hc-home">
        <header className="hc-rise" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 className="hc-disp" style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.03em' }}>
              {isNew ? 'Welcome' : 'Welcome back'}, <span className="hc-serif" style={{ color: 'var(--hc-brand)', fontSize: '1.12em', letterSpacing: '-0.01em' }}>{firstName}.</span>
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--hc-ink-muted)' }}>{isNew ? 'Let’s get your job search started.' : 'Your job search, all in one place.'}</p>
          </div>
          <Link className="hc-btn-s" to="/database?add=1" style={{ minHeight: 40, fontSize: 13.5 }}><Plus size={14} strokeWidth={2.4} aria-hidden="true" />Add an application</Link>
        </header>

        {isNew && (
          <ol className="hc-rise" aria-label="Getting started" style={{ ...rise(0.04), margin: '-6px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['Tailor a CV for a job', 'Track the application', 'Ask your AI team for help'].map((step, n) => (
              <li key={step} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '0 12px 0 6px', borderRadius: 999, fontSize: 13, fontWeight: 600, ...(n === 0 ? { background: 'var(--hc-brand-tint)', color: 'var(--hc-brand-hover)' } : { background: '#FFFFFF', border: '1px solid var(--hc-hairline)', color: '#3D4357' }) }}>
                <span className="hc-mono" style={{ width: 24, height: 24, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, ...(n === 0 ? { background: 'var(--hc-brand)', color: '#FFFFFF' } : { border: '1.5px solid #C9CCD8' }) }}>{n + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        )}

        <Kpis apps={apps} />
        <TailorCard jdRef={jdRef} />

        <div className="hc-hg2 hc-rise" style={rise(0.28)}>
          <ApplicationsCard apps={apps} />
          <TeamCard agents={agents} />
        </div>

        <div className="hc-hg2b hc-rise" style={rise(0.34)}>
          <InsightsCard apps={apps} onTailor={focusJd} />
          <CvsCard cvs={cvs} />
        </div>

        <div className="hc-rise" style={{ ...rise(0.34), display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '2px 4px', fontSize: 13, color: 'var(--hc-ink-muted)' }}>
          {progress ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span role="progressbar" aria-label="Profile completeness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.pct} style={{ display: 'inline-block', width: 90, height: 6, borderRadius: 99, background: 'var(--hc-hairline)', overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', borderRadius: 99, background: 'var(--hc-brand)', width: `${progress.pct}%` }} />
              </span>
              Profile {progress.pct}% complete.
              <Link className="hc-lnk" to="/profile" style={{ minHeight: 32 }}>{progress.cta}</Link>
            </span>
          ) : <span />}
          <Link className="hc-lnk" to="/settings" style={{ color: 'var(--hc-ink-muted)', minHeight: 32 }}>Settings</Link>
        </div>
      </main>

      <div className="hc-dock">
        <form className={`hc-dockbar${ask.trim() ? ' is-big' : ''}`} onSubmit={askAgents}>
          <label htmlFor="home-ask" className="hc-sr-only">Ask your AI team</label>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <button type="button" className="hc-icb" aria-label="Attach a file (coming soon)" title="Attach a file — coming soon" disabled style={{ width: 40, height: 40, borderRadius: 999 }}><Paperclip size={18} aria-hidden="true" /></button>
            <textarea id="home-ask" className="hc-ask" rows={1} maxLength={MESSAGE_MAX} placeholder="Ask your AI team… type @" value={ask}
              onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) askAgents(e); }} />
            <button type="submit" aria-label="Send" disabled={!ask.trim()} style={{ flex: 'none', width: 40, height: 40, borderRadius: 999, border: 0, background: 'var(--hc-brand)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: ask.trim() ? 1 : 0.6 }}><ArrowUp size={17} strokeWidth={2.2} aria-hidden="true" /></button>
          </div>
          <div className="hc-docktools" style={{ flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6, paddingLeft: 44 }}>
            <span className="hc-tool" style={{ minHeight: 32, fontSize: 12.5 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--hc-success)', display: 'inline-block' }} /><span style={{ color: 'var(--hc-ink-muted)' }}>Uses</span> <strong>Profile + Applications</strong></span>
            <span className="hc-mono hc-hint" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--hc-ink-muted)' }}>@ agents · ↵ send</span>
          </div>
        </form>
      </div>
    </div>
  );
}
