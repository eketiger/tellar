'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { sanitizeSlideHtml } from '@/lib/sanitize';

type Kind = 'rewrite' | 'tighten' | 'narration' | 'structure';
interface Suggestion { id: string; kind: Kind; title: string; preview: string; compare?: string; payload: { title?: string; subtitle?: string; notes?: string } }
interface Msg { role: 'user' | 'assistant'; html: string; }

export function CopilotPanel({
  slideId, slideIdx, totalSlides, slideTitle, slideSubtitle,
  onApplyTitle, onApplySubtitle, onApplyNotes,
}: {
  slideId: string | undefined;
  slideIdx: number | undefined;
  totalSlides: number;
  slideTitle: string;
  slideSubtitle: string | null;
  onApplyTitle: (html: string) => void;
  onApplySubtitle: (text: string) => void;
  onApplyNotes: (text: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<Kind | null>(null);

  async function requestSuggestion(kind: Kind) {
    if (!slideId || busy) return;
    setBusy(kind);
    try {
      const r = await api<{ suggestion: string }>('/agent/copilot', { method: 'POST', json: { kind, slideId } });
      const text = r.suggestion.trim();
      const parts = text.split('|').map(p => p.trim());
      let sugg: Suggestion;
      if (kind === 'rewrite' || kind === 'structure') {
        const [newTitle, newSub] = parts;
        sugg = {
          id: `sg_${Date.now()}`,
          kind,
          title: kind === 'rewrite' ? 'Rewrite — punchier, editorial' : 'New slide after this one',
          preview: `${newTitle}${newSub ? `\n— ${newSub}` : ''}`,
          compare: kind === 'rewrite' ? `${String(slideTitle).replace(/<[^>]+>/g, '')} — ${slideSubtitle || ''}` : undefined,
          payload: { title: newTitle, subtitle: newSub },
        };
      } else if (kind === 'tighten') {
        sugg = {
          id: `sg_${Date.now()}`,
          kind,
          title: 'Tighten — more specific',
          preview: text,
          compare: slideSubtitle || undefined,
          payload: { subtitle: text },
        };
      } else {
        sugg = {
          id: `sg_${Date.now()}`,
          kind: 'narration',
          title: '20-second narration draft',
          preview: text,
          payload: { notes: text },
        };
      }
      setSuggestions(xs => [sugg, ...xs].slice(0, 6));
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', html: `Couldn't generate that — ${e?.message ?? 'unknown'}` }]);
    } finally {
      setBusy(null);
    }
  }

  function apply(s: Suggestion) {
    if (s.payload.title) onApplyTitle(s.payload.title);
    if (s.payload.subtitle) onApplySubtitle(s.payload.subtitle);
    if (s.payload.notes) onApplyNotes(s.payload.notes);
    dismiss(s.id);
  }
  function dismiss(id: string) {
    setSuggestions(xs => xs.filter(x => x.id !== id));
  }

  async function sendChat() {
    const q = input.trim(); if (!q || !slideId) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', html: sanitizeSlideHtml(q) }]);
    try {
      const r = await api<{ suggestion: string }>('/agent/copilot', { method: 'POST', json: { kind: 'rewrite', slideId, selectedText: q } });
      setMessages(m => [...m, { role: 'assistant', html: sanitizeSlideHtml(r.suggestion) }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', html: 'Copilot offline.' }]);
    }
  }

  return (
    <>
      <div className="copilot-head">
        <div className="agent-mark">t</div>
        <div style={{ flex: 1 }}>
          <div className="agent-name">Copilot <em>— Tellar agent</em></div>
          <div className="agent-sub">reading the deck · {totalSlides} slides</div>
        </div>
      </div>

      {slideIdx && <div className="context-chip">editing slide {String(slideIdx).padStart(2, '0')}</div>}

      <div>
        {suggestions.map(s => (
          <div key={s.id} className="suggestion-card">
            <div className={`sc-kind ${s.kind}`}>{s.kind}</div>
            <div className="sc-title-sugg">{s.title}</div>
            {s.compare && <div className="sc-compare">{s.compare}</div>}
            <div className="sc-preview" dangerouslySetInnerHTML={{ __html: sanitizeSlideHtml(s.preview) }} />
            <div className="sc-actions">
              <button className="sc-apply" onClick={() => apply(s)}>Apply</button>
              <button className="sc-dismiss" onClick={() => dismiss(s.id)}>Dismiss</button>
            </div>
          </div>
        ))}
      </div>

      <div className="copilot-chat">
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 10 }}>
          ask the copilot
        </div>
        <div className="chat-body">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role === 'user' ? 'user' : ''}`}>
              <div className={`msg-avatar ${m.role === 'user' ? 'ma-user' : 'ma-agent'}`}>{m.role === 'user' ? 'Y' : 't'}</div>
              <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: m.html }} />
            </div>
          ))}
        </div>
        <div className="chat-input">
          <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="var(--ink-3)" strokeWidth={1.5}><path d="M7 1v12M1 7h12" /></svg>
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }} placeholder="Build me a risks slide…" />
          <button className="chat-send" onClick={sendChat}>→</button>
        </div>
        <div className="suggest" style={{ marginTop: 10 }}>
          <button className="suggest-chip" onClick={() => requestSuggestion('rewrite')} disabled={!!busy}>rewrite this slide</button>
          <button className="suggest-chip" onClick={() => requestSuggestion('tighten')} disabled={!!busy}>tighten subtitle</button>
          <button className="suggest-chip" onClick={() => requestSuggestion('narration')} disabled={!!busy}>draft narration</button>
          <button className="suggest-chip" onClick={() => requestSuggestion('structure')} disabled={!!busy}>suggest next slide</button>
        </div>
        {busy && <div className="note" style={{ marginTop: 8 }}>generating {busy}…</div>}
      </div>
    </>
  );
}
