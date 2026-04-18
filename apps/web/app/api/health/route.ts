// ALB + CloudFront health check. Must stay cheap and cache-free.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok', service: 'tellar-web', ts: Date.now() });
}
