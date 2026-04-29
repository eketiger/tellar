'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  keywords?: string[];
  /** Group label for visual section separation. */
  group?: string;
  /** Either a navigation target or a handler. One must be set. */
  href?: string;
  run?: () => void | Promise<void>;
}

const BUILTIN_ACTIONS: CommandAction[] = [
  { id: 'nav.dashboard', group: 'Navigate', label: 'Go to dashboard',          href: '/dashboard',     keywords: ['home', 'tellars'] },
  { id: 'nav.templates', group: 'Navigate', label: 'Browse templates',         href: '/templates',     keywords: ['template'] },
  { id: 'nav.settings',  group: 'Navigate', label: 'Account settings',         href: '/settings',      keywords: ['profile', 'workspace'] },
  { id: 'nav.billing',   group: 'Navigate', label: 'Billing & usage',          href: '/settings#billing', keywords: ['plan', 'invoice'] },
  { id: 'nav.admin',     group: 'Navigate', label: 'Open backoffice (admin)',  href: '/admin',         keywords: ['ops'] },
  { id: 'nav.docs',      group: 'Navigate', label: 'API reference',            href: '/api-reference', keywords: ['openapi'] },
];

/**
 * Global command palette. Triggered by ⌘K / Ctrl+K. Consumers can
 * extend the action list per page via the `extraActions` prop.
 */
export function CommandPalette({ extraActions = [] }: { extraActions?: CommandAction[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const actions = useMemo(() => [...extraActions, ...BUILTIN_ACTIONS], [extraActions]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return actions;
    return actions.filter(a => {
      const hay = [a.label, a.hint || '', a.group || '', ...(a.keywords || [])].join(' ').toLowerCase();
      return hay.includes(s);
    });
  }, [actions, q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
      const meta = isMac ? e.metaKey : e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQ('');
        setHighlight(0);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function pick(a: CommandAction) {
    setOpen(false);
    if (a.run) { a.run(); return; }
    if (a.href) router.push(a.href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const a = filtered[highlight];
      if (a) pick(a);
    }
  }

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 250,
        background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'center', paddingTop: '12vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)',
          background: 'var(--panel)', border: '1px solid var(--line-2)',
          boxShadow: '0 24px 80px rgba(0,0,0,.45)', position: 'relative',
        }}
      >
        <input
          ref={inputRef}
          value={q}
          placeholder="Type a command or search…"
          onChange={e => { setQ(e.target.value); setHighlight(0); }}
          onKeyDown={onInputKey}
          style={{
            width: '100%', background: 'transparent', border: 0,
            color: 'var(--ink)', fontFamily: 'var(--sans)',
            fontSize: 14, padding: '14px 16px',
            borderBottom: '1px solid var(--line)',
          }}
        />
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '60vh', overflow: 'auto' }}>
          {filtered.length === 0 && (
            <li style={{ padding: 18, color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
              No matches.
            </li>
          )}
          {filtered.map((a, i) => (
            <li
              key={a.id}
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pick(a)}
              style={{
                padding: '10px 16px',
                background: i === highlight ? 'var(--panel-2)' : 'transparent',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderLeft: i === highlight ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <div>
                <div style={{ fontSize: 13 }}>{a.label}</div>
                {a.hint && <div className="note">{a.hint}</div>}
              </div>
              {a.group && (
                <span className="note" style={{ marginLeft: 12 }}>{a.group}</span>
              )}
            </li>
          ))}
        </ul>
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
          <span>↑↓ navigate · ↵ run</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
