'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface GoogleStatus {
  enabled: boolean;
  connected: boolean;
  connection?: { email?: string; name?: string } | null;
}

/**
 * Google Slides → Tellar import modal.
 *
 * Uses the persistent OAuth connection stored per user (see
 * /settings/integrations). Three phases:
 *   - loading status: GET /api/google/status while we figure out whether
 *     the feature is configured AND the user connected.
 *   - not-configured: API env has no GOOGLE_CLIENT_ID → nudge to configure.
 *   - not-connected: send the user to /settings with a clear CTA instead
 *     of asking them to re-consent per-import.
 *   - ready: paste a URL, POST /tellers/:id/google-import (backend mints
 *     the access token from the stored refresh token).
 */
export function GoogleSlidesImport({
  tellerId,
  onDone,
  onClose,
}: {
  tellerId: string;
  onDone: (count: number) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<GoogleStatus>('/google/status')
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, connected: false }));
  }, []);

  async function doImport() {
    if (!url) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ ok: boolean; appended: number; title?: string }>(
        `/tellers/${tellerId}/google-import`,
        { method: 'POST', json: { presentationUrl: url } },
      );
      onDone(r.appended);
    } catch (e: any) {
      setError(e?.body?.message || e?.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(12,13,15,.9)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 620, width: '100%', background: 'var(--panel)', border: '1px solid var(--line-2)', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.2em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 4 }}>
              import from google slides
            </div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500 }}>
              Drop a link, <em style={{ color: 'var(--accent)' }}>get a deck</em>.
            </h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        {!status && <div className="note">Checking connection…</div>}

        {status && !status.enabled && (
          <div style={{ padding: 14, border: '1px dashed var(--line-2)', background: 'var(--panel-2)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '.05em', lineHeight: 1.6 }}>
            Google OAuth is not configured on this environment.<br />
            Set <strong>GOOGLE_CLIENT_ID</strong>, <strong>GOOGLE_CLIENT_SECRET</strong> and optionally <strong>GOOGLE_REDIRECT_URI</strong> in your API env and restart.
          </div>
        )}

        {status && status.enabled && !status.connected && (
          <div style={{ padding: 16, border: '1px solid var(--line-2)', background: 'var(--panel-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              Connect your Google account once in <strong>Settings → Integrations</strong> and every future import runs silently — no popup, no re-consent.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={onClose}>Later</button>
              <Link href="/settings?tab=integrations#integrations" className="btn btn-primary">
                Connect Google →
              </Link>
            </div>
          </div>
        )}

        {status && status.enabled && status.connected && (
          <>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--good)', letterSpacing: '.12em' }}>
              ● connected as <strong style={{ color: 'var(--ink-2)' }}>{status.connection?.email || 'your Google account'}</strong>
            </div>
            <label style={{ display: 'block' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.2em', color: 'var(--ink-3)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>presentation url</span>
              <input
                autoFocus
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://docs.google.com/presentation/d/abc123.../edit"
                style={{
                  width: '100%',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  padding: 10,
                  outline: 'none',
                }}
              />
            </label>
            {error && <div className="err">! {error}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Link href="/settings?tab=integrations#integrations" style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', textDecoration: 'none', letterSpacing: '.1em' }}>
                manage connection →
              </Link>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
                <button className="btn btn-primary" onClick={doImport} disabled={busy || !url}>
                  {busy ? 'Importing…' : 'Import'}
                </button>
              </div>
            </div>
          </>
        )}

        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.08em', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          We map each Google slide to the closest Tellar layout (bullets ⟶ bullets; large text + image ⟶ imageRight; otherwise headline). Clean up afterwards as needed.
        </div>
      </div>
    </div>
  );
}
