'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { citeToHtml } from '@/lib/cite';
import { sanitizeSlideHtml } from '@/lib/sanitize';

interface Slide {
  id: string;
  idx: number;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
}

interface ShareData {
  share: { id: string; slug: string; accessMode: string; perms: Record<string, boolean> };
  teller: { id: string; title: string; slides: Slide[]; kbSources: any[]; recordings: any[] };
}

export function ViewerClient({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<'gate' | 'viewer'>('gate');
  const [email, setEmail] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [gateErr, setGateErr] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<ShareData | null>(null);
  const [idx, setIdx] = useState(0);

  async function authorize(e?: React.FormEvent) {
    e?.preventDefault();
    setGateErr(null);
    try {
      const r = await api<{ token: string; email: string }>(`/v/${slug}/authorize`, {
        method: 'POST',
        json: { email: email || undefined, passphrase: passphrase || undefined },
      });
      setToken(r.token);
      const d = await api<ShareData>(`/v/${slug}`, { headers: { 'x-share-token': r.token } });
      setData(d);
      setPhase('viewer');
      // SHARE_OPEN event
      navigator.sendBeacon?.(
        '/api/events',
        new Blob(
          [JSON.stringify({ type: 'SHARE_OPEN', tellerId: d.teller.id, shareId: d.share.id, sessionId: `s_${Math.random().toString(36).slice(2)}`, email })],
          { type: 'application/json' },
        ),
      );
    } catch (err) {
      const body = (err as ApiError).body;
      const reason = body?.reason || body?.message || 'Access denied';
      setGateErr(reason);
    }
  }

  if (phase === 'gate') {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 40, position: 'relative', zIndex: 3 }}>
        <form onSubmit={authorize} className="panel" style={{ maxWidth: 440, width: '100%', padding: 32 }}>
          <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
          <div className="brand-mark" style={{ fontSize: 28 }}>Tellar</div>
          <p className="note" style={{ marginTop: 8, marginBottom: 26 }}>— You've been invited to view a tellar.</p>
          <div className="field">
            <label className="field-label">Your work email</label>
            <input className="field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" required />
          </div>
          <div className="field">
            <label className="field-label">Passphrase <span className="note">(optional)</span></label>
            <input className="field-input" type="password" value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="…" />
          </div>
          {gateErr && <div className="err">! {gateErr}</div>}
          <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center', padding: '12px 18px', marginTop: 6 }}>
            Enter →
          </button>
          <p className="note" style={{ marginTop: 16, textAlign: 'center' }}>
            Your email is stamped onto every frame as a watermark.
          </p>
        </form>
      </main>
    );
  }

  return <Viewer data={data!} email={email} idx={idx} setIdx={setIdx} shareId={data!.share.id} tellerId={data!.teller.id} />;
}

