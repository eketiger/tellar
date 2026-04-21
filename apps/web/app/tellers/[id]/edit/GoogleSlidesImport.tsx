'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface GoogleConfig { enabled: boolean }

/**
 * Google Slides → Tellar import modal.
 *
 * Three phases:
 *   - check config: `/api/google/config` → { enabled }. If the backend is
 *     missing GOOGLE_CLIENT_ID we show a "configure OAuth first" nudge.
 *   - connect: open a popup to /api/google/auth/start; the callback posts
 *     the access token back via window.postMessage and closes itself.
 *   - import: POST the URL + token to the backend; rely on the heuristic
 *     parser to produce Tellar slides. Refresh the editor to show them.
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
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    api<GoogleConfig>('/google/config').then(c => setEnabled(c.enabled)).catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type !== 'tellar:google-auth') return;
      const token = e.data.payload?.accessToken as string | undefined;
      if (token) setAccessToken(token);
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  function connect() {
    // Pop a window; the callback page closes itself and posts the token.
    const w = 520, h = 640;
    const left = window.screen.width / 2 - w / 2;
    const top = window.screen.height / 2 - h / 2;
    popupRef.current = window.open(
      '/api/google/auth/start',
      'tellar-google-auth',
      `width=${w},height=${h},left=${left},top=${top}`,
    );
  }

  async function doImport() {
    if (!accessToken || !url) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ ok: boolean; appended: number; title?: string }>(
        `/tellers/${tellerId}/google-import`,
        { method: 'POST', json: { presentationUrl: url, accessToken } },
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

        {enabled === null && <div className="note">Checking configuration…</div>}

        {enabled === false && (
          <div style={{ padding: 14, border: '1px dashed var(--line-2)', background: 'var(--panel-2)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '.05em', lineHeight: 1.6 }}>
            Google OAuth is not configured on this environment.<br />
            Set <strong>GOOGLE_CLIENT_ID</strong>, <strong>GOOGLE_CLIENT_SECRET</strong> and optionally <strong>GOOGLE_REDIRECT_URI</strong> in your API env and restart.
          </div>
        )}

        {enabled && !accessToken && (
          <>
            <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
              Tellar needs read access to your Google Slides to import a deck. We ask for the minimum scope and never store the token.
            </p>
            <button className="btn btn-primary" onClick={connect} style={{ alignSelf: 'flex-start' }}>
              Connect Google →
            </button>
          </>
        )}

        {enabled && accessToken && (
          <>
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
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--good)', letterSpacing: '.12em' }}>
                ● connected
              </span>
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
