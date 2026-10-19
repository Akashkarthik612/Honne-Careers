import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import PageTitle from '@/components/PageTitle';
import SetupSteps from '@/components/SetupSteps';
import { CvThumb } from '@/components/CvDoc';
import { profileToCv } from '@/data/cvModel';
import { PREVIEW_PROFILE } from '@/data/templatePreview';
import { TEMPLATES } from '@/data/templates';
import useResource from '@/hooks/useResource';
import { listTemplates } from '@/services/api';
import { ErrorBanner, PageLoading } from '@/components/Status';
import { useAppStore } from '@/state/appStore';
import elegantTemplate from '@/assets/elegant-template.png';

// Step 1 of new-resume setup (design: TemplatePicker.dc.html). Which templates are live comes from
// GET /templates (Jake's Resume in the beta); the others show as "Coming soon".

const SAMPLE = profileToCv(PREVIEW_PROFILE);
const tileName = (muted) => ({ fontSize: 18, fontWeight: 700, color: muted ? 'var(--hc-ink-muted)' : 'var(--hc-ink)' });
const well = { height: 300, overflow: 'hidden', background: '#EEF0F5', borderRadius: 12, display: 'flex', justifyContent: 'center', paddingTop: 16 };

function Skeleton({ accent, centred }) {
  const bar = (w, extra) => <div className="hc-skel" style={{ width: w, ...extra }} />;
  return (
    <div style={{ width: 238, height: 300, background: '#FFFFFF', padding: 18, display: 'flex', flexDirection: 'column', gap: 7, opacity: .45 }}>
      {centred ? (
        <>
          {bar('52%', { height: 10, margin: '0 auto', background: accent })}
          {bar('70%', { margin: '0 auto 6px' })}
          <div style={{ height: 1, background: accent }} />
        </>
      ) : (
        <>
          {bar('58%', { height: 11, background: accent })}
          {bar('44%', { marginBottom: 8 })}
        </>
      )}
      {bar('30%', { background: accent, marginTop: 6 })}{bar('100%')}{bar('88%')}{bar('76%')}
      {bar('30%', { background: accent, marginTop: 6 })}{bar('90%')}{bar('82%')}
    </div>
  );
}

const PREVIEWS = {
  elegant: <img src={elegantTemplate} alt="Elegant template preview" style={{ width: 238, height: 'auto', alignSelf: 'flex-start', opacity: .45, boxShadow: '0 10px 30px rgba(22,26,43,.12)' }} />,
  classic: <Skeleton accent="#161A2B" centred />,
  modern: <Skeleton accent="#3F5FD8" />,
};

function TileFoot({ name, blurb, muted, badge }) {
  return (
    <>
      <div style={{ padding: '14px 4px 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span className="hc-disp" style={tileName(muted)}>{name}</span>
        {badge}
      </div>
      <div style={{ padding: '4px 4px 0', fontSize: 13, color: 'var(--hc-ink-muted)' }}>{blurb}</div>
    </>
  );
}

export default function TemplatePage() {
  const { draft, setDraft } = useAppStore();
  const [picked, setPicked] = useState(draft.template === 'jake');
  const templates = useResource(listTemplates);
  const live = new Set((templates.data ?? []).map((t) => t.id));

  function toggle() {
    setPicked((p) => !p);
    setDraft({ template: 'jake' });
  }

  return (
    <main className="hc-wrap">
      <SetupSteps current={0} />
      <PageTitle before="Pick a" accent="template" style={{ marginTop: 24 }} />
      <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--hc-ink-muted)' }}>Every template is built for ATS. You can switch later.</p>

      <ErrorBanner error={templates.error} action={{ label: 'Retry', onClick: templates.reload }} />
      {templates.loading && <PageLoading label="Loading templates…" />}
      {templates.data && (
      <div role="radiogroup" aria-label="Templates" style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 18 }}>
        {TEMPLATES.map((t) => (live.has(t.id) ? (
          <button
            key={t.id} type="button" role="radio" aria-checked={picked} onClick={toggle}
            style={{
              display: 'block', width: '100%', textAlign: 'left', fontFamily: 'inherit', color: 'var(--hc-ink)', cursor: 'pointer', background: '#FFFFFF', borderRadius: 20, padding: 14,
              transition: 'border-color .2s ease, box-shadow .2s ease',
              ...(picked ? { border: '1.5px solid var(--hc-brand)', boxShadow: '0 0 0 4px rgba(63,95,216,.12)' } : { border: '1.5px solid var(--hc-hairline)' }),
            }}
          >
            <div style={{ position: 'relative' }}>
              <CvThumb cv={SAMPLE} height={300} radius={12} />
              {picked && (
                <span style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 99, background: 'var(--hc-brand)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                </span>
              )}
            </div>
            <TileFoot name={t.name} blurb={t.blurb} badge={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--hc-success)', background: '#E8F5EC', borderRadius: 999, padding: '4px 10px' }}>ATS-safe</span>} />
          </button>
        ) : (
          <div key={t.id} aria-disabled="true" style={{ background: '#FFFFFF', border: '1.5px solid var(--hc-hairline)', borderRadius: 20, padding: 14 }}>
            <div style={well}>{PREVIEWS[t.id]}</div>
            <TileFoot name={t.name} blurb={t.blurb} muted badge={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--hc-ink-muted)', background: '#F3F4F8', borderRadius: 999, padding: '4px 10px' }}>Coming soon</span>} />
          </div>
        )))}
      </div>
      )}

      <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Link className="hc-back" to="/resumes"><ArrowLeft size={16} aria-hidden="true" />Back to resumes</Link>
        {picked && live.has('jake')
          ? <Link className="hc-btn-p is-lg" to="/new/mode">Continue with Jake’s Resume<ArrowRight size={16} aria-hidden="true" /></Link>
          : <span className="hc-btn-off" aria-disabled="true">Pick a template to continue</span>}
      </div>
    </main>
  );
}
