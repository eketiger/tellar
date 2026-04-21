'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '@/lib/api';
import { NarrationPanel } from './NarrationPanel';
import { NotesPanel } from './NotesPanel';
import { KbPanel } from './KbPanel';
import { CopilotPanel } from './CopilotPanel';
import { LayoutPicker } from './LayoutPicker';
import { PresentMode } from './PresentMode';
import { MarkdownImport, type ParsedSlide } from './MarkdownImport';
import { GradientPicker } from './GradientPicker';
import { LAYOUTS, RenderSlide, type Background, type BackgroundKind } from '@/lib/slide-layouts';
import './editor.css';

interface Slide {
  id: string;
  idx: number;
  layoutId?: string;
  background?: Background | null;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  notes: string | null;
  layout?: Record<string, any> | null; // the slots bag
}
interface Teller { id: string; title: string; slides: Slide[]; kbSources: any[]; recordings: any[]; }

type Tab = 'copilot' | 'knowledge' | 'recording' | 'notes';

interface SlideImage { id: string; name: string; url: string; }

/** One reversible edit. PATCH kind stores the forward patch + its inverse.
 *  DUPLICATE kind just remembers the duplicate's id so undo can delete it. */
type HistoryEntry =
  | {
      kind: 'patch';
      slideId: string;
      patch: Partial<Slide> & { layout?: any };
      inverse: Partial<Slide> & { layout?: any };
    }
  | { kind: 'duplicate'; newSlideId: string }
  | { kind: 'reorder'; prevOrder: string[] }
  | { kind: 'bulkBg'; before: Array<{ slideId: string; background: any }>; next: any };

const HISTORY_LIMIT = 80;
const COALESCE_MS = 600;

/** Extract the values in `slide` for the keys being patched, so we can undo. */
function inverseOf(slide: Slide | undefined, patch: Record<string, any>): Record<string, any> {
  if (!slide) return {};
  const inv: Record<string, any> = {};
  for (const k of Object.keys(patch)) {
    inv[k] = (slide as any)[k] ?? null;
  }
  return inv;
}

function targetIsEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

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
  const [presenting, setPresenting] = useState(false);
  const [importingMd, setImportingMd] = useState(false);
  const [showGradient, setShowGradient] = useState(false);
  const gradientBtnRef = useRef<HTMLButtonElement | null>(null);
  const layoutBtnRef = useRef<HTMLButtonElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Undo/redo stacks of inverse patches. Coalesce same-slide+same-keys bursts
  // within 600ms so rapid typing sessions count as one history entry.
  const undoStackRef = useRef<HistoryEntry[]>([]);
  const redoStackRef = useRef<HistoryEntry[]>([]);
  const lastPushRef = useRef<{ slideId: string; keys: string; at: number } | null>(null);
  // Slot-level clipboard (⌘⇧C / ⌘⇧V). Separate from the OS text clipboard so
  // the user's in-page text selection keeps behaving normally.
  const slotClipboardRef = useRef<{ name: string; value: any } | null>(null);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;
    const ids = teller.slides.map(s => s.id);
    const from = ids.indexOf(String(dragged.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    reorderSlides(arrayMove(ids, from, to));
  }

  const active = teller.slides.find(s => s.id === activeId);
  const activeLayoutId = active?.layoutId || 'headline';
  const activeBg = active?.background || { kind: LAYOUTS[activeLayoutId]?.defaultBg || 'cream' };
  const activeSlots = active ? resolveSlotsFromSlide(active) : {};

  function flashToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 1600); }

  function currentSlotName(): string | null {
    const el = document.activeElement as HTMLElement | null;
    return el?.getAttribute('data-slot-name') || null;
  }

  function copySlot() {
    const name = currentSlotName();
    if (!name || !active) { flashToast('Click a slot first'); return; }
    const value = activeSlots[name];
    if (value == null || value === '') { flashToast(`${name} is empty`); return; }
    slotClipboardRef.current = { name, value };
    flashToast(`Copied ${name}`);
  }

  function pasteSlot() {
    const clip = slotClipboardRef.current;
    if (!clip) { flashToast('Nothing copied'); return; }
    if (!active) return;
    const layout = LAYOUTS[activeLayoutId];
    if (!layout.slots[clip.name]) {
      flashToast(`This layout has no "${clip.name}" slot`);
      return;
    }
    setSlot(clip.name, clip.value);
    flashToast(`Pasted ${clip.name}`);
  }

  // Global Cmd+Z / Cmd+Shift+Z (or Cmd+Y) → undo/redo.
  // While the user is actively typing in a contentEditable/input, let the
  // browser handle its own native undo first — our stack still captures the
  // final value on blur, so we don't lose anything.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const editable = targetIsEditable(e.target);
      // Escape blurs the current slot so you can navigate without clicking out.
      if (e.key === 'Escape' && editable) {
        (e.target as HTMLElement).blur();
        return;
      }
      if (mod) {
        const k = e.key.toLowerCase();
        // ⌘⇧C / ⌘⇧V work even while a slot is focused — that's the whole
        // point: copy what you're editing, move to another slide, paste.
        if (e.shiftKey && k === 'c') {
          e.preventDefault();
          copySlot();
          return;
        }
        if (e.shiftKey && k === 'v') {
          e.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur?.();
          pasteSlot();
          return;
        }
        if (editable) return;
        if (k === 'z' || k === 'y') {
          e.preventDefault();
          if (k === 'y' || (k === 'z' && e.shiftKey)) redo();
          else undo();
          return;
        }
        if (k === 'd' && !e.shiftKey) {
          e.preventDefault();
          if (activeId) duplicateSlide(activeId);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          setPresenting(true);
          return;
        }
        return;
      }
      // Unmodified nav keys — only fire when the user isn't typing.
      if (editable) return;
      const ids = teller.slides.map(s => s.id);
      const cur = activeId ? ids.indexOf(activeId) : -1;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j') {
        const nextIdx = cur < 0 ? 0 : Math.min(ids.length - 1, cur + 1);
        if (ids[nextIdx]) { e.preventDefault(); setActiveId(ids[nextIdx]); }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k') {
        const nextIdx = cur < 0 ? 0 : Math.max(0, cur - 1);
        if (ids[nextIdx]) { e.preventDefault(); setActiveId(ids[nextIdx]); }
      } else if (e.key === 'Home') {
        if (ids[0]) { e.preventDefault(); setActiveId(ids[0]); }
      } else if (e.key === 'End') {
        if (ids[ids.length - 1]) { e.preventDefault(); setActiveId(ids[ids.length - 1]); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // undo/redo close over teller via queueSave; re-bind on teller change is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teller, activeId]);

  function queueSave(slideId: string, patch: Partial<Slide> & { layout?: any }, opts: { trackHistory?: boolean } = {}) {
    const trackHistory = opts.trackHistory !== false;
    if (trackHistory) {
      const before = teller.slides.find(s => s.id === slideId);
      const inverse = inverseOf(before, patch);
      const keys = Object.keys(patch).sort().join(',');
      const now = Date.now();
      const last = lastPushRef.current;
      // Coalesce rapid edits on the same slide+fields into the same history entry.
      const canCoalesce = last && last.slideId === slideId && last.keys === keys && (now - last.at) < COALESCE_MS;
      if (!canCoalesce) {
        undoStackRef.current.push({ kind: 'patch', slideId, patch, inverse });
        if (undoStackRef.current.length > HISTORY_LIMIT) undoStackRef.current.shift();
        redoStackRef.current = [];
      } else {
        // Update forward patch so redo reflects the latest value.
        const top = undoStackRef.current[undoStackRef.current.length - 1];
        if (top && top.kind === 'patch') top.patch = { ...top.patch, ...patch };
      }
      lastPushRef.current = { slideId, keys, at: now };
    }
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

  async function undo() {
    const entry = undoStackRef.current.pop();
    if (!entry) { flashToast('Nothing to undo'); return; }
    redoStackRef.current.push(entry);
    lastPushRef.current = null;
    if (entry.kind === 'patch') {
      queueSave(entry.slideId, entry.inverse, { trackHistory: false });
      if (entry.slideId !== activeId) setActiveId(entry.slideId);
    } else if (entry.kind === 'duplicate') {
      await api(`/slides/${entry.newSlideId}`, { method: 'DELETE' });
      setTeller(t => {
        const next = t.slides.filter(s => s.id !== entry.newSlideId).map((s, i) => ({ ...s, idx: i + 1 }));
        if (activeId === entry.newSlideId) setActiveId(next[0]?.id);
        return { ...t, slides: next };
      });
    } else if (entry.kind === 'reorder') {
      await applyReorderSwap(entry);
    } else if (entry.kind === 'bulkBg') {
      applyBulkBg(entry.before);
    }
    flashToast('Undo');
  }

  async function applyReorderSwap(entry: { kind: 'reorder'; prevOrder: string[] }) {
    const currentOrder = teller.slides.map(s => s.id);
    const targetOrder = entry.prevOrder;
    entry.prevOrder = currentOrder; // swap so the next call flips back
    setTeller(t => {
      const byId = new Map(t.slides.map(s => [s.id, s]));
      const next = targetOrder.map((id, i) => ({ ...(byId.get(id) as Slide), idx: i + 1 }));
      return { ...t, slides: next };
    });
    await api(`/tellers/${teller.id}/slides/reorder`, { method: 'POST', json: { ids: targetOrder } }).catch(() => {});
  }

  async function redo() {
    const entry = redoStackRef.current.pop();
    if (!entry) { flashToast('Nothing to redo'); return; }
    undoStackRef.current.push(entry);
    lastPushRef.current = null;
    if (entry.kind === 'patch') {
      queueSave(entry.slideId, entry.patch, { trackHistory: false });
      if (entry.slideId !== activeId) setActiveId(entry.slideId);
    } else if (entry.kind === 'duplicate') {
      // Re-duplication by id is lossy (server mints a new id). Drop the redo
      // by not pushing it again — keeps us honest rather than silently wrong.
      undoStackRef.current.pop();
      flashToast('Cannot redo duplicate — please run again');
      return;
    } else if (entry.kind === 'reorder') {
      await applyReorderSwap(entry);
    } else if (entry.kind === 'bulkBg') {
      // Re-apply the forward op: every slide gets entry.next.
      const entries = entry.before.map(e => ({ slideId: e.slideId, background: entry.next }));
      applyBulkBg(entries);
    }
    flashToast('Redo');
  }

  async function addSlide(layoutId: string = 'headline') {
    const s = await api<Slide>(`/tellers/${teller.id}/slides`, { method: 'POST' });
    const created = { ...s, layoutId, background: { kind: LAYOUTS[layoutId]?.defaultBg || 'cream' }, layout: {} };
    setTeller(t => ({ ...t, slides: [...t.slides, created] }));
    setActiveId(created.id);
    await api(`/slides/${created.id}`, { method: 'PATCH', json: { layoutId, background: created.background } });
    flashToast(`${LAYOUTS[layoutId]?.label || 'Slide'} added`);
  }

  async function importMarkdownSlides(parsed: ParsedSlide[]) {
    if (!parsed.length) return;
    const created: Slide[] = [];
    for (const spec of parsed) {
      const s = await api<Slide>(`/tellers/${teller.id}/slides`, { method: 'POST' });
      const layoutMeta = LAYOUTS[spec.layoutId] || LAYOUTS.headline;
      const bg = { kind: layoutMeta.defaultBg };
      const patch = {
        layoutId: spec.layoutId,
        layout: spec.slots,
        title: spec.slots.title || '',
        subtitle: spec.slots.subtitle ?? null,
        eyebrow: spec.slots.eyebrow ?? null,
        background: bg,
      };
      await api(`/slides/${s.id}`, { method: 'PATCH', json: patch });
      created.push({ ...s, ...patch });
    }
    setTeller(t => ({ ...t, slides: [...t.slides, ...created] }));
    if (created[0]) setActiveId(created[0].id);
    setImportingMd(false);
    flashToast(`${parsed.length} slide${parsed.length === 1 ? '' : 's'} imported`);
  }

  async function reorderSlides(newOrder: string[]) {
    const prevOrder = teller.slides.map(s => s.id);
    if (prevOrder.join('|') === newOrder.join('|')) return;
    // Optimistic reindex.
    setTeller(t => {
      const byId = new Map(t.slides.map(s => [s.id, s]));
      const next = newOrder.map((id, i) => ({ ...(byId.get(id) as Slide), idx: i + 1 }));
      return { ...t, slides: next };
    });
    undoStackRef.current.push({ kind: 'reorder', prevOrder });
    if (undoStackRef.current.length > HISTORY_LIMIT) undoStackRef.current.shift();
    redoStackRef.current = [];
    lastPushRef.current = null;
    try {
      await api(`/tellers/${teller.id}/slides/reorder`, { method: 'POST', json: { ids: newOrder } });
      flashToast('Reordered');
    } catch {
      // Roll back on failure.
      setTeller(t => {
        const byId = new Map(t.slides.map(s => [s.id, s]));
        const next = prevOrder.map((id, i) => ({ ...(byId.get(id) as Slide), idx: i + 1 }));
        return { ...t, slides: next };
      });
      flashToast('Reorder failed');
    }
  }

  async function duplicateSlide(id: string) {
    const src = teller.slides.find(s => s.id === id);
    if (!src) return;
    const copy = await api<Slide>(`/slides/${id}/duplicate`, { method: 'POST' });
    const hydrated: Slide = { ...copy, layoutId: copy.layoutId || src.layoutId };
    setTeller(t => {
      const bumped = t.slides.map(s => (s.idx >= hydrated.idx ? { ...s, idx: s.idx + 1 } : s));
      // The server already bumped + inserted; we rebuild slides from scratch ordered by idx.
      const next = [...bumped.filter(s => s.id !== hydrated.id), hydrated].sort((a, b) => a.idx - b.idx);
      // Normalise idx in case the optimistic bump drifted.
      return { ...t, slides: next.map((s, i) => ({ ...s, idx: i + 1 })) };
    });
    setActiveId(hydrated.id);
    undoStackRef.current.push({ kind: 'duplicate', newSlideId: hydrated.id });
    if (undoStackRef.current.length > HISTORY_LIMIT) undoStackRef.current.shift();
    redoStackRef.current = [];
    lastPushRef.current = null;
    flashToast('Slide duplicated');
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

  function setGradientBackground(bg: Background) {
    if (!active) return;
    queueSave(active.id, { background: bg });
  }

  function applyThemeToAll(kind: BackgroundKind) {
    const nextBg = { kind };
    const before = teller.slides.map(s => ({ slideId: s.id, background: s.background ?? null }));
    undoStackRef.current.push({ kind: 'bulkBg', before, next: nextBg });
    if (undoStackRef.current.length > HISTORY_LIMIT) undoStackRef.current.shift();
    redoStackRef.current = [];
    lastPushRef.current = null;
    setTeller(t => ({ ...t, slides: t.slides.map(s => ({ ...s, background: nextBg })) }));
    setSaveState('saving');
    Promise.all(teller.slides.map(s =>
      api(`/slides/${s.id}`, { method: 'PATCH', json: { background: nextBg } }),
    )).finally(() => setSaveState('saved'));
    flashToast(`Theme → whole deck`);
  }

  function applyBulkBg(entries: Array<{ slideId: string; background: any }>) {
    setTeller(t => ({
      ...t,
      slides: t.slides.map(s => {
        const m = entries.find(e => e.slideId === s.id);
        return m ? { ...s, background: m.background } : s;
      }),
    }));
    setSaveState('saving');
    Promise.all(entries.map(e =>
      api(`/slides/${e.slideId}`, { method: 'PATCH', json: { background: e.background ?? { kind: 'cream' } } }),
    )).finally(() => setSaveState('saved'));
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
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setImportingMd(true)} title="Import from markdown" style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.1em', padding: '0 6px', width: 'auto', borderRadius: 2 }}>md</button>
              <button onClick={() => addSlide()} title="Add slide">+</button>
            </div>
          </div>
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={teller.slides.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div>
                {teller.slides.map(s => (
                  <SortableSlideThumb
                    key={s.id}
                    slide={thumbSlide(s)}
                    isActive={s.id === activeId}
                    hasRec={teller.recordings.some((r: any) => r.slideId === s.id)}
                    canDelete={teller.slides.length > 1}
                    onSelect={() => setActiveId(s.id)}
                    onDelete={() => removeSlide(s.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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
                title={`${t.label} — click: this slide · shift+click: whole deck`}
                onClick={e => (e.shiftKey ? applyThemeToAll(t.kind) : setBackground(t.kind))}
                style={{ width: 22, height: 22, minWidth: 22, padding: 0, border: '1px solid ' + (activeBg.kind === t.kind ? 'var(--accent)' : 'var(--line-2)'), background: t.swatch, borderRadius: '50%', marginLeft: 2 }}
              />
            ))}
            <button
              ref={gradientBtnRef}
              className={`tool-btn${showGradient ? ' active' : ''}`}
              title="Gradient background"
              onClick={() => setShowGradient(p => !p)}
              style={{
                width: 22, height: 22, minWidth: 22, padding: 0,
                border: '1px solid ' + (activeBg.kind === 'gradient' ? 'var(--accent)' : 'var(--line-2)'),
                borderRadius: '50%',
                marginLeft: 2,
                background: `linear-gradient(135deg, ${activeBg.from || '#c89a3a'}, ${activeBg.to || '#0c1220'})`,
              }}
            />
            <button
              className="tool-btn"
              title="Apply current theme to every slide"
              onClick={() => applyThemeToAll((activeBg.kind || 'cream') as BackgroundKind)}
              style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.15em', marginLeft: 6, textTransform: 'uppercase', padding: '0 8px', height: 22 }}
            >
              apply all
            </button>
            <div style={{ flex: 1 }} />
            <button
              className="tool-btn"
              title="Present (⌘Enter)"
              onClick={() => setPresenting(true)}
              style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', padding: '0 10px', height: 24, textTransform: 'uppercase', border: '1px solid var(--line-2)', color: 'var(--accent)', marginRight: 10 }}
            >
              ▶ present
            </button>
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
            <button className={`rp-tab${tab === 'notes' ? ' active' : ''}`} onClick={() => setTab('notes')}>notes</button>
            <button className={`rp-tab${tab === 'knowledge' ? ' active' : ''}`} onClick={() => setTab('knowledge')}>
              kb<span className="badge">{teller.kbSources.length}</span>
            </button>
            <button className={`rp-tab${tab === 'recording' ? ' active' : ''}`} onClick={() => setTab('recording')}>
              rec<span className="badge">{teller.recordings.length}</span>
            </button>
          </div>

          <div className="rp-content">
            {tab === 'notes' && (
              <NotesPanel
                slide={active}
                totalSlides={teller.slides.length}
                onChange={(notes) => active && queueSave(active.id, { notes })}
              />
            )}
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
                onSelectSlide={setActiveId}
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

      {presenting && (
        <PresentMode
          slides={teller.slides}
          startIndex={Math.max(0, teller.slides.findIndex(s => s.id === activeId))}
          onClose={() => setPresenting(false)}
        />
      )}

      {importingMd && (
        <MarkdownImport onImport={importMarkdownSlides} onClose={() => setImportingMd(false)} />
      )}

      {showGradient && (
        <GradientPicker
          value={activeBg.kind === 'gradient' ? activeBg as Background : undefined}
          anchorRef={gradientBtnRef}
          onChange={setGradientBackground}
          onCancel={() => setShowGradient(false)}
        />
      )}

      <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
    </>
  );
}

function SortableSlideThumb({
  slide,
  isActive,
  hasRec,
  canDelete,
  onSelect,
  onDelete,
}: {
  slide: Slide;
  isActive: boolean;
  hasRec: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`slide-thumb${isActive ? ' active' : ''}${isDragging ? ' dragging' : ''}`}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      <div className="st-num">{String(slide.idx).padStart(2, '0')}</div>
      <div className="st-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ transform: 'scale(0.12)', transformOrigin: 'top left', width: '833%', height: '833%' }}>
          <RenderSlide slide={slide} />
        </div>
        {hasRec && <span className="st-rec-badge" />}
      </div>
      {canDelete && (
        <button
          className="slide-thumb-del"
          title="Delete slide"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onDelete(); }}
        >
          <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.4}>
            <path d="M2 2l6 6M8 2l-6 6" />
          </svg>
        </button>
      )}
    </div>
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
