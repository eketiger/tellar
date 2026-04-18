import { cookies } from 'next/headers';
import { apiServer } from './api';

export async function getSession() {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
  return apiServer<{
    user: { id: string; email: string; name: string };
    workspace: { id: string; name: string; slug: string; plan: string };
    session: { userId: string; workspaceId: string; email: string; name: string; initials: string };
  }>('/auth/me', cookieHeader);
}
