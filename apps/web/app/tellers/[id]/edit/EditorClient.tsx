'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface Slide {
  id: string;
  idx: number;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  notes: string | null;
}

interface Teller {
  id: string;
  title: string;
  slides: Slide[];
  kbSources: any[];
  recordings: any[];
}

export function EditorClient({ teller: initial }: { teller: Teller }) {
  const [teller, setTeller] = useState<Teller>(initial);
  const [activeId, setActiveId] = useState(initial.slides[0]?.id);
  const active = teller.slides.find(s => s.id === activeId);

  async function save(slideId: string, patch: Partial<Slide>) {
    setTeller(t => ({
      ...t,
      slides: t.slides.map(s => (s.id === slideId ? { ...s, ...patch } : s)),
    }));
    try {
      await api(`/slides/${slideId}`, { method: 'PATCH', json: patch });
    } catch {}
  }

  async function addSlide() {
    const s = await api<Slide>(`/tellers/${teller.id}/slides`, { method: 'POST' });
    setTeller(t => ({ ...t, slides: [...t.slides, s] }));
    setActiveId(s.id);
  }

  async function removeSlide(id: string) {
    if (!confirm('Delete slide?')) return;
    await api(`/slides/${id}`, { method: 'DELETE' });
    setTeller(t => ({ ...t, slides: t.slides.filter(s => s.id !== id).map((s, i) => ({ ...s, idx: i + 1 })) }));
  }

  async function copilot(kind: 'rewrite' | 'tighten' | 'narration' | 'structure') {
    if (!active) return;
    const r = await api<{ suggestion: string }>('/agent/copilot', { method: 'POST', json: { kind, slideId: active.id } });
    if (kind === 'rewrite' || kind === 'structure') {
      const [newTitle, newSub] = r.suggestion.split('|').map(s => s.trim());
      if (newTitle) save(active.id, { title: newTitle, subtitle: newSub || active.subtitle });
    } else if (kind === 'tighten') {
      save(active.id, { subtitle: r.suggestion.trim() });
    } else {
      save(active.id, { notes: r.suggestion.trim() });
    }
  }

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '260px 1fr 340px', minHeight: 'calc(100vh - 58px)', position: 'relative', zIndex: 3 }}>
      {/* Sidebar: slides list */}
      <aside style={{ borderRight: '1px solid var(--line)', padding: 14, overflowY: 'auto' }}>
        <div className="note" style={{ marginBottom: 12, padding: '0 6px' }}>Slides · {teller.slides.length}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {teller.slides.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              style={{
                textAlign: 'left', padding: 12, cursor: 'pointer',
                background: s.id === activeId ? 'rgba(244,185,66,.08)' : 'var(--panel)',
                border: '1px solid ' + (s.id === activeId ? 'rgba(244,185,66,.3)' : 'var(--line)'),
                color: 'var(--ink)', borderRadius: 2,
              }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 4 }}>
                {String(s.idx).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                dangerouslySetInnerHTML={{ __html: s.title }} />
            </button>
          ))}
        </div>
        <button onClick={addSlide} className="btn btn-ghost" style={{ width: '100%', marginTop: 10 }}>+ Add slide</button>
      </aside>

      {/* Canvas */}
      <section style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {!active ? (
          <p className="note">No slide selected.</p>
        ) : (
          <>
            <div className="panel" style={{ padding: 60, aspectRatio: '16/9', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.15em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 24 }}>
                {active.eyebrow}
              </div>
              <h2
                contentEditable suppressContentEditableWarning
                onBlur={e => save(active.id, { title: e.currentTarget.innerHTML })}
                style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 56, letterSpacing: '-.03em', lineHeight: 1.05, outline: 'none' }}
                dangerouslySetInnerHTML={{ __html: active.title }}
              />
              <p
                contentEditable suppressContentEditableWarning
                onBlur={e => save(active.id, { subtitle: e.currentTarget.innerText })}
                style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 20, color: 'var(--ink-2)', marginTop: 20, lineHeight: 1.45, outline: 'none' }}
              >
                {active.subtitle}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => copilot('rewrite')}>✦ Rewrite title + subtitle</button>
              <button className="btn btn-ghost btn-sm" onClick={() => copilot('tighten')}>Tighten subtitle</button>
              <button className="btn btn-ghost btn-sm" onClick={() => copilot('narration')}>Generate narration</button>
              <button className="btn btn-ghost btn-sm" onClick={() => copilot('structure')}>Suggest new slide</button>
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', color: 'var(--bad)' }} onClick={() => removeSlide(active.id)}>Delete slide</button>
            </div>
          </>
        )}
      </section>

      {/* Right panel: narration + KB */}
      <aside style={{ borderLeft: '1px solid var(--line)', padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <NarrationPanel teller={teller} active={active} onUpdate={patch => active && save(active.id, patch)} />
        <KBPanel tellerId={teller.id} initial={teller.kbSources} />
      </aside>
    </main>
  );
}

