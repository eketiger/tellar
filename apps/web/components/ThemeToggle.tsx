'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'tellar:theme';

function readStored(): Theme | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : null;
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
}

/**
 * Theme toggle. Source of truth is `<html data-theme="…">`. The initial
 * value is set by `themeBootstrap()` (rendered from RootLayout) before
 * hydration so the user never sees the wrong theme flash on load.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const initial =
      (document.documentElement.getAttribute('data-theme') as Theme | null) ??
      readStored() ??
      (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function flip() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch {}
  }

  return (
    <button
      type="button"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Theme: ${theme}`}
      onClick={flip}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        border: '1px solid var(--line-2)',
        background: 'var(--panel)',
        color: 'var(--ink-2)',
        borderRadius: 3,
        cursor: 'pointer',
        fontSize: 12,
        lineHeight: 1,
      }}
    >
      {theme === 'dark' ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}

/**
 * Synchronous theme-bootstrap script. Runs before hydration to set
 * `data-theme` on <html>. Inlined as a string so Next can render it
 * inside a <script dangerouslySetInnerHTML>. Reads the same localStorage
 * key + system preference fallback as ThemeToggle.
 */
export const themeBootstrap = `
(function(){try{
  var s = localStorage.getItem('${STORAGE_KEY}');
  var t = (s === 'light' || s === 'dark')
    ? s
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', t);
}catch(e){}})();`;
