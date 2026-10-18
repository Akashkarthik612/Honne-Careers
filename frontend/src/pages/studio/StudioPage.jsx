import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import AppHeader, { Avatar } from '@/components/AppHeader';
import { HonneTile, Wordmark } from '@/components/HonneMark';
import { TEMPLATES } from '@/data/templates';
import { SAMPLE_JD, SAMPLE_PROFILE_FILE } from '@/data/sampleCv';
import JobPanel from './JobPanel';
import CvPanel from './CvPanel';
import AnalysisSection from './AnalysisSection';
import PreviewModal from './PreviewModal';
import useTailorJob from './useTailorJob';

// CV studio ("App home" in the design). Phases: new → profile → gen → ready.
// `?state=new|profile|ready|chat` opens a given phase, matching the design's three App home artboards.
// Upload, tailoring and chat edits are simulated until the P1 backend endpoints exist.

const SUBLINES = {
  new: 'Start here: add your CV on the right, then paste a job description.',
  profile: 'Paste a job description and tailor your CV to it.',
  gen: 'Tailoring your CV to this job…',
  ready: 'Preview it, make changes, download.',
};

const HELLO = { role: 'ai', text: 'Hi Arjun — what should I change? Tell me in plain words. I’ll only use what’s in your profile, so nothing gets invented.' };
const SAMPLE_CHAT = [
  HELLO,
  { role: 'user', text: 'Lead with ownership and keep it to one page.' },
  { role: 'ai', text: 'Done ✓ Your first bullet now opens with “Owned the settlement pipeline”, and I tightened Projects so it fits one page. Anything else?' },
];

function initialState(param) {
  const s = ['new', 'profile', 'ready', 'chat'].includes(param) ? param : 'new';
  return {
    phase: s === 'chat' ? 'ready' : s,
    tab: s === 'chat' ? 'chat' : 'jd',
    jd: s === 'ready' || s === 'chat' ? SAMPLE_JD : '',
    messages: s === 'chat' ? SAMPLE_CHAT : [HELLO],
    profileSource: s === 'new' ? null : SAMPLE_PROFILE_FILE,
  };
}

const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length;

function TemplateThumb({ ink, rule }) {
  const line = (h, bg, w) => <span style={{ height: h, background: bg, width: w, margin: w ? '0 auto' : undefined }} />;
  return (
    <span aria-hidden="true" style={{ width: 22, height: 28, borderRadius: 3, background: '#FFFFFF', border: '1px solid #C9CDD9', display: 'inline-flex', flexDirection: 'column', gap: 2, padding: '4px 3px' }}>
      {line(2, ink, '70%')}{line(1, rule)}{line(1.5, '#C9CDD9')}{line(1.5, '#C9CDD9')}{line(1, rule)}{line(1.5, '#C9CDD9')}
    </span>
  );
}

