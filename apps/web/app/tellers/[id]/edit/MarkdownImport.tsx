'use client';

import { useState } from 'react';

export interface ParsedSlide {
  layoutId: string;
  slots: Record<string, any>;
}

/**
 * Parse a markdown outline into slide specs.
 *
 * Conventions:
 *   # / ## / ### starts a new slide (title = heading).
 *   - or * lines → bullets layout with up to 6 bullets.
 *   Plain lines between headings → subtitle (first non-empty line).
 *   "Thank you." as a title → thanks layout.
 *   Content before the first heading becomes a cover slide.
 */
export function parseMarkdownToSlides(md: string): ParsedSlide[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const slides: ParsedSlide[] = [];
  let current: { title: string; rest: string[] } | null = null;
  const preamble: string[] = [];

  const flush = () => {
    if (!current) return;
    const bullets: string[] = [];
    const paragraphs: string[] = [];
    for (const line of current.rest) {
      const t = line.trim();
      if (!t) continue;
      if (/^[-*]\s+/.test(t)) bullets.push(t.replace(/^[-*]\s+/, '').trim());
      else paragraphs.push(t);
    }
    const titleStr = current.title;
    if (bullets.length >= 2) {
      slides.push({ layoutId: 'bullets', slots: { title: titleStr, bullets: bullets.slice(0, 6) } });
    } else if (/^(thank\s*you|thanks|the\s*end|end)[.!]?$/i.test(titleStr.trim())) {
      slides.push({ layoutId: 'thanks', slots: { title: titleStr } });
    } else if (paragraphs.length === 1 && bullets.length === 0 && paragraphs[0].length < 32) {
      slides.push({ layoutId: 'headline', slots: { title: titleStr, subtitle: paragraphs[0] } });
    } else {
      slides.push({
        layoutId: 'headline',
        slots: {
          title: titleStr,
          subtitle: paragraphs.join(' ') || bullets[0] || '',
        },
      });
    }
    current = null;
  };

  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)$/);
    if (m) {
      flush();
      current = { title: m[2].trim(), rest: [] };
    } else if (current) {
      current.rest.push(line);
    } else {
      if (line.trim()) preamble.push(line.trim());
    }
  }
  flush();

  if (preamble.length) {
    slides.unshift({
      layoutId: 'cover',
      slots: {
        title: preamble[0],
        subtitle: preamble.slice(1).join(' ') || '',
      },
    });
  }

  return slides;
}

export function MarkdownImport({
  onImport,
  onClose,
}: {
  onImport: (slides: ParsedSlide[]) => Promise<void> | void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const parsed = text.trim() ? parseMarkdownToSlides(text) : [];

  async function handleImport() {
    if (!parsed.length) return;
    setBusy(true);
    try {
      await onImport(parsed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(12,13,15,.9)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 780, width: '100%', background: 'var(--panel)', border: '1px solid var(--line-2)', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.2em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 4 }}>
              import from markdown
            </div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500 }}>
              Paste an outline, get <em style={{ color: 'var(--accent)' }}>a deck</em>.
            </h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.08em' }}>
          <strong style={{ color: 'var(--ink-2)' }}># title</strong> starts a slide ·{' '}
          <strong style={{ color: 'var(--ink-2)' }}>- bullet</strong> becomes a bullets layout ·{' '}
          a single paragraph after a heading becomes the subtitle ·{' '}
          "Thank you" auto-detected as thanks.
        </div>

        <textarea
          autoFocus
          spellCheck={false}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={'# Cover\nYour opening line.\n\n## The market\n- $34B market\n- 28% YoY\n- Eating F1000\n\n## Thank you.'}
          style={{
            width: '100%',
            minHeight: 260,
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            color: 'var(--ink)',
            fontFamily: 'var(--mono)',
            fontSize: 12,
            lineHeight: 1.55,
            padding: 12,
            outline: 'none',
            resize: 'vertical',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: parsed.length ? 'var(--accent)' : 'var(--ink-3)', letterSpacing: '.1em' }}>
            {parsed.length
              ? `${parsed.length} slide${parsed.length === 1 ? '' : 's'} will be appended`
              : 'paste a markdown outline above'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={busy || !parsed.length}>
              {busy ? 'Importing…' : `Import ${parsed.length || ''}`.trim()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
