'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { Template } from '@/lib/templates';

/**
 * "Use this template" client button. Posts the template\'s slide spec to
 * /api/tellers/from-template; on success, redirects into the editor of the
 * freshly-cloned teller. If the caller isn\'t authenticated we bounce them
 * to /login with a ?next= hint so they land back here after signing in.
 */
export function UseTemplateClient({ template }: { template: Template }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ id: string }>('/tellers/from-template', {
        method: 'POST',
        json: {
          title: template.title,
          slides: template.slides,
        },
      });
      router.push(`/tellers/${r.id}/edit`);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) {
        const next = encodeURIComponent(`/templates/${template.slug}`);
        router.push(`/login?next=${next}`);
        return;
      }
      setError(e?.body?.message || e?.message || 'Could not create deck');
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        onClick={onClick}
        disabled={busy}
        className="tmpl-detail-cta"
      >
        {busy ? 'Cloning…' : `Use this template — ${template.slides.length} slides →`}
      </button>
      {error && (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--bad)', letterSpacing: '.08em' }}>
          ! {error}
        </span>
      )}
    </div>
  );
}
