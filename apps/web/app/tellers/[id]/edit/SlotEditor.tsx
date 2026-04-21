'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { sanitizeSlideHtml } from '@/lib/sanitize';
import { LAYOUTS, type SlotKind } from '@/lib/slide-layouts';

interface SlideImage { id: string; name: string; url: string; }

export function SlotEditor({
  tellerId,
  slideId,
  layoutId,
  slots,
  onChange,
}: {
  tellerId: string;
  slideId: string;
  layoutId: string;
  slots: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}) {
  const layout = LAYOUTS[layoutId] || LAYOUTS.headline;
  const slotDefs = Object.entries(layout.slots) as [string, SlotKind][];
  const [showImagePicker, setShowImagePicker] = useState<string | null>(null);

  function setSlot(name: string, value: any) {
    onChange({ ...slots, [name]: value });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {slotDefs.map(([name, kind]) => (
        <div key={name}>
          <label style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
            {humanize(name)}
          </label>
          {kind === 'text' && (
            <TextInput
              value={String(slots[name] ?? '')}
              placeholder={placeholderFor(name)}
              onChange={v => setSlot(name, v)}
              multiline={isMultilineSlot(name)}
            />
          )}
          {kind === 'text[]' && name === 'items'
            ? <GridItemsEditor tellerId={tellerId} items={slots[name] || []} onChange={v => setSlot(name, v)} />
            : kind === 'text[]' && (
              <ListInput
                values={Array.isArray(slots[name]) ? slots[name] : []}
                onChange={v => setSlot(name, v)}
                max={name === 'bullets' ? 6 : 5}
              />
            )}
          {kind === 'image' && (
            <ImageSlot
              tellerId={tellerId}
              value={slots[name]}
              onChange={v => setSlot(name, v)}
              onOpenPicker={() => setShowImagePicker(name)}
            />
          )}
        </div>
      ))}

      {showImagePicker && (
        <ImagePickerModal
          tellerId={tellerId}
          onPick={img => { setSlot(showImagePicker, img); setShowImagePicker(null); }}
          onClose={() => setShowImagePicker(null)}
        />
      )}
    </div>
  );
}

function humanize(s: string) { return s.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()); }
function isMultilineSlot(name: string) { return ['subtitle', 'body', 'caption', 'leftBody', 'rightBody', 'quote'].includes(name); }
function placeholderFor(name: string) {
  const pl: Record<string, string> = {
    eyebrow: 'slide 04 / the market',
    title: 'Your headline here',
    subtitle: 'A short editorial subtitle.',
    body: 'Body copy…',
    quote: 'The one sentence that matters.',
    author: 'Nora Álvarez',
    role: 'founder, Kova',
    prefix: '$',
    number: '1.4',
    unit: 'M ARR',
    caption: 'Short caption',
  };
  return pl[name] || '';
}

function TextInput({ value, placeholder, multiline, onChange }: { value: string; placeholder?: string; multiline?: boolean; onChange: (v: string) => void }) {
  if (multiline) {
    return (
      <textarea
        className="field-input"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{ minHeight: 60, fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13 }}
      />
    );
  }
  return (
    <input
      type="text"
      className="field-input"
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{ fontFamily: 'var(--serif)', fontSize: 14 }}
    />
  );
}

function ListInput({ values, onChange, max }: { values: string[]; onChange: (v: string[]) => void; max: number }) {
  function set(i: number, v: string) { const cp = [...values]; cp[i] = v; onChange(cp); }
  function add() { if (values.length < max) onChange([...values, '']); }
  function remove(i: number) { onChange(values.filter((_, j) => j !== i)); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {values.map((v, i) => (
        <div key={i} style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)', alignSelf: 'center', letterSpacing: '.15em', paddingTop: 6 }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <input
            type="text"
            className="field-input"
            value={v}
            onChange={e => set(i, e.target.value)}
            style={{ fontFamily: 'var(--serif)', fontSize: 13, flex: 1, padding: '6px 10px' }}
          />
          <button className="btn btn-ghost btn-sm" onClick={() => remove(i)} style={{ color: 'var(--bad)' }}>×</button>
        </div>
      ))}
      {values.length < max && (
        <button className="btn btn-ghost btn-sm" onClick={add} style={{ alignSelf: 'flex-start' }}>+ Add line</button>
      )}
      {values.length >= max && <div className="note">max {max}</div>}
    </div>
  );
}

