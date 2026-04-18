import { cookies } from 'next/headers';
import { apiServer } from '@/lib/api';
import { AccountsClient } from './AccountsClient';

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const jar = await cookies();
  const ch = jar.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const data = (await apiServer<any>(`/admin/accounts?q=${encodeURIComponent(sp.q || '')}&page=${sp.page || 1}`, ch)) || {
    items: [], total: 0, page: 1, pageSize: 25,
  };
  return <AccountsClient initial={data} initialQuery={sp.q || ''} />;
}