function NarrationPanel({ teller, active, onUpdate }: any) {
  const [recording, setRecording] = useState(false);
  const chunks = useRef<Blob[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = e => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        const up = await api<{ id: string; uploadUrl: string; method: string; headers: any }>(
          '/recordings/upload-url', { method: 'POST', json: { tellerId: teller.id, slideId: active?.id, mode: 'voice', contentType: blob.type } },
        );
        await fetch(up.uploadUrl, { method: up.method, body: blob, headers: up.headers });
        await api(`/recordings/${up.id}/confirm`, { method: 'POST', json: { sizeBytes: blob.size, durationMs: 0 } });
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      alert('Mic permission denied.');
    }
  }

  function stop() {
    recRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="panel" style={{ padding: 16 }}>
      <header className="section-head" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 14 }}><span className="num">R</span>Narration</h2>
      </header>
      <button className={`btn ${recording ? 'btn-primary' : 'btn-ghost'}`} onClick={recording ? stop : start} style={{ width: '100%' }}>
        {recording ? '● Stop recording' : '⏺ Record slide narration'}
      </button>
      <div className="note" style={{ marginTop: 10 }}>
        Browser-native MediaRecorder → confirmed upload. In prod, transcode + Whisper transcript run in the queue.
      </div>
      <textarea
        defaultValue={active?.notes || ''}
        onBlur={e => onUpdate({ notes: e.target.value })}
        placeholder="Speaker notes…"
        className="field-input"
        style={{ marginTop: 12, minHeight: 90, fontFamily: 'var(--serif)', fontStyle: 'italic' }}
      />
    </div>
  );
}

function KBPanel({ tellerId, initial }: { tellerId: string; initial: any[] }) {
  const [items, setItems] = useState<any[]>(initial || []);
  const [url, setUrl] = useState('');

  async function addUrl() {
    if (!url.trim()) return;
    const r = await api(`/tellers/${tellerId}/kb`, { method: 'POST', json: { url: url.trim(), kind: 'url', name: url } });
    setItems(xs => [r, ...xs]);
    setUrl('');
  }

  async function remove(id: string) {
    await api(`/kb/${id}`, { method: 'DELETE' });
    setItems(xs => xs.filter(x => x.id !== id));
  }

  return (
    <div className="panel" style={{ padding: 16 }}>
      <header className="section-head" style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 14 }}><span className="num">K</span>Knowledge base</h2>
      </header>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input value={url} onChange={e => setUrl(e.target.value)} className="field-input" placeholder="https://…" style={{ fontSize: 12 }} />
        <button className="btn btn-ghost btn-sm" onClick={addUrl}>Add URL</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(k => (
          <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, border: '1px solid var(--line)', background: 'var(--panel-2)' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.name}</div>
              <div className="note">
                {k.kind.toUpperCase()} · {k.indexed ? 'indexed' : 'indexing…'}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => remove(k.id)}>×</button>
          </div>
        ))}
        {items.length === 0 && <p className="note">No sources yet — the agent will only cite slides & narration.</p>}
      </div>
    </div>
  );
}
