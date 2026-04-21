'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { NarrationPanel } from './NarrationPanel';
import { KbPanel } from './KbPanel';
import { CopilotPanel } from './CopilotPanel';
import { LayoutPicker } from './LayoutPicker';
import { LAYOUTS, RenderSlide, type BackgroundKind } from '@/lib/slide-layouts';
import './editor.css';

interface Slide {
  id: string;
  idx: number;
  layoutId?: string;
  background?: { kind?: BackgroundKind; imageUrl?: string } | null;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  notes: string | null;
  layout?: Record<string, any> | null; // the slots bag
}
interface Teller { id: string; title: string; slides: Slide[]; kbSources: any[]; recordings: any[]; }

type Tab = 'copilot' | 'knowledge' | 'recording';

interface SlideImage { id: string; name: string; url: string; }

const THEMES: { kind: BackgroundKind; label: string; swatch: string }[] = [
  { kind: 'cream',    label: 'Cream',    swatch: '#f6f3ed' },
  { kind: 'paper',    label: 'Paper',    swatch: '#ece7db' },
  { kind: 'midnight', label: 'Midnight', swatch: '#0c1220' },
  { kind: 'dark',     label: 'Dark',     swatch: '#1a1a1a' },
];

function resolveSlotsFromSlide(s: Slide | undefined): Record<string, any> {
  if (!s) return {};
  const rawSlots = (s.layout && typeof s.layout === 'object' && !Array.isArray(s.layout)) ? s.layout : {};
  const slots = { ...rawSlots };
  if (slots.eyebrow == null && s.eyebrow != null) slots.eyebrow = s.eyebrow;
  if (slots.title == null && s.title != null) slots.title = s.title;
  if (slots.subtitle == null && s.subtitle != null) slots.subtitle = s.subtitle;
  return slots;
}

