'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'members', label: 'Members' },
  { id: 'usage', label: 'Usage' },
  { id: 'billing', label: 'Billing' },
  { id: 'security', label: 'Security' },
];

export function SettingsClient({ workspace, user, members, usage, billing }: any) {
  const [tab, setTab] = useState('profile');
  const [memberList, setMembers] = useState<any[]>(members);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('EDITOR');
  const [wsName, setWsName] = useState(workspace.name);

  async function invite() {
    if (!inviteEmail.includes('@')) return;
    const m = await api<any>(`/workspaces/${workspace.id}/invites`, { method: 'POST', json: { email: inviteEmail, role: inviteRole } });
    setMembers(ms => [...ms, m]);
    setInviteEmail('');
  }
  async function remove(id: string) {
    await api(`/memberships/${id}`, { method: 'DELETE' });
    setMembers(ms => ms.filter(m => m.id !== id));
  }
  async function rename() {
    await api(`/workspaces/${workspace.id}`, { method: 'PATCH', json: { name: wsName } });
  }
  async function upgrade(plan: string) {
    const r = await api<{ url: string }>('/billing/checkout', { method: 'POST', json: { workspaceId: workspace.id, plan } });
    location.href = r.url;
  }

  return (
    <main className="shell">
      <div style={{ marginBottom: 30 }}>
        <div className="note" style={{ marginBottom: 10 }}>— Settings</div>
        <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: 48, letterSpacing: '-.025em' }}>
          Your <em style={{ color: 'var(--accent)' }}>studio</em>.
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 30 }}>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'sticky', top: 80, alignSelf: 'start' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                textAlign: 'left', padding: '10px 14px', cursor: 'pointer',
                background: tab === t.id ? 'rgba(244,185,66,.06)' : 'transparent',
                border: '1px solid ' + (tab === t.id ? 'rgba(244,185,66,.3)' : 'var(--line)'),
                color: tab === t.id ? 'var(--accent)' : 'var(--ink-2)',
                fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase',
              }}>
              {t.label}
            </button>
          ))}
        </nav>

        <section>
          {tab === 'profile' && <Panel title="Profile">
            <Field label="Name" value={user.name} readOnly />
            <Field label="Email" value={user.email} readOnly />
            <Field label="Provider" value={user.provider} readOnly />
          </Panel>}

          {tab === 'workspace' && <Panel title="Workspace">
            <div className="field">
              <label className="field-label">Name</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="field-input" value={wsName} onChange={e => setWsName(e.target.value)} />
                <button className="btn" onClick={rename}>Save</button>
              </div>
            </div>
            <Field label="Slug" value={workspace.slug} readOnly />
            <Field label="Plan" value={workspace.plan} readOnly />
          </Panel>}

          {tab === 'members' && <Panel title="Members">
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input className="field-input" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@company.com" />
              <select className="field-input" value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ maxWidth: 140 }}>
                <option value="ADMIN">Admin</option>
                <option value="EDITOR">Editor</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <button className="btn btn-primary" onClick={invite}>Invite</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {memberList.map((m: any) => (
                <div key={m.id} style={{ padding: 14, background: 'var(--panel-2)', border: '1px solid var(--line)', display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{m.email}</div>
                    <div className="note">{m.status}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)' }}>{m.role}</span>
                  <span className="note">{new Date(m.joinedAt).toLocaleDateString()}</span>
                  {m.role !== 'OWNER' && <button className="btn btn-ghost btn-sm" onClick={() => remove(m.id)}>remove</button>}
                </div>
              ))}
            </div>
          </Panel>}

          {tab === 'usage' && <Panel title="Usage">
            {usage ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
                <UsageBar label="Agent queries" value={usage.agentQueries} max={usage.agentQueriesLimit} />
                <UsageBar label="Recording minutes" value={usage.recordingMinutes} max={usage.recordingMinutesLimit} />
                <UsageBar label="Storage (MB)" value={usage.storageMB} max={usage.storageMBLimit} />
                <UsageBar label="Seats" value={members.length} max={usage.seatsLimit} />
              </div>
            ) : <p className="note">No usage yet.</p>}
          </Panel>}

          {tab === 'billing' && <Panel title="Billing">
            {billing ? (
              <>
                <Field label="Plan" value={billing.plan} readOnly />
                <Field label="Price" value={`$${billing.price}/${billing.interval}`} readOnly />
                <Field label="Card" value={`•••• ${billing.card.last4} (${billing.card.brand})`} readOnly />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 20 }}>
                  {['FREE', 'PRO', 'SCALE'].map(p => (
                    <button key={p} className={`btn ${billing.plan === p ? 'btn-primary' : ''}`} onClick={() => upgrade(p)}>
                      {billing.plan === p ? `${p} ✓` : `Switch to ${p}`}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 30 }}>
                  <div className="note" style={{ marginBottom: 10 }}>— invoices</div>
                  {billing.invoices.map((i: any) => (
                    <div key={i.id} style={{ padding: '10px 14px', border: '1px solid var(--line)', background: 'var(--panel-2)', display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 11, marginBottom: 4 }}>
                      <span>{new Date(i.date).toLocaleDateString()}</span>
                      <span>${i.amount}</span>
                      <span className="note">{i.status}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="note">No billing info yet.</p>}
          </Panel>}

          {tab === 'security' && <Panel title="Security & privacy">
            <p className="note" style={{ lineHeight: 1.7, marginBottom: 20 }}>
              Sessions, 2FA and audit log live here. In prod: list all active sessions with IP/UA, revoke per-session, and show the last 90 days of membership changes.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a className="btn" href="/api/user/data-export" download>
                Download my data (GDPR)
              </a>
              <button
                className="btn"
                style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}
                onClick={async () => {
                  if (!confirm('Delete account? This is a 30-day soft delete, then your data is purged forever.')) return;
                  await api('/user/account', { method: 'DELETE' });
                  location.href = '/';
                }}
              >
                Delete my account
              </button>
            </div>
          </Panel>}
        </section>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
      <header className="section-head"><h2>{title}</h2></header>
      {children}
    </div>
  );
}

function Field({ label, value, readOnly }: { label: string; value: string; readOnly?: boolean }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <input className="field-input" value={value} readOnly={readOnly} />
    </div>
  );
}

function UsageBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div style={{ padding: 14, background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
      <div className="note">{label}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 400, letterSpacing: '-.02em', marginTop: 8 }}>
        {value}<span style={{ fontSize: 14, color: 'var(--ink-2)', marginLeft: 4 }}>/ {max}</span>
      </div>
      <div className="bar" style={{ marginTop: 10 }}>
        <div className={`bar-fill ${pct > 80 ? '' : 'dim'}`} style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}
