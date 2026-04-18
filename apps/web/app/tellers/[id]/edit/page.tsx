import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { apiServer } from '@/lib/api';
import { getSession } from '@/lib/session';
import { TopBar } from '@/components/TopBar';
import { NavDock } from '@/components/NavDock';
import { EditorClient } from './EditorClient';

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');
  const jar = await cookies();
  const cookieHeader = jar.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const teller = await apiServer<any>(`/tellers/${id}`, cookieHeader);
  if (!teller) redirect('/dashboard');

  return (
    <>
      <TopBar
        crumbs={[
          { label: session.workspace.name, href: '/dashboard' },
          { label: 'tellers', href: '/dashboard' },
          { label: teller.title.replace(/<[^>]+>/g, ''), href: `/tellers/${id}/dashboard` },
          { label: 'editing', active: true },
        ]}
        initials={session.session.initials}
        name={session.session.name}
        email={session.session.email}
        isAdmin={session.session.isAdmin}
        right={<a className="btn" href={`/tellers/${id}/share`}>Share settings →</a>}
      />
      <EditorClient teller={teller} />
      <NavDock tellerId={id} />
    </>
  );
}
