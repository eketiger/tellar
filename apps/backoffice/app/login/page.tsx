'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { boApi, setToken, ApiError } from '@/lib/api';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const r = await boApi<{ token: string }>('/superadmin/login', { method: 'POST', json: { email, password } });
      setToken(r.token);
      router.push('/');
    } catch (e) {
      setErr(e instanceof ApiError ? (e.body?.message || e.message) : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 40, position: 'relative', zIndex: 3 }}>
      <div className="panel" style={{ maxWidth: 440, width: '100%', padding: 36 }}>
        <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 28, letterSpacing: '-.02em' }}>
          <span style={{ color: 'var(--accent)' }}>T</span>ellar
        </div>
        <div className="bo-tag" style={{ display: 'inline-block', marginTop: 8, marginBottom: 24, marginLeft: 0 }}>backoffice · internal</div>

        <div className="note" style={{ marginBottom: 22 }}>
          This is not the client app. Credentials live in ops env vars — <em style={{ color: 'var(--accent)' }}>SUPERADMIN_EMAIL</em> / <em style={{ color: 'var(--accent)' }}>SUPERADMIN_PASSWORD</em>.
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label className="field-label">ops email</label>
            <input className="field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label className="field-label">password</label>
            <input className="field-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {err && <div className="err">! {err}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', marginTop: 6 }}>
            {busy ? '…' : 'Sign in →'}
          </button>
        </form>
      </div>
    </main>
  );
}
