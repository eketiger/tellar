'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export function AccountsClient({ initial, initialQuery }: { initial: any; initialQuery: string }) {
  const [items, setItems] = useState(initial.items);
  const [q, setQ] = useState(initialQuery);
  const [busy, setBusy] = useState<string | null>(null);

  async function search() {
    const r = await api<any>(`/admin/accounts?q=${encodeURIComponent(q)}`);
    setItems(r.items);
  }

  async function setRole(id: string, role: 'USER' | 'ADMIN') {
    setBusy(id);
    await api(`/admin/accounts/${id}/role`, { method: 'PATCH', json: { role } });
    setItems((xs: any[]) => xs.map(x => (x.id === id ? { ...x, role } : x)));
    setBusy(null);
  }

  async function setSuspended(id: string, isSuspended: boolean) {
    setBusy(id);
    await api(`/admin/accounts/${id}/suspended`, { method: 'PATCH', json: { isSuspended } });
    setItems((xs: any[]) => xs.map(x => (x.id === id ? { ...x, isSuspended } : x)));
    setBusy(null);
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: 44, letterSpacing: '-.025em', marginBottom: 20 }}>
        Accounts <span className="note" style={{ marginLeft: 10 }}>· {initial.total} total</span>
      </h1>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input
          className="field-input"
          placeholder="Search email or name…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <button className="btn" onClick={search}>Search</button>
      </div>

      <div style={{ border: '1px solid var(--line)', background: 'var(--panel)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 120px 120px 120px 160px', padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'var(--panel-2)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          <span>Account</span>
          <span>Provider</span>
          <span>Role</span>
          <span>Status</span>
          <span>Joined</span>
          <span>Actions</span>
        </div>
        {items.map((u: any) => (
          <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 120px 120px 120px 160px', padding: '12px 14px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12 }}>
            <div>
              <div style={{ fontWeight: 500 }}>{u.name}</div>
              <div className="note">{u.email}</div>
            </div>
            <span className="note">{u.provider}</span>
            <span style={{ fontFamily: 'var(--mono)', color: u.role === 'ADMIN' ? 'var(--accent)' : 'var(--ink-2)' }}>{u.role}</span>
            <span style={{ fontFamily: 'var(--mono)', color: u.isSuspended ? 'var(--bad)' : u.deletionRequestedAt ? 'var(--accent)' : 'var(--good)' }}>
              {u.isSuspended ? 'suspended' : u.deletionRequestedAt ? 'deletion' : 'active'}
            </span>
            <span className="note">{new Date(u.createdAt).toLocaleDateString()}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-sm btn-ghost"
                disabled={busy === u.id}
                onClick={() => setRole(u.id, u.role === 'ADMIN' ? 'USER' : 'ADMIN')}
              >
                {u.role === 'ADMIN' ? 'Demote' : 'Promote'}
              </button>
              <button
                className="btn btn-sm btn-ghost"
                style={{ color: u.isSuspended ? 'var(--good)' : 'var(--bad)' }}
                disabled={busy === u.id}
                onClick={() => setSuspended(u.id, !u.isSuspended)}
              >
                {u.isSuspended ? 'Unsuspend' : 'Suspend'}
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div style={{ padding: 24, textAlign: 'center' }} className="note">No accounts match.</div>}
      </div>
    </div>
  );
}
