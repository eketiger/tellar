/**
 * Pure host/path → action resolver used by middleware.ts. Extracted so it
 * can be unit-tested without booting Next's edge runtime.
 */

export type SubdomainAction =
  | { kind: 'pass' }
  | { kind: 'redirect'; targetHost: string }
  | { kind: 'block'; message: string };

export interface SubdomainContext {
  host: string;
  pathname: string;
  consoleHost: string;
  viewerHost: string;
}

const VIEWER_PUBLIC_PREFIXES = [
  '/v/',
  '/_next',
  '/api/v',
  '/api/events',
  '/api/health',
  '/cookies',
  '/privacy',
  '/favicon',
  '/api-reference',
  '/openapi.yaml',
];

export function isViewerPath(pathname: string): boolean {
  if (pathname === '/v') return true;
  return VIEWER_PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p));
}

export function resolveSubdomainAction(ctx: SubdomainContext): SubdomainAction {
  const { host, pathname, consoleHost, viewerHost } = ctx;

  // Single-host mode (local dev, preview environments) — never re-route.
  if (!consoleHost && !viewerHost) return { kind: 'pass' };

  // Viewer host: only allow viewer paths. Anything else bounces to console.
  if (viewerHost && host === viewerHost) {
    if (isViewerPath(pathname)) return { kind: 'pass' };
    if (consoleHost) return { kind: 'redirect', targetHost: consoleHost };
    return { kind: 'block', message: 'Not found on viewer host' };
  }

  // Console host: viewer paths redirect to viewer host so shared links
  // never leak the authenticated origin.
  if (consoleHost && host === consoleHost) {
    if (pathname.startsWith('/v/') && viewerHost) {
      return { kind: 'redirect', targetHost: viewerHost };
    }
    return { kind: 'pass' };
  }

  // Unknown host (preview, custom domain, raw IP) — no rerouting.
  return { kind: 'pass' };
}
