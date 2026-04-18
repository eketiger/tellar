import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-static';

export function GET() {
  // Resolve upward from the Next runtime to the repo root where openapi.yaml lives.
  const paths = [
    join(process.cwd(), 'openapi.yaml'),
    join(process.cwd(), '..', '..', 'openapi.yaml'),
    join(process.cwd(), '..', 'openapi.yaml'),
  ];
  let spec: string | null = null;
  for (const p of paths) {
    try {
      spec = readFileSync(p, 'utf-8');
      break;
    } catch {
      // try next candidate
    }
  }
  if (!spec) return new Response('# openapi.yaml not found on disk', { status: 404, headers: { 'content-type': 'application/yaml' } });
  return new Response(spec, { headers: { 'content-type': 'application/yaml' } });
}
