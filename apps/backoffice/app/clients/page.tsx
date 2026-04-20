'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { boApi, getToken, clearToken } from '@/lib/api';

interface Workspace {
  id: string; name: string; slug: string; plan: string; seats: number; createdAt: string;
  owner: { id: string; email: string; name: string; lastLoginAt?: string | null };
  _count: { members: number; tellers: number };
  usage?: { agentQueries: number; recordingMinutes: number; storageMB: number } | null;
}

export default function Clients() {
  const router = useRouter();
  const [items, setItems] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    (async () => {
      try { setItems(await boApi<Workspace[]>('/admin/workspaces')); }
      catch (e: any) {
        if (e?.status === 401) { clearToken(); router.push('/login'); }
      } finally { setLoading(false); }
    })();
  }, [router]);

  const filtered = q.trim() ? items.filter(w => [w.name, w.slug, w.owner.email].some(s => s?.toLowerCase().includes(q.toLowerCase()))) : items;

  return (
    <>
      <header className="bo-top">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link href="/" className="bo-brand">tellar</Link>
          <span className="bo-tag">backoffice</span>
        </div>
        <div className="bo-right">
          <span>ops · internal</span>
          <button className="btn btn-sm btn-ghost" onClick={() => { clearToken(); router.push('/login'); }}>Sign out</button>
        </div>
      </header>

      <main className="bo-shell">
        <div className="bo-head">
          <div className="kicker">global · clients</div>
          <h1>All <em>workspaces.</em></h1>
          <p>Every paying + free workspace on the platform. Click any row to inspect without impersonating.</p>
        </div>

        <nav className="bo-nav">
          <Link href="/">Overview</Link>
          <Link href="/clients" className="active">Clients</Link>
        </nav>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <input className="field-input" placeholder="Search by workspace name, slug, or owner email…" value={q} onChange={e => setQ(e.target.value)} />
        </div>

        <div style={{ border: '1px solid var(--line)', background: 'var(--panel)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 80px 70px 90px 120px 140px', padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'var(--panel-2)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
            <span>Workspace</span><span>Owner</span><span>Plan</span><span>Seats</span><span>Tellers</span><span>Last access</span><span>Month usage</span>
          </div>
          {loading && <div style={{ padding: 24, textAlign: 'center' }} className="note">loading…</div>}
          {!loading && filtered.map(w => {
            const usageQ = w.usage?.agentQueries ?? 0;
            const lastLogin = w.owner.lastLoginAt ? timeAgo(new Date(w.owner.lastLoginAt)) : '—';
            return (
              <Link
                key={w.id}
                href={`/clients/${w.id}`}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1.4fr 80px 70px 90px 120px 140px', padding: '12px 14px', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12, color: 'var(--ink)', textDecoration: 'none' }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{w.name}</div>
                  <div className="note">/{w.slug}</div>
                </div>
                <span className="note">{w.owner.email}</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{w.plan}</span>
                <span className="note">{w._count.members}/{w.seats}</span>
                <span className="note">{w._count.tellers}</span>
                <span className="note">{lastLogin}</span>
                <span className="note">{usageQ} queries · {w.usage?.recordingMinutes ?? 0} min</span>
              </Link>
            );
          })}
          {!loading && !filtered.length && <div style={{ padding: 24, textAlign: 'center' }} className="note">No workspaces match.</div>}
        </div>
      </main>
    </>
  );
}

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
