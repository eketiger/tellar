'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface ToolCall {
  name: string;
  input: any;
  result: any;
}

interface ChatTurnResp {
  reply: string;
  appliedTools: ToolCall[];
  fallback: boolean;
  usage?: { inputTokens: number; outputTokens: number; cacheReadInputTokens?: number };
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tools?: ToolCall[];
  fallback?: boolean;
}

const SUGGESTIONS = [
  'Add a problem slide before the solution',
  'Tighten slide 3 — make the title sharper',
  'Reorder so the team slide comes near the end',
  'Add a "Why now" slide right before pricing',
];

/**
 * Conversational tellar editor — talks to /tellers/:id/authoring/chat
 * which runs Anthropic tool-use server-side. The model can list,
 * create, update, delete and reorder slides on its own; we show the
 * trace of the tool calls it actually applied so creators trust the
 * change before saving.
 */
export function AuthoringPanel({
  tellerId,
  onApplied,
}: {
  tellerId: string;
  onApplied?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hi — I'm your Tellar authoring agent. Tell me what you want to add, change or rearrange and I'll apply it. I can list, create, edit, delete and reorder slides.",
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setError(null);
    setBusy(true);
    setInput('');
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-12)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    setMessages(m => [...m, { role: 'user', content: message }]);
    try {
      const r = await api<ChatTurnResp>(`/tellers/${tellerId}/authoring/chat`, {
        method: 'POST',
        json: { message, history },
      });
      setMessages(m => [...m, { role: 'assistant', content: r.reply, tools: r.appliedTools, fallback: r.fallback }]);
      if (r.appliedTools?.length) onApplied?.();
    } catch (e: any) {
      setError(e?.message || 'Authoring agent unavailable');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 360 }}>
      <header style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--ink-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Authoring agent</span>
        <span className="note" style={{ color: 'var(--accent)' }}>claude · tool-use</span>
      </header>

      <div ref={scroller} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '92%',
              background: m.role === 'user' ? 'var(--panel-3)' : 'transparent',
              border: m.role === 'assistant' ? '1px solid var(--line)' : 'none',
              padding: m.role === 'assistant' ? '10px 12px' : '8px 10px',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
            {m.tools && m.tools.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary className="note" style={{ cursor: 'pointer' }}>
                  applied {m.tools.length} tool call{m.tools.length === 1 ? '' : 's'}
                </summary>
                <ul style={{ marginTop: 6, paddingLeft: 14, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-2)' }}>
                  {m.tools.map((t, j) => (
                    <li key={j} style={{ marginBottom: 4 }}>
                      <span style={{ color: 'var(--accent)' }}>{t.name}</span>{' '}
                      <span style={{ color: 'var(--ink-3)' }}>
                        {Object.entries(t.input || {})
                          .filter(([, v]) => v !== undefined && v !== null && v !== '')
                          .slice(0, 4)
                          .map(([k, v]) => `${k}=${String(v).slice(0, 40)}`)
                          .join(' ')}
                      </span>
                      {t.result?.error && <span style={{ color: 'var(--bad)', marginLeft: 6 }}>· {t.result.error}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {m.fallback && (
              <div className="note" style={{ marginTop: 6, color: 'var(--accent)' }}>
                running in mock mode — set ANTHROPIC_API_KEY for real edits
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="note" style={{ alignSelf: 'flex-start' }}>
            thinking…
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="btn btn-sm btn-ghost"
              style={{ justifyContent: 'flex-start', textAlign: 'left' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={e => { e.preventDefault(); send(); }}
        style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid var(--line)', background: 'var(--panel-2)' }}
      >
        <input
          className="field-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder='Try: "add a slide about the team"'
          disabled={busy}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>

      {error && <div className="err" style={{ padding: '0 12px 10px' }}>! {error}</div>}
    </div>
  );
}