function Viewer({ data, email, idx, setIdx, shareId, tellerId }: any) {
  const slide = data.teller.slides[idx];
  const sessionId = useMemo(() => `s_${Math.random().toString(36).slice(2)}`, []);
  const dwellStart = useRef(Date.now());

  // Event ingestion: SLIDE_VIEW on mount, SLIDE_DWELL on unmount/idx-change
  useEffect(() => {
    const body = { type: 'SLIDE_VIEW', tellerId, shareId, sessionId, email, slideIdx: slide.idx };
    navigator.sendBeacon?.('/api/events', new Blob([JSON.stringify(body)], { type: 'application/json' }));
    dwellStart.current = Date.now();
    return () => {
      const dwellMs = Date.now() - dwellStart.current;
      navigator.sendBeacon?.(
        '/api/events',
        new Blob([JSON.stringify({ type: 'SLIDE_DWELL', tellerId, shareId, sessionId, email, slideIdx: slide.idx, dwellMs })], { type: 'application/json' }),
      );
    };
  }, [idx, slide?.idx, shareId, tellerId, sessionId, email]);

  const agentOn = data.share.perms.agent !== false;
  const watermark = data.share.perms.watermark !== false;

  return (
    <>
      <header className="topbar">
        <div className="brand"><span className="brand-mark" dangerouslySetInnerHTML={{ __html: sanitizeSlideHtml(data.teller.title) }} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="note">slide <b style={{ color: 'var(--ink)' }}>{slide.idx}</b> / {data.teller.slides.length}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setIdx((i: number) => Math.max(0, i - 1))} disabled={idx === 0}>←</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setIdx((i: number) => Math.min(data.teller.slides.length - 1, i + 1))}>→</button>
          </div>
        </div>
      </header>

      <main style={{ display: 'grid', gridTemplateColumns: agentOn ? '1fr 400px' : '1fr', minHeight: 'calc(100vh - 58px)', position: 'relative', zIndex: 3 }}>
        <section style={{ padding: 40, position: 'relative' }}>
          <div className="panel" style={{ aspectRatio: '16/9', padding: 60, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
            {watermark && (
              <div aria-hidden style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', opacity: .06, mixBlendMode: 'screen',
                fontFamily: 'var(--mono)', fontSize: 18, color: 'var(--ink)',
                display: 'flex', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', gap: 40,
                transform: 'rotate(-22deg)', letterSpacing: '.3em',
              }}>
                {Array.from({ length: 24 }).map((_, i) => <span key={i}>{email || 'viewer'}</span>)}
              </div>
            )}
            <div className="note" style={{ textTransform: 'uppercase', marginBottom: 24 }}>{slide.eyebrow}</div>
            <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 400, fontSize: 'clamp(32px, 5vw, 72px)', lineHeight: 1.05, letterSpacing: '-.03em' }}
              dangerouslySetInnerHTML={{ __html: sanitizeSlideHtml(slide.title) }} />
            {slide.subtitle && (
              <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'clamp(16px,1.6vw,22px)', color: 'var(--ink-2)', marginTop: 24, lineHeight: 1.45 }}>
                {slide.subtitle}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 20 }}>
            {data.teller.slides.map((_: any, i: number) => (
              <button key={i} onClick={() => setIdx(i)} aria-label={`Go to slide ${i + 1}`}
                style={{ flex: 1, height: 3, background: i <= idx ? 'var(--accent)' : 'var(--line)', border: 'none', cursor: 'pointer' }} />
            ))}
          </div>
        </section>

        {agentOn && <AgentChat tellerId={tellerId} email={email} slide={slide} shareId={shareId} sessionId={sessionId} />}
      </main>
    </>
  );
}

function AgentChat({ tellerId, email, slide, shareId, sessionId }: any) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; html: string }>>([
    {
      role: 'assistant',
      html: `Hi — I'm the agent for this tellar. I can answer questions using the deck, the creator's narration, and the attached knowledge base.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || thinking) return;
    setInput('');
    setMessages(ms => [...ms, { role: 'user', html: q }]);
    setThinking(true);

    // AGENT_QUERY event
    navigator.sendBeacon?.(
      '/api/events',
      new Blob([JSON.stringify({ type: 'AGENT_QUERY', tellerId, shareId, sessionId, email, slideIdx: slide.idx, meta: { question: q } })], { type: 'application/json' }),
    );

    try {
      const r = await api<{ answer: string; citations: any[] }>('/agent/ask', {
        method: 'POST',
        json: { tellerId, question: q, history: [], email },
      });
      setMessages(ms => [...ms, { role: 'assistant', html: citeToHtml(r.answer) }]);
    } catch {
      setMessages(ms => [...ms, { role: 'assistant', html: 'Sorry, I hit an error.' }]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <aside style={{ borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <header style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
        <div className="note">— Agent</div>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, marginTop: 4 }}>
          Ask <em style={{ color: 'var(--accent)' }}>anything.</em>
        </h2>
      </header>
      <div className="chat-body" style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role === 'user' ? 'user' : ''}`}>
            <div className={`msg-avatar ${m.role === 'user' ? 'ma-user' : 'ma-agent'}`}>
              {m.role === 'user' ? (email?.[0] || 'V').toUpperCase() : 'T'}
            </div>
            <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: m.html }} />
          </div>
        ))}
        {thinking && <div className="note">thinking…</div>}
      </div>
      <div style={{ padding: '0 22px 14px' }}>
        <div className="suggest">
          {['unit economics?', 'who is on the team?', 'what is the moat?', 'why $18M?'].map(q => (
            <button key={q} className="suggest-chip" onClick={() => send(q)}>{q}</button>
          ))}
        </div>
      </div>
      <form
        onSubmit={e => { e.preventDefault(); send(); }}
        style={{ padding: '14px 22px 22px', borderTop: '1px solid var(--line)' }}
      >
        <div className="chat-input">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about this slide or the deck…" />
          <button className="chat-send" type="submit" disabled={thinking} aria-label="Send">→</button>
        </div>
      </form>
    </aside>
  );
}
