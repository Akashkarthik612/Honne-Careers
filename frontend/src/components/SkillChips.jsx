import { useState } from 'react';
import { X } from 'lucide-react';

// Chip input: Enter adds the typed skill, × removes one. Duplicates (case-insensitive) are ignored.
export default function SkillChips({ id, label, values, onChange }) {
  const [draft, setDraft] = useState('');

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft('');
  }

  return (
    <div className="hc-f">
      <label className="hc-flabel" htmlFor={id}>{label}</label>
      <div className="hc-focus-within" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, border: '1px solid var(--hc-hairline)', borderRadius: 12, background: 'var(--hc-ground)', padding: '6px 6px 6px 8px', minHeight: 48 }}>
        {values.map((t) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 13, fontWeight: 600, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 999, padding: '0 4px 0 10px', minHeight: 32 }}>
            {t}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== t))} aria-label={`Remove ${t}`} style={{ width: 26, height: 26, border: 0, background: 'none', borderRadius: 99, cursor: 'pointer', color: 'var(--hc-ink-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={12} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id} type="text" placeholder="Type and press Enter" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          style={{ flex: '1 1 140px', minWidth: 120, minHeight: 36, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 14, color: 'var(--hc-ink)' }}
        />
      </div>
    </div>
  );
}
