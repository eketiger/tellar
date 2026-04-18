'use client';

import Link from 'next/link';

export interface AuthShellProps {
  mode: 'login' | 'register';
  onSubmit: (e: React.FormEvent) => void;
  onOauth: (provider: 'google' | 'github') => void;
  err: string | null;
  busy: boolean;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  name?: string;
  setName?: (v: string) => void;
}

export function AuthShell(props: AuthShellProps) {
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
              <input
                className="field-input"
                value={props.name ?? ''}
                onChange={e => props.setName?.(e.target.value)}
                placeholder="Martín Echeverría"
                required
              />
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
