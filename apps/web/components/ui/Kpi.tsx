/**
 * Kpi tile used by the dashboard, admin overview, and backoffice KPI
 * grids. The trio (label / value / delta) was duplicated across three
 * files with subtly different styling. This is the canonical version.
 */
export function Kpi({
  label,
  value,
  delta,
  up,
  down,
}: {
  label: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  up?: boolean;
  down?: boolean;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta && <div className={`kpi-delta ${up ? 'up' : down ? 'down' : ''}`}>{delta}</div>}
    </div>
  );
}
