'use client';

import { useEffect, useState } from 'react';
import { RenderSlide } from '@/lib/slide-layouts';

interface PresentSlide {
  id: string;
  idx: number;
  layoutId?: string;
  layout?: any;
  background?: any;
  eyebrow?: string | null;
  title?: string;
  subtitle?: string | null;
  notes?: string | null;
}

/**
 * Full-screen present overlay with an optional speaker panel.
 *
 * Keys:
 *   →/Space/Enter/PageDown  next
 *   ←/PageUp/Backspace      previous
 *   Home / End              first / last
 *   S                       toggle speaker view (notes + next preview + timer)
 *   Esc                     exit
 */
export function PresentMode({
  slides,
  startIndex,
  onClose,
}: {
  slides: PresentSlide[];
  startIndex: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(Math.max(0, Math.min(startIndex, slides.length - 1)));
  const [speaker, setSpeaker] = useState(false);
  const [startAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault(); setI(x => Math.min(slides.length - 1, x + 1)); return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault(); setI(x => Math.max(0, x - 1)); return;
      }
      if (e.key === 'Home') { e.preventDefault(); setI(0); return; }
      if (e.key === 'End') { e.preventDefault(); setI(slides.length - 1); return; }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); setSpeaker(s => !s); return; }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length, onClose]);

  const slide = slides[i];
  const next = slides[i + 1];
  if (!slide) return null;

  const elapsed = Math.floor((now - startAt) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) setI(x => Math.min(slides.length - 1, x + 1)); }}
      style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 500, display: 'flex', flexDirection: 'column', color: '#f6f3ed' }}
    >
      <div style={{ padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.15em', color: '#888' }}>
        <span>{mm}:{ss}</span>
        <span>{String(i + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={e => { e.stopPropagation(); setSpeaker(s => !s); }}
            title="Speaker view (S)"
            style={{ background: 'transparent', border: '1px solid #333', color: speaker ? '#f4b942' : '#888', padding: '3px 9px', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            speaker
          </button>
          <button
            onClick={e => { e.stopPropagation(); onClose(); }}
            title="Exit (Esc)"
            style={{ background: 'transparent', border: '1px solid #333', color: '#888', padding: '3px 9px', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            close
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: speaker ? '1.8fr 1fr' : '1fr', padding: speaker ? '20px 24px' : '32px', gap: 24, minHeight: 0 }}>
        <div style={{ display: 'grid', placeItems: 'center', minHeight: 0 }}>
          <div style={{ width: '100%', aspectRatio: '16 / 10', maxHeight: '100%', maxWidth: '100%', boxShadow: '0 30px 80px rgba(0,0,0,.6)', overflow: 'hidden' }}>
            <RenderSlide slide={slide} />
          </div>
        </div>

        {speaker && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto', minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.25em', textTransform: 'uppercase', color: '#666' }}>Next</div>
            {next ? (
              <div style={{ aspectRatio: '16/10', overflow: 'hidden', border: '1px solid #222' }}>
                <RenderSlide slide={next} />
              </div>
            ) : (
              <div style={{ aspectRatio: '16/10', display: 'grid', placeItems: 'center', color: '#444', border: '1px dashed #222', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase' }}>
                end of deck
              </div>
            )}
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.25em', textTransform: 'uppercase', color: '#666', marginTop: 10 }}>Notes</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: '#ddd', minHeight: 0, overflow: 'auto' }}>
              {slide.notes || <span style={{ color: '#555', fontStyle: 'italic' }}>No notes for this slide.</span>}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '8px 18px', textAlign: 'center', color: '#444', fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase' }}>
        ← / → navigate · S speaker · Esc exit
      </div>
    </div>
  );
}
