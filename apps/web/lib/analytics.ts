// Mixpanel singleton. Safe on SSR: becomes a no-op if window/token is missing.
// Never initialises until the user has accepted cookies.
import type Mixpanel from 'mixpanel-browser';

const CONSENT_KEY = 'tellar:consent';
let mixpanel: typeof Mixpanel | null = null;
let initialised = false;

function hasConsent() {
  if (typeof window === 'undefined') return false;
  try {
    return JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null')?.accepted === true;
  } catch {
    return false;
  }
}

async function loadIfAble() {
  if (initialised) return mixpanel;
  if (typeof window === 'undefined') return null;
  if (!hasConsent()) return null;
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  if (!token) return null;
  const mod = await import('mixpanel-browser');
  mod.default.init(token, { track_pageview: false, persistence: 'localStorage' });
  mixpanel = mod.default;
  initialised = true;
  return mixpanel;
}

export async function track(event: string, props?: Record<string, unknown>) {
  const mp = await loadIfAble();
  mp?.track(event, { ...props, timestamp: Date.now() });
}

export async function identify(userId: string, profile?: Record<string, unknown>) {
  const mp = await loadIfAble();
  mp?.identify(userId);
  if (profile) mp?.people.set(profile);
}

export async function reset() {
  if (typeof window === 'undefined') return;
  mixpanel?.reset();
}

export function markConsent(accepted: boolean, version = '2026-04-18') {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CONSENT_KEY, JSON.stringify({ accepted, version, at: Date.now() }));
  // Fire the backend record too (non-blocking).
  fetch('/api/consent/cookies', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version }),
    credentials: 'include',
  }).catch(() => {});
}

export function hasAnalyticsConsent() {
  return hasConsent();
}
