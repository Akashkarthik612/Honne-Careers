import { inlineParts, toBlocks } from '@/data/chatAdapter';

// Renders an agent's answer: paragraphs, '-' lists, **bold** and [n] citations (buttons that open the
// row it came from). Text is rendered as text only — never HTML — so nothing in an answer can inject markup.
function Inline({ text, sources, onCite }) {
  return inlineParts(text, sources).map((p, i) => {
    if (p.bold) return <strong key={i}>{p.bold}</strong>;
    if (p.cite) {
      return (
        <button key={i} type="button" className="hc-cite" onClick={() => onCite?.(p.source)} aria-label={`Source ${p.cite}: ${p.source.label}`} title={p.source.label}>
          {p.cite}
        </button>
      );
    }
    return <span key={i}>{p.text}</span>;
  });
}

export default function MarkdownLite({ text, sources = [], onCite }) {
  return (
    <div className="hc-atext">
      {toBlocks(text).map((b, i) => (b.type === 'ul'
        ? <ul key={i}>{b.items.map((item, j) => <li key={j}><Inline text={item} sources={sources} onCite={onCite} /></li>)}</ul>
        : <p key={i}><Inline text={b.text} sources={sources} onCite={onCite} /></p>))}
    </div>
  );
}
