'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { boApi, getToken, clearToken } from '@/lib/api';

interface WsDetail {
  workspace: {
    id: string; name: string; slug: string; plan: string; seats: number; createdAt: string;
    owner: { id: string; email: string; name: string; lastLoginAt?: string | null; createdAt: string; provider: string };
    members: { id: string; email: string; role: string; status: string; joinedAt: string; user?: { lastLoginAt?: string | null } | null }[];
    usage?: { agentQueries: number; recordingMinutes: number; storageMB: number; month: string } | null;
    billing?: { plan: string; seatCount: number; stripeCustomerId?: string | null } | null;
    tellers: { id: string; title: string; revision: number; updatedAt: string; isPublished: boolean }[];
  };
  subscriptions: { id: string; status: string; plan: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean }[];
  invoices: { id: string; amountPaid: number; currency: string; status: string; createdAt: string; invoicePdf?: string | null }[];
  eventCount: number;
  agentQueries: number;
}

export default function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<WsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    (async () => {
      try { setData(await boApi<WsDetail>(`/admin/workspaces/${id}`)); }
      catch (e: any) {
        if (e?.status === 401) { clearToken(); router.push('/login'); return; }
        setErr(e?.message || 'Failed to load');
      } finally { setLoading(false); }
    })();
  }, [id, router]);

  if (loading) return <div style={{ padding: 40 }} className="note">loading…</div>;
  if (err) return <div style={{ padding: 40, color: 'var(--bad)' }}>{err}</div>;
  if (!data) return null;

  const w = data.workspace;
  const activeSub = data.subscriptions.find(s => s.status === 'active');

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
          <div className="kicker">
            <Link href="/clients" style={{ color: 'var(--ink-2)' }}>clients</Link> / {w.slug}
          </div>
          <h1>{w.name} <em>— {w.plan.toLowerCase()}</em></h1>
          <p>
            Owner <b style={{ color: 'var(--ink)', fontStyle: 'normal', fontWeight: 500 }}>{w.owner.email}</b>
            {w.owner.lastLoginAt ? <> · last active <b style={{ color: 'var(--ink)', fontStyle: 'normal' }}>{new Date(w.owner.lastLoginAt).toLocaleString()}</b></> : ''}
          </p>
        </div>

        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(6,1fr)' }}>
          <div className="kpi"><div className="kpi-label">Plan</div><div className="kpi-value" style={{ color: 'var(--accent)' }}>{w.plan}</div></div>
          <div className="kpi"><div className="kpi-label">Seats</div><div className="kpi-value">{w.members.length}<span style={{ fontSize: 14, color: 'var(--ink-3)', marginLeft: 4 }}>/ {w.seats}</span></div></div>
          <div className="kpi"><div className="kpi-label">Tellers</div><div className="kpi-value">{w.tellers.length}</div></div>
          <div className="kpi"><div className="kpi-label">Events</div><div className="kpi-value">{data.eventCount}</div></div>
          <div className="kpi"><div className="kpi-label">Agent queries</div><div className="kpi-value">{data.agentQueries}</div></div>
          <div className="kpi"><div className="kpi-label">Created</div><div className="kpi-value" style={{ fontSize: 16 }}>{new Date(w.createdAt).toLocaleDateString()}</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 22 }}>
          <section className="panel">
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <header className="section-head">
              <h2><span className="num">01</span>Members</h2>
              <span className="aux">{w.members.length} total</span>
            </header>
            <div>
              {w.members.map(m => (
                <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 120px', padding: '10px 0', borderBottom: '1px dashed var(--line)', alignItems: 'center', fontSize: 12, gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{m.email}</div>
                    <div className="note">joined {new Date(m.joinedAt).toLocaleDateString()}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)' }}>{m.role}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: m.status === 'active' ? 'var(--good)' : 'var(--accent)' }}>{m.status}</span>
                  <span className="note">{m.user?.lastLoginAt ? new Date(m.user.lastLoginAt).toLocaleDateString() : '—'}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <header className="section-head"><h2><span className="num">02</span>Billing</h2></header>
            {activeSub ? (
              <div>
                <p style={{ fontSize: 13, marginBottom: 8 }}>Subscription <em style={{ color: 'var(--accent)' }}>{activeSub.plan}</em> — <b>{activeSub.status}</b></p>
                <p className="note" style={{ marginBottom: 16 }}>
                  renews {new Date(activeSub.currentPeriodEnd).toLocaleDateString()}
                  {activeSub.cancelAtPeriodEnd ? ' · cancels at period end' : ''}
                </p>
              </div>
            ) : <p className="note" style={{ marginBottom: 16 }}>No active subscription</p>}

            <div className="note" style={{ marginBottom: 8 }}>Recent invoices</div>
            {data.invoices.length === 0 && <p className="note">No invoices yet.</p>}
            {data.invoices.map(i => (
              <div key={i.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto 80px', padding: '8px 0', borderBottom: '1px dashed var(--line)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', gap: 10 }}>
                <span>{new Date(i.createdAt).toLocaleDateString()}</span>
                <span>${(i.amountPaid / 100).toFixed(2)} {i.currency.toUpperCase()}</span>
                <span style={{ color: i.status === 'paid' ? 'var(--good)' : 'var(--accent)' }}>{i.status}</span>
              </div>
            ))}
          </section>
        </div>

        <section className="panel" style={{ marginTop: 22 }}>
          <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
          <header className="section-head">
            <h2><span className="num">03</span>Tellers</h2>
            <span className="aux">{w.tellers.length} · most recent 20</span>
          </header>
          <div>
            {w.tellers.map(t => (
              <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 140px', padding: '10px 0', borderBottom: '1px dashed var(--line)', alignItems: 'center', fontSize: 12 }}>
                <span dangerouslySetInnerHTML={{ __html: (t.title || 'Untitled').replace(/<\/?(?!em\b|br\b|strong\b)[^>]+>/gi, '') }} />
                <span className="note">rev {t.revision}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: t.isPublished ? 'var(--good)' : 'var(--ink-3)' }}>{t.isPublished ? 'published' : 'draft'}</span>
                <span className="note">{new Date(t.updatedAt).toLocaleDateString()}</span>
              </div>
            ))}
            {!w.tellers.length && <p className="note">No tellers in this workspace.</p>}
          </div>
        </section>

        {w.usage && (
          <section className="panel" style={{ marginTop: 22 }}>
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <header className="section-head"><h2><span className="num">04</span>Usage — {w.usage.month}</h2></header>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              <div><div className="note">Agent queries</div><div style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>{w.usage.agentQueries}</div></div>
              <div><div className="note">Recording min</div><div style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>{w.usage.recordingMinutes}</div></div>
              <div><div className="note">Storage MB</div><div style={{ fontFamily: 'var(--serif)', fontSize: 24 }}>{w.usage.storageMB}</div></div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
