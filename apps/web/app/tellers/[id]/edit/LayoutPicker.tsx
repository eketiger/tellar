'use client';

import { useEffect, useRef } from 'react';
import { LAYOUT_LIST } from '@/lib/slide-layouts';

/**
 * Small popover dropdown with mini wireframes. Anchored to a toolbar button
 * (or to a trigger ref). Click-outside and Escape dismiss.
 */
export function LayoutPicker({
  current,
  anchorRef,
  onPick,
  onCancel,
}: {
  current?: string;
  anchorRef?: React.RefObject<HTMLElement | null>;
  onPick: (layoutId: string) => void;
  onCancel: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onCancel();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [anchorRef, onCancel]);

  // Position the popover just below the anchor.
  const rect = anchorRef?.current?.getBoundingClientRect();
  const top = rect ? rect.bottom + 6 : 80;
  const left = rect ? Math.max(12, rect.left) : 20;

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top,
        left,
        width: 340,
        background: 'var(--panel)',
        border: '1px solid var(--line-2)',
        boxShadow: '0 16px 40px rgba(0,0,0,.45)',
        padding: 10,
        zIndex: 120,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 6px 8px' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.2em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
          layouts
        </span>
        {current && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.15em', color: 'var(--accent)', textTransform: 'uppercase' }}>
            current · {current}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
        {LAYOUT_LIST.map(meta => {
          const isCurrent = meta.id === current;
          return (
            <button
              key={meta.id}
              onClick={() => onPick(meta.id)}
              title={meta.hint}
              style={{
                padding: 6,
                background: isCurrent ? 'rgba(244,185,66,.08)' : 'var(--panel-2)',
                border: '1px solid ' + (isCurrent ? 'var(--accent)' : 'var(--line)'),
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                textAlign: 'left',
                color: 'inherit',
                transition: 'border-color .12s, background .12s',
              }}
              onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line-3)'; }}
              onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)'; }}
            >
              <Wireframe id={meta.id} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.08em', color: isCurrent ? 'var(--accent)' : 'var(--ink-2)', textTransform: 'uppercase' }}>
                {meta.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Tiny SVG wireframe per layout — schematic, not pixel-perfect. */
function Wireframe({ id }: { id: string }) {
  const S = {
    card: '#f6f3ed',
    bar: '#c4beb0',
    dim: '#9e9886',
    accent: '#c89a3a',
  };
  const W = 96, H = 58;
  const wrap = (children: React.ReactNode) => (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: 'block', background: S.card, border: '1px solid rgba(0,0,0,.08)' }}>
      {children}
    </svg>
  );
  const bar = (x: number, y: number, w: number, h: number, fill = S.bar) => (
    <rect x={x} y={y} width={w} height={h} fill={fill} />
  );
  switch (id) {
    case 'cover':
      return wrap(<>
        {bar(10, 14, 20, 2, S.dim)}
        {bar(10, 22, 76, 10, S.accent)}
        {bar(10, 36, 56, 3, S.bar)}
        {bar(10, 42, 40, 3, S.bar)}
      </>);
    case 'headline':
      return wrap(<>
        {bar(10, 8, 20, 2, S.dim)}
        {bar(10, 22, 70, 8, S.accent)}
        {bar(10, 34, 48, 3, S.bar)}
        {bar(10, 50, 16, 2, S.dim)}
      </>);
    case 'bigNumber':
      return wrap(<>
        {bar(10, 10, 18, 2, S.dim)}
        {bar(10, 18, 50, 26, S.accent)}
        {bar(10, 48, 60, 3, S.bar)}
      </>);
    case 'twoColumn':
      return wrap(<>
        {bar(10, 8, 60, 6, S.accent)}
        {bar(10, 22, 32, 3, S.dim)}
        {bar(10, 28, 32, 12, S.bar)}
        {bar(54, 22, 32, 3, S.dim)}
        {bar(54, 28, 32, 12, S.bar)}
      </>);
    case 'quote':
      return wrap(<>
        {bar(10, 14, 76, 4, S.bar)}
        {bar(10, 22, 76, 4, S.bar)}
        {bar(10, 30, 50, 4, S.accent)}
        {bar(10, 42, 30, 2, S.dim)}
      </>);
    case 'imageFull':
      return wrap(<>
        {bar(0, 0, W, H, '#2a2a2a')}
        {bar(0, 38, W, 20, 'rgba(0,0,0,.4)')}
        {bar(10, 44, 40, 3, '#f6f3ed')}
        {bar(10, 50, 56, 3, '#c89a3a')}
      </>);
    case 'imageRight':
      return wrap(<>
        {bar(10, 14, 16, 2, S.dim)}
        {bar(10, 22, 32, 6, S.accent)}
        {bar(10, 32, 32, 3, S.bar)}
        {bar(10, 38, 28, 3, S.bar)}
        {bar(48, 0, 48, H, '#2a2a2a')}
      </>);
    case 'bullets':
      return wrap(<>
        {bar(10, 8, 44, 6, S.accent)}
        {bar(10, 22, 2, 3, S.accent)}
        {bar(16, 22, 56, 3, S.bar)}
        {bar(10, 30, 2, 3, S.accent)}
        {bar(16, 30, 48, 3, S.bar)}
        {bar(10, 38, 2, 3, S.accent)}
        {bar(16, 38, 60, 3, S.bar)}
        {bar(10, 46, 2, 3, S.accent)}
        {bar(16, 46, 40, 3, S.bar)}
      </>);
    case 'grid':
      return wrap(<>
        {bar(10, 6, 40, 4, S.accent)}
        {[0, 1, 2].map(c => [0, 1].map(r => bar(10 + c * 28, 18 + r * 17, 24, 14, S.bar)))}
      </>);
    case 'comparison':
      return wrap(<>
        {bar(10, 8, 48, 4, S.accent)}
        {bar(10, 18, 14, 2, S.dim)}
        {bar(10, 24, 34, 2, S.bar)}
        {bar(10, 30, 34, 2, S.bar)}
        {bar(10, 36, 30, 2, S.bar)}
        {bar(54, 18, 14, 2, S.accent)}
        {bar(54, 24, 34, 2, S.bar)}
        {bar(54, 30, 34, 2, S.bar)}
        {bar(54, 36, 30, 2, S.bar)}
      </>);
    case 'videoEmbed':
      return wrap(<>
        {bar(10, 8, 50, 4, S.accent)}
        {bar(10, 18, 76, 28, '#2a2a2a')}
        <polygon points="44,26 44,38 54,32" fill="#f6f3ed" />
        {bar(10, 50, 40, 2, S.dim)}
      </>);
    case 'chart':
      return wrap(<>
        {bar(10, 8, 44, 4, S.accent)}
        {bar(12, 44, 10, 8, S.accent)}
        {bar(26, 36, 10, 16, S.bar)}
        {bar(40, 26, 10, 26, S.accent)}
        {bar(54, 18, 10, 34, S.bar)}
        {bar(68, 12, 10, 40, S.accent)}
      </>);
    case 'thanks':
      return wrap(<>
        {bar(18, 20, 60, 18, S.accent)}
      </>);
    default:
      return wrap(<>{bar(10, 22, 76, 8, S.bar)}</>);
  }
}
