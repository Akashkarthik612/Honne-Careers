import { useEffect, useRef, useState } from 'react';
import CvDoc from '@/components/CvDoc';
import { ErrorBanner } from '@/components/Status';
import { PDF_PREVIEW_DEBOUNCE_MS } from '@/config/limits';
import { buildPdf } from '@/services/api';

// The exact preview for templates whose HTML can't match the LaTeX PDF (Honne Professional): the real PDF,
// built by POST /resumes/{id}/pdf (reused by the server when content + layout are unchanged, so viewing
// again is free). Until it arrives, or if it fails, the HTML approximation shows, labelled as such.
// `layoutKey` changes whenever content or layout does; a newer request makes an older answer stale.
export default function PdfPreview({ resumeId, layoutKey, cv, template, order }) {
  // The answer for one layoutKey: { key, url } or { key, error }. One for an older key means "building".
  const [result, setResult] = useState({ key: null });
  const latest = useRef(layoutKey);
  const pdf = result.key !== layoutKey ? { phase: 'busy' }
    : result.error ? { phase: 'fail', error: result.error } : { phase: 'ready', url: result.url };

  useEffect(() => {
    latest.current = layoutKey;
    const timer = setTimeout(async () => {
      try {
        const r = await buildPdf(resumeId);
        if (latest.current === layoutKey) setResult({ key: layoutKey, url: r.url });
      } catch (e) {
        if (latest.current === layoutKey) setResult({ key: layoutKey, error: e });
      }
    }, PDF_PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [resumeId, layoutKey]);

  if (pdf.phase === 'ready') {
    return <iframe title="Exact PDF preview" src={`${pdf.url}#toolbar=0&view=FitH`} style={{ display: 'block', width: '100%', height: 'min(1030px, 130vw)', border: 0, background: '#FFFFFF' }} />;
  }
  return (
    <>
      <div role="status" className="hc-mono" style={{ padding: '8px 12px', fontSize: 11.5, color: 'var(--hc-ink-muted)', background: '#F7F8FD', borderBottom: '1px solid var(--hc-hairline)' }}>
        {pdf.phase === 'busy' ? 'APPROXIMATE PREVIEW · BUILDING THE EXACT PDF…' : 'APPROXIMATE PREVIEW · THE PDF WILL MATCH YOUR DOWNLOAD'}
      </div>
      {pdf.phase === 'fail' && <ErrorBanner error={pdf.error} style={{ margin: 12 }} />}
      <CvDoc cv={cv} template={template} order={order} />
    </>
  );
}