function GridItemsEditor({ tellerId, items, onChange }: { tellerId: string; items: any[]; onChange: (v: any[]) => void }) {
  function setItem(i: number, patch: any) { const cp = [...items]; cp[i] = { ...cp[i], ...patch }; onChange(cp); }
  function add() { if (items.length < 6) onChange([...items, { title: '', body: '' }]); }
  function remove(i: number) { onChange(items.filter((_, j) => j !== i)); }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, i) => (
        <div key={i} style={{ border: '1px solid var(--line)', padding: 10, display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--panel-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', color: 'var(--accent)' }}>
              CARD {String(i + 1).padStart(2, '0')}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => remove(i)} style={{ color: 'var(--bad)' }}>×</button>
          </div>
          <input className="field-input" placeholder="Title" value={it.title || ''} onChange={e => setItem(i, { title: e.target.value })} style={{ fontFamily: 'var(--serif)', fontSize: 14 }} />
          <input className="field-input" placeholder="Role or subtitle" value={it.body || ''} onChange={e => setItem(i, { body: e.target.value })} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
          <ImageSlot
            tellerId={tellerId}
            value={it.image}
            compact
            onChange={img => setItem(i, { image: img })}
          />
        </div>
      ))}
      {items.length < 6 && <button className="btn btn-ghost btn-sm" onClick={add} style={{ alignSelf: 'flex-start' }}>+ Add card</button>}
    </div>
  );
}

export function ImageSlot({
  tellerId, value, compact, onChange, onOpenPicker,
}: {
  tellerId: string;
  value?: { id?: string; url?: string };
  compact?: boolean;
  onChange: (v: { id?: string; url?: string } | null) => void;
  onOpenPicker?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) { alert('Image > 10 MB — choose a smaller file.'); return; }
    setUploading(true);
    try {
      const up = await api<{ id: string; uploadUrl: string; method: string; headers: Record<string, string>; url: string }>(
        `/tellers/${tellerId}/images/upload-url`,
        { method: 'POST', json: { name: file.name, mime: file.type, bytes: file.size } },
      );
      await fetch(up.uploadUrl, { method: up.method, body: file, headers: up.headers });
      onChange({ id: up.id, url: up.url });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          aspectRatio: compact ? '4/3' : '16/10',
          background: value?.url ? `url(${value.url}) center/cover` : 'var(--panel-2)',
          border: '1px dashed ' + (value?.url ? 'var(--line)' : 'var(--line-2)'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase',
        }}
      >
        {uploading ? 'uploading…' : value?.url ? '' : 'no image'}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>Upload</button>
        {onOpenPicker && <button className="btn btn-ghost btn-sm" onClick={onOpenPicker}>Library</button>}
        {value?.url && <button className="btn btn-ghost btn-sm" onClick={() => onChange(null)} style={{ color: 'var(--bad)' }}>Remove</button>}
      </div>
      <input
        ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
      />
    </div>
  );
}

function ImagePickerModal({ tellerId, onPick, onClose }: { tellerId: string; onPick: (img: SlideImage) => void; onClose: () => void }) {
  const [items, setItems] = useState<SlideImage[] | null>(null);
  useEffect(() => {
    api<SlideImage[]>(`/tellers/${tellerId}/images`).then(setItems).catch(() => setItems([]));
  }, [tellerId]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(12,13,15,.9)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: 900, width: '100%', background: 'var(--panel)', border: '1px solid var(--line-2)', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}>
            Image library <span className="note" style={{ marginLeft: 8 }}>— {items?.length ?? 0}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
        {!items && <div className="note">Loading…</div>}
        {items && items.length === 0 && <p className="note">No images uploaded yet for this teller.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {(items || []).map(i => (
            <button key={i.id} onClick={() => onPick(i)} style={{ padding: 0, border: '1px solid var(--line)', background: `url(${i.url}) center/cover`, aspectRatio: '16/10', cursor: 'pointer' }} title={i.name} />
          ))}
        </div>
      </div>
    </div>
  );
}
