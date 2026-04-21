'use client';

import { useEffect, useRef, useState } from 'react';
import type { FontFamily } from '@/lib/slide-layouts';

const FAMILIES: Array<{ id: FontFamily; label: string; sample: string; fontFamily: string }> = [
  { id: 'serif', label: 'Serif', sample: 'Aa', fontFamily: 'var(--serif)' },
  { id: 'sans',  label: 'Sans',  sample: 'Aa', fontFamily: 'var(--sans)' },
  { id: 'mono',  label: 'Mono',  sample: 'Aa', fontFamily: 'var(--mono)' },
];

const SCALES: Array<{ id: string; label: string; value: number }> = [
  { id: 'S', label: 'S', value: 0.85 },
  { id: 'M', label: 'M', value: 1 },
  { id: 'L', label: 'L', value: 1.15 },
];

const DEFAULT_ACCENT = '#c89a3a';

/**
 * Formatting row: primary typeface + size scale + accent color + inline
 * bold / italic / emphasis.
 *
 * The family / scale / accent controls persist at the slide level (via
 * `_fontFamily` / `_fontScale` / `_accent` entries in the slot bag).
 *
 * B / I / E act on the currently-focused contentEditable selection. We save
 * the selection on mousedown (when focus is still in the slot) and restore
 * it on click before running the command — this is the standard trick for
 * toolbar buttons in rich-text editors.
 *
 * - B → <strong>
 * - I → <i>
 * - E → <em> (viewer renders <em> in the accent color — use this to tag
 *             the "vivos" / highlighted words in a slide).
 */
