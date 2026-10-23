import { X } from 'lucide-react';
import { LANGUAGE_LEVELS, SPOKEN_LANGUAGES_MAX, blankLanguage } from '@/data/cvModel';

// Spoken languages (English, French…), one row each: name + optional level. Used by the wizard's
// Skills step and the profile page. Rows with no name are dropped when saved (pruneDoc).
export default function SpokenLanguagesEditor({ id, values, onChange, disabled = false }) {
  const set = (lid, patch) => onChange(values.map((l) => (l.id === lid ? { ...l, ...patch } : l)));

  return (
    <div className="hc-f">
      <span className="hc-flabel" id={`${id}-label`}>Languages you speak</span>
      <div role="group" aria-labelledby={`${id}-label`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {values.map((l, i) => (
          <div key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="hc-in" type="text" placeholder="e.g. French" value={l.name} disabled={disabled}
              aria-label={`Language ${i + 1}`} onChange={(e) => set(l.id, { name: e.target.value })}
              style={{ flex: '1 1 0', minWidth: 0 }}
            />
            <select
              className="hc-in" value={l.level} disabled={disabled} aria-label={`Level for language ${i + 1}`}
              onChange={(e) => set(l.id, { level: e.target.value })} style={{ flex: '0 0 170px', width: 170, cursor: 'pointer' }}
            >
              <option value="">Level (optional)</option>
              {LANGUAGE_LEVELS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <button type="button" onClick={() => onChange(values.filter((x) => x.id !== l.id))} disabled={disabled} aria-label={`Remove language ${i + 1}`} style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
        {values.length < SPOKEN_LANGUAGES_MAX && <div><button type="button" className="hc-add" disabled={disabled} onClick={() => onChange([...values, blankLanguage()])}>+ Add language</button></div>}
      </div>
    </div>
  );
}
