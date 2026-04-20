/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';
    return [{ source: '/bo-api/:path*', destination: `${api}/api/:path*` }];
  },
};
export default nextConfig;
