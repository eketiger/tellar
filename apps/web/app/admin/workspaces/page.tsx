import { cookies } from 'next/headers';
import { apiServer } from '@/lib/api';

export default async function AdminWorkspacesPage() {
  const jar = await cookies();
  const ch = jar.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const items = (await apiServer<any[]>('/admin/workspaces', ch)) || [];

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: 44, letterSpacing: '-.025em', marginBottom: 20 }}>
        Workspaces
      </h1>

      <div style={{ border: '1px solid var(--line)', background: 'var(--panel)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 100px 100px 100px 120px', padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'var(--panel-2)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          <span>Workspace</span>
          <span>Owner</span>
          <span>Plan</span>
          <span>Seats</span>
          <span>Tellers</span>
          <span>Created</span>
        </div>
        {items.map(w => (
          <div key={w.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 100px 100px 100px 120px', padding: '12px 14px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12 }}>
            <div>
              <div style={{ fontWeight: 500 }}>{w.name}</div>
              <div className="note">/{w.slug}</div>
            </div>
            <span className="note">{w.owner?.email}</span>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{w.plan}</span>
            <span className="note">{w._count?.members || 0}/{w.seats}</span>
            <span className="note">{w._count?.tellers || 0}</span>
            <span className="note">{new Date(w.createdAt).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
