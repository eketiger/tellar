import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiServer } from '@/lib/api';
import { getSession } from '@/lib/session';
import { sanitizeSlideHtml } from '@/lib/sanitize';
import { TopBar } from '@/components/TopBar';
import { NavDock } from '@/components/NavDock';
import { LiveFunnel } from './LiveFunnel';

export default async function TellerDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');

  const jar = await cookies();
  const cookieHeader = jar.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const [teller, metrics, share] = await Promise.all([
    apiServer<any>(`/tellers/${id}`, cookieHeader),
    apiServer<any>(`/tellers/${id}/analytics`, cookieHeader),
    apiServer<any>(`/tellers/${id}/share`, cookieHeader),
  ]);

  if (!teller) redirect('/dashboard');

  const fmtMs = (ms: number) => {
    const s = Math.round(ms / 1000);
    return s > 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  };

  return (
    <>
      <TopBar
        crumbs={[
          { label: session.workspace.name, href: '/dashboard' },
          { label: 'tellers', href: '/dashboard' },
          { label: teller.title.replace(/<[^>]+>/g, ''), active: true },
        ]}
        initials={session.session.initials}
        name={session.session.name}
        email={session.session.email}
        isAdmin={session.session.isAdmin}
        live={metrics?.uniqueViewers > 0}
      />

      <main className="shell">
        <section style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 32, paddingBottom: 28, marginBottom: 28, borderBottom: '1px solid var(--line)' }}>
          <div>
            <div className="note" style={{ marginBottom: 10 }}>— Dashboard · rev {teller.revision}</div>
            <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 44, lineHeight: 1.05, letterSpacing: '-.025em' }}
              dangerouslySetInnerHTML={{ __html: sanitizeSlideHtml(teller.title) }} />
            <div style={{ display: 'flex', gap: 18, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', marginTop: 18, flexWrap: 'wrap' }}>
              <span><b style={{ color: 'var(--ink)' }}>{metrics?.totalSlides ?? 0}</b> slides</span>
              <span className="note">·</span>
              <span><b style={{ color: 'var(--ink)' }}>{share?.slug ? `/v/${share.slug}` : 'not shared'}</b></span>
              <span className="note">·</span>
              <span>updated {new Date(teller.updatedAt).toLocaleString()}</span>
            </div>
            <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
              <a className="btn" href={`/tellers/${id}/edit`}>Open editor →</a>
              <a className="btn btn-ghost" href={`/tellers/${id}/share`}>Share settings →</a>
              {share?.slug && <a className="btn btn-ghost" href={`/v/${share.slug}`} target="_blank">Open as viewer ↗</a>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <Kpi label="Unique viewers" value={metrics?.uniqueViewers ?? 0} />
            <Kpi label="Completion" value={(metrics?.completion ?? 0) + '%'} />
            <Kpi label="Agent queries" value={metrics?.agentQueries ?? 0} delta={(metrics?.agentQueriesToday ?? 0) + ' today'} />
            <Kpi label="Avg session" value={fmtMs(metrics?.avgSessionMs ?? 0)} />
            <Kpi label="Slides" value={metrics?.totalSlides ?? 0} />
            <Kpi label="Biggest drop" value={(metrics?.biggestDrop?.drop ?? 0) + '%'} delta={`slide ${metrics?.biggestDrop?.idx || '—'}`} down />
          </div>
        </section>

        <div className="grid-2">
          <section className="panel">
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <header className="section-head">
              <h2><span className="num">01</span>Funnel</h2>
              <span className="aux">per-slide unique viewers</span>
            </header>
            <LiveFunnel initialFunnel={metrics?.funnel || []} shareId={share?.id} />
          </section>

          <section className="panel">
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <header className="section-head">
              <h2><span className="num">02</span>Viewers</h2>
            </header>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(metrics?.viewers || []).slice(0, 6).map((v: any) => (
                <div key={v.email} style={{ padding: 14, background: 'var(--panel-2)', border: '1px solid var(--line)', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#2a3a4e', color: '#9fb8d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500 }}>
                    {v.name.split(' ').map((s: string) => s[0]).slice(0, 2).join('')}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{v.name}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.email}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-2)', textAlign: 'right' }}>
                    <b style={{ color: 'var(--accent)' }}>{v.slidesSeen}/{v.totalSlides}</b> slides<br />
                    {fmtMs(v.dwellMs)}
                  </div>
                </div>
              ))}
              {metrics?.viewers?.length === 0 && <p className="note">No viewers yet — share the teller to start seeing data.</p>}
            </div>
          </section>
        </div>
      </main>
      <NavDock tellerId={id} />
    </>
  );
}

function Kpi({ label, value, delta, down }: { label: string; value: any; delta?: string; down?: boolean }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta && <div className={`kpi-delta ${down ? 'down' : 'up'}`}>{delta}</div>}
    </div>
  );
}
