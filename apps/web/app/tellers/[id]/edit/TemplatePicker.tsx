'use client';

import { useState } from 'react';
import { RenderSlide } from '@/lib/slide-layouts';
import { TEMPLATES, type Template } from '@/lib/templates';

/**
 * Modal that surfaces the 10 marketplace templates from inside the editor.
 * Picking one appends the template's slides to the current teller so the
 * creator can use a template's slide — say, the YC Series A team grid —
 * without leaving the editor.
 */
export function TemplatePicker({
  onPick,
  onClose,
}: {
  onPick: (template: Template) => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState<Template | null>(null);

  async function confirm() {
    if (!choice) return;
    setBusy(true);
    try {
      await onPick(choice);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(12,13,15,.9)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 980,
          width: '100%',
          maxHeight: '88vh',
          background: 'var(--panel)',
          border: '1px solid var(--line-2)',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.2em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
              append from a template
            </div>
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, marginTop: 4 }}>
              Drop a <em style={{ color: 'var(--accent)' }}>ready-made</em> deck in.
            </h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
          overflowY: 'auto',
          padding: 2,
        }}>
          {TEMPLATES.map(t => {
            const selected = choice?.slug === t.slug;
            return (
              <button
                key={t.slug}
                onClick={() => setChoice(t)}
                style={{
                  padding: 0,
                  background: 'var(--panel-2)',
                  border: '1px solid ' + (selected ? 'var(--accent)' : 'var(--line)'),
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  textAlign: 'left',
                  color: 'inherit',
                  overflow: 'hidden',
                  transition: 'border-color .12s',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    aspectRatio: '16 / 10',
                    overflow: 'hidden',
                    containerType: 'inline-size',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 860,
                    height: 537.5,
                    transformOrigin: 'top left',
                    transform: 'scale(calc(100cqw / 860px))',
                    pointerEvents: 'none',
                  }}>
                    <RenderSlide slide={t.slides[0] as any} />
                  </div>
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>
                    {t.title}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>
                    {t.slides.length} slides · {t.category}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: choice ? 'var(--accent)' : 'var(--ink-3)', letterSpacing: '.1em' }}>
            {choice ? `${choice.title} — ${choice.slides.length} slides will append to this deck` : 'pick a template above'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || !choice} onClick={confirm}>
              {busy ? 'Appending…' : 'Append'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
