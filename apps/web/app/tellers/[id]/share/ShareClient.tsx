'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import './share.css';

const MODES = [
  { id: 'PUBLIC', label: <>Public link <em>— open</em></>, desc: 'Anyone with the URL. Fastest, zero friction.', icon: (<svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.3}><circle cx={9} cy={9} r={7} /><path d="M2 9h14M9 2a12 12 0 010 14M9 2a12 12 0 000 14" /></svg>) },
  { id: 'EMAIL_GATED', label: <>Email-gated</>, desc: "Viewer types their email before the deck loads. You see who came.", icon: (<svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.3}><path d="M3 7h12v8H3z" /><path d="M6 7V5a3 3 0 016 0v2" /></svg>) },
  { id: 'PASSPHRASE', label: <>Passphrase</>, desc: 'A shared secret. Useful for a cohort or a roadshow.', icon: (<svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.3}><rect x={3} y={7} width={12} height={8} /><path d="M9 11v2M7 11h4" /></svg>) },
  { id: 'INVITE_ONLY', label: <>Invite only <em>— per-person</em></>, desc: 'Each person gets their own magic link. No sharing.', icon: (<svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.3}><circle cx={9} cy={9} r={3} /><path d="M9 1v3M9 14v3M17 9h-3M4 9H1" /></svg>) },
] as const;

const PERMS = [
  { k: 'agent', name: 'Ask the agent', badge: 'recommended', desc: 'The agent answers questions using the deck, recording, and your knowledge base.' },
  { k: 'recording', name: 'Watch the recording', desc: 'Play your narration over each slide, or let viewers read silently.' },
  { k: 'download', name: 'Download a PDF', desc: 'A static export — no recording, no agent, no tracking past this point.' },
  { k: 'reshare', name: 'Re-share the link', desc: 'If off, forwards require a new invite from you.' },
  { k: 'nda', name: 'Require NDA', badge: 'pro', desc: 'Viewer e-signs before slide 1. You get a countersigned PDF.' },
  { k: 'watermark', name: 'Show viewer watermark', desc: 'Overlays their email across every slide, faintly. Discourages screenshots.' },
];

function daysLeft(iso?: string | null) {
  if (!iso) return '∞';
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return d > 0 ? `${d}d` : 'expired';
}

