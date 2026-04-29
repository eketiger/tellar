'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface AccountsPage {
  items: any[];
  total: number;
  page: number;
  pageSize: number;
}

export function AccountsClient({ initial, initialQuery }: { initial: AccountsPage; initialQuery: string }) {
  const [data, setData] = useState<AccountsPage>(initial);
  const [q, setQ] = useState(initialQuery);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const items = data.items;

  async function load(opts: { q?: string; page?: number } = {}) {
    setLoading(true);
    const nextQ = opts.q ?? q;
    const nextPage = opts.page ?? 1;
    try {
      const r = await api<AccountsPage>(`/admin/accounts?q=${encodeURIComponent(nextQ)}&page=${nextPage}`);
      setData(r);
    } finally {
      setLoading(false);
    }
  }

  async function setRole(id: string, role: 'USER' | 'ADMIN') {
    setBusy(id);
    await api(`/admin/accounts/${id}/role`, { method: 'PATCH', json: { role } });
    setData(d => ({ ...d, items: d.items.map(x => (x.id === id ? { ...x, role } : x)) }));
    setBusy(null);
  }

  async function setSuspended(id: string, isSuspended: boolean) {
    setBusy(id);
    await api(`/admin/accounts/${id}/suspended`, { method: 'PATCH', json: { isSuspended } });
    setData(d => ({ ...d, items: d.items.map(x => (x.id === id ? { ...x, isSuspended } : x)) }));
    setBusy(null);
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: 44, letterSpacing: '-.025em', marginBottom: 20 }}>
        Accounts <span className="note" style={{ marginLeft: 10 }}>· {data.total} total</span>
      </h1>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input
          className="field-input"
          placeholder="Search email or name…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load({ q, page: 1 })}
        />
        <button className="btn" onClick={() => load({ q, page: 1 })} disabled={loading}>
          {loading ? '…' : 'Search'}
        </button>
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

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)' }}>
          <span className="note">
            page {data.page} of {totalPages} · {data.pageSize} per page
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-sm btn-ghost"
              disabled={loading || data.page <= 1}
              onClick={() => load({ q, page: data.page - 1 })}
            >
              ← prev
            </button>
            <button
              className="btn btn-sm btn-ghost"
              disabled={loading || data.page >= totalPages}
              onClick={() => load({ q, page: data.page + 1 })}
            >
              next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
