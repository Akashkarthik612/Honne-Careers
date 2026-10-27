import { X } from 'lucide-react';
import { CERTIFICATIONS_MAX, blankCertification } from '@/data/cvModel';

// Certifications and awards, one row each: name + optional issuer and date. Typed by the user, so the
// AI never writes them. Used by the wizard's Skills step and the profile page. Empty rows are dropped
// when saved (pruneDoc); a row with an issuer or date but no name is flagged on the field (validateDoc).
export default function CertificationsEditor({ id, values, onChange, errors = {}, disabled = false }) {
  const set = (cid, patch) => onChange(values.map((c) => (c.id === cid ? { ...c, ...patch } : c)));

  return (
    <div className="hc-f">
      <span className="hc-flabel" id={`${id}-label`}>Certifications and awards</span>
      <div role="group" aria-labelledby={`${id}-label`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {values.map((c, i) => {
          const error = errors[`${c.id}.name`];
          return (
            <div key={c.id}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input
                  className="hc-in" type="text" placeholder="e.g. AWS Certified Developer" value={c.name} disabled={disabled} maxLength={120}
                  aria-label={`Certification ${i + 1}`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-${c.id}-err` : undefined}
                  onChange={(e) => set(c.id, { name: e.target.value })} style={{ flex: '2 1 220px', minWidth: 0 }}
                />
                <input
                  className="hc-in" type="text" placeholder="Issuer (optional)" value={c.issuer} disabled={disabled} maxLength={120}
                  aria-label={`Issuer for certification ${i + 1}`} onChange={(e) => set(c.id, { issuer: e.target.value })} style={{ flex: '1 1 150px', minWidth: 0 }}
                />
                <input
                  className="hc-in" type="text" placeholder="Year (optional)" value={c.date} disabled={disabled} maxLength={30}
                  aria-label={`Year for certification ${i + 1}`} onChange={(e) => set(c.id, { date: e.target.value })} style={{ flex: '0 0 120px', width: 120 }}
                />
                <button type="button" onClick={() => onChange(values.filter((x) => x.id !== c.id))} disabled={disabled} aria-label={`Remove certification ${i + 1}`} style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, border: '1px solid var(--hc-hairline)', background: '#FFFFFF', color: 'var(--hc-ink-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
              {error && <span id={`${id}-${c.id}-err`} style={{ display: 'block', marginTop: 4, fontSize: 12.5, color: 'var(--hc-warm)', fontWeight: 600 }}>{error}</span>}
            </div>
          );
        })}
        {values.length < CERTIFICATIONS_MAX && <div><button type="button" className="hc-add" disabled={disabled} onClick={() => onChange([...values, blankCertification()])}>+ Add certification</button></div>}
      </div>
    </div>
  );
}
