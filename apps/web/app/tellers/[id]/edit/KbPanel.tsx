'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';

interface KbItem { id: string; kind: string; name: string; bytes?: number | null; indexed: boolean; }

function iconFor(kind: string) {
  const k = (kind || '').toLowerCase();
  if (k === 'pdf') return 'pdf';
  if (k === 'xlsx' || k === 'csv' || k === 'xls') return 'xlsx';
  if (k === 'url') return 'url';
  return 'doc';
}

export function KbPanel({ tellerId, initial }: { tellerId: string; initial: KbItem[] }) {
  const [items, setItems] = useState<KbItem[]>(initial || []);
  const [url, setUrl] = useState('');
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addFile(file: File) {
    const ext = file.name.split('.').pop() || 'doc';
    const rec = await api<KbItem>(`/tellers/${tellerId}/kb`, {
      method: 'POST',
      json: { kind: iconFor(ext), name: file.name, bytes: file.size },
    });
    setItems(xs => [rec, ...xs]);
  }

  async function addUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    const r = await api<KbItem>(`/tellers/${tellerId}/kb`, {
      method: 'POST',
      json: { url: url.trim(), kind: 'url', name: url.trim() },
    });
    setItems(xs => [r, ...xs]);
    setUrl('');
  }

  async function removeItem(id: string) {
    await api(`/kb/${id}`, { method: 'DELETE' });
    setItems(xs => xs.filter(x => x.id !== id));
  }

  return (
    <>
      <p className="kb-intro">
        Feed the agent. Anything dropped here becomes <em>context</em> — the agent can answer viewer questions using these sources, and you can cite them in suggestions.
      </p>

      <div
        className={`kb-dropzone${drag ? ' drag' : ''}`}
        onClick={() => fileRef.current?.click()}
        onDragEnter={e => { e.preventDefault(); setDrag(true); }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); Array.from(e.dataTransfer.files).forEach(addFile); }}
      >
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth={1.2}><path d="M12 3v12M6 9l6-6 6 6M3 21h18" /></svg>
        <div className="kb-title">Drop files or click to upload</div>
        <div className="kb-sub">PDF · DOCX · CSV · XLSX · TXT · MD</div>
        <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => { Array.from(e.target.files || []).forEach(addFile); e.target.value = ''; }} />
      </div>

      <form onSubmit={addUrl} style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        <input type="url" value={url} onChange={e => setUrl(e.target.value)} className="field-input" placeholder="https://docs.example.com/…" style={{ padding: '7px 10px', fontSize: 12 }} />
        <button className="btn btn-sm" type="submit">Add URL</button>
      </form>

      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 10 }}>
        {items.length} {items.length === 1 ? 'source' : 'sources'}
      </div>
      <div className="kb-list">
        {items.map(k => (
          <div key={k.id} className="kb-item">
            <div className={`kb-icon ${iconFor(k.kind)}`}>{(k.kind || 'doc').slice(0, 3).toUpperCase()}</div>
            <div className="kb-info">
              <div className="kb-name">{k.name}</div>
              <div className="kb-meta">
                {k.bytes ? `${Math.round(k.bytes / 1024)} KB · ` : ''}{k.kind}
              </div>
            </div>
            <span className={`kb-status${k.indexed ? '' : ' indexing'}`}>{k.indexed ? 'indexed' : 'indexing…'}</span>
            <button className="kb-delete" onClick={() => removeItem(k.id)} aria-label="Delete">×</button>
          </div>
        ))}
        {items.length === 0 && <p className="note">No sources yet — the agent will only cite slides &amp; narration.</p>}
      </div>

      <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 10 }}>
          agent scope
        </div>
        {[
          { label: 'Let viewers ask the agent', checked: true },
          { label: 'Answer using knowledge base', checked: true },
          { label: 'Answer using external web', checked: false },
          { label: 'Always show slide citations', checked: true },
        ].map((r, i) => (
          <label key={i} className="toggle" style={{ marginBottom: 10 }}>
            <input type="checkbox" defaultChecked={r.checked} />
            <span className="toggle-sw" />
            <span style={{ fontSize: 13 }}>{r.label}</span>
          </label>
        ))}
      </div>
    </>
  );
}
