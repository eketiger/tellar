import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { TopBar } from '@/components/TopBar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!session.session.isAdmin) redirect('/dashboard');

  return (
    <>
      <TopBar
        crumbs={[{ label: 'Tellar', href: '/dashboard' }, { label: 'admin', active: true }]}
        initials={session.session.initials}
        name={session.session.name}
        email={session.session.email}
      />
      <main className="shell" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 30 }}>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 80, alignSelf: 'start' }}>
          {[
            ['/admin', 'Overview'],
            ['/admin/accounts', 'Accounts'],
            ['/admin/workspaces', 'Workspaces'],
            ['/admin/billing', 'Billing'],
            ['/admin/events', 'Events'],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              style={{
                padding: '10px 14px',
                border: '1px solid var(--line)',
                color: 'var(--ink-2)',
                fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
        <section>{children}</section>
      </main>
    </>
  );
}