export function EditorClient({ teller: initial }: { teller: Teller }) {
  const [teller, setTeller] = useState<Teller>(initial);
  const [activeId, setActiveId] = useState<string | undefined>(initial.slides[0]?.id);
  const [tab, setTab] = useState<Tab>('copilot');
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [toast, setToast] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [imagePickerSlot, setImagePickerSlot] = useState<string | null>(null);
  const layoutBtnRef = useRef<HTMLButtonElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = teller.slides.find(s => s.id === activeId);
  const activeLayoutId = active?.layoutId || 'headline';
  const activeBg = active?.background || { kind: LAYOUTS[activeLayoutId]?.defaultBg || 'cream' };
  const activeSlots = active ? resolveSlotsFromSlide(active) : {};

  function flashToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 1600); }

  function queueSave(slideId: string, patch: Partial<Slide> & { layout?: any }) {
    setTeller(t => ({
      ...t,
      slides: t.slides.map(s => s.id === slideId ? { ...s, ...patch, layout: patch.layout ?? s.layout } : s),
    }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState('saving');
    saveTimerRef.current = setTimeout(async () => {
      try { await api(`/slides/${slideId}`, { method: 'PATCH', json: patch }); }
      finally { setSaveState('saved'); }
    }, 300);
  }

  async function addSlide(layoutId: string = 'headline') {
    const s = await api<Slide>(`/tellers/${teller.id}/slides`, { method: 'POST' });
    const created = { ...s, layoutId, background: { kind: LAYOUTS[layoutId]?.defaultBg || 'cream' }, layout: {} };
    setTeller(t => ({ ...t, slides: [...t.slides, created] }));
    setActiveId(created.id);
    await api(`/slides/${created.id}`, { method: 'PATCH', json: { layoutId, background: created.background } });
    flashToast(`${LAYOUTS[layoutId]?.label || 'Slide'} added`);
  }

  async function removeSlide(id: string) {
    if (teller.slides.length <= 1) { flashToast("Can't delete the last slide"); return; }
    if (!confirm('Delete this slide?')) return;
    await api(`/slides/${id}`, { method: 'DELETE' });
    setTeller(t => {
      const next = t.slides.filter(s => s.id !== id).map((s, i) => ({ ...s, idx: i + 1 }));
      if (id === activeId) setActiveId(next[0]?.id);
      return { ...t, slides: next };
    });
    flashToast('Slide deleted');
  }

  function switchLayout(nextLayoutId: string) {
    if (!active) return;
    const nextLayout = LAYOUTS[nextLayoutId];
    if (!nextLayout) return;
    // Carry compatible slot values across by name intersection.
    const currentSlots = activeSlots;
    const nextSlots: Record<string, any> = {};
    for (const slotName of Object.keys(nextLayout.slots)) {
      if (currentSlots[slotName] != null) nextSlots[slotName] = currentSlots[slotName];
    }
    queueSave(active.id, { layoutId: nextLayoutId, layout: nextSlots, background: active.background || { kind: nextLayout.defaultBg } });
    setShowPicker(false);
    flashToast(`Layout → ${nextLayout.label}`);
  }

  function updateSlots(next: Record<string, any>) {
    if (!active) return;
    queueSave(active.id, {
      layout: next,
      // Mirror legacy columns when the slot name matches, so older code paths stay consistent.
      eyebrow: next.eyebrow ?? null,
      title: next.title ?? active.title ?? '',
      subtitle: next.subtitle ?? null,
    });
  }

  function setSlot(name: string, value: any) {
    if (!active) return;
    updateSlots({ ...activeSlots, [name]: value });
  }

  function setBackground(kind: BackgroundKind) {
    if (!active) return;
    queueSave(active.id, { background: { kind } });
  }

  async function applyCopilot(payload: { title?: string; subtitle?: string; notes?: string }) {
    if (!active) return;
    const patch: any = {};
    if (payload.title) patch.title = payload.title;
    if (payload.subtitle !== undefined) patch.subtitle = payload.subtitle;
    if (payload.notes !== undefined) patch.notes = payload.notes;
    // Also mirror into slots.
    const nextSlots = { ...activeSlots, ...patch };
    patch.layout = nextSlots;
    queueSave(active.id, patch);
    flashToast('Applied');
  }

  const thumbSlide = (s: Slide) => {
    const bg = s.background || { kind: LAYOUTS[s.layoutId || 'headline']?.defaultBg || 'cream' };
    return { ...s, background: bg };
  };

  return (
    <>
      <div className="editor-layout">
        <aside className="slide-list">
          <div className="sl-head">
            <h3>Slides · {teller.slides.length}</h3>
            <button onClick={() => addSlide()} title="Add slide">+</button>
          </div>
          <div>
            {teller.slides.map(s => {
              const hasRec = teller.recordings.some((r: any) => r.slideId === s.id);
              return (
                <button key={s.id} className={`slide-thumb${s.id === activeId ? ' active' : ''}`} onClick={() => setActiveId(s.id)}>
                  <div className="st-num">{String(s.idx).padStart(2, '0')}</div>
                  <div className="st-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ transform: 'scale(0.12)', transformOrigin: 'top left', width: '833%', height: '833%' }}>
                      <RenderSlide slide={thumbSlide(s)} />
                    </div>
                    {hasRec && <span className="st-rec-badge" />}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="canvas-area">
          <div className="canvas-toolbar">
            <span className="tool-label">slide {String(active?.idx ?? 0).padStart(2, '0')}</span>
            <div className="tool-divider" />
            <button
              ref={layoutBtnRef}
              className={`tool-btn${showPicker ? ' active' : ''}`}
              onClick={() => setShowPicker(p => !p)}
              title="Change layout"
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em' }}>
                {LAYOUTS[activeLayoutId]?.label || '—'} ▾
              </span>
            </button>
            <div className="tool-divider" />
            <span className="tool-label">theme</span>
            {THEMES.map(t => (
              <button
                key={t.kind}
                className="tool-btn"
                title={t.label}
                onClick={() => setBackground(t.kind)}
                style={{ width: 22, height: 22, minWidth: 22, padding: 0, border: '1px solid ' + (activeBg.kind === t.kind ? 'var(--accent)' : 'var(--line-2)'), background: t.swatch, borderRadius: '50%', marginLeft: 2 }}
              />
            ))}
            <div style={{ flex: 1 }} />
            <span
              title={saveState === 'saved' ? 'All changes saved' : 'Saving…'}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                letterSpacing: '.1em',
                color: saveState === 'saved' ? 'var(--good)' : 'var(--accent)',
                marginRight: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
              {saveState === 'saved' ? 'saved' : 'saving…'}
            </span>
            {active && (
              <button className="tool-btn" onClick={() => removeSlide(active.id)} title="Delete slide" style={{ color: 'var(--bad)' }}>
                <svg width={13} height={13} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M3 3l8 8M11 3l-8 8" /></svg>
              </button>
            )}
          </div>

          <div className="canvas-stage">
            {active ? (
              <div className="slide-canvas" style={{ padding: 0, overflow: 'hidden' }}>
                <RenderSlide
                  slide={{ ...active, layoutId: activeLayoutId, layout: activeSlots, background: activeBg }}
                  edit={{ onSlotChange: setSlot, onPickImage: setImagePickerSlot }}
                />
              </div>
            ) : (
              <div style={{ color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>No slide selected — press + to add one.</div>
            )}
          </div>

          <div className="narration-bar">
            <span className="nb-label">narration · slide {String(active?.idx ?? '—').padStart(2, '0')}</span>
            <div className="waveform">
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} className="wave-bar" style={{ height: 6 + ((i * 7) % 22) }} />
              ))}
            </div>
            <button className="narration-rec" onClick={() => setTab('recording')}>record</button>
          </div>
        </main>

        <aside className="right-panel">
          <div className="rp-tabs">
            <button className={`rp-tab${tab === 'copilot' ? ' active' : ''}`} onClick={() => setTab('copilot')}>copilot</button>
            <button className={`rp-tab${tab === 'knowledge' ? ' active' : ''}`} onClick={() => setTab('knowledge')}>
              kb<span className="badge">{teller.kbSources.length}</span>
            </button>
            <button className={`rp-tab${tab === 'recording' ? ' active' : ''}`} onClick={() => setTab('recording')}>
              rec<span className="badge">{teller.recordings.length}</span>
            </button>
          </div>

          <div className="rp-content">
            {tab === 'copilot' && (
              <CopilotPanel
                slideId={active?.id}
                slideIdx={active?.idx}
                totalSlides={teller.slides.length}
                slideTitle={active?.title || ''}
                slideSubtitle={active?.subtitle || null}
                onApplyTitle={(html) => applyCopilot({ title: html })}
                onApplySubtitle={(text) => applyCopilot({ subtitle: text })}
                onApplyNotes={(text) => applyCopilot({ notes: text })}
              />
            )}
            {tab === 'knowledge' && <KbPanel tellerId={teller.id} initial={teller.kbSources as any} />}
            {tab === 'recording' && (
              <NarrationPanel
                tellerId={teller.id}
                slides={teller.slides.map(s => ({ id: s.id, idx: s.idx, title: s.title, notes: s.notes }))}
                active={active}
                initialRecordings={teller.recordings as any}
                onNotesChange={n => active && queueSave(active.id, { notes: n })}
              />
            )}
          </div>
        </aside>
      </div>

      {showPicker && (
        <LayoutPicker
          current={activeLayoutId}
          anchorRef={layoutBtnRef}
          onPick={switchLayout}
          onCancel={() => setShowPicker(false)}
        />
      )}

      {imagePickerSlot && (
        <ImagePickerDialog
          tellerId={teller.id}
          onPick={img => { setSlot(imagePickerSlot, img); setImagePickerSlot(null); flashToast('Image updated'); }}
          onClose={() => setImagePickerSlot(null)}
        />
      )}

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </>
  );
}

function ImagePickerDialog({
  tellerId,
  onPick,
  onClose,
}: {
  tellerId: string;
  onPick: (img: { id: string; url: string }) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<SlideImage[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    api<SlideImage[]>(`/tellers/${tellerId}/images`).then(setItems).catch(() => setItems([]));
  }, [tellerId]);

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) { alert('Image > 10 MB — choose a smaller file.'); return; }
    setUploading(true);
    try {
      const up = await api<{ id: string; uploadUrl: string; method: string; headers: Record<string, string>; url: string }>(
        `/tellers/${tellerId}/images/upload-url`,
        { method: 'POST', json: { name: file.name, mime: file.type, bytes: file.size } },
      );
      await fetch(up.uploadUrl, { method: up.method, body: file, headers: up.headers });
      onPick({ id: up.id, url: up.url });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(12,13,15,.9)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: 900, width: '100%', background: 'var(--panel)', border: '1px solid var(--line-2)', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}>
            Image library <span className="note" style={{ marginLeft: 8 }}>— {items?.length ?? 0}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload new'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
        {!items && <div className="note">Loading…</div>}
        {items && items.length === 0 && <p className="note">No images yet — upload one.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {(items || []).map(i => (
            <button
              key={i.id}
              onClick={() => onPick({ id: i.id, url: i.url })}
              style={{ padding: 0, border: '1px solid var(--line)', background: `url(${i.url}) center/cover`, aspectRatio: '16/10', cursor: 'pointer' }}
              title={i.name}
            />
          ))}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
        />
      </div>
    </div>
  );
}
