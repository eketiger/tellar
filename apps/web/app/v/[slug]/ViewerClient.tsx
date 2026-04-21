'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { citeToHtml } from '@/lib/cite';
import { sanitizeSlideHtml } from '@/lib/sanitize';
import { RenderSlide } from '@/lib/slide-layouts';
import './viewer.css';

interface Slide { id: string; idx: number; eyebrow: string | null; title: string; subtitle: string | null; }
interface Recording { id: string; slideId: string | null; mode: string; durationMs: number; }
interface ShareData {
  share: { id: string; slug: string; accessMode: string; perms: Record<string, boolean> };
  teller: { id: string; title: string; slides: Slide[]; recordings: Recording[]; kbSources: any[] };
}

type GateReason = 'email-required' | 'passphrase-required' | 'domain-blocked' | 'not-invited' | 'expired' | 'bad-passphrase' | null;

const fmtMs = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function ViewerClient({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<'gate' | 'viewer'>('gate');
  const [email, setEmail] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('tellar:viewer-email') || '' : ''));
  const [passphrase, setPassphrase] = useState('');
  const [gateReason, setGateReason] = useState<GateReason>(null);
  const [gateErr, setGateErr] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<ShareData | null>(null);

  async function authorize(e?: React.FormEvent) {
    e?.preventDefault();
    setGateErr(null);
    try {
      const r = await api<{ token: string }>(`/v/${slug}/authorize`, { method: 'POST', json: { email: email || undefined, passphrase: passphrase || undefined } });
      setToken(r.token);
      const d = await api<ShareData>(`/v/${slug}`, { headers: { 'x-share-token': r.token } });
      if (email) localStorage.setItem('tellar:viewer-email', email);
      setData(d);
      setPhase('viewer');
      navigator.sendBeacon?.('/api/events', new Blob(
        [JSON.stringify({ type: 'SHARE_OPEN', tellerId: d.teller.id, shareId: d.share.id, sessionId: `s_${Math.random().toString(36).slice(2)}`, email })],
        { type: 'application/json' },
      ));
    } catch (err) {
      const body = (err as ApiError).body;
      const reason = (body?.reason || body?.message || 'denied') as GateReason;
      setGateReason(reason);
      if (reason === 'bad-passphrase') setGateErr('incorrect passphrase');
      else if (reason === 'domain-blocked') setGateErr('not on allow-list · try another address');
      else setGateErr(null);
    }
  }

  if (phase === 'gate') return <GateOverlay email={email} setEmail={setEmail} passphrase={passphrase} setPassphrase={setPassphrase} reason={gateReason} err={gateErr} onSubmit={authorize} />;
  return <Viewer data={data!} email={email} />;
}

function GateOverlay({ email, setEmail, passphrase, setPassphrase, reason, err, onSubmit }: any) {
  const passMode = reason === 'passphrase-required' || reason === 'bad-passphrase';
  const expired = reason === 'expired';
  let title = <>Who's <em>joining?</em></>, desc = "Your email stays private and is only shared with the creator.";
  if (passMode) { title = <>Enter the <em>passphrase</em></>; desc = 'This deck is shared with a passphrase. Ask the creator for it.'; }
  else if (reason === 'domain-blocked') { title = <>That email <em>can't</em> open this</>; desc = "Your address isn't on the allow-list. Use a different email or ask for a personal invite."; }
  else if (reason === 'not-invited') { title = <>Invite <em>only</em></>; desc = 'This deck was shared with specific people. Use the email you were invited as.'; }
  else if (expired) { title = <>This link <em>has expired</em></>; desc = 'Ask the creator for a fresh link.'; }

  return (
    <div className="gate-overlay">
      <form className="gate-card" onSubmit={onSubmit}>
        <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
        <div className="kicker">tellar · private viewing</div>
        <h2>{title}</h2>
        <p>{desc}</p>
        {!expired && (
          <>
            <div className="field">
              <label className="field-label">your work email</label>
              <input type="email" className="field-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
            </div>
            {passMode && (
              <div className="field">
                <label className="field-label">passphrase</label>
                <input type="password" className="field-input" value={passphrase} onChange={e => setPassphrase(e.target.value)} placeholder="••••••••" required />
              </div>
            )}
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} type="submit">Open the deck →</button>
          </>
        )}
        <div className="gate-error">{err || ''}</div>
      </form>
    </div>
  );
}

