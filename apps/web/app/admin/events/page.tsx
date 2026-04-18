import { cookies } from 'next/headers';
import { apiServer } from '@/lib/api';

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const sp = await searchParams;
  const jar = await cookies();
  const ch = jar.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const events = (await apiServer<any[]>(`/admin/events${sp.type ? `?type=${sp.type}` : ''}`, ch)) || [];
  const types = ['SLIDE_VIEW', 'SLIDE_DWELL', 'AGENT_QUERY', 'SHARE_OPEN', 'DOWNLOAD'];

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: 44, letterSpacing: '-.025em', marginBottom: 20 }}>
        Events
      </h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <a className={`btn btn-sm ${!sp.type ? 'btn-primary' : ''}`} href="/admin/events">All</a>
        {types.map(t => (
          <a key={t} className={`btn btn-sm ${sp.type === t ? 'btn-primary' : ''}`} href={`/admin/events?type=${t}`}>{t}</a>
        ))}
      </div>

      <div style={{ border: '1px solid var(--line)', background: 'var(--panel)' }}>
        {events.map(e => (
          <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '140px 140px 1fr 60px 140px', padding: '8px 14px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 10 }}>
            <span style={{ color: 'var(--accent)' }}>{e.type}</span>
            <span className="note">{e.email || '—'}</span>
            <span style={{ color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.meta?.question || `teller ${e.tellerId.slice(-6)}`}
            </span>
            <span className="note" style={{ textAlign: 'right' }}>{e.slideIdx ? `s${e.slideIdx}` : ''}</span>
            <span className="note">{new Date(e.at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
