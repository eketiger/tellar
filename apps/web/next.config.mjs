/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@tellar/api-types'],
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
    // Docs + search + reference are Next-local — leave them alone.
    // Only proxy to NestJS when the prefix is /api/ AND doesn't match local routes.
    return [
      { source: '/api/auth/:path*', destination: `${api}/api/auth/:path*` },
      { source: '/api/tellers/:path*', destination: `${api}/api/tellers/:path*` },
      { source: '/api/slides/:path*', destination: `${api}/api/slides/:path*` },
      { source: '/api/shares/:path*', destination: `${api}/api/shares/:path*` },
      { source: '/api/recordings/:path*', destination: `${api}/api/recordings/:path*` },
      { source: '/api/slide-images/:path*', destination: `${api}/api/slide-images/:path*` },
      { source: '/api/kb/:path*', destination: `${api}/api/kb/:path*` },
      { source: '/api/events', destination: `${api}/api/events` },
      { source: '/api/agent/:path*', destination: `${api}/api/agent/:path*` },
      { source: '/api/workspaces/:path*', destination: `${api}/api/workspaces/:path*` },
      { source: '/api/memberships/:path*', destination: `${api}/api/memberships/:path*` },
      { source: '/api/billing/:path*', destination: `${api}/api/billing/:path*` },
      { source: '/api/admin/:path*', destination: `${api}/api/admin/:path*` },
      { source: '/api/user/:path*', destination: `${api}/api/user/:path*` },
      { source: '/api/consent/:path*', destination: `${api}/api/consent/:path*` },
      { source: '/api/v/:path*', destination: `${api}/api/v/:path*` },
    ];
  },
};
export default nextConfig;
