'use client';

const TOKEN_KEY = 'tellar:bo:token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: any) { super(message); }
}

/** Backoffice → NestJS via Next rewrite at /bo-api/*. Always attaches the superadmin bearer. */
export async function boApi<T = any>(path: string, opts: RequestInit & { json?: unknown } = {}): Promise<T> {
  const tok = getToken();
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers as any) };
  if (tok) headers.authorization = `Bearer ${tok}`;
  const init: RequestInit = { ...opts, headers };
  if (opts.json !== undefined) init.body = JSON.stringify(opts.json);
  const res = await fetch(`/bo-api${path}`, init);
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (body as any)?.message || res.statusText, body);
  return body as T;
}
