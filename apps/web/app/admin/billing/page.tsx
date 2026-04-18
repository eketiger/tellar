import { cookies } from 'next/headers';
import { apiServer } from '@/lib/api';

export default async function AdminBillingPage() {
  const jar = await cookies();
  const ch = jar.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const d = (await apiServer<any>('/admin/billing', ch)) || { subs: [], invoices: [], revenueCents: 0 };

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: 44, letterSpacing: '-.025em', marginBottom: 20 }}>
        Billing
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 30 }}>
        <div className="kpi"><div className="kpi-label">Paid revenue</div><div className="kpi-value">${(d.revenueCents / 100).toFixed(2)}</div></div>
        <div className="kpi"><div className="kpi-label">Subscriptions</div><div className="kpi-value">{d.subs.length}</div></div>
        <div className="kpi"><div className="kpi-label">Invoices</div><div className="kpi-value">{d.invoices.length}</div></div>
      </div>

      <section className="panel" style={{ marginBottom: 20 }}>
        <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
        <header className="section-head"><h2>Subscriptions</h2></header>
        {d.subs.map((s: any) => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 100px 140px 120px', padding: '10px 0', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12 }}>
            <span>{s.user?.email}</span>
            <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{s.plan}</span>
            <span style={{ fontFamily: 'var(--mono)', color: s.status === 'active' ? 'var(--good)' : 'var(--bad)' }}>{s.status}</span>
            <span className="note">renews {new Date(s.currentPeriodEnd).toLocaleDateString()}</span>
            <span className="note">{s.cancelAtPeriodEnd ? 'canceling' : 'auto-renew'}</span>
          </div>
        ))}
        {!d.subs.length && <p className="note">No subscriptions yet.</p>}
      </section>

      <section className="panel">
        <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
        <header className="section-head"><h2>Recent invoices</h2></header>
        {d.invoices.map((i: any) => (
          <div key={i.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 100px 120px', padding: '10px 0', borderBottom: '1px solid var(--line)', alignItems: 'center', fontSize: 12 }}>
            <span>{i.user?.email}</span>
            <span style={{ fontFamily: 'var(--mono)' }}>${(i.amountPaid / 100).toFixed(2)} {i.currency.toUpperCase()}</span>
            <span style={{ fontFamily: 'var(--mono)', color: i.status === 'paid' ? 'var(--good)' : 'var(--accent)' }}>{i.status}</span>
            <span className="note">{new Date(i.createdAt).toLocaleDateString()}</span>
          </div>
        ))}
        {!d.invoices.length && <p className="note">No invoices yet.</p>}
      </section>
    </div>
  );
}
