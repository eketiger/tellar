/**
 * Loading skeleton primitives. CSS shimmer comes from globals.css
 * (`.skel`). Three composable shapes cover most dashboard/list/card
 * loading states without pulling in a new dependency.
 */
export function SkeletonLine({
  width = '100%',
  height = 12,
  style,
}: {
  width?: string | number;
  height?: number;
  style?: React.CSSProperties;
}) {
  return <div className="skel" style={{ width, height, ...style }} />;
}

export function SkeletonRect({
  width = '100%',
  height = 100,
  style,
}: {
  width?: string | number;
  height?: number;
  style?: React.CSSProperties;
}) {
  return <div className="skel" style={{ width, height, ...style }} />;
}

/** Card-shaped skeleton (matches the dashboard teller cards). */
export function SkeletonCard() {
  return (
    <div className="skel" style={{ width: '100%', height: 168, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
      <SkeletonLine width="60%" height={14} style={{ background: 'var(--panel-3)', border: 0 }} />
      <SkeletonLine width="40%" height={10} style={{ background: 'var(--panel-3)', border: 0 }} />
    </div>
  );
}
