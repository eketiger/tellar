'use client';

import { useMemo, useState } from 'react';

type Range = '7' | '14' | '30' | '90' | '180' | '365' | 'wtd' | 'mtd' | 'ytd';

const RANGES: { id: Range; label: string }[] = [
  { id: '7', label: '7D' },
  { id: '14', label: '14D' },
  { id: '30', label: '1M' },
  { id: '90', label: '3M' },
  { id: '180', label: '6M' },
  { id: '365', label: '1Y' },
  { id: 'wtd', label: 'WTD' },
  { id: 'mtd', label: 'MTD' },
  { id: 'ytd', label: 'YTD' },
];

/** Deterministic pseudo-random — same value every render per dayOffset */
function seed(x: number) {
  const s = Math.sin(x * 9301 + 49297) * 10000;
  return s - Math.floor(s);
}

interface DayPoint { date: Date; queries: number; recordingMin: number; sessions: number; }

function daysForRange(range: Range): number {
  const today = new Date();
  if (range === 'wtd') return today.getDay() + 1;
  if (range === 'mtd') return today.getDate();
  if (range === 'ytd') {
    const start = new Date(today.getFullYear(), 0, 1);
    return Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
  }
  return Number(range);
}

function buildSeries(range: Range): DayPoint[] {
  const n = daysForRange(range);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: DayPoint[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const weekday = d.getDay();
    const boost = weekday >= 1 && weekday <= 5 ? 1.6 : 0.7;
    out.push({
      date: d,
      queries: Math.round(10 + seed(i + 1) * 40 * boost),
      recordingMin: Math.round(2 + seed(i + 101) * 12 * boost),
      sessions: Math.round(5 + seed(i + 201) * 20 * boost),
    });
  }
  return out;
}

export function UsageChart() {
  const [range, setRange] = useState<Range>('30');
  const [hover, setHover] = useState<number | null>(null);

  const series = useMemo(() => buildSeries(range), [range]);
  const maxQ = Math.max(...series.map(d => d.queries), 1);
  const maxR = Math.max(...series.map(d => d.recordingMin), 1);
  const maxS = Math.max(...series.map(d => d.sessions), 1);

  const W = 800, H = 200, pad = 10;
  const barW = (W - pad * 2) / series.length;

  const totals = series.reduce(
    (acc, d) => ({ q: acc.q + d.queries, r: acc.r + d.recordingMin, s: acc.s + d.sessions }),
    { q: 0, r: 0, s: 0 },
  );

  const firstDate = series[0]?.date;
  const midDate = series[Math.floor(series.length / 2)]?.date;
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}>Daily activity</h3>
        <div className="range-pills">
          {RANGES.map(r => (
            <button key={r.id} className={range === r.id ? 'active' : ''} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 200, display: 'block' }}>
          {series.map((d, i) => {
            const x = pad + i * barW;
            const barH = (d.queries / maxQ) * (H - 40);
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect
                  x={x + barW * 0.15}
                  y={H - barH - 10}
                  width={barW * 0.7}
                  height={barH}
                  fill="url(#qgrad)"
                  rx={1}
                  style={{ cursor: 'pointer', opacity: hover == null || hover === i ? 1 : .5 }}
                />
              </g>
            );
          })}
          {series.map((d, i) => {
            const x = pad + i * barW;
            const y = H - 10 - (d.recordingMin / maxR) * (H - 40);
            const next = series[i + 1];
            if (!next) return null;
            const nx = pad + (i + 1) * barW;
            const ny = H - 10 - (next.recordingMin / maxR) * (H - 40);
            return <line key={`r${i}`} x1={x + barW / 2} y1={y} x2={nx + barW / 2} y2={ny} stroke="var(--accent-2)" strokeWidth={1.5} />;
          })}
          {series.map((d, i) => {
            const x = pad + i * barW;
            const y = H - 10 - (d.sessions / maxS) * (H - 40);
            return <circle key={`s${i}`} cx={x + barW / 2} cy={y} r={2} fill="#7fa8d4" />;
          })}
          <defs>
            <linearGradient id="qgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity=".4" />
            </linearGradient>
          </defs>
        </svg>
        {hover != null && series[hover] && (
          <div className="chart-tip show" style={{ left: `${(hover / series.length) * 100}%`, top: 10 }}>
            <div className="tt-date">{series[hover].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            <div className="tt-row">Agent queries <b>{series[hover].queries}</b></div>
            <div className="tt-row">Recording min <b>{series[hover].recordingMin}</b></div>
            <div className="tt-row">Sessions <b>{series[hover].sessions}</b></div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.15em', textTransform: 'uppercase' }}>
          <span>{firstDate ? fmt(firstDate) : '—'}</span>
          <span>{midDate ? fmt(midDate) : '—'}</span>
          <span>today</span>
        </div>

        <div style={{ display: 'flex', gap: 18, marginTop: 14, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: 'var(--accent)', borderRadius: '50%' }} />
            Agent queries <b style={{ color: 'var(--ink)', marginLeft: 4 }}>{totals.q}</b>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: 'var(--accent-2)', borderRadius: '50%' }} />
            Recording min <b style={{ color: 'var(--ink)', marginLeft: 4 }}>{totals.r}</b>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: '#7fa8d4', borderRadius: '50%' }} />
            Sessions <b style={{ color: 'var(--ink)', marginLeft: 4 }}>{totals.s}</b>
          </span>
        </div>
      </div>
    </div>
  );
}
