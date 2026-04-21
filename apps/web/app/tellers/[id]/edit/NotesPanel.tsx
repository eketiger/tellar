'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Speaker-notes editor. One note per slide, rendered in the present-mode
 * speaker view. Saves on blur so rapid typing bursts become one patch.
 */
export function NotesPanel({
  slide,
  totalSlides,
  onChange,
}: {
  slide: { id: string; idx: number; notes: string | null; title: string } | undefined;
  totalSlides: number;
  onChange: (notes: string) => void;
}) {
  const [draft, setDraft] = useState(slide?.notes ?? '');
  const slideIdRef = useRef(slide?.id);

  // Reset the draft when the active slide changes.
  useEffect(() => {
    if (slide?.id !== slideIdRef.current) {
      slideIdRef.current = slide?.id;
      setDraft(slide?.notes ?? '');
    }
  }, [slide?.id, slide?.notes]);

  if (!slide) {
    return <div className="note">Select a slide to edit its speaker notes.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.2em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>
          speaker notes · slide {String(slide.idx).padStart(2, '0')} of {String(totalSlides).padStart(2, '0')}
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.4, marginBottom: 10 }}>
          {(slide.title || '').replace(/<[^>]+>/g, '').slice(0, 80) || 'Untitled slide'}
        </div>
      </div>

      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { if ((slide?.notes ?? '') !== draft) onChange(draft); }}
        placeholder={'What you want to say when this slide is on screen…\n\nShown in the speaker view during Present mode.'}
        className="field-input"
        style={{
          minHeight: 200,
          fontFamily: 'var(--serif)',
          fontStyle: 'italic',
          fontSize: 14,
          lineHeight: 1.55,
          padding: 12,
          resize: 'vertical',
        }}
      />

      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.08em' }}>
        {draft.length.toLocaleString()} chars · autosaves on blur
      </div>
    </div>
  );
}
