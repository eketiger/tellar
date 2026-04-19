import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { apiServer } from '@/lib/api';
import { getSession } from '@/lib/session';
import { sanitizeSlideHtml } from '@/lib/sanitize';
import { TopBar } from '@/components/TopBar';
import { NavDock } from '@/components/NavDock';
import { LiveFunnel } from './LiveFunnel';
import { SessionRecordings } from './SessionRecordings';
import './dashboard.css';

const AVATAR_COLORS = [
  ['#2a3a4e', '#9fb8d4'],
  ['#4e2a3a', '#d49fb8'],
  ['#3a4e2a', '#b8d49f'],
  ['#4e3a2a', '#d4b89f'],
  ['#3a2a4e', '#b89fd4'],
] as const;

function fmtMs(ms: number) {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

function viewerBadge(pct: number) {
  if (pct >= 100) return '✓ complete';
  if (pct >= 60) return '💬 engaged';
  if (pct >= 30) return '⚠ stalled';
  return '✕ bounced';
}

function buildInsights(m: any) {
  const out: { neg?: boolean; tag: string; html: string }[] = [];
  if (m.biggestDrop?.drop >= 15) {
    const title = String(m.biggestDrop.title || '').replace(/<[^>]+>/g, '').slice(0, 40);
    out.push({
      neg: true,
      tag: '⚠ drop-off hotspot',
      html: `<b>Slide ${m.biggestDrop.idx} — "${title}"</b> is losing ${m.biggestDrop.drop}% of viewers. Consider reframing the content before this point.`,
    });
  }
  if (m.topQuestions?.[0] && m.topQuestions[0].count >= 3) {
    out.push({
      tag: '💬 common question',
      html: `Viewers keep asking the agent <b>"${m.topQuestions[0].display}"</b> — ${m.topQuestions[0].count} times. Consider adding a dedicated slide or expanding the KB.`,
    });
  }
  if (m.completion >= 50) {
    out.push({
      tag: '↑ engagement',
      html: `<b>${m.completion}% completion rate</b> — above the 32% DocSend pitch deck benchmark. Whatever you're doing on the opening slides is working.`,
    });
  } else if (m.uniqueViewers > 5) {
    out.push({
      neg: true,
      tag: '↓ low completion',
      html: `Only <b>${m.completion}%</b> of viewers reach the final slide. The deck may be too long or losing pace past slide ${Math.round(m.totalSlides / 2)}.`,
    });
  }
  return out;
}

export default async function TellerDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');

  const jar = await cookies();
  const ch = jar.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const [teller, metrics, share] = await Promise.all([
    apiServer<any>(`/tellers/${id}`, ch),
    apiServer<any>(`/tellers/${id}/analytics`, ch),
    apiServer<any>(`/tellers/${id}/share`, ch),
  ]);
  if (!teller) redirect('/dashboard');

  const m = metrics || { funnel: [], viewers: [], topQuestions: [], biggestDrop: { drop: 0, idx: 0, title: '' }, totalSlides: 0, uniqueViewers: 0, completion: 0, agentQueries: 0, agentQueriesToday: 0, avgSessionMs: 0 };
  const insights = buildInsights(m);
  const topViewers = (m.viewers || []).slice(0, 6);
  const topQuestions = (m.topQuestions || []).slice(0, 6);

  const lastSharedDays = share ? Math.max(0, Math.floor((Date.now() - new Date(share.createdAt).getTime()) / 86_400_000)) : 0;
  const avgMin = Math.floor(m.avgSessionMs / 60_000);
  const avgSec = Math.round((m.avgSessionMs % 60_000) / 1000);

  const recordings = topViewers.map((v: any, i: number) => {
    const [bg, fg] = AVATAR_COLORS[i % AVATAR_COLORS.length];
    const durMs = v.dwellMs || 60_000;
    const min = Math.floor(durMs / 60_000);
    const sec = Math.round((durMs % 60_000) / 1000);
    const hoursAgo = Math.max(1, Math.floor((Date.now() - v.lastSeen) / 3_600_000));
    const live = i === 0 && topViewers.length > 1;
    const when = live ? 'in progress' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo / 24)}d ago`;
    const reachPct = Math.round((v.slidesSeen / Math.max(v.totalSlides, 1)) * 100);
    return { idx: i, name: v.name, email: v.email, bg, fg, durMs, min, sec, when, live, slidesSeen: v.slidesSeen, totalSlides: v.totalSlides, reachPct };
  });

  return (
    <>
      <TopBar
        crumbs={[
          { label: session.workspace.name, href: '/dashboard' },
          { label: 'tellers', href: '/dashboard' },
          { label: String(teller.title || '').replace(/<[^>]+>/g, ''), active: true },
        ]}
        initials={session.session.initials}
        name={session.session.name}
        email={session.session.email}
        isAdmin={session.session.isAdmin}
        live={m.uniqueViewers > 0}
      />

      <main className="td-shell">
        <section className="td-hero">
          <div className="td-hero-left fade-in d1">
            <div className="eyebrow">teller · shared link · {share?.slug || '—'}</div>
            <h1>
              <span dangerouslySetInnerHTML={{ __html: sanitizeSlideHtml(teller.title) }} />{' '}
              <em>— revision {teller.revision}</em>
            </h1>
            <div className="td-hero-meta">
              <span><b>{m.totalSlides}</b> slides</span>
              <span className="divider">/</span>
              <span><b>{m.uniqueViewers}</b> unique viewers</span>
              <span className="divider">/</span>
              <span>last shared <b>{lastSharedDays}d ago</b></span>
              <span className="divider">/</span>
              <span>avg. session <b>{avgMin}m {String(avgSec).padStart(2, '0')}s</b></span>
            </div>
            <div className="td-hero-actions">
              <Link href={`/tellers/${id}/edit`} className="btn">
                <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M8.5 1.5L10.5 3.5 4 10l-2.5.5L2 8l6.5-6.5z" /></svg>
                Edit teller
              </Link>
              {share?.slug && (
                <Link href={`/v/${share.slug}`} target="_blank" className="btn btn-ghost">
                  <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx={6} cy={6} r={2.5} /><path d="M1 6c1.5-3 3.5-4 5-4s3.5 1 5 4c-1.5 3-3.5 4-5 4S2.5 9 1 6z" /></svg>
                  Preview as viewer
                </Link>
              )}
              <Link href={`/tellers/${id}/share`} className="btn btn-ghost">
                <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx={3} cy={6} r={1.5} /><circle cx={9} cy={3} r={1.5} /><circle cx={9} cy={9} r={1.5} /><path d="M4.3 5.3l3.4-1.6M4.3 6.7l3.4 1.6" /></svg>
                Share settings
              </Link>
            </div>
          </div>

          <div className="td-hero-right">
            <div className="kpi fade-in d2">
              <div className="kpi-label">Completion</div>
              <div className="kpi-value">{m.completion}<span className="unit">%</span></div>
              <div className="kpi-delta">viewers who saw last slide</div>
            </div>
            <div className="kpi fade-in d3">
              <div className="kpi-label">Biggest drop</div>
              <div className="kpi-value">Slide&nbsp;{m.biggestDrop?.idx || '—'}</div>
              <div className="kpi-delta down">−{m.biggestDrop?.drop || 0}% of viewers</div>
            </div>
            <div className="kpi fade-in d4">
              <div className="kpi-label">Agent queries</div>
              <div className="kpi-value">{m.agentQueries}</div>
              <div className="kpi-delta up">↑ {m.agentQueriesToday} today</div>
            </div>
          </div>
        </section>

        <div className="td-grid">
          <div>
            <section className="panel fade-in d2">
              <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
              <header className="section-head">
                <h2><span className="num">01</span>Slide funnel</h2>
                <span className="aux">live · from events</span>
              </header>
              <LiveFunnel initialFunnel={m.funnel || []} biggestDropIdx={m.biggestDrop?.idx || 0} shareId={share?.id} />
            </section>

            <section className="panel fade-in d3">
              <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
              <header className="section-head">
                <h2><span className="num">02</span>Recent viewers</h2>
                <span className="aux">sorted by engagement</span>
              </header>
              <div className="td-viewers">
                {topViewers.map((v: any, i: number) => {
                  const [bg, fg] = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  const dwellM = Math.floor(v.dwellMs / 60_000);
                  const dwellS = Math.round((v.dwellMs % 60_000) / 1000);
                  const reachPct = Math.round((v.slidesSeen / Math.max(v.totalSlides, 1)) * 100);
                  return (
                    <div key={v.email} className="viewer-card">
                      <div className="viewer-avatar" style={{ background: bg, color: fg }}>{v.name[0].toUpperCase()}</div>
                      <div className="viewer-info">
                        <div className="viewer-name">{v.name}</div>
                        <div className="viewer-email">{v.email}</div>
                        <div className="viewer-stats">
                          <span>read <b>{v.slidesSeen}/{v.totalSlides}</b></span>
                          <span><b>{dwellM}m {String(dwellS).padStart(2, '0')}s</b></span>
                          <span>{viewerBadge(reachPct)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {topViewers.length === 0 && <p className="note">No viewers yet — share the teller to start seeing data.</p>}
              </div>
            </section>
          </div>

          <div>
            <section className="panel fade-in d3">
              <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
              <header className="section-head">
                <h2><span className="num">03</span>Top agent questions</h2>
                <span className="aux">{m.agentQueries} total</span>
              </header>
              {topQuestions.length ? (
                <div className="q-list">
                  {topQuestions.map((q: any) => (
                    <div key={q.display} className="q-row">
                      <span className="q-text">"{q.display}"</span>
                      <span className="q-count">×{q.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', padding: 10 }}>
                  No queries yet. Viewers haven't asked the agent anything.
                </div>
              )}
            </section>

            <section className="panel fade-in d4">
              <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
              <header className="section-head">
                <h2><span className="num">04</span>Auto-insights</h2>
                <span className="aux">just now</span>
              </header>
              {insights.length ? (
                insights.map((ins, i) => (
                  <div key={i} className={`insight ${ins.neg ? 'neg' : ''}`}>
                    <span className="tag">{ins.tag}</span>
                    <span dangerouslySetInnerHTML={{ __html: ins.html }} />
                  </div>
                ))
              ) : (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', padding: 10 }}>
                  Not enough data yet — share the teller to start generating insights.
                </div>
              )}
            </section>
          </div>
        </div>

        <section className="panel fade-in d4" style={{ marginTop: 28 }}>
          <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
          <header className="section-head">
            <h2><span className="num">05</span>Viewer session recordings</h2>
            <span className="aux">{recordings.length} sessions · {recordings.filter((r: { live: boolean }) => r.live).length ? '1 live · ' : ''}auto-captured</span>
          </header>
          <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', margin: '-2px 0 16px', lineHeight: 1.5 }}>
            Screen recordings of each viewer's path through the deck — see exactly where they paused, re-read, or bounced.
          </p>
          <SessionRecordings items={recordings} />
        </section>
      </main>
      <NavDock tellerId={id} />
    </>
  );
}
