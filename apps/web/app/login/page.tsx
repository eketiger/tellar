'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('martin@tellar.studio');
  const [password, setPassword] = useState('demo1234');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api('/auth/login', { method: 'POST', json: { email, password } });
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: 'google' | 'github') {
    setBusy(true);
    try {
      await api(`/auth/oauth/${provider}`);
      router.push('/dashboard');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return <AuthShell mode="login" onSubmit={onSubmit} onOauth={oauth} err={err} busy={busy}
    email={email} setEmail={setEmail} password={password} setPassword={setPassword} />;
}

export function AuthShell(props: any) {
  const isLogin = props.mode === 'login';
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 40, position: 'relative', zIndex: 3 }}>
      <div className="panel" style={{ maxWidth: 440, width: '100%', padding: 36 }}>
        <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
        <Link href="/" className="brand-mark" style={{ fontSize: 28, display: 'block', marginBottom: 8 }}>Tellar</Link>
        <div className="note" style={{ marginBottom: 28 }}>— {isLogin ? 'Welcome back' : 'Create your workspace'}</div>

        <form onSubmit={props.onSubmit}>
          {!isLogin && (
            <div className="field">
              <label className="field-label">Your name</label>
              <input className="field-input" value={props.name} onChange={e => props.setName(e.target.value)} placeholder="Martín Echeverría" required />
            </div>
          )}
          <div className="field">
            <label className="field-label">Email</label>
            <input className="field-input" type="email" value={props.email} onChange={e => props.setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <input className="field-input" type="password" value={props.password} onChange={e => props.setPassword(e.target.value)} minLength={8} required />
          </div>
          {props.err && <div className="err">! {props.err}</div>}
          <button className="btn btn-primary" type="submit" disabled={props.busy} style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', marginTop: 6 }}>
            {props.busy ? '…' : isLogin ? 'Sign in →' : 'Create account →'}
          </button>
        </form>

        <div style={{ display: 'flex', gap: 10, margin: '20px 0' }}>
          <div style={{ flex: 1, borderTop: '1px solid var(--line)', height: 0, alignSelf: 'center' }} />
          <span className="note">or</span>
          <div style={{ flex: 1, borderTop: '1px solid var(--line)', height: 0, alignSelf: 'center' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className="btn btn-ghost" type="button" onClick={() => props.onOauth('google')}>Google</button>
          <button className="btn btn-ghost" type="button" onClick={() => props.onOauth('github')}>GitHub</button>
        </div>

        <div className="note" style={{ marginTop: 22, textAlign: 'center' }}>
          {isLogin ? (
            <>No account? <Link href="/register" style={{ color: 'var(--accent)' }}>Create one →</Link></>
          ) : (
            <>Already have one? <Link href="/login" style={{ color: 'var(--accent)' }}>Sign in →</Link></>
          )}
        </div>
        <div className="note" style={{ marginTop: 12, textAlign: 'center' }}>
          Demo: <em style={{ color: 'var(--accent)' }}>martin@tellar.studio / demo1234</em>
        </div>
      </div>
    </main>
  );
}
