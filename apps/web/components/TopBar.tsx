'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export interface Crumb {
  label: string;
  href?: string;
  active?: boolean;
}

export function TopBar(props: {
  crumbs: Crumb[];
  initials: string;
  email: string;
  name: string;
  right?: React.ReactNode;
  live?: boolean;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  async function signOut() {
    if (!confirm('Sign out?')) return;
    await api('/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <Link href="/dashboard" className="brand-mark">Tellar</Link>
        <nav className="crumbs">
          {props.crumbs.map((c, i) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <span className="sep">›</span>}
              {c.href ? <Link href={c.href} className={c.active ? 'active' : ''}>{c.label}</Link> : <span className={c.active ? 'active' : ''}>{c.label}</span>}
            </span>
          ))}
        </nav>
      </div>
      <div className="topbar-right">
        {props.live && <span className="live-dot">LIVE · 2</span>}
        {props.right}
        <div ref={ref} style={{ position: 'relative' }}>
          <button className="avatar" onClick={e => { e.stopPropagation(); setOpen(o => !o); }} aria-label="Account menu">
            <span>{props.initials}</span>
          </button>
          {open && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 240,
              background: 'var(--panel)', border: '1px solid var(--line-2)',
              boxShadow: '0 12px 40px rgba(0,0,0,.5)', zIndex: 150, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.05em',
            }}>
              <div style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>{props.name}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{props.email}</div>
              </div>
              <Link href="/dashboard" className="note" style={{ display: 'block', padding: '11px 14px', borderBottom: '1px solid var(--line)' }}>→ Dashboard</Link>
              {props.isAdmin && (
                <Link href="/admin" className="note" style={{ display: 'block', padding: '11px 14px', borderBottom: '1px solid var(--line)', color: 'var(--accent)' }}>→ Backoffice (admin)</Link>
              )}
              <Link href="/settings" className="note" style={{ display: 'block', padding: '11px 14px', borderBottom: '1px solid var(--line)' }}>→ Account settings</Link>
              <Link href="/settings#workspace" className="note" style={{ display: 'block', padding: '11px 14px', borderBottom: '1px solid var(--line)' }}>→ Workspace</Link>
              <Link href="/settings#billing" className="note" style={{ display: 'block', padding: '11px 14px', borderBottom: '1px solid var(--line)' }}>→ Billing & usage</Link>
              <button onClick={signOut} style={{
                width: '100%', textAlign: 'left', padding: '11px 14px', background: 'none', border: 'none',
                color: 'var(--bad)', fontFamily: 'inherit', fontSize: 'inherit', cursor: 'pointer',
              }}>→ Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
