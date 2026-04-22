import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { apiServer } from '@/lib/api';
import { getSession } from '@/lib/session';
import { TopBar } from '@/components/TopBar';
import { NavDock } from '@/components/NavDock';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const jar = await cookies();
  const ch = jar.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const [members, usage, billing, googleStatus] = await Promise.all([
    apiServer<any[]>(`/workspaces/${session.workspace.id}/members`, ch),
    apiServer<any>(`/workspaces/${session.workspace.id}/usage`, ch),
    apiServer<any>(`/workspaces/${session.workspace.id}/billing`, ch),
    apiServer<any>(`/google/status`, ch).catch(() => ({ enabled: false, connected: false })),
  ]);

  return (
    <>
      <TopBar
        crumbs={[
          { label: session.workspace.name, href: '/dashboard' },
          { label: 'settings', active: true },
        ]}
        initials={session.session.initials}
        name={session.session.name}
        email={session.session.email}
        isAdmin={session.session.isAdmin}
      />
      <SettingsClient
        workspace={session.workspace}
        user={session.user}
        members={members || []}
        usage={usage}
        billing={billing}
        googleStatus={googleStatus || { enabled: false, connected: false }}
      />
      <NavDock />
    </>
  );
}