function TemplatePicker({ template, onPick }) {
  const btn = (on) => ({
    display: 'inline-flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '6px 14px 6px 8px', borderRadius: 12,
    fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all .2s ease',
    ...(on ? { background: 'var(--hc-brand-tint)', color: 'var(--hc-brand-hover)', border: '1.5px solid var(--hc-brand)' }
      : { background: '#FFFFFF', color: 'var(--hc-ink)', border: '1.5px solid var(--hc-hairline)' }),
  });
  const thumbs = { jake: <TemplateThumb ink="#111" rule="#111" />, elegant: <TemplateThumb ink="#1F3A8A" rule="#8FA3D9" /> };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
      <span className="hc-lbl">Template</span>
      <div role="group" aria-label="Choose a template" style={{ display: 'flex', gap: 8 }}>
        {Object.entries(TEMPLATES).map(([id, name]) => (
          <button key={id} type="button" aria-pressed={template === id} onClick={() => onPick(id)} style={btn(template === id)}>
            {thumbs[id]}{name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function StudioPage() {
  const [params] = useSearchParams();
  const [init] = useState(() => initialState(params.get('state')));

  const [phase, setPhase] = useState(init.phase);
  const [template, setTemplate] = useState('jake');
  const [profileSource, setProfileSource] = useState(init.profileSource);
  const [jd, setJd] = useState(init.jd);
  const [tab, setTab] = useState(init.tab);
  const [messages, setMessages] = useState(init.messages);
  const [draft, setDraft] = useState('');
  const [modal, setModal] = useState(false);

  const onJobDone = useCallback(({ fromChat }) => {
    setPhase('ready');
    if (fromChat) setMessages((m) => [...m, { role: 'ai', text: 'Done ✓ Your preview is updated. Anything else you’d like to change?' }]);
  }, []);
  const job = useTailorJob(onJobDone);

  const startTailoring = (fromChat) => {
    setModal(false);
    setPhase('gen');
    job.start({ fromChat });
  };

  function send(text) {
    const t = text.trim();
    if (!t || phase === 'gen') return;
    setMessages((m) => [...m, { role: 'user', text: t }, { role: 'ai', text: 'On it — updating your CV with that. Watch the preview on the right.' }]);
    setDraft('');
    setTab('chat');
    startTailoring(true);
  }

  function addProfile(source) {
    setProfileSource(source);
    setPhase('profile');
  }

  function changeSource() {
    job.cancel();
    setModal(false);
    setTab('jd');
    setPhase('new');
  }

  const ready = phase === 'ready';
  const chatAvailable = ready || phase === 'gen' || tab === 'chat';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--hc-app-ground)' }}>
      <AppHeader>
        <Link to="/" aria-label="Honne Careers home" style={{ textDecoration: 'none', color: 'var(--hc-ink)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <HonneTile />
          <Wordmark />
        </Link>
        <div className="hc-navmid" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link className="hc-navlink" to="/home" aria-current="page" style={{ background: 'var(--hc-brand-tint)', color: 'var(--hc-brand)' }}>CV studio</Link>
          <span className="hc-navlink" aria-disabled="true">Honne IQ <span className="hc-soon">SOON</span></span>
          <span className="hc-navlink" aria-disabled="true">Agents <span className="hc-soon">SOON</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="hc-chip" style={{ background: '#E8F5EC', color: 'var(--hc-success)' }}>Beta</span>
          <Avatar initials="AM" />
        </div>
      </AppHeader>

      <main style={{ maxWidth: 1600, margin: '0 auto', padding: '24px 24px 64px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18 }}>
          <div>
            <h1 className="hc-disp" style={{ margin: 0, fontSize: 'clamp(28px,3vw,40px)', lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.035em' }}>
              Ready to get <span className="hc-serif" style={{ color: 'var(--hc-brand)', fontSize: '1.1em' }}>hired?</span>
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--hc-ink-muted)' }}>{SUBLINES[phase]}</p>
          </div>
          <TemplatePicker template={template} onPick={setTemplate} />
        </div>

        <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
          <JobPanel
            tab={tab} onTab={setTab} chatAvailable={chatAvailable}
            jd={jd} onJdChange={setJd} words={countWords(jd)}
            hasProfile={phase !== 'new'} ready={ready} generating={phase === 'gen'} onTailor={() => startTailoring(false)}
            messages={messages} draft={draft} onDraftChange={setDraft} onSend={send}
          />

          <div className="hc-arrows" aria-hidden="true" style={{ flex: '0 0 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <span style={{ width: 36, height: 36, borderRadius: 99, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--hc-brand)' }}><ArrowRight className="hc-ar" size={16} strokeWidth={2.2} /></span>
            <span style={{ width: 36, height: 36, borderRadius: 99, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--hc-ink-faint)' }}><ArrowLeft className="hc-al" size={16} strokeWidth={2.2} /></span>
          </div>

          <CvPanel
            phase={phase} step={job.step} template={template} profileSource={profileSource}
            onFile={(file) => addProfile(file.name)} onLatex={() => addProfile('LaTeX source')}
            onChangeSource={changeSource}
            onOpenPreview={() => setModal(true)} onMakeChanges={() => setTab('chat')}
          />
        </div>

        <AnalysisSection ready={ready} />
      </main>

      {modal && ready && (
        <PreviewModal template={template} onClose={() => setModal(false)} onMakeChanges={() => { setTab('chat'); setModal(false); }} />
      )}
    </div>
  );
}
