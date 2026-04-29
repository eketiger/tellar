import { NextRequest, NextResponse } from 'next/server';
import { resolveSubdomainAction } from './lib/subdomain-router';

/**
 * Subdomain router. The same Next.js app serves two product surfaces:
 *
 *   - **Console** (`app.tellar.studio` or local `localhost:3000`) — the
 *     authenticated authoring experience: dashboard, editor, settings,
 *     templates, admin. Anything under `/v/*` redirects to the viewer host.
 *   - **Viewer** (`viewer.tellar.studio`) — public share viewing only.
 *     Everything *outside* `/v/*` and the public marketing pages 301s back
 *     to the console.
 *
 * Subdomain hostnames are configured via `TELLAR_CONSOLE_HOST` and
 * `TELLAR_VIEWER_HOST`. When unset (e.g. local dev / single-host preview)
 * the middleware is a no-op so `localhost:3000` keeps serving everything.
 *
 * The Backoffice runs as its own Next app at apps/backoffice and is
 * deployed to its own hostname (`ops.tellar.studio`). It does not share
 * cookies, sessions or origin with the console or viewer.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get('host')?.split(':')[0]?.toLowerCase() || '';
  const action = resolveSubdomainAction({
    host,
    pathname: req.nextUrl.pathname,
    consoleHost: process.env.TELLAR_CONSOLE_HOST?.trim() || '',
    viewerHost: process.env.TELLAR_VIEWER_HOST?.trim() || '',
  });

  if (action.kind === 'pass') return NextResponse.next();
  if (action.kind === 'block') return new NextResponse(action.message, { status: 404 });

  const url = new URL(req.url);
  url.host = action.targetHost;
  url.port = '';
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
