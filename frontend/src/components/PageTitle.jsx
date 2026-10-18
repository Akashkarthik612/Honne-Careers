// Screen heading in the design's voice: grotesk display with one serif-italic accent word in brand blue.
export default function PageTitle({ before, accent, after, size = 'clamp(28px,3.2vw,40px)', style }) {
  return (
    <h1 className="hc-disp" style={{ margin: 0, fontSize: size, lineHeight: 1.05, fontWeight: 800, letterSpacing: '-0.035em', ...style }}>
      {before && <>{before} </>}
      <span className="hc-serif" style={{ color: 'var(--hc-brand)', fontSize: '1.1em' }}>{accent}</span>
      {after}
    </h1>
  );
}
