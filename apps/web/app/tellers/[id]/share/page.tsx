import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { apiServer } from '@/lib/api';
import { getSession } from '@/lib/session';
import { TopBar } from '@/components/TopBar';
import { NavDock } from '@/components/NavDock';
import { ShareClient } from './ShareClient';

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');
  const jar = await cookies();
  const cookieHeader = jar.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const [teller, share] = await Promise.all([
    apiServer<any>(`/tellers/${id}`, cookieHeader),
    apiServer<any>(`/tellers/${id}/share`, cookieHeader),
  ]);
  if (!teller) redirect('/dashboard');

  return (
    <>
      <TopBar
        crumbs={[
          { label: session.workspace.name, href: '/dashboard' },
          { label: 'tellers', href: '/dashboard' },
          { label: teller.title.replace(/<[^>]+>/g, ''), href: `/tellers/${id}/dashboard` },
          { label: 'share', active: true },
        ]}
        initials={session.session.initials}
        name={session.session.name}
        email={session.session.email}
        isAdmin={session.session.isAdmin}
      />
      <ShareClient tellerId={id} initialShare={share} />
      <NavDock tellerId={id} />
    </>
  );
}
