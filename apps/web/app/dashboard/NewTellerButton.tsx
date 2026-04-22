'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export function NewTellerButton() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const t = await api<{ id: string }>('/tellers', { method: 'POST', json: { title: title.trim() } });
      router.push(`/tellers/${t.id}/edit`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>+ New tellar</button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(12,13,15,.85)', backdropFilter: 'blur(6px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}
        >
          <div onClick={e => e.stopPropagation()} className="panel" style={{ maxWidth: 480, width: '100%' }}>
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            <h3 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginBottom: 18 }}>
              New <em style={{ color: 'var(--accent)' }}>tellar</em>
            </h3>
            <div className="field">
              <label className="field-label">Working title</label>
              <input
                autoFocus
                className="field-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && create()}
                placeholder="e.g. Q3 board update"
              />
            </div>
            <p className="note" style={{ marginBottom: 18, lineHeight: 1.6 }}>
              A new tellar starts empty. You can import slides, record narration, and share it — all from the editor.
            </p>
            <div style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 12,
              border: '1px dashed var(--line-2)',
              background: 'var(--panel-2)',
              marginBottom: 14,
            }}>
              <div>
                <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink)' }}>
                  Or start from a <em style={{ color: 'var(--accent)' }}>template</em>.
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.08em' }}>
                  10 YC-inspired decks · Series A, sales, investor update…
                </div>
              </div>
              <Link href="/templates" className="btn btn-ghost btn-sm">Browse →</Link>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={create}>
                {busy ? '…' : 'Create blank & open editor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
