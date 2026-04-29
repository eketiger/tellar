'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SkeletonLine } from '@/components/ui/Skeleton';

interface InsightItem {
  kind: 'win' | 'risk' | 'recommendation' | 'observation';
  title: string;
  detail: string;
  slideIdx?: number;
  confidence?: 'high' | 'medium' | 'low';
}

interface InsightsResult {
  generatedAt: string;
  fallback: boolean;
  summary: string;
  insights: InsightItem[];
  usage?: { inputTokens: number; outputTokens: number; cacheReadInputTokens?: number };
}

const KIND_STYLE: Record<InsightItem['kind'], { tag: string; color: string }> = {
  win: { tag: 'win', color: 'var(--good)' },
  risk: { tag: 'risk', color: 'var(--bad)' },
  recommendation: { tag: 'do', color: 'var(--accent)' },
  observation: { tag: 'note', color: 'var(--ink-2)' },
};

export function ClaudeInsights({ tellerId }: { tellerId: string }) {
  const [data, setData] = useState<InsightsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchInsights() {
    setLoading(true);
    setError(null);
    try {
      const r = await api<InsightsResult>(`/tellers/${tellerId}/insights`);
      setData(r);
    } catch (e: any) {
      setError(e?.message || 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchInsights(); /* eslint-disable-next-line */ }, [tellerId]);

  return (
    <section className="panel fade-in d4" style={{ marginTop: 18 }}>
      <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
      <header className="section-head">
        <h2><span className="num">04</span>Claude insights {data?.fallback && <span className="note" style={{ marginLeft: 8 }}>· deterministic fallback</span>}</h2>
        <span className="aux" style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={fetchInsights}
            disabled={loading}
            className="btn btn-sm btn-ghost"
          >
            {loading ? '…' : 'Refresh'}
          </button>
        </span>
      </header>

      {loading && !data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 8 }}>
          <SkeletonLine width="65%" height={12} />
          <SkeletonLine width="90%" height={10} />
          <SkeletonLine width="75%" height={10} />
        </div>
      )}

      {error && <div className="err">! {error}</div>}

      {data && (
        <>
          <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-2)', marginBottom: 12 }}>
            {data.summary}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.insights.map((ins, i) => {
              const meta = KIND_STYLE[ins.kind];
              return (
                <div key={i} style={{
                  border: '1px solid var(--line)', background: 'var(--panel-2)',
                  padding: '10px 12px', display: 'grid',
                  gridTemplateColumns: '60px 1fr auto', gap: 12, alignItems: 'baseline',
                }}>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.2em',
                    textTransform: 'uppercase', color: meta.color,
                  }}>
                    {meta.tag}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{ins.title}</div>
                    <div className="note" style={{ marginTop: 2 }}>{ins.detail}</div>
                  </div>
                  {(ins.slideIdx || ins.confidence) && (
                    <span className="note" style={{ whiteSpace: 'nowrap' }}>
                      {ins.slideIdx ? `slide ${ins.slideIdx}` : ''}
                      {ins.slideIdx && ins.confidence ? ' · ' : ''}
                      {ins.confidence ? ins.confidence : ''}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {data.usage && (
            <div className="note" style={{ marginTop: 12, textAlign: 'right' }}>
              {data.usage.inputTokens} in · {data.usage.outputTokens} out
              {data.usage.cacheReadInputTokens ? ` · ${data.usage.cacheReadInputTokens} cached` : ''}
            </div>
          )}
        </>
      )}
    </section>
  );
}
