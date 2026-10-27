import { ArrowDown, ArrowUp } from 'lucide-react';
import { SECTION_LABELS, moveSection, templateName } from '@/data/templates';

// PDF-1: the CV's template and section order (PATCH /resumes/{id}/layout). Content never changes here, so
// switching costs no AI call. The PDF is rebuilt from the new layout on the next download or preview.
// Employers stay in the order they were entered (reverse chronological); only whole sections move.
export default function LayoutPanel({ templates, template, order, busy, onChange }) {
  return (
    <section className="hc-card" aria-labelledby="layout-h" style={{ marginTop: 20, padding: 20, display: 'flex', flexWrap: 'wrap', gap: 24 }}>
      <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span id="layout-h" className="hc-disp" style={{ fontSize: 18, fontWeight: 700 }}>Template</span>
        <div role="radiogroup" aria-label="Template" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {templates.map((t) => {
            const on = t.id === template;
            return (
              <button
                key={t.id} type="button" role="radio" aria-checked={on} disabled={busy} onClick={() => !on && onChange(t.id, order)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, minHeight: 44, padding: '8px 14px', borderRadius: 12, fontFamily: 'inherit', textAlign: 'left', cursor: busy ? 'progress' : 'pointer', background: on ? 'var(--hc-brand-tint)' : '#FFFFFF', border: `1.5px solid ${on ? 'var(--hc-brand)' : 'var(--hc-hairline)'}`, color: 'var(--hc-ink)' }}
              >
                <span style={{ fontSize: 14, fontWeight: 700 }}>{templateName(t.id)}</span>
                <span style={{ fontSize: 12, color: 'var(--hc-ink-muted)' }}>{t.description}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="hc-disp" style={{ fontSize: 18, fontWeight: 700 }}>Section order</span>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {order.map((key, i) => (
            <li key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--hc-hairline)', borderRadius: 12, padding: '4px 6px 4px 12px' }}>
              <span style={{ flex: 1, fontSize: 14 }}>{i + 1}. {SECTION_LABELS[key] ?? key}</span>
              {[[-1, ArrowUp, 'up'], [1, ArrowDown, 'down']].map(([step, Icon, word]) => (
                <button
                  key={word} type="button" className="hc-btn-sm" disabled={busy || i + step < 0 || i + step >= order.length}
                  onClick={() => onChange(template, moveSection(order, i, step))} aria-label={`Move ${SECTION_LABELS[key] ?? key} ${word}`}
                  style={{ width: 40, minHeight: 40, padding: 0, justifyContent: 'center', border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink)' }}
                >
                  <Icon size={15} aria-hidden="true" />
                </button>
              ))}
            </li>
          ))}
        </ol>
        <span style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>Empty sections are left out of the PDF. Jobs stay newest first.</span>
      </div>
    </section>
  );
}
