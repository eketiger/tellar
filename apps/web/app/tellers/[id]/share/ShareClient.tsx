'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const MODES = [
  { v: 'PUBLIC', label: 'Public link' },
  { v: 'EMAIL_GATED', label: 'Email gate' },
  { v: 'PASSPHRASE', label: 'Passphrase' },
  { v: 'INVITE_ONLY', label: 'Invite only' },
];

export function ShareClient({ tellerId, initialShare }: { tellerId: string; initialShare: any }) {
  const [share, setShare] = useState<any>(initialShare);
  const [newEmail, setNewEmail] = useState('');
  const [newDomain, setNewDomain] = useState('');

  useEffect(() => {
    if (share) return;
    (async () => {
      const created = await api(`/tellers/${tellerId}/shares`, { method: 'POST', json: {} });
      setShare(created);
    })();
  }, [share, tellerId]);

  async function patch(body: any) {
    setShare((s: any) => ({ ...s, ...body }));
    const updated = await api(`/shares/${share.id}`, { method: 'PATCH', json: body });
    setShare(updated);
  }

  async function togglePerm(k: string, v: boolean) {
    patch({ perms: { [k]: v } });
  }

  async function addInvitee() {
    if (!newEmail.includes('@')) return;
    const inv = await api(`/shares/${share.id}/invitees`, { method: 'POST', json: { email: newEmail } });
    setShare((s: any) => ({ ...s, invitees: [...(s.invitees || []), inv] }));
    setNewEmail('');
  }

  async function revoke() {
    if (!confirm('Revoke this share? Anyone with the link will lose access immediately.')) return;
    await api(`/shares/${share.id}/revoke`, { method: 'POST' });
    location.reload();
  }

  if (!share) return <main className="shell">Creating share…</main>;

  const viewerUrl = typeof window !== 'undefined' ? `${location.origin}/v/${share.slug}` : `/v/${share.slug}`;
  const perms = share.perms || {};

  return (
    <main className="shell">
      <header style={{ marginBottom: 30 }}>
        <div className="note" style={{ marginBottom: 10 }}>— Share settings</div>
        <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 44, letterSpacing: '-.025em' }}>
          Who can <em style={{ color: 'var(--accent)' }}>see</em> this?
        </h1>
      </header>

      <div className="grid-2">
        <section className="panel">
          <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
          <header className="section-head"><h2><span className="num">01</span>Access</h2></header>

          <div className="field">
            <label className="field-label">Link</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="field-input" readOnly value={viewerUrl} />
              <button className="btn" onClick={() => navigator.clipboard.writeText(viewerUrl)}>Copy</button>
              <a className="btn btn-ghost" href={viewerUrl} target="_blank">Open ↗</a>
            </div>
          </div>

          <div className="field">
            <label className="field-label">Access mode</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
              {MODES.map(m => (
                <button key={m.v}
                  onClick={() => patch({ accessMode: m.v })}
                  className="btn"
                  style={{ justifyContent: 'center', background: share.accessMode === m.v ? 'rgba(244,185,66,.1)' : 'var(--panel)', borderColor: share.accessMode === m.v ? 'var(--accent)' : 'var(--line-2)', color: share.accessMode === m.v ? 'var(--accent)' : 'var(--ink)' }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {share.accessMode === 'EMAIL_GATED' && (
            <div className="field">
              <label className="field-label">Allowed domains</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="field-input" value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="sequoiacap.com" />
                <button className="btn" onClick={() => {
                  if (!newDomain) return;
                  patch({ allowedDomains: [...(share.allowedDomains || []), newDomain] });
                  setNewDomain('');
                }}>+ Add</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {(share.allowedDomains || []).map((d: string) => (
                  <span key={d} style={{ padding: '4px 10px', border: '1px solid var(--line-2)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                    {d} <button onClick={() => patch({ allowedDomains: share.allowedDomains.filter((x: string) => x !== d) })}
                      style={{ marginLeft: 6, background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer' }}>×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {share.accessMode === 'INVITE_ONLY' && (
            <div className="field">
              <label className="field-label">Invitees</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="field-input" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="sofia@sequoiacap.com" />
                <button className="btn" onClick={addInvitee}>+ Invite</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
                {(share.invitees || []).map((i: any) => (
                  <div key={i.email} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--line)', background: 'var(--panel-2)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                    <span>{i.email}</span>
                    <span className="note">{i.status} · {i.opens} opens</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="panel">
          <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
          <header className="section-head"><h2><span className="num">02</span>Permissions</h2></header>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['agent', 'Agent chat — viewer can ask questions'],
              ['recording', 'Play narration recordings'],
              ['download', 'Allow download of slides (PDF)'],
              ['reshare', 'Allow forwarding the link'],
              ['nda', 'Require NDA acceptance first'],
              ['watermark', 'Embed viewer email as visible watermark'],
              ['blockScreenRec', 'Block DisplayCapture (best-effort)'],
            ].map(([k, label]) => (
              <label key={k} className="toggle" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13 }}>{label}</span>
                <input type="checkbox" checked={!!perms[k]} onChange={e => togglePerm(k, e.target.checked)} />
                <span className="toggle-sw" />
              </label>
            ))}
          </div>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
            <button className="btn" style={{ width: '100%', borderColor: 'var(--bad)', color: 'var(--bad)' }} onClick={revoke}>
              Revoke this share
            </button>
            <div className="note" style={{ marginTop: 10 }}>
              Anyone currently viewing gets dropped within seconds. Analytics stay.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