export function ShareClient({ tellerId, initialShare }: { tellerId: string; initialShare: any }) {
  const [share, setShare] = useState<any>(initialShare);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [domainDraft, setDomainDraft] = useState('');
  const [inviteeDraft, setInviteeDraft] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (share) return;
    (async () => {
      const created = await api(`/tellers/${tellerId}/shares`, { method: 'POST', json: {} });
      setShare(created);
    })();
  }, [share, tellerId]);

  useEffect(() => {
    if (savedAt) {
      const t = setTimeout(() => setSavedAt(null), 2400);
      return () => clearTimeout(t);
    }
  }, [savedAt]);

  function bumpSaveBar() {
    setSavedAt(Date.now());
  }

  async function patch(body: any) {
    setShare((s: any) => ({ ...s, ...body, perms: { ...(s?.perms || {}), ...(body.perms || {}) } }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        const updated = await api(`/shares/${share.id}`, { method: 'PATCH', json: body });
        setShare(updated);
        bumpSaveBar();
      } finally {
        setSaving(false);
      }
    }, 300);
  }

  async function togglePerm(k: string, v: boolean) { patch({ perms: { [k]: v } }); }

  async function addInvitee(email: string) {
    if (!email.includes('@')) return;
    const inv = await api<any>(`/shares/${share.id}/invitees`, { method: 'POST', json: { email } });
    setShare((s: any) => ({ ...s, invitees: [...(s.invitees || []), inv] }));
    bumpSaveBar();
  }

  async function revoke() {
    if (!confirm('Revoke this share? Anyone with the link will lose access immediately.')) return;
    await api(`/shares/${share.id}/revoke`, { method: 'POST' });
    location.reload();
  }

  if (!share) return <main className="share-shell">Creating share…</main>;

  const viewerUrl = typeof window !== 'undefined' ? `${location.host}/v/${share.slug}` : `/v/${share.slug}`;
  const fullUrl = typeof window !== 'undefined' ? `${location.origin}/v/${share.slug}` : `/v/${share.slug}`;
  const perms = share.perms || {};
  const invitees = share.invitees || [];
  const domains: string[] = Array.isArray(share.allowedDomains) ? share.allowedDomains : [];
  const active = invitees.filter((i: any) => i.status === 'active').length;
  const totalOpens = invitees.reduce((n: number, i: any) => n + (i.opens || 0), 0);

  const selectedMode = MODES.find(m => m.id === share.accessMode) || MODES[1];
  const lockContent = useMemo(() => {
    if (share.accessMode === 'PUBLIC') return null;
    if (share.accessMode === 'EMAIL_GATED') return { t: 'email required', s: share.requireOTC ? 'one-time code' : 'domain allow-list' };
    if (share.accessMode === 'PASSPHRASE') return { t: 'passphrase', s: 'shared secret' };
    return { t: 'invite only', s: `${active} / ${invitees.length} active` };
  }, [share.accessMode, share.requireOTC, invitees.length, active]);

  return (
    <main className="share-shell">
      <header className="share-head fade-in d1">
        <div className="eyebrow">tellar · share link</div>
        <h1>Share this <em>tellar.</em></h1>
        <p>A link isn't just a link. Decide <em>who sees what</em>, whether the agent can answer, and what the viewer can take home with them.</p>
      </header>

      <div className="share-grid">
        <div>
          <div className="url-panel fade-in d2">
            <div className="url-row">
              <span className="url-label">link</span>
              <div className="url-box">
                <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="var(--accent)" strokeWidth={1.5}><path d="M3.5 6h5M5 3.5L3 6l2 2.5M7 3.5L9 6 7 8.5" /></svg>
                <span className="dom">{viewerUrl.replace(`/v/${share.slug}`, '/v/')}</span>
                <span className="slug">{share.slug}</span>
              </div>
              <button className={`url-copy${copied ? ' copied' : ''}`} onClick={() => { navigator.clipboard.writeText(fullUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x={3} y={3} width={7} height={7} /><path d="M3 7H2V1h6v1" /></svg>
                {copied ? 'copied' : 'copy'}
              </button>
            </div>
            <div className="url-footer">
              <span>opens · <b>{totalOpens}</b></span>
              <span>expires · <b>{daysLeft(share.expiresAt)}</b></span>
              <span>status · <b style={{ color: share.revokedAt ? 'var(--bad)' : 'var(--good)' }}>{share.revokedAt ? 'revoked' : 'live'}</b></span>
            </div>
          </div>

          <section className="sh-section fade-in d3">
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <h3 className="sh-title"><span className="num">01</span>Who can open it</h3>
            <p className="sh-desc">Pick how strictly we check viewers before the first slide loads.</p>
            <div className="access-modes">
              {MODES.map(m => (
                <div key={m.id} className={`access-mode${share.accessMode === m.id ? ' sel' : ''}`} onClick={() => patch({ accessMode: m.id })}>
                  <div className="am-icon">{m.icon}</div>
                  <div className="am-name">{m.label}</div>
                  <div className="am-desc">{m.desc}</div>
                </div>
              ))}
            </div>
            {share.accessMode === 'PASSPHRASE' && (
              <div className="field" style={{ marginTop: 14 }}>
                <label className="field-label">passphrase</label>
                <input type="text" value={passphrase} onChange={e => setPassphrase(e.target.value)} onBlur={() => passphrase && patch({ passphrase })} className="field-input" placeholder="e.g. butter-knife-moon" style={{ maxWidth: 300 }} />
              </div>
            )}
          </section>

          <section className="sh-section fade-in d4">
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <h3 className="sh-title"><span className="num">02</span>Allowed emails &amp; domains</h3>
            <p className="sh-desc">Anything outside this list gets a soft bounce. The agent will know why, too.</p>

            <div className="field">
              <label className="field-label">allowed domains</label>
              <div className="chip-list">
                {domains.map((d: string) => (
                  <span key={d} className="sh-chip">
                    {d}
                    <button className="sh-chip-x" onClick={() => patch({ allowedDomains: domains.filter(x => x !== d) })}>×</button>
                  </span>
                ))}
                <input
                  className="chip-input"
                  placeholder={domains.length ? '+ add domain and press enter' : 'e.g. sequoiacap.com'}
                  value={domainDraft}
                  onChange={e => setDomainDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && domainDraft.trim()) { e.preventDefault(); patch({ allowedDomains: [...domains, domainDraft.trim()] }); setDomainDraft(''); } }}
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label">specific invitees · per-person links</label>
              <div className="chip-list">
                {invitees.map((i: any) => (
                  <span key={i.id || i.email} className="sh-chip invite">
                    {i.email}
                  </span>
                ))}
                <input
                  className="chip-input"
                  placeholder={invitees.length ? '+ add email and press enter' : 'sofia@sequoiacap.com'}
                  value={inviteeDraft}
                  onChange={e => setInviteeDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && inviteeDraft.trim()) { e.preventDefault(); addInvitee(inviteeDraft.trim()); setInviteeDraft(''); } }}
                />
              </div>
            </div>

            <div className="field" style={{ marginTop: 8 }}>
              <label className="toggle">
                <input type="checkbox" checked={!!share.requireOTC} onChange={e => patch({ requireOTC: e.target.checked })} />
                <span className="toggle-sw" />
                <span style={{ fontSize: 13 }}>Require one-time code sent to email</span>
              </label>
            </div>
          </section>

          <section className="sh-section fade-in d5">
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <h3 className="sh-title"><span className="num">03</span>What viewers can do</h3>
            <p className="sh-desc">Granular controls — turn them on when the context calls for it, off when it doesn't.</p>
            <div>
              {PERMS.map(p => (
                <div key={p.k} className="perm-row">
                  <div className="perm-info">
                    <div className="perm-name">
                      {p.name}
                      {p.badge && <span className="badge">{p.badge}</span>}
                    </div>
                    <div className="perm-desc">{p.desc}</div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={!!perms[p.k]} onChange={e => togglePerm(p.k, e.target.checked)} />
                    <span className="toggle-sw" />
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className="sh-section fade-in d6">
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <h3 className="sh-title"><span className="num">04</span>Expiration &amp; limits</h3>
            <p className="sh-desc">Because a pitch left open for six months is a pitch that leaks.</p>
            <div className="adv-grid">
              <div>
                <label className="field-label">link expires on</label>
                <input type="date" className="date-input"
                  value={share.expiresAt ? new Date(share.expiresAt).toISOString().slice(0, 10) : ''}
                  onChange={e => patch({ expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
              <div>
                <label className="field-label">max opens per invite</label>
                <input type="number" className="date-input" min={1} max={99}
                  value={share.maxOpens ?? ''}
                  onChange={e => patch({ maxOpens: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
          </section>
        </div>

        <aside>
          <div className="preview-card fade-in d3">
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 12 }}>what a viewer sees</div>
            <div className="preview-frame">
              <div className="pf-slide">
                <span className="pf-eye">tellar</span>
                <div className="pf-t">A <em>$34B</em><br />market<br />growing 28%.</div>
                {perms.watermark && <span className="pf-eye" style={{ opacity: .4 }}>viewer@example.com</span>}
              </div>
              {lockContent && (
                <div className="pf-lock">
                  <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.3}><rect x={4} y={9} width={12} height={8} /><path d="M7 9V6a3 3 0 016 0v3" /></svg>
                  <div className="t">{lockContent.t}</div>
                  <div className="s">{lockContent.s}</div>
                </div>
              )}
            </div>
            <div className="preview-meta">
              <span>mode · <b>{(selectedMode.id || '').toLowerCase().replace(/_/g, '-')}</b></span>
              <span><b>{daysLeft(share.expiresAt)}</b> left</span>
            </div>
          </div>

          <div className="sh-section" style={{ marginBottom: 20 }}>
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <div className="sh-head-inline">
              <h3>Invitees</h3>
              <span className="aux">{active} active · {invitees.length - active} pending</span>
            </div>
            <div>
              {invitees.length === 0 && <p style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif)', fontStyle: 'italic' }}>No invitees yet.</p>}
              {invitees.map((i: any) => {
                const initials = (i.name || i.email).split(/[.\s@_]/).map((p: string) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                return (
                  <div key={i.id || i.email} className="invitee">
                    <div className="inv-avatar">{initials}</div>
                    <div className="inv-info">
                      <div className="inv-name">{i.name || i.email.split('@')[0]}</div>
                      <div className="inv-email">{i.email}</div>
                    </div>
                    <span className={`inv-status ${i.status === 'active' ? 'active' : 'pend'}`}>{i.status}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sh-section" style={{ borderColor: 'rgba(212,122,122,.2)' }}>
            <div className="sh-head-inline">
              <h3 style={{ color: 'var(--bad)' }}>Revoke access</h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--serif)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 14 }}>
              Instantly invalidates all open links. Anyone mid-view gets kicked out on the next slide.
            </p>
            <button className="btn" onClick={revoke} style={{ width: '100%', justifyContent: 'center', borderColor: 'rgba(212,122,122,.4)', color: 'var(--bad)' }}>Revoke all access</button>
          </div>
        </aside>
      </div>

      <div className={`save-bar${savedAt ? ' show' : ''}`}>
        <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="var(--good)" strokeWidth={1.5}><path d="M1.5 5l2.5 2.5L9 2" /></svg>
        changes saved · <em>live for invitees</em>
      </div>
    </main>
  );
}
