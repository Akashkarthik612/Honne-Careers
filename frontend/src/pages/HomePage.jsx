import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Bot, Database, FileText, Plus } from 'lucide-react';
import { MAX_JD_WORDS } from '@/config/limits';
import { countWords, guessJobMeta } from '@/data/cvModel';
import { blankDraft, useAppStore } from '@/state/appStore';
import { useAuth } from '@/state/auth';

// Home (design: Home.dc.html): the start page after sign-in. Pasting a JD here starts a tailored resume
// with the Mode step skipped (template → JD page, draft.jdFromHome). Nothing is sent until the JD page.
// Agents and the chat bar are P3/P4 and have no backend yet, so they show as "Coming soon" (no mock data).

function greeting(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const sectionTitle = { margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' };
const iconTile = (bg, fg) => ({ flex: 'none', width: 32, height: 32, borderRadius: 10, background: bg, color: fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' });

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

  const words = countWords(jd);
  const tooLong = words > MAX_JD_WORDS;
  const canGo = words > 0 && !tooLong;
  const firstName = user.name.split(/\s+/)[0];

  // A new resume: the draft starts clean, carrying only this JD and its guessed company/role (SAVE-2).
  function go() {
    setDraft({ ...blankDraft(), jd, ...guessJobMeta(jd), jdFromHome: true });
    navigate('/new/template');
  }

  return (
    <main style={{ width: '100%', maxWidth: 980, margin: '0 auto', padding: '40px 24px 48px' }}>
      <h1 className="hc-disp" style={{ margin: 0, fontSize: 'clamp(24px,2.4vw,30px)', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.03em' }}>
        {greeting(new Date().getHours())}, <span className="hc-serif" style={{ color: 'var(--hc-brand)', fontSize: '1.1em' }}>{firstName}.</span>
      </h1>
      <p style={{ margin: '4px 0 0', fontSize: 14.5, color: 'var(--hc-ink-muted)' }}>Make a CV for your next job.</p>

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

      <section aria-labelledby="soon-h" style={{ marginTop: 32 }}>
        <h2 id="soon-h" className="hc-disp" style={sectionTitle}>Coming soon</h2>
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          <SoonCard icon={Bot} title="Agents">Ask built-in agents about your search, or create your own. You’ll call them by typing @ in chat.</SoonCard>
          <SoonCard icon={Database} title="Honne IQ">Connect Drive, Notion and Gmail so every agent knows your whole search.</SoonCard>
          <div style={{ border: '1.5px dashed var(--hc-hairline)', borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--hc-ink-muted)', fontSize: 12.5, lineHeight: 1.5 }}>
            <Plus size={16} aria-hidden="true" style={{ flex: 'none' }} />New features show up here first.
          </div>
        </div>
      </section>
    </main>
  );
}