export function FormatToolbar({
  fontFamily,
  fontScale,
  accent,
  onChange,
}: {
  fontFamily: FontFamily;
  fontScale: number;
  accent: string | null;
  onChange: (patch: { fontFamily?: FontFamily; fontScale?: number; accent?: string | null }) => void;
}) {
  const [accentOpen, setAccentOpen] = useState(false);
  const accentInputRef = useRef<HTMLInputElement>(null);
  const [isOverEditable, setIsOverEditable] = useState(false);

  // Save the slot's current selection on mousedown so the toolbar click
  // doesn't lose it. We refocus + restore on the actual click handler.
  const savedRangeRef = useRef<Range | null>(null);
  const savedEditableRef = useRef<HTMLElement | null>(null);

  function captureSelection() {
    const el = document.activeElement as HTMLElement | null;
    if (!el || !el.isContentEditable) return;
    savedEditableRef.current = el;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  }

  function runInline(cmd: 'bold' | 'italic' | 'emphasis') {
    const el = savedEditableRef.current;
    const range = savedRangeRef.current;
    if (!el || !range) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
    execInlineCmd(cmd, accent || DEFAULT_ACCENT);
    // Refresh saved range so chained clicks keep working.
    if (sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  }

  // Track focus globally so B/I/E indicate when they'll no-op.
  useEffect(() => {
    function onFocus() {
      const el = document.activeElement as HTMLElement | null;
      const editable = !!el && el.isContentEditable;
      setIsOverEditable(editable);
      if (editable) savedEditableRef.current = el;
    }
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onFocus);
    return () => {
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', onFocus);
    };
  }, []);

  const activeAccent = accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : DEFAULT_ACCENT;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {/* Font family */}
      <div style={{ display: 'flex', gap: 2 }}>
        {FAMILIES.map(f => (
          <button
            key={f.id}
            className={`tool-btn${fontFamily === f.id ? ' active' : ''}`}
            title={`Font: ${f.label}`}
            onMouseDown={e => e.preventDefault() /* keep slot focus */}
            onClick={() => onChange({ fontFamily: f.id })}
            style={{ width: 26, height: 22, minWidth: 26, padding: 0, fontFamily: f.fontFamily, fontSize: 12, lineHeight: 1 }}
          >
            {f.sample}
          </button>
        ))}
      </div>

      <div className="tool-divider" />

      {/* Font size scale */}
      <div style={{ display: 'flex', gap: 2 }}>
        {SCALES.map(sc => {
          const isActive = Math.abs((fontScale || 1) - sc.value) < 0.02;
          return (
            <button
              key={sc.id}
              className={`tool-btn${isActive ? ' active' : ''}`}
              title={`Size: ${sc.label}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => onChange({ fontScale: sc.value })}
              style={{ width: 22, height: 22, minWidth: 22, padding: 0, fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 500 }}
            >
              {sc.label}
            </button>
          );
        })}
      </div>

      <div className="tool-divider" />

      {/* Accent color — applies to <em> and every accent-using element. */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button
          className="tool-btn"
          title="Accent color (applies to <em> and number accents)"
          onMouseDown={e => e.preventDefault()}
          onClick={() => { setAccentOpen(o => !o); setTimeout(() => accentInputRef.current?.click(), 0); }}
          style={{
            width: 22, height: 22, minWidth: 22, padding: 0,
            border: '1px solid var(--line-2)',
            borderRadius: '50%',
            background: activeAccent,
          }}
        />
        <input
          ref={accentInputRef}
          type="color"
          value={activeAccent}
          onChange={e => onChange({ accent: e.target.value })}
          onBlur={() => setAccentOpen(false)}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        />
        {accent && (
          <button
            className="tool-btn"
            title="Reset to theme default"
            onMouseDown={e => e.preventDefault()}
            onClick={() => onChange({ accent: null })}
            style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.1em', padding: '0 4px', height: 22, marginLeft: 2 }}
          >
            reset
          </button>
        )}
      </div>

      <div className="tool-divider" />

      {/* Inline B / I / E — save selection on mousedown, restore on click. */}
      <InlineFormatButton
        label="B"
        title="Bold (⌘B) — wraps selection in <strong>"
        enabled={isOverEditable}
        onCapture={captureSelection}
        onClick={() => runInline('bold')}
        bold
      />
      <InlineFormatButton
        label="I"
        title="Italic (⌘I) — wraps selection in <i>"
        enabled={isOverEditable}
        onCapture={captureSelection}
        onClick={() => runInline('italic')}
        italic
      />
      <InlineFormatButton
        label="E"
        title="Emphasis (⌘E) — wraps selection in <em>, styled with the accent color"
        enabled={isOverEditable}
        onCapture={captureSelection}
        onClick={() => runInline('emphasis')}
        color={activeAccent}
        italic
      />
    </div>
  );
}

function InlineFormatButton({
  label,
  title,
  enabled,
  onCapture,
  onClick,
  bold,
  italic,
  color,
}: {
  label: string;
  title: string;
  enabled: boolean;
  onCapture: () => void;
  onClick: () => void;
  bold?: boolean;
  italic?: boolean;
  color?: string;
}) {
  return (
    <button
      className="tool-btn"
      title={title}
      disabled={!enabled}
      onMouseDown={e => { e.preventDefault(); onCapture(); }}
      onClick={onClick}
      style={{
        width: 22,
        height: 22,
        minWidth: 22,
        padding: 0,
        fontFamily: 'var(--serif)',
        fontSize: 13,
        fontWeight: bold ? 700 : 500,
        fontStyle: italic ? 'italic' : 'normal',
        color: enabled ? (color || 'var(--ink)') : 'var(--ink-3)',
        cursor: enabled ? 'pointer' : 'not-allowed',
      }}
    >
      {label}
    </button>
  );
}

/**
 * Apply an inline style to the current selection inside a contentEditable.
 * Called from toolbar clicks AND from ⌘B / ⌘I / ⌘E shortcuts.
 */
export function execInlineCmd(cmd: 'bold' | 'italic' | 'emphasis', accent?: string) {
  const el = document.activeElement as HTMLElement | null;
  if (!el || !el.isContentEditable) return;
  if (cmd === 'bold') { document.execCommand('bold'); return; }
  if (cmd === 'italic') { document.execCommand('italic'); return; }
  // Emphasis: wrap the selection in a <em> element the sanitizer keeps.
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;
  if (!el.contains(range.commonAncestorContainer)) return;
  const em = document.createElement('em');
  if (accent) em.setAttribute('style', `color:${accent};font-style:italic`);
  try {
    em.appendChild(range.extractContents());
    range.insertNode(em);
  } catch {
    return;
  }
  const after = document.createRange();
  after.setStartAfter(em);
  after.setEndAfter(em);
  sel.removeAllRanges();
  sel.addRange(after);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
