'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { UsageChart } from './UsageChart';
import './settings.css';

type TabId = 'profile' | 'workspaces' | 'members' | 'usage' | 'billing' | 'security' | 'integrations';

const TABS: { id: TabId; label: string; cnt?: string }[] = [
  { id: 'profile', label: 'Profile', cnt: 'you' },
  { id: 'workspaces', label: 'Workspaces' },
  { id: 'members', label: 'Members' },
  { id: 'usage', label: 'Usage this month' },
  { id: 'billing', label: 'Billing & plan' },
  { id: 'security', label: 'Security' },
  { id: 'integrations', label: 'Integrations', cnt: '4' },
];

const PLANS: Record<string, { price: number; desc: string; next?: string }> = {
  FREE: { price: 0, desc: '3 tellars · 30 min recording · 100 agent queries · 1 seat.', next: 'PRO' },
  PRO: { price: 49, desc: 'Unlimited tellars · 300 recording minutes · 1,000 agent queries · 5 seats · priority support.', next: 'SCALE' },
  SCALE: { price: 199, desc: 'Everything in Pro · unlimited recording & queries · SSO · SCIM · REST API · dedicated CSM.' },
  ENTERPRISE: { price: 0, desc: 'Custom — tailored to your org.' },
};

export function SettingsClient({ workspace, user, members, usage, billing, googleStatus }: any) {
  const [tab, setTab] = useState<TabId>('profile');
  const [memberList, setMembers] = useState<any[]>(members || []);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('EDITOR');
  const [wsName, setWsName] = useState(workspace.name);
  const [toast, setToast] = useState<string | null>(null);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2000); }

  async function invite() {
    if (!inviteEmail.includes('@')) return;
    const m = await api<any>(`/workspaces/${workspace.id}/invites`, { method: 'POST', json: { email: inviteEmail, role: inviteRole } });
    setMembers(ms => [...ms, m]);
    setInviteEmail('');
    flash('Invite sent');
  }
  async function removeMember(id: string) {
    await api(`/memberships/${id}`, { method: 'DELETE' });
    setMembers(ms => ms.filter(m => m.id !== id));
  }
  async function rename() {
    await api(`/workspaces/${workspace.id}`, { method: 'PATCH', json: { name: wsName } });
    flash('Workspace renamed');
  }
  async function upgrade(plan: 'PRO' | 'SCALE') {
    try {
      const r = await api<{ url: string }>('/billing/create-checkout-session', {
        method: 'POST',
        json: {
          plan,
          workspaceId: workspace.id,
          successUrl: `${location.origin}/settings?tab=billing&upgraded=${plan}`,
          cancelUrl: `${location.origin}/settings?tab=billing`,
        },
      });
      if (r.url) location.href = r.url;
    } catch (e: any) {
      flash('Billing checkout failed — ' + (e?.message || 'unknown'));
    }
  }
  async function openPortal() {
    try {
      const r = await api<{ url: string }>('/billing/create-portal-session', {
        method: 'POST',
        json: { returnUrl: `${location.origin}/settings?tab=billing` },
      });
      if (r.url) location.href = r.url;
    } catch { flash('Customer Portal unavailable — configure STRIPE_SECRET_KEY first'); }
  }
  async function deleteAccount() {
    if (!confirm('Export + delete account? 30-day soft delete, then purged forever.')) return;
    await api('/user/account', { method: 'DELETE' });
    location.href = '/';
  }

  const currentPlan = (billing?.plan || workspace?.plan || 'FREE').toUpperCase();
  const planInfo = PLANS[currentPlan] || PLANS.FREE;

  return (
    <div className="st-page">
      <div className="st-head">
        <div className="kicker">settings · workspace · account</div>
        <h1>Make it <em>yours.</em></h1>
        <p>Usage, seats, invoices, members, security. Everything you need to run your tellars — nothing you don't.</p>
      </div>

      <div className="st-layout">
        <nav className="st-side">
          {TABS.map(t => (
            <a key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
              <span className="cnt">{
                t.cnt ??
                (t.id === 'workspaces' ? '1' :
                 t.id === 'members' ? String(memberList.length) :
                 t.id === 'usage' && usage ? `${Math.round((usage.agentQueries / Math.max(usage.agentQueriesLimit, 1)) * 100)}%` :
                 t.id === 'billing' ? currentPlan :
                 t.id === 'security' ? 'shares' :
                 '—')
              }</span>
            </a>
          ))}
        </nav>

        <div>
          {tab === 'profile' && (
            <section className="st-panel">
              <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
              <div className="st-panel-head">
                <div>
                  <h2>Your <em>profile.</em></h2>
                  <p>This is the you that shows up on decks, in the agent's name, and on the watermark at the bottom of every shared viewer.</p>
                </div>
                <div className="st-panel-head-cta">
                  <button className="btn btn-primary" onClick={() => flash('Profile saved')}>Save changes</button>
                </div>
              </div>

              <div className="st-row">
                <div className="k">Display name</div>
                <div className="v"><input type="text" defaultValue={user?.name || ''} /></div>
                <div />
              </div>
              <div className="st-row">
                <div className="k">Email</div>
                <div className="v"><input type="email" defaultValue={user?.email || ''} disabled style={{ opacity: .6, cursor: 'not-allowed' }} /></div>
                <div className="status-chip active">verified</div>
              </div>
              <div className="st-row">
                <div className="k">Signed in via</div>
                <div className="v">{(user?.provider || 'email').toLowerCase()} · password</div>
                <div />
              </div>
              <div className="st-row">
                <div className="k">Member since</div>
                <div className="v">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</div>
                <div />
              </div>
              <div className="st-row">
                <div className="k">Data export</div>
                <div className="v">Download a JSON of everything tied to your account — GDPR-compliant.</div>
                <div><a className="btn btn-ghost" href="/api/user/data-export" download>Download</a></div>
              </div>

              <div className="danger-zone">
                <h3>Delete account</h3>
                <p>Cancel your subscription, export your tellars, and permanently remove your workspace. This cannot be undone.</p>
                <button className="btn-danger" onClick={deleteAccount}>Export &amp; delete</button>
              </div>
            </section>
          )}

          {tab === 'workspaces' && (
            <section className="st-panel">
              <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
              <div className="st-panel-head">
                <div>
                  <h2>Your <em>workspaces.</em></h2>
                  <p>A workspace is a shared library of tellars, a seat pool, and a billing account.</p>
                </div>
              </div>
              <div className="ws-list">
                <div className="ws-item active">
                  <div className="ws-avatar">{(workspace.name || 'T').charAt(0).toUpperCase()}</div>
                  <div className="ws-info">
                    <div className="ws-name">{workspace.name}</div>
                    <div className="ws-meta">{currentPlan} plan · {memberList.length} seats · /{workspace.slug}</div>
                  </div>
                  <span className="ws-current">current</span>
                </div>
              </div>
              <div className="st-row">
                <div className="k">Workspace name</div>
                <div className="v"><input type="text" value={wsName} onChange={e => setWsName(e.target.value)} /></div>
                <div><button className="btn btn-ghost" onClick={rename}>Rename</button></div>
              </div>
              <div className="st-row">
                <div className="k">URL slug</div>
                <div className="v">tellar.studio/<em>{workspace.slug}</em></div>
                <div />
              </div>
              <div className="st-row">
                <div className="k">Default theme</div>
                <div className="v">Editorial cream <span className="muted">applied to new tellars</span></div>
                <div />
              </div>
            </section>
          )}

          {tab === 'members' && (
            <section className="st-panel">
              <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
              <div className="st-panel-head">
                <div>
                  <h2>People in <em>this workspace.</em></h2>
                  <p>Owners can do anything. Editors record and publish. Viewers see the studio but can't edit or share.</p>
                </div>
              </div>
              <div className="invite-bar">
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="teammate@yourco.com" />
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  <option value="ADMIN">Admin</option>
                  <option value="EDITOR">Editor</option>
                  <option value="VIEWER">Viewer</option>
                </select>
                <button className="btn btn-primary" onClick={invite}>Send invite</button>
              </div>
              <table className="tbl">
                <thead><tr><th>Member</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th /></tr></thead>
                <tbody>
                  {memberList.map((m: any) => (
                    <tr key={m.id}>
                      <td>{(m.email || '').split('@')[0]}</td>
                      <td className="mono">{m.email}</td>
                      <td><span className={`role-chip ${String(m.role || '').toLowerCase()}`}>{m.role}</span></td>
                      <td><span className={`status-chip ${m.status === 'active' ? 'active' : 'pending'}`}>{m.status}</span></td>
                      <td className="mono">{m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                      <td>{m.role !== 'OWNER' && <button className="btn btn-ghost btn-sm" onClick={() => removeMember(m.id)}>Remove</button>}</td>
                    </tr>
                  ))}
                  {!memberList.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-3)' }}>No members yet — invite someone above.</td></tr>}
                </tbody>
              </table>
            </section>
          )}

          {tab === 'usage' && (
            <section className="st-panel">
              <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
              <div className="st-panel-head">
                <div>
                  <h2>This <em>month</em> at a glance.</h2>
                  <p>Resets on the 1st of next month. Snapshot for {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</p>
                </div>
                <div className="st-panel-head-cta">
                  <button className="btn btn-ghost" onClick={() => flash('CSV export queued')}>Export CSV</button>
                </div>
              </div>

              <div className="metric-grid">
                {[
                  { k: 'Agent queries', v: usage?.agentQueries ?? 0, lim: usage?.agentQueriesLimit ?? 1000, sub: 'answers generated · included in plan', tone: 'ok' },
                  { k: 'Recording minutes', v: usage?.recordingMinutes ?? 0, lim: usage?.recordingMinutesLimit ?? 300, sub: 'browser-native captures', tone: 'ok' },
                  { k: 'Storage', v: usage?.storageMB ?? 0, lim: usage?.storageMBLimit ?? 5000, sub: 'recordings + kb sources', tone: 'ok' },
                ].map((m, i) => {
                  const pct = Math.min(100, Math.round((m.v / Math.max(m.lim, 1)) * 100));
                  const tone = pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : '';
                  return (
                    <div key={i} className="metric-card">
                      <div className="mk">
                        <span>{m.k}</span>
                        <span className="pct">{pct}%</span>
                      </div>
                      <div className="mv">{m.v}<em>/ {m.lim}</em></div>
                      <div className="msub">{m.sub}</div>
                      <div className="mb"><div className={`mb-fill ${tone}`} style={{ width: pct + '%' }} /></div>
                    </div>
                  );
                })}
              </div>

              <UsageChart />
            </section>
          )}

          {tab === 'billing' && (
            <section className="st-panel">
              <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
              <div className="st-panel-head">
                <div>
                  <h2>Billing &amp; <em>plan.</em></h2>
                  <p>Your subscription, payment method, and every invoice — all in one place.</p>
                </div>
              </div>

              <div className="plan-card">
                <div>
                  <div className="plan-price"><em>$</em>{planInfo.price}<span style={{ fontSize: 18, color: 'var(--ink-3)' }}>/mo</span></div>
                  <div className="plan-period">{billing?.cancelAtPeriodEnd ? 'cancels at period end' : 'auto-renews'}</div>
                </div>
                <div className="plan-info">
                  <h3>You're on <em>{currentPlan.charAt(0) + currentPlan.slice(1).toLowerCase()}</em></h3>
                  <p>{planInfo.desc}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {planInfo.next && <button className="btn btn-primary" onClick={() => upgrade(planInfo.next as 'PRO' | 'SCALE')}>Upgrade to {planInfo.next.charAt(0) + planInfo.next.slice(1).toLowerCase()}</button>}
                  <button className="btn btn-ghost" onClick={openPortal}>Manage billing</button>
                </div>
              </div>

              <div className="st-split">
                <div>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 12 }}>Payment method</h3>
                  <div className="card-viz">
                    <div className={`card-brand ${(billing?.card?.brand || 'visa').toLowerCase()}`}>{(billing?.card?.brand || 'VISA').toUpperCase()}</div>
                    <div>
                      <div className="card-num">•••• •••• •••• {billing?.card?.last4 || '4242'}</div>
                      <div className="card-exp">expires {billing?.card?.exp || '09/28'}</div>
                    </div>
                  </div>
                  <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={openPortal}>Update card</button>
                </div>
                <div>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 12 }}>Billing contact</h3>
                  <div className="st-row" style={{ padding: '10px 0' }}>
                    <div className="k">Company</div>
                    <div className="v">{workspace.name}</div>
                    <div />
                  </div>
                  <div className="st-row" style={{ padding: '10px 0' }}>
                    <div className="k">Next invoice</div>
                    <div className="v">{billing?.nextInvoice ? new Date(billing.nextInvoice).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</div>
                    <div />
                  </div>
                  <div className="st-row" style={{ padding: '10px 0' }}>
                    <div className="k">Billed email</div>
                    <div className="v mono">{user?.email || '—'}</div>
                    <div />
                  </div>
                </div>
              </div>

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, margin: '28px 0 14px' }}>Invoice history</h3>
              <table className="tbl">
                <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {(billing?.invoices || []).map((inv: any) => (
                    <tr key={inv.id}>
                      <td className="mono">{new Date(inv.date || inv.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      <td>{currentPlan} plan — 1 month</td>
                      <td className="mono">${typeof inv.amount === 'number' ? inv.amount : ((inv.amountPaid || 0) / 100).toFixed(2)}</td>
                      <td><span className={`status-chip ${inv.status === 'paid' ? 'active' : 'pending'}`}>{inv.status}</span></td>
                      <td>{inv.invoicePdf ? <a className="btn btn-ghost btn-sm" href={inv.invoicePdf} target="_blank">PDF</a> : ''}</td>
                    </tr>
                  ))}
                  {!(billing?.invoices || []).length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-3)' }}>No invoices yet.</td></tr>}
                </tbody>
              </table>
            </section>
          )}

          {tab === 'security' && (
            <section className="st-panel">
              <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
              <div className="st-panel-head">
                <div>
                  <h2>Security &amp; <em>share defaults.</em></h2>
                  <p>Set the guardrails once. Every new share inherits these — you can override per tellar.</p>
                </div>
                <div className="st-panel-head-cta">
                  <button className="btn btn-primary" onClick={() => flash('Defaults saved')}>Save defaults</button>
                </div>
              </div>

              {[
                { k: 'Default access', v: <select style={{ background: 'var(--bg)', border: '1px solid var(--line-2)', color: 'var(--ink)', padding: '10px 14px', fontFamily: 'var(--serif)', fontSize: 14 }}><option>Email-gated (work emails only)</option><option>Anyone with the link</option><option>Invite only</option><option>Passphrase required</option></select>, toggle: false },
                { k: 'Watermark viewer email', v: 'Stamps every slide with the viewer\'s address — deters screenshots.', toggle: true, defaultOn: true },
                { k: 'Block screen recording', v: 'DRM-lite: blacks out the canvas when a native recorder is detected.', toggle: true, defaultOn: true },
                { k: 'Allow agent questions', v: 'Viewers can ask the Ask-the-deck agent during and after the playback.', toggle: true, defaultOn: true },
                { k: 'Allow download', v: 'Adds a PDF export button to every shared viewer.', toggle: true, defaultOn: false },
                { k: 'Require one-time code', v: 'Emails a 6-digit code to the viewer before they can open.', toggle: true, defaultOn: true },
                { k: 'Auto-expire links after', v: <input type="text" defaultValue="14 days" style={{ maxWidth: 180 }} />, toggle: false },
              ].map((r, i) => (
                <div key={i} className="st-row">
                  <div className="k">{r.k}</div>
                  <div className="v">{r.v as any}</div>
                  <div>
                    {r.toggle && (
                      <label className="toggle">
                        <input type="checkbox" defaultChecked={r.defaultOn} />
                        <span className="toggle-sw" />
                      </label>
                    )}
                  </div>
                </div>
              ))}

              <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, margin: '28px 0 14px' }}>Active sessions</h3>
              <table className="tbl">
                <thead><tr><th>Device</th><th>Location</th><th>Last active</th><th /></tr></thead>
                <tbody>
                  <tr>
                    <td>MacBook Pro · Chrome <span className="status-chip active" style={{ marginLeft: 8 }}>this device</span></td>
                    <td className="mono">Buenos Aires, AR</td>
                    <td className="mono">now</td>
                    <td />
                  </tr>
                  <tr>
                    <td>iPhone 15 · Safari</td>
                    <td className="mono">Buenos Aires, AR</td>
                    <td className="mono">2h ago</td>
                    <td><button className="btn btn-ghost btn-sm">Revoke</button></td>
                  </tr>
                </tbody>
              </table>
            </section>
          )}

          {tab === 'integrations' && (
            <section id="integrations" className="st-panel">
              <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
              <div className="st-panel-head">
                <div>
                  <h2>Connected <em>tools.</em></h2>
                  <p>Connect the tools you live in. Google Slides imports your existing decks; the rest pipe your events and notifications out.</p>
                </div>
              </div>

              <GoogleIntegrationCard initial={googleStatus} />

              <div className="integ-grid" style={{ marginTop: 16 }}>
                {[
                  { icon: '#', color: '#4a154b', name: 'Slack', sub: 'post deck-opened + agent-query to a channel', status: 'soon' as const },
                  { icon: 'H', color: '#ff7a59', name: 'HubSpot', sub: 'auto-log deck opens as contact activity', status: 'soon' as const },
                  { icon: 'SF', color: 'var(--ink-2)', name: 'Salesforce', sub: 'opportunity-level tellar attachment', status: 'soon' as const },
                  { icon: 'Sg', color: 'var(--ink-2)', name: 'Segment', sub: 'pipe every tellar event as a track call', status: 'soon' as const },
                ].map((it, i) => (
                  <div key={i} className="integ-card">
                    <div className="integ-icon" style={{ color: it.color }}>{it.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500 }}>{it.name}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.1em', marginTop: 2 }}>{it.sub}</div>
                    </div>
                    <span className="status-chip" style={{ opacity: .6 }}>coming soon</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 28, padding: 22, background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>API &amp; webhooks</h3>
                <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', marginBottom: 16 }}>
                  Programmatic access for the Scale plan and up. Create a tellar, attach a KB source, or fetch analytics from your own stack.
                </p>
                <div className="st-row" style={{ padding: '8px 0' }}>
                  <div className="k">Personal API key</div>
                  <div className="v mono" style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>tlr_live_•••••••••••••••••• <span className="muted">rotate monthly</span></div>
                  <div><button className="btn btn-ghost btn-sm">Reveal · Rotate</button></div>
                </div>
                <div className="st-row" style={{ padding: '8px 0' }}>
                  <div className="k">Webhook endpoint</div>
                  <div className="v"><input type="text" placeholder="https://your-app.com/tellar/hooks" style={{ fontFamily: 'var(--mono)', fontSize: 12 }} /></div>
                  <div><button className="btn btn-ghost btn-sm">Test</button></div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--panel)', border: '1px solid var(--line-2)', padding: '12px 20px', fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--ink)', zIndex: 200, borderLeft: '2px solid var(--good)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/**
 * Real Google connection card — reads status from the server prop on first
 * render, then refetches after connect/disconnect. Connect is a full-page
 * redirect (not a popup) so the callback can write the refresh token and
 * bounce us back here with ?google=connected.
 */
function GoogleIntegrationCard({ initial }: { initial: { enabled: boolean; connected: boolean; connection?: { email?: string; name?: string } | null } }) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState<'disconnect' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Surface the ?google=connected / ?google=error flag the callback set.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const flag = url.searchParams.get('google');
    const err = url.searchParams.get('msg');
    if (flag === 'connected') {
      setMsg('Google connected.');
      refresh();
    } else if (flag === 'error') {
      setMsg(`Google connect failed${err ? ` · ${err}` : ''}`);
    }
    if (flag) {
      url.searchParams.delete('google');
      url.searchParams.delete('msg');
      window.history.replaceState({}, '', url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    try {
      const s = await fetch('/api/google/status', { credentials: 'include' }).then(r => r.json());
      setState(s);
    } catch { /* ignore */ }
  }

  async function disconnect() {
    if (!confirm('Disconnect Google? Future imports will need to re-authorize.')) return;
    setBusy('disconnect');
    try {
      await fetch('/api/google/disconnect', { method: 'DELETE', credentials: 'include' });
      await refresh();
      setMsg('Google disconnected.');
    } finally {
      setBusy(null);
    }
  }

  if (!state.enabled) {
    return (
      <div className="integ-card" style={{ borderStyle: 'dashed', color: 'var(--ink-3)' }}>
        <div className="integ-icon" style={{ color: '#4285f4' }}>G</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500, color: 'var(--ink-2)' }}>Google Slides</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.1em', marginTop: 2 }}>
            OAuth not configured · set GOOGLE_CLIENT_ID in the API env
          </div>
        </div>
        <span className="status-chip" style={{ opacity: .5 }}>unavailable</span>
      </div>
    );
  }

  return (
    <div className="integ-card">
      <div className="integ-icon" style={{ color: '#4285f4' }}>G</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500 }}>Google Slides</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.1em', marginTop: 2 }}>
          {state.connected && state.connection?.email
            ? <>connected as <b style={{ color: 'var(--ink-2)' }}>{state.connection.email}</b> · import presentations one-click</>
            : <>import presentations from your Google Slides workspace with one click</>}
        </div>
        {msg && <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--good)', letterSpacing: '.08em', marginTop: 4 }}>{msg}</div>}
      </div>
      {state.connected ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="status-chip active">connected</span>
          <button className="btn btn-ghost btn-sm" disabled={busy === 'disconnect'} onClick={disconnect}>
            {busy === 'disconnect' ? '…' : 'Disconnect'}
          </button>
        </div>
      ) : (
        <a className="btn btn-primary btn-sm" href="/api/google/auth/start">Connect</a>
      )}
    </div>
  );
}