function Viewer({ data, email }: { data: ShareData; email: string }) {
  const slides = data.teller.slides;
  const recs = data.teller.recordings;
  const perms = data.share.perms;
  const agentOn = perms.agent !== false;
  const showNarrator = perms.recording !== false;
  const showWatermark = perms.watermark !== false;

  const sessionId = useMemo(() => `s_${Math.random().toString(36).slice(2, 10)}`, []);
  const [idx, setIdx] = useState(1);
  const [viewed, setViewed] = useState<Set<number>>(new Set([1]));
  const [chatOpen, setChatOpen] = useState(true);
  const [swap, setSwap] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  const slide = slides.find(s => s.idx === idx) || slides[0];
  const rec = recs.find(r => r.slideId === slide?.id);
  const slideDurMs = rec?.durationMs || 12_000;

  const narratorVideoRef = useRef<HTMLVideoElement>(null);
  const dwellStartRef = useRef(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback((next: number) => {
    if (next < 1 || next > slides.length) return;
    const dwellMs = Date.now() - dwellStartRef.current;
    navigator.sendBeacon?.('/api/events', new Blob(
      [JSON.stringify({ type: 'SLIDE_DWELL', tellerId: data.teller.id, shareId: data.share.id, sessionId, email, slideIdx: idx, dwellMs })],
      { type: 'application/json' },
    ));
    setSwap(true);
    setTimeout(() => { setIdx(next); setViewed(v => new Set(v).add(next)); setSwap(false); setProgress(0); dwellStartRef.current = Date.now(); }, 160);
  }, [data, email, idx, sessionId, slides.length]);

  useEffect(() => {
    navigator.sendBeacon?.('/api/events', new Blob(
      [JSON.stringify({ type: 'SLIDE_VIEW', tellerId: data.teller.id, shareId: data.share.id, sessionId, email, slideIdx: idx })],
      { type: 'application/json' },
    ));
  }, [idx, data, email, sessionId]);

  // Load narration blob when slide changes
  useEffect(() => {
    const v = narratorVideoRef.current;
    if (!v || !rec) return;
    (async () => {
      try {
        const r = await api<{ url: string }>(`/recordings/${rec.id}/stream`);
        v.src = r.url;
        if (playing) v.play().catch(() => {});
      } catch { /* ignore */ }
    })();
    return () => { try { v.pause(); v.src = ''; } catch {} };
  }, [rec, playing]);

  // Progress timer
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      if (!playing) return;
      setProgress(p => {
        const np = p + 100;
        if (np >= slideDurMs) {
          if (idx < slides.length) setTimeout(() => goTo(idx + 1), 0);
          else setPlaying(false);
          return slideDurMs;
        }
        return np;
      });
    }, 100);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [playing, slideDurMs, idx, slides.length, goTo]);

  // Keyboard nav
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goTo(idx + 1); }
      if (e.key === 'ArrowLeft') goTo(idx - 1);
      if (e.key === 'Escape') setChatOpen(o => !o);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [idx, goTo]);

  const togglePlay = () => {
    const v = narratorVideoRef.current;
    const np = !playing;
    setPlaying(np);
    if (v) { if (np) v.play().catch(() => {}); else v.pause(); }
  };

  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - r.left) / r.width;
    const newP = Math.max(0, Math.min(slideDurMs, slideDurMs * pct));
    setProgress(newP);
    const v = narratorVideoRef.current;
    if (v && v.src) v.currentTime = newP / 1000;
  };

  const layoutCls = `viewer-layout${chatOpen ? '' : ' chat-closed'}${agentOn ? '' : ' no-agent'}`;
  const hasVideoNarration = rec && (rec.mode === 'cam-mic' || rec.mode === 'screen' || rec.mode === 'screen-mic');
  const watermarkText = showWatermark && email ? Array(6).fill(email).join(' · ') : '';

  return (
    <div className="viewer-root">
      <header className="viewer-top">
        <div className="vt-left">
          <span className="vt-brand">tellar</span>
          <span className="vt-title"><b dangerouslySetInnerHTML={{ __html: sanitizeSlideHtml(data.teller.title) }} /> · shared deck</span>
        </div>
        <div className="vt-right">
          <span className="vt-watermark">{email || 'guest'}</span>
          <span>{String(idx).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
        </div>
      </header>

      <div className={layoutCls}>
        <main className="viewer-stage">
          <div className={`slide-stage fade-in d1${swap ? ' swap' : ''}`} style={{ position: 'relative' }}>
            {watermarkText && <div className="slide-watermark">{watermarkText}</div>}
            {slide && <RenderSlide slide={slide} />}
            {showNarrator && (
              <div className={`narrator${playing && rec ? ' playing' : ''}`} onClick={togglePlay} title="Click to play narration">
                <video ref={narratorVideoRef} playsInline muted={muted} style={{ display: hasVideoNarration ? 'block' : 'none' }} />
                {!hasVideoNarration && <div className="narrator-fallback">{(data.teller.title || 'T').charAt(0).toUpperCase()}</div>}
                <div className="narrator-ring" />
              </div>
            )}
          </div>

          <div className="player-bar fade-in d2">
            <button className="pb-btn" onClick={() => goTo(idx - 1)} title="Previous">
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M8 2L4 6l4 4" /></svg>
            </button>
            <button className="pb-btn big" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
              {playing
                ? <svg width={14} height={14} viewBox="0 0 14 14" fill="currentColor"><rect x={3} y={2} width={3} height={10} /><rect x={8} y={2} width={3} height={10} /></svg>
                : <svg width={14} height={14} viewBox="0 0 14 14" fill="currentColor"><path d="M3 2l9 5-9 5z" /></svg>}
            </button>
            <button className="pb-btn" onClick={() => goTo(idx + 1)} title="Next">
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M4 2l4 4-4 4" /></svg>
            </button>
            <div className="pb-progress">
              <span className="pb-time">{fmtMs(progress)}</span>
              <div className="pb-track" onClick={onTrackClick}>
                <div className="pb-track-fill" style={{ width: `${Math.min(100, (progress / slideDurMs) * 100)}%` }} />
              </div>
              <span className="pb-time">{fmtMs(slideDurMs)}</span>
            </div>
            <button className="pb-btn" onClick={() => setMuted(m => !m)} title={muted ? 'Unmute' : 'Mute'}>
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M2 4v4h2l3 2V2L4 4z" />{muted && <path d="M9 4l2 4M11 4l-2 4" />}
              </svg>
            </button>
          </div>

          <div className="slide-nav">
            <button className="slide-arrow" onClick={() => goTo(idx - 1)}><svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M6 1L2 5l4 4" /></svg></button>
            {slides.slice(0, 14).map(s => {
              const cls = `slide-nav-dot${s.idx === idx ? ' active' : ''}${viewed.has(s.idx) ? ' viewed' : ''}`;
              return <button key={s.id} className={cls} onClick={() => goTo(s.idx)}>{s.idx}</button>;
            })}
            {slides.length > 14 && <span style={{ padding: '0 6px', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', alignSelf: 'center' }}>+{slides.length - 14}</span>}
            <button className="slide-arrow" onClick={() => goTo(idx + 1)}><svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M4 1l4 4-4 4" /></svg></button>
          </div>
        </main>

        {agentOn && (
          <AgentChat
            tellerId={data.teller.id}
            shareId={data.share.id}
            email={email}
            sessionId={sessionId}
            slideIdx={idx}
            kbCount={data.teller.kbSources.length}
            recCount={recs.length}
            slideCount={slides.length}
            onClose={() => setChatOpen(false)}
            onCite={(type: string, ref: string) => { if (type === 'slide' || type === 'audio') goTo(parseInt(ref, 10)); }}
          />
        )}
      </div>

      {agentOn && !chatOpen && (
        <button className="chat-fab" onClick={() => setChatOpen(true)} aria-label="Open chat">t</button>
      )}
    </div>
  );
}

function AgentChat({ tellerId, shareId, email, sessionId, slideIdx, kbCount, recCount, slideCount, onClose, onCite }: any) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; html: string; typing?: boolean }[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 99999, behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const q = input.trim(); if (!q || thinking) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', html: q }]);
    setThinking(true);
    navigator.sendBeacon?.('/api/events', new Blob(
      [JSON.stringify({ type: 'AGENT_QUERY', tellerId, shareId, sessionId, email, slideIdx, meta: { question: q } })],
      { type: 'application/json' },
    ));
    try {
      const r = await api<{ answer: string }>('/agent/ask', { method: 'POST', json: { tellerId, question: q, history: [], email } });
      setMessages(m => [...m, { role: 'assistant', html: citeToHtml(r.answer) }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', html: "Sorry — I couldn't reach the model right now." }]);
    } finally {
      setThinking(false);
    }
  }

  const onBubbleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    const cite = t.closest('.cite') as HTMLElement | null;
    if (cite && cite.dataset.type && cite.dataset.ref) onCite(cite.dataset.type, cite.dataset.ref);
  };

  return (
    <aside className="viewer-chat">
      <div className="vc-head">
        <div className="vc-agent">t</div>
        <div className="vc-info">
          <div className="vc-name">Ask the deck <em>— agent</em></div>
          <div className="vc-sub">trained on {slideCount} slides · {recCount} recordings · {kbCount} kb sources</div>
        </div>
        <button className="vc-close" onClick={onClose} title="Close">
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M3 3l6 6M9 3l-6 6" /></svg>
        </button>
      </div>

      <div className="vc-body" ref={bodyRef}>
        <div className="chat-welcome">
          Hi {email ? email.split('@')[0] : 'there'} — I'm the agent for this <em>tellar</em>. Ask me anything about the deck, the creator's narration, or the <em>{kbCount}</em> knowledge sources attached. I'll cite every answer.
        </div>
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role === 'user' ? 'user' : ''}`}>
            <div className={`msg-avatar ${m.role === 'user' ? 'ma-user' : 'ma-agent'}`}>
              {m.role === 'user' ? (email?.[0] || 'V').toUpperCase() : 't'}
            </div>
            <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: m.html }} onClick={onBubbleClick} />
          </div>
        ))}
        {thinking && (
          <div className="msg">
            <div className="msg-avatar ma-agent">t</div>
            <div className="msg-bubble"><span className="typing"><span /><span /><span /></span></div>
          </div>
        )}
      </div>

      <div className="vc-footer">
        <div className="chat-input">
          <input type="text" placeholder="Ask anything about this deck…" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="chat-send" onClick={send} type="button" aria-label="Send">
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M1 6h10M7 2l4 4-4 4" /></svg>
          </button>
        </div>
        <div style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.1em', display: 'flex', justifyContent: 'space-between' }}>
          <span>enter to send</span>
          <span>answers from the deck only</span>
        </div>
      </div>
    </aside>
  );
}
