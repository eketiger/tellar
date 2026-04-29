import { isViewerPath, resolveSubdomainAction } from './subdomain-router';

describe('isViewerPath', () => {
  it('matches /v/* slugs', () => {
    expect(isViewerPath('/v/abc123')).toBe(true);
    expect(isViewerPath('/v/')).toBe(true);
  });
  it('matches whitelisted public infra paths', () => {
    expect(isViewerPath('/api/events')).toBe(true);
    expect(isViewerPath('/api/health')).toBe(true);
    expect(isViewerPath('/api/v/foo')).toBe(true);
    expect(isViewerPath('/_next/static/chunks/x.js')).toBe(true);
    expect(isViewerPath('/cookies')).toBe(true);
    expect(isViewerPath('/privacy')).toBe(true);
  });
  it('rejects authoring routes', () => {
    expect(isViewerPath('/dashboard')).toBe(false);
    expect(isViewerPath('/admin')).toBe(false);
    expect(isViewerPath('/tellers/abc/edit')).toBe(false);
    expect(isViewerPath('/login')).toBe(false);
    expect(isViewerPath('/api/auth/login')).toBe(false);
  });
});

describe('resolveSubdomainAction', () => {
  const consoleHost = 'app.tellar.studio';
  const viewerHost = 'viewer.tellar.studio';

  it('passes through when no hosts are configured (local dev)', () => {
    expect(
      resolveSubdomainAction({ host: 'localhost', pathname: '/dashboard', consoleHost: '', viewerHost: '' }),
    ).toEqual({ kind: 'pass' });
    expect(
      resolveSubdomainAction({ host: 'localhost', pathname: '/v/abc', consoleHost: '', viewerHost: '' }),
    ).toEqual({ kind: 'pass' });
  });

  it('viewer host: allows /v/* and infra paths', () => {
    expect(
      resolveSubdomainAction({ host: viewerHost, pathname: '/v/abc', consoleHost, viewerHost }),
    ).toEqual({ kind: 'pass' });
    expect(
      resolveSubdomainAction({ host: viewerHost, pathname: '/api/events', consoleHost, viewerHost }),
    ).toEqual({ kind: 'pass' });
  });

  it('viewer host: redirects authoring paths to console', () => {
    const action = resolveSubdomainAction({
      host: viewerHost, pathname: '/dashboard', consoleHost, viewerHost,
    });
    expect(action).toEqual({ kind: 'redirect', targetHost: consoleHost });
  });

  it('viewer host without console fallback: blocks unknown paths', () => {
    const action = resolveSubdomainAction({
      host: viewerHost, pathname: '/dashboard', consoleHost: '', viewerHost,
    });
    expect(action.kind).toBe('block');
  });

  it('console host: redirects /v/* to viewer host', () => {
    expect(
      resolveSubdomainAction({ host: consoleHost, pathname: '/v/xyz', consoleHost, viewerHost }),
    ).toEqual({ kind: 'redirect', targetHost: viewerHost });
  });

  it('console host: passes authoring paths through', () => {
    expect(
      resolveSubdomainAction({ host: consoleHost, pathname: '/dashboard', consoleHost, viewerHost }),
    ).toEqual({ kind: 'pass' });
    expect(
      resolveSubdomainAction({ host: consoleHost, pathname: '/admin', consoleHost, viewerHost }),
    ).toEqual({ kind: 'pass' });
  });

  it('unknown host (preview, custom domain) is left untouched', () => {
    expect(
      resolveSubdomainAction({ host: 'staging.tellar.dev', pathname: '/dashboard', consoleHost, viewerHost }),
    ).toEqual({ kind: 'pass' });
  });

  it('shared link from console-host /v/x is bounced when only console is configured (defensive)', () => {
    // No viewer host configured: middleware must not redirect into a void.
    expect(
      resolveSubdomainAction({ host: consoleHost, pathname: '/v/abc', consoleHost, viewerHost: '' }),
    ).toEqual({ kind: 'pass' });
  });
});
