import { cookies } from 'next/headers';
import { apiServer } from '@/lib/api';

export default async function AdminOverview() {
  const jar = await cookies();
  const ch = jar.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const m = (await apiServer<any>('/admin/overview', ch)) || {};

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: 44, letterSpacing: '-.025em', marginBottom: 20 }}>
        Platform <em style={{ color: 'var(--accent)' }}>overview</em>
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 30 }}>
        <Kpi label="Accounts" value={m.usersTotal || 0} delta={`+${m.last30DaysSignups || 0} / 30d`} />
        <Kpi label="Active users" value={m.usersActive || 0} />
        <Kpi label="Workspaces" value={m.workspacesTotal || 0} />
        <Kpi label="Tellers" value={m.tellersTotal || 0} />
        <Kpi label="Active shares" value={m.sharesTotal || 0} />
        <Kpi label="Active subs" value={m.activeSubs || 0} />
        <Kpi label="MRR" value={`$${m.mrr || 0}`} />
        <Kpi label="Agent queries" value={m.agentQueries || 0} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <section className="panel">
          <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
          <header className="section-head"><h2>Latest signups</h2></header>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(m.latestUsers || []).map((u: any) => (
              <div key={u.id} style={{ padding: 10, border: '1px solid var(--line)', background: 'var(--panel-2)', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', fontSize: 12 }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{u.email}</div>
                  <div className="note">{u.provider} · {new Date(u.createdAt).toLocaleString()}</div>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: u.role === 'ADMIN' ? 'var(--accent)' : 'var(--ink-3)' }}>{u.role}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
          <header className="section-head"><h2>Recent events</h2></header>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(m.latestEvents || []).slice(0, 12).map((e: any) => (
              <div key={e.id} style={{ padding: '6px 10px', border: '1px solid var(--line)', background: 'var(--panel-2)', fontFamily: 'var(--mono)', fontSize: 10, display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 8 }}>
                <span style={{ color: 'var(--accent)' }}>{e.type}</span>
                <span style={{ color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.email || '—'}</span>
                <span className="note">{new Date(e.at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, delta }: any) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta && <div className="kpi-delta up">{delta}</div>}
    </div>
  );
}
