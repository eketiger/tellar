/**
 * Typed fetch wrapper. In the browser, proxies through Next.js rewrites → NestJS.
 * On the server, hits the API directly.
 */

function base(): string {
  if (typeof window !== 'undefined') return '';
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: any) {
    super(message);
  }
}

export async function api<T = any>(
  path: string,
  opts: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const url = `${base()}/api${path}`;
  const init: RequestInit = {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(opts.headers || {}),
    },
    credentials: 'include',
  };
  if (opts.json !== undefined) init.body = JSON.stringify(opts.json);

  const res = await fetch(url, init);
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (body as any)?.message || res.statusText, body);
  return body as T;
}

// Server-side variant that forwards cookies from Next headers
export async function apiServer<T = any>(path: string, cookieHeader?: string): Promise<T | null> {
  try {
    const res = await fetch(`${base()}/api${path}`, {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
