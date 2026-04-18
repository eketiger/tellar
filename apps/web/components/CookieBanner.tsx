'use client';

import { useEffect, useState } from 'react';
import { markConsent, hasAnalyticsConsent } from '@/lib/analytics';

export function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Only mount after hydration, so SSR doesn't flash the banner.
    setShow(!hasAnalyticsConsent());
  }, []);

  if (!show) return null;
  return (
    <div
      role="dialog"
      aria-label="Cookies"
      style={{
        position: 'fixed', bottom: 20, left: 20, right: 20, zIndex: 400,
        maxWidth: 820, margin: '0 auto',
        background: 'var(--panel)', border: '1px solid var(--line-2)',
        padding: 18, display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 12px 40px rgba(0,0,0,.5)',
      }}
    >
      <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, lineHeight: 1.5, color: 'var(--ink-2)' }}>
        We use only the cookies required to run the product. Analytics are off until you agree.
        See <a href="/cookies" style={{ color: 'var(--accent)' }}>cookie policy</a> and <a href="/privacy" style={{ color: 'var(--accent)' }}>privacy</a>.
      </div>
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { markConsent(false); setShow(false); }}>
          Essential only
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => { markConsent(true); setShow(false); }}>
          Accept all
        </button>
      </div>
    </div>
  );
}
