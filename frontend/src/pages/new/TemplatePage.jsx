import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, FileText } from 'lucide-react';
import PageTitle from '@/components/PageTitle';
import SetupSteps from '@/components/SetupSteps';
import { CvThumb } from '@/components/CvDoc';
import { countWords, profileToCv } from '@/data/cvModel';
import { templatePreviewProfile } from '@/data/templatePreview';
import { TEMPLATES, templateName } from '@/data/templates';
import useResource from '@/hooks/useResource';
import { listTemplates } from '@/services/api';
import { ErrorBanner, PageLoading } from '@/components/Status';
import { useAppStore } from '@/state/appStore';

// Step 1 of new-resume setup (design: TemplatePicker.dc.html). Which templates are live comes from
// GET /templates.
// The picked id goes into draft.template, which ModePage/JdPage send to POST /resumes.
// With a JD pasted on Home (draft.jdFromHome) the Mode step is skipped: Continue goes to the JD page.

const tileName = (muted) => ({ fontSize: 18, fontWeight: 700, color: muted ? 'var(--hc-ink-muted)' : 'var(--hc-ink)' });
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
  const [selection, setSelection] = useState(null);
  const [searchParams] = useSearchParams();
  const templates = useResource(listTemplates);
  const live = new Set((templates.data ?? []).map((t) => t.id));
  const requested = searchParams.get('template');
  const picked = selection ?? (live.has(requested) ? requested : draft.template);
  const fromHome = draft.jdFromHome && Boolean(draft.jd.trim());
  const jdTitle = [draft.role, draft.company].filter(Boolean).join(' · ') || 'Your job description';

  function pick(id) {
    setSelection(id);
    setDraft({ template: id });
  }

  return (
    <main className="hc-wrap">
      <SetupSteps current={0} jdFromHome={fromHome} />
      {fromHome && (
        <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 14, padding: '10px 12px 10px 14px', maxWidth: 720 }}>
          <span style={{ flex: 'none', width: 32, height: 32, borderRadius: 10, background: '#E8F5EC', color: 'var(--hc-success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={16} aria-hidden="true" /></span>
          <span style={{ flex: '1 1 240px', minWidth: 0, fontSize: 14 }}><strong>JD added:</strong> {jdTitle} <span className="hc-mono" style={{ fontSize: 11.5, color: 'var(--hc-ink-muted)' }}>· {countWords(draft.jd).toLocaleString('en-US')} words</span></span>
          <Link to="/home" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 6px', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>Change</Link>
        </div>
      )}
      <PageTitle before="Pick a" accent="template" style={{ marginTop: 24 }} />
      <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--hc-ink-muted)' }}>Designed for ATS readability. You can switch templates later.</p>

      <ErrorBanner error={templates.error} action={{ label: 'Retry', onClick: templates.reload }} />
      {templates.loading && <PageLoading label="Loading templates…" />}
      {templates.data && (
      <div role="radiogroup" aria-label="Templates" style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 18 }}>
        {TEMPLATES.filter((t) => live.has(t.id)).map((t) => (
          <button
            key={t.id} type="button" role="radio" aria-checked={picked === t.id} onClick={() => pick(t.id)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', fontFamily: 'inherit', color: 'var(--hc-ink)', cursor: 'pointer', background: '#FFFFFF', borderRadius: 20, padding: 14,
              transition: 'border-color .2s ease, box-shadow .2s ease',
              ...(picked === t.id ? { border: '1.5px solid var(--hc-brand)', boxShadow: '0 0 0 4px rgba(63,95,216,.12)' } : { border: '1.5px solid var(--hc-hairline)' }),
            }}
          >
            <div style={{ position: 'relative' }}>
              <CvThumb cv={profileToCv(templatePreviewProfile(t.id))} template={t.id} height={300} radius={12} />
              {picked === t.id && (
                <span style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 99, background: 'var(--hc-brand)', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                </span>
              )}
            </div>
            <TileFoot name={t.name} blurb={t.blurb} badge={<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--hc-success)', background: '#E8F5EC', borderRadius: 999, padding: '4px 10px' }}>ATS-friendly</span>} />
          </button>
        ))}
      </div>
      )}

      <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Link className="hc-back" to={fromHome ? '/home' : '/resumes'}><ArrowLeft size={16} aria-hidden="true" />{fromHome ? 'Back to Home' : 'Back to resumes'}</Link>
        {live.has(picked)
          ? <Link className="hc-btn-p is-lg" to={fromHome ? '/new/jd' : '/new/mode'} onClick={() => setDraft({ template: picked })}>Continue with {templateName(picked)}<ArrowRight size={16} aria-hidden="true" /></Link>
          : <span className="hc-btn-off" aria-disabled="true">Pick a template to continue</span>}
      </div>
    </main>
  );
}
