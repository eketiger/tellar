/**
 * Panel — bordered panel with the four corner ornaments used everywhere
 * in the dashboard / settings / admin / backoffice. Single source of
 * truth so we don't keep copy-pasting `<span className="corner tl" />`.
 */
export function Panel({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section className={`panel${className ? ` ${className}` : ''}`} style={style}>
      <span className="corner tl" />
      <span className="corner tr" />
      <span className="corner bl" />
      <span className="corner br" />
      {children}
    </section>
  );
}

/**
 * SectionHead — the numbered "01 · Title · aux" header pattern that
 * every panel section uses.
 */
export function SectionHead({
  num,
  title,
  aux,
}: {
  num: string | number;
  title: React.ReactNode;
  aux?: React.ReactNode;
}) {
  return (
    <header className="section-head">
      <h2><span className="num">{String(num).padStart(2, '0')}</span>{title}</h2>
      {aux !== undefined && <span className="aux">{aux}</span>}
    </header>
  );
}
