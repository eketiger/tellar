'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';
const STORAGE_KEY = 'tellar:bo:theme';

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const initial =
      (document.documentElement.getAttribute('data-theme') as Theme | null) ??
      ((window.localStorage.getItem(STORAGE_KEY) as Theme | null) || 'dark');
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
      onClick={flip}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Theme: ${theme}`}
      style={{
        width: 26, height: 26, padding: 0, border: '1px solid var(--line-2)',
        background: 'var(--panel)', color: 'var(--ink-2)', borderRadius: 3,
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {theme === 'dark' ? '☾' : '☀'}
    </button>
  );
}

export const themeBootstrap = `
(function(){try{
  var s = localStorage.getItem('${STORAGE_KEY}');
  var t = (s === 'light' || s === 'dark') ? s
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', t);
}catch(e){}})();`;
