'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavDock({ tellerId }: { tellerId?: string }) {
  const p = usePathname();
  const items = [
    { href: '/dashboard', label: 'Dashboard' },
    tellerId && { href: `/tellers/${tellerId}/edit`, label: 'Editor' },
    tellerId && { href: `/tellers/${tellerId}/share`, label: 'Share' },
    tellerId && { href: `/tellers/${tellerId}/dashboard`, label: 'Analytics' },
    { href: '/settings', label: 'Settings' },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="nav-dock">
      <span style={{ padding: '8px 10px 8px 14px', color: 'var(--ink-3)', borderRight: '1px solid var(--line)', marginRight: 4, fontStyle: 'italic', fontFamily: 'var(--serif)', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>Tellar</span>
      {items.map(i => (
        <Link key={i.href} href={i.href} className={p === i.href ? 'active' : ''}>{i.label}</Link>
      ))}
    </div>
  );
}
