import { redirect } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { apiServer } from '@/lib/api';
import { getSession } from '@/lib/session';
import { sanitizeSlideHtml } from '@/lib/sanitize';
import { TopBar } from '@/components/TopBar';
import { NavDock } from '@/components/NavDock';
import { NewTellerButton } from './NewTellerButton';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const jar = await cookies();
  const cookieHeader = jar.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const page = (await apiServer<{ items: any[]; total: number }>('/tellers', cookieHeader)) || { items: [], total: 0 };
  const tellers = page.items;
  const total = page.total;

  return (
    <>
      <TopBar
        crumbs={[
          { label: session.workspace.name, href: '/dashboard', active: true },
          { label: 'tellers' },
        ]}
        initials={session.session.initials}
        name={session.session.name}
        email={session.session.email}
        isAdmin={session.session.isAdmin}
      />

      <main className="shell">
        <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 30 }}>
          <div>
            <div className="note" style={{ marginBottom: 10 }}>— {total} tellers</div>
            <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 300, fontSize: 48, letterSpacing: '-.025em', lineHeight: 1.05 }}>
              Your <em style={{ color: 'var(--accent)' }}>tellers</em>.
            </h1>
          </div>
          <NewTellerButton />
        </div>

        {tellers.length === 0 ? (
          <div className="panel" style={{ padding: 60, textAlign: 'center' }}>
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-2)', fontSize: 18, marginBottom: 20 }}>
              Nothing here yet.
            </p>
            <NewTellerButton />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {tellers.map(t => (
              <Link key={t.id} href={`/tellers/${t.id}/dashboard`} className="panel fade-in" style={{ textDecoration: 'none', display: 'block', transition: 'border-color .2s' }}>
                <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
                <div className="note" style={{ marginBottom: 10 }}>rev {t.revision} · {t._count?.slides ?? '—'} slides · {t._count?.shares ? 'shared' : 'not shared'}</div>
                <h3 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 400, letterSpacing: '-.01em', marginBottom: 14 }}>
                  {/* eslint-disable-next-line react/no-danger */}
                  <span dangerouslySetInnerHTML={{ __html: sanitizeSlideHtml(t.title) }} />
                </h3>
                <div style={{ display: 'flex', gap: 14, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.05em' }}>
                  <span>updated {new Date(t.updatedAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <NavDock />
    </>
  );
}
