'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { boApi, getToken, clearToken } from '@/lib/api';

interface Overview {
  usersTotal: number; usersActive: number; workspacesTotal: number; tellersTotal: number;
  sharesTotal: number; activeSubs: number; agentQueries: number; last30DaysSignups: number;
  mrr: number;
  latestUsers: { id: string; email: string; name: string; createdAt: string; role: string; provider: string }[];
  latestEvents: { id: string; type: string; at: string; email?: string | null; meta?: any }[];
}

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    (async () => {
      try { setData(await boApi<Overview>('/admin/overview')); }
      catch (e: any) {
        if (e?.status === 401) { clearToken(); router.push('/login'); }
        else setErr(e?.message || 'Failed to load');
      } finally { setLoading(false); }
    })();
  }, [router]);

  function signOut() { clearToken(); router.push('/login'); }

  if (loading) return <div style={{ padding: 40, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>loading…</div>;
  if (err) return <div style={{ padding: 40, color: 'var(--bad)' }}>{err}</div>;
  if (!data) return null;

  return (
    <>
      <header className="bo-top">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link href="/" className="bo-brand">tellar</Link>
          <span className="bo-tag">backoffice</span>
        </div>
        <div className="bo-right">
          <span>ops · internal</span>
          <button className="btn btn-sm btn-ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <main className="bo-shell">
        <div className="bo-head">
          <div className="kicker">global · platform operations</div>
          <h1>Tellar at a <em>glance.</em></h1>
          <p>Every workspace, every dollar, every query — across the whole platform.</p>
        </div>

        <nav className="bo-nav">
          <Link href="/" className="active">Overview</Link>
          <Link href="/clients">Clients</Link>
        </nav>

        <div className="kpi-grid">
          <Kpi label="MRR" value={`$${data.mrr.toLocaleString()}`} delta={`${data.activeSubs} active subs`} />
          <Kpi label="Workspaces" value={data.workspacesTotal} delta={`${data.last30DaysSignups} signed up in 30d`} up />
          <Kpi label="Active users" value={data.usersActive} delta={`of ${data.usersTotal} total`} />
          <Kpi label="Agent queries" value={data.agentQueries} delta="all-time" />
          <Kpi label="Tellers" value={data.tellersTotal} />
          <Kpi label="Active shares" value={data.sharesTotal} />
          <Kpi label="Suspended" value={data.usersTotal - data.usersActive} down />
          <Kpi label="Signups 30d" value={data.last30DaysSignups} up />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
          <section className="panel">
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <header className="section-head">
              <h2><span className="num">01</span>Latest signups</h2>
              <span className="aux">last 10</span>
            </header>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.latestUsers.map(u => (
                <div key={u.id} style={{ padding: 10, border: '1px solid var(--line)', background: 'var(--panel-2)', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', fontSize: 12 }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{u.email}</div>
                    <div className="note">{u.provider} · {new Date(u.createdAt).toLocaleString()}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: u.role === 'ADMIN' ? 'var(--accent)' : 'var(--ink-3)' }}>{u.role}</span>
                  <Link href={`/clients`} className="btn btn-ghost btn-sm">inspect →</Link>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <header className="section-head">
              <h2><span className="num">02</span>Recent events</h2>
              <span className="aux">live feed</span>
            </header>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.latestEvents.slice(0, 14).map(e => (
                <div key={e.id} style={{ padding: '6px 10px', border: '1px solid var(--line)', background: 'var(--panel-2)', fontFamily: 'var(--mono)', fontSize: 10, display: 'grid', gridTemplateColumns: '130px 1fr auto', gap: 8 }}>
                  <span style={{ color: 'var(--accent)' }}>{e.type}</span>
                  <span style={{ color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.meta?.question || e.email || '—'}
                  </span>
                  <span className="note">{new Date(e.at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function Kpi({ label, value, delta, up, down }: { label: string; value: any; delta?: string; up?: boolean; down?: boolean }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta && <div className={`kpi-delta ${up ? 'up' : down ? 'down' : ''}`}>{delta}</div>}
    </div>
  );
}
