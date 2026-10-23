import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Copy, X } from 'lucide-react';
import { answerToMarkdown, draftsToMarkdown, sourceRows } from '@/data/chatAdapter';
import { statusLabel } from '@/data/applications';

// Right-hand panel for one answer (design: Chat.dc.html "Panel · table" and "Panel · doc").
// Table = the rows the answer cited, each linking to where it lives (CHAT sources, Day_3 §2.3).
// Doc = the drafts it wrote; nothing is ever sent from Honne (CUST-5). Export is Markdown for now.

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

function TableView({ message, highlight }) {
  const rows = sourceRows(message.sources);
  return (
    <div>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--hc-ink-muted)' }}>What @{message.agent.handle} read for this answer. Open a row to check it.</p>
      <div style={{ marginTop: 14, border: '1px solid var(--hc-hairline)', borderRadius: 14, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
          <thead><tr><th className="hc-th" scope="col">#</th><th className="hc-th" scope="col">From</th><th className="hc-th" scope="col">Role</th><th className="hc-th" scope="col">Status</th><th className="hc-th" scope="col">Sent</th><th className="hc-th" scope="col">Days</th><th className="hc-th" scope="col"><span className="hc-sr-only">Open</span></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ref} className="hc-tr" style={r.ref === highlight ? { background: 'var(--hc-brand-tint)' } : undefined}>
                <td className="hc-td hc-mono" style={{ fontSize: 12, color: 'var(--hc-ink-muted)' }}>{r.ref}</td>
                <td className="hc-td" style={{ fontWeight: 700 }}>{r.kind === 'application' ? r.company : r.label}</td>
                <td className="hc-td">{r.role || '—'}</td>
                <td className="hc-td">{r.status ? statusLabel(r.status) : r.kind === 'resume' ? 'Resume' : r.kind === 'profile' ? 'Profile' : '—'}</td>
                <td className="hc-td hc-mono" style={{ fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>{r.sent || '—'}</td>
                <td className="hc-td hc-mono" style={{ fontSize: 12.5 }}>{r.days ?? '—'}</td>
                <td className="hc-td"><Link to={r.to} style={{ fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DocView({ message }) {
  const [copied, setCopied] = useState({});
  return (
    <div style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {message.drafts.map((d, i) => (
        <div key={i} style={{ border: '1px solid var(--hc-hairline)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--hc-ground)', borderBottom: '1px solid var(--hc-hairline)' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}><span style={{ color: 'var(--hc-ink-muted)' }}>To</span> <strong>{d.to}</strong>{d.subject && <><br /><span style={{ color: 'var(--hc-ink-muted)' }}>Subject</span> {d.subject}</>}</span>
            <button type="button" className="hc-btn-s" style={{ minHeight: 34, fontSize: 12.5 }}
              onClick={async () => { if (await copy(`${d.subject ? `Subject: ${d.subject}\n\n` : ''}${d.body}`)) setCopied((c) => ({ ...c, [i]: true })); }}>
              {copied[i] ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
          <div style={{ padding: '14px 16px', fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{d.body}</div>
        </div>
      ))}
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--hc-ink-muted)' }}>Nothing is sent from Honne. Check each one, then copy it into your email.</p>
    </div>
  );
}

export default function AnswerPanel({ panel, message, onClose }) {
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState('');
  const isDoc = panel.kind === 'doc';
  const title = isDoc ? `${message.drafts.length} draft${message.drafts.length === 1 ? '' : 's'}` : 'Rows used';
  const sub = isDoc ? `Doc · by @${message.agent.handle}` : `Table · ${message.sources.length} row${message.sources.length === 1 ? '' : 's'} · from your data`;
  const markdown = isDoc ? draftsToMarkdown(message.drafts) : answerToMarkdown(message);
  const flash = (text) => { setToast(text); setExportOpen(false); setTimeout(() => setToast(''), 2200); };

  return (
    <aside className="hc-panel hc-peek" aria-label={title}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 10px 18px', borderBottom: '1px solid var(--hc-hairline)', position: 'relative' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="hc-disp" style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--hc-ink-muted)' }}>{sub}</div>
        </div>
        <button type="button" className="hc-btn-s" style={{ minHeight: 36 }} onClick={async () => flash(await copy(markdown) ? 'Copied to clipboard ✓' : 'Couldn’t copy: your browser blocked it')}>
          <Copy size={14} aria-hidden="true" />Copy
        </button>
        <button type="button" className="hc-btn-s" style={{ minHeight: 36 }} aria-expanded={exportOpen} onClick={() => setExportOpen((o) => !o)}>Export <ChevronDown size={12} aria-hidden="true" /></button>
        <button type="button" className="hc-icb" onClick={onClose} aria-label="Close panel"><X size={16} aria-hidden="true" /></button>
        {exportOpen && (
          <div role="menu" style={{ position: 'absolute', right: 52, top: 'calc(100% - 4px)', width: 230, background: '#FFFFFF', border: '1px solid var(--hc-hairline)', borderRadius: 14, boxShadow: '0 20px 50px rgba(22,26,43,.16)', padding: 6, zIndex: 5 }}>
            <button type="button" role="menuitem" className="hc-pick" onClick={() => { download(isDoc ? 'drafts.md' : 'answer.md', markdown); flash('Downloaded as Markdown ✓'); }}>
              <span className="hc-mono" style={{ width: 44, fontSize: 11, fontWeight: 700, color: 'var(--hc-ink-muted)' }}>MD</span><span style={{ fontSize: 14, fontWeight: 600 }}>Markdown</span>
            </button>
            {[['PDF', 'PDF document'], ['DOCX', 'Word document']].map(([ext, label]) => (
              <div key={ext} role="menuitem" aria-disabled="true" className="hc-pick" style={{ cursor: 'default', color: 'var(--hc-ink-muted)' }}>
                <span className="hc-mono" style={{ width: 44, fontSize: 11, fontWeight: 700 }}>{ext}</span><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{label}</span><span className="hc-soon">SOON</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {toast && <div role="status" style={{ flex: 'none', background: '#E8F5EC', color: 'var(--hc-success)', fontSize: 13, fontWeight: 700, padding: '8px 18px' }}>{toast}</div>}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '24px clamp(18px,3vw,36px) 40px' }}>
        {isDoc ? <DocView message={message} /> : <TableView message={message} highlight={panel.ref} />}
      </div>
    </aside>
  );
}
