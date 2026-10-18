import { useEffect, useRef } from 'react';
import { Download, X } from 'lucide-react';
import CvDoc from '@/components/CvDoc';
import { TEMPLATES } from '@/data/templates';

// Full-size CV preview. Escape or the close button dismisses it.
export default function PreviewModal({ template, onClose, onMakeChanges }) {
  const closeBtn = useRef(null);
  const closeRef = useRef(onClose);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Full CV preview"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(14,18,38,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', overflow: 'auto' }}
    >
      <div className="hc-rise" style={{ width: '100%', maxWidth: 860, background: 'var(--hc-app-ground)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 30px 80px rgba(14,18,38,.35)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px', background: '#FFFFFF', borderBottom: '1px solid var(--hc-hairline)' }}>
          <div className="hc-disp" style={{ fontSize: 17, fontWeight: 700 }}>Preview · {TEMPLATES[template]}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="hc-btn-s" onClick={onMakeChanges}>Make changes</button>
            <button type="button" className="hc-btn-p"><Download size={16} aria-hidden="true" />Download PDF</button>
            <button ref={closeBtn} type="button" className="hc-btn-s" onClick={onClose} aria-label="Close preview" style={{ width: 44, padding: 0 }}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ maxWidth: 794, margin: '0 auto', boxShadow: '0 12px 30px rgba(22,26,43,.12)', borderRadius: 4, overflow: 'hidden' }}>
            <CvDoc template={template} />
          </div>
        </div>
      </div>
    </div>
  );
}
