'use client';

import { useEffect, useRef, useState } from 'react';
import type { Background } from '@/lib/slide-layouts';

declare global {
  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
  }
}

/**
 * Toolbar popover that edits the slide's gradient background.
 * Anchors under a trigger ref (same pattern as LayoutPicker).
 */
export function GradientPicker({
  value,
  anchorRef,
  onChange,
  onCancel,
}: {
  value: Background | undefined;
  anchorRef?: React.RefObject<HTMLElement | null>;
  onChange: (bg: Background) => void;
  onCancel: () => void;
}) {
  const popRef = useRef<HTMLDivElement | null>(null);
  const [from, setFrom] = useState(value?.from || '#c89a3a');
  const [to, setTo] = useState(value?.to || '#0c1220');
  const [angle, setAngle] = useState(value?.angle ?? 135);
  const [eyedropperAvailable, setEyedropperAvailable] = useState(false);

  useEffect(() => {
    setEyedropperAvailable(typeof window !== 'undefined' && 'EyeDropper' in window);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (popRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onCancel();
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel(); }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchorRef, onCancel]);

  const rect = anchorRef?.current?.getBoundingClientRect();
  const top = rect ? rect.bottom + 6 : 80;
  const left = rect ? Math.max(12, rect.left - 150) : 20;

  function push(next: Partial<Background>) {
    onChange({ kind: 'gradient', from, to, angle, ...next });
  }

  async function pickColor(setter: (hex: string) => void) {
    if (!window.EyeDropper) return;
    try {
      const ed = new window.EyeDropper();
      const { sRGBHex } = await ed.open();
      setter(sRGBHex);
      if (setter === setFrom) push({ from: sRGBHex });
      else push({ to: sRGBHex });
    } catch {
      /* user cancelled */
    }
  }

  const swap = () => {
    setFrom(to);
    setTo(from);
    push({ from: to, to: from });
  };

  return (
    <div
      ref={popRef}
      style={{
        position: 'fixed',
        top,
        left,
        width: 300,
        background: 'var(--panel)',
        border: '1px solid var(--line-2)',
        boxShadow: '0 16px 40px rgba(0,0,0,.45)',
        padding: 14,
        zIndex: 120,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.2em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
          gradient
        </span>
        <button onClick={swap} className="btn btn-ghost btn-sm" title="Swap colors" style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.15em' }}>
          ⇄ swap
        </button>
      </div>

      <div
        style={{
          height: 48,
          background: `linear-gradient(${angle}deg, ${from}, ${to})`,
          border: '1px solid var(--line)',
        }}
      />

      <ColorRow
        label="from"
        value={from}
        onChange={(hex) => { setFrom(hex); push({ from: hex }); }}
        onEyedropper={eyedropperAvailable ? () => pickColor(setFrom) : null}
      />
      <ColorRow
        label="to"
        value={to}
        onChange={(hex) => { setTo(hex); push({ to: hex }); }}
        onEyedropper={eyedropperAvailable ? () => pickColor(setTo) : null}
      />

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 4 }}>
          <span>angle</span>
          <span style={{ color: 'var(--ink-2)' }}>{angle}°</span>
        </div>
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={angle}
          onChange={e => {
            const a = Number(e.target.value);
            setAngle(a);
            push({ angle: a });
          }}
          style={{ width: '100%' }}
        />
      </div>

      {!eyedropperAvailable && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.08em' }}>
          Eyedropper works in Chromium browsers only.
        </div>
      )}
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
  onEyedropper,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  onEyedropper: (() => void) | null;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.2em', color: 'var(--ink-3)', textTransform: 'uppercase', width: 40 }}>
        {label}
      </span>
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: 34, height: 26, border: '1px solid var(--line)', padding: 0, background: 'transparent', cursor: 'pointer' }}
      />
      <input
        type="text"
        value={value}
        onChange={e => {
          const v = e.target.value.trim();
          if (/^#?[0-9a-fA-F]{6}$/.test(v)) onChange(v.startsWith('#') ? v : `#${v}`);
        }}
        style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--ink)', padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 11, outline: 'none' }}
      />
      {onEyedropper && (
        <button
          onClick={onEyedropper}
          title="Pick a color from the page"
          className="btn btn-ghost btn-sm"
          style={{ width: 28, height: 26, padding: 0, fontSize: 13 }}
        >
          💧
        </button>
      )}
    </div>
  );
}
