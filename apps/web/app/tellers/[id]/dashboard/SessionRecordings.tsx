'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { RenderSlide } from '@/lib/slide-layouts';

interface Rec {
  idx: number;
  sessionId: string;
  name: string;
  email: string;
  bg: string;
  fg: string;
  durMs: number;
  min: number;
  sec: number;
  when: string;
  live: boolean;
  slidesSeen: number;
  totalSlides: number;
  reachPct: number;
}

interface TimelineEvent {
  id: string;
  type: string;
  slideIdx: number | null;
  dwellMs: number | null;
  at: string;
  email?: string | null;
  meta?: any;
}

interface TimelineSlide {
  id: string;
  idx: number;
  layoutId?: string;
  background?: any;
  layout?: any;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  notes: string | null;
}

interface Timeline {
  sessionId: string;
  tellerId: string;
  events: TimelineEvent[];
  slides: TimelineSlide[];
}

/** Segment = one slide + how long the viewer spent on it, ordered. */
interface Segment {
  slideIdx: number;
  startMs: number;   // ms since session start
  durationMs: number;
  agentQueries: string[]; // questions asked while on this slide
}

function buildSegments(timeline: Timeline): { segments: Segment[]; totalMs: number; startedAt: number } {
  const evs = timeline.events;
  if (!evs.length) return { segments: [], totalMs: 0, startedAt: Date.now() };
  const startedAt = new Date(evs[0].at).getTime();
  const segments: Segment[] = [];
  let current: Segment | null = null;
  const ensure = (slideIdx: number, at: number): Segment => {
    if (!current || current.slideIdx !== slideIdx) {
      if (current) segments.push(current);
      current = { slideIdx, startMs: at - startedAt, durationMs: 0, agentQueries: [] };
    }
    return current as Segment;
  };
  for (const e of evs) {
    const at = new Date(e.at).getTime();
    if (e.type === 'SLIDE_VIEW' && e.slideIdx != null) {
      ensure(e.slideIdx, at);
    } else if (e.type === 'SLIDE_DWELL' && e.slideIdx != null) {
      const seg = ensure(e.slideIdx, at);
      // Prefer the explicit dwellMs from the event over our inferred delta.
      seg.durationMs = Math.max(seg.durationMs, e.dwellMs || 0);
    } else if (e.type === 'AGENT_QUERY' && current) {
      const q = String(e.meta?.question || '').trim();
      if (q) (current as Segment).agentQueries.push(q);
    }
  }
  if (current) segments.push(current);
  // Fill any segment that didn't receive a SLIDE_DWELL (still open when tab closed).
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.durationMs > 0) continue;
    const next = segments[i + 1];
    seg.durationMs = next ? Math.max(250, next.startMs - seg.startMs) : 3_000;
  }
  const totalMs = segments.reduce((sum, s) => sum + s.durationMs, 0);
  return { segments, totalMs, startedAt };
}

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function SessionRecordings({ items, tellerId }: { items: Rec[]; tellerId: string }) {
  const [open, setOpen] = useState<Rec | null>(null);

  if (!items.length) {
    return <p className="note">No viewer sessions yet. Share the teller to start recording activity.</p>;
  }

  return (
    <>
      <div className="rec-grid">
        {items.map(r => (
          <div key={r.sessionId} className="rec-card" onClick={() => setOpen(r)}>
            <div className="rec-thumb">
              <div className="rec-thumb-grid">
                <div className="rec-thumb-bar" />
                <div className="rec-thumb-body">
                  <div /><div />
                </div>
              </div>
              {r.live && <div className="rec-live">live</div>}
              <div className="rec-play" />
              <div className="rec-dur">{fmt(r.durMs)}</div>
            </div>
            <div className="rec-meta">
              <div className="rec-top">
                <div className="rec-av" style={{ background: r.bg, color: r.fg }}>{r.name[0]?.toUpperCase() || '?'}</div>
                <div className="rec-who">
                  <div className="rec-name">{r.name}</div>
                  <div className="rec-when">{r.when}</div>
                </div>
              </div>
              <div className="rec-stats">
                <span>read <b>{r.slidesSeen}/{r.totalSlides}</b> slides</span>
                <span className="sep">/</span>
                <span><b>{r.reachPct}%</b> reach</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <PlaybackModal
          rec={open}
          tellerId={tellerId}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function PlaybackModal({
  rec,
  tellerId,
  onClose,
}: {
  rec: Rec;
  tellerId: string;
  onClose: () => void;
}) {
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [elapsedMs, setElapsedMs] = useState(0);
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    api<Timeline>(`/tellers/${tellerId}/sessions/${rec.sessionId}`)
      .then(setTimeline)
      .catch((e) => setErr(e?.message || 'Could not load session'));
  }, [rec.sessionId, tellerId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const built = useMemo(() => (timeline ? buildSegments(timeline) : null), [timeline]);
  const totalMs = built?.totalMs ?? 0;
  const segments = built?.segments ?? [];
  const slidesById = useMemo(() => {
    const m = new Map<number, TimelineSlide>();
    (timeline?.slides || []).forEach(s => m.set(s.idx, s));
    return m;
  }, [timeline]);

  // Advance the playhead at `speed` while playing.
  useEffect(() => {
    if (!playing || !totalMs) return;
    lastTickRef.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) * speed;
      lastTickRef.current = now;
      setElapsedMs(prev => {
        const next = prev + delta;
        if (next >= totalMs) {
          setPlaying(false);
          return totalMs;
        }
        return next;
      });
    }, 80);
    return () => clearInterval(id);
  }, [playing, speed, totalMs]);

  // Find the current segment from elapsedMs.
  const currentSegIdx = useMemo(() => {
    if (!segments.length) return 0;
    let acc = 0;
    for (let i = 0; i < segments.length; i++) {
      acc += segments[i].durationMs;
      if (elapsedMs < acc) return i;
    }
    return segments.length - 1;
  }, [elapsedMs, segments]);

  const currentSeg = segments[currentSegIdx];
  const currentSlide = currentSeg ? slidesById.get(currentSeg.slideIdx) : undefined;

  function jumpTo(segIdx: number) {
    let acc = 0;
    for (let i = 0; i < segIdx; i++) acc += segments[i].durationMs;
    setElapsedMs(acc);
    lastTickRef.current = Date.now();
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(12,13,15,.85)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, cursor: 'pointer' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 860,
          width: '100%',
          maxHeight: '84vh',
          background: 'var(--panel)',
          border: '1px solid var(--line-2)',
          cursor: 'default',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="rec-av" style={{ background: rec.bg, color: rec.fg, width: 32, height: 32, fontSize: 13 }}>{rec.name[0]?.toUpperCase() || '?'}</div>
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500 }}>
                {rec.name} <em style={{ color: 'var(--ink-3)', fontStyle: 'italic', fontWeight: 400 }}>— session replay</em>
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.05em' }}>
                {rec.email || 'anonymous'} · {rec.when} · reached slide {rec.slidesSeen}/{rec.totalSlides}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--ink-2)', fontFamily: 'var(--mono)', fontSize: 11, padding: '6px 12px', cursor: 'pointer', letterSpacing: '.15em', textTransform: 'uppercase' }}
          >
            Close
          </button>
        </div>

        {/* Stage */}
        <div style={{ aspectRatio: '16/10', background: '#0c0d0f', position: 'relative', flexShrink: 1, minHeight: 0, maxHeight: '52vh' }}>
          {!timeline && !err && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase' }}>
              Loading timeline…
            </div>
          )}
          {err && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--bad)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.15em' }}>
              {err}
            </div>
          )}
          {currentSlide && (
            <div style={{ position: 'absolute', inset: 0 }}>
              <RenderSlide slide={currentSlide as any} />
            </div>
          )}
          {currentSeg && (
            <div style={{ position: 'absolute', top: 10, left: 12, padding: '4px 10px', background: 'rgba(12,13,15,.75)', color: '#f4b942', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase' }}>
              slide {String(currentSeg.slideIdx).padStart(2, '0')} · {fmt(currentSeg.durationMs)} dwell
            </div>
          )}
          {currentSeg && currentSeg.agentQueries.length > 0 && (
            <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14, background: 'rgba(12,13,15,.78)', color: '#f6f3ed', padding: '8px 12px', fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, borderLeft: '2px solid var(--accent)' }}>
              <div style={{ fontFamily: 'var(--mono)', fontStyle: 'normal', fontSize: 9, letterSpacing: '.2em', color: '#f4b942', textTransform: 'uppercase', marginBottom: 3 }}>asked the agent</div>
              "{currentSeg.agentQueries[0]}"
            </div>
          )}
        </div>

        {/* Transport — flex-shrink:0 on side elements so a long session
            never pushes the speed buttons off the row. */}
        <div style={{ padding: '10px 14px', background: 'var(--panel-2)', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button
            onClick={() => setPlaying(p => !p)}
            disabled={!segments.length}
            style={{ width: 28, height: 28, minWidth: 28, flexShrink: 0, border: '1px solid var(--line-2)', background: playing ? 'var(--accent)' : 'var(--panel)', color: playing ? '#0c0d0f' : 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing
              ? <svg width={10} height={10} viewBox="0 0 10 10" fill="currentColor"><rect x={1} width={3} height={10} /><rect x={6} width={3} height={10} /></svg>
              : <svg width={10} height={10} viewBox="0 0 10 10" fill="currentColor"><path d="M1 0l8 5-8 5z" /></svg>}
          </button>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.08em', flexShrink: 0, width: 80, textAlign: 'center' }}>
            {fmt(elapsedMs)} / {fmt(totalMs)}
          </span>
          <div style={{ flex: '1 1 0', minWidth: 60, height: 6, background: 'var(--line)', position: 'relative', overflow: 'hidden' }}>
            {segments.map((seg, i) => (
              <div
                key={i}
                onClick={() => jumpTo(i)}
                title={`Jump to slide ${seg.slideIdx}`}
                style={{
                  position: 'absolute',
                  left: `${(seg.startMs / Math.max(totalMs, 1)) * 100}%`,
                  width: `${Math.max(0.5, (seg.durationMs / Math.max(totalMs, 1)) * 100)}%`,
                  top: 0,
                  bottom: 0,
                  borderLeft: i ? '1px solid var(--bg)' : undefined,
                  background: i === currentSegIdx ? 'var(--accent)' : 'var(--line-3)',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            {[1, 2, 4].map(n => (
              <button
                key={n}
                onClick={() => setSpeed(n as 1 | 2 | 4)}
                style={{
                  width: 26, height: 22, border: '1px solid var(--line-2)',
                  background: speed === n ? 'var(--accent)' : 'transparent',
                  color: speed === n ? '#0c0d0f' : 'var(--ink-2)',
                  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.05em', cursor: 'pointer', padding: 0,
                }}
              >
                {n}x
              </button>
            ))}
          </div>
        </div>

        {/* Segment list */}
        {segments.length > 0 && (
          <div style={{ padding: '10px 14px', background: 'var(--bg-2)', borderTop: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: 6, overflowY: 'auto', maxHeight: 110, flexShrink: 0 }}>
            {segments.map((seg, i) => (
              <button
                key={i}
                onClick={() => jumpTo(i)}
                style={{
                  padding: '6px 10px',
                  border: '1px solid ' + (i === currentSegIdx ? 'var(--accent)' : 'var(--line)'),
                  background: i === currentSegIdx ? 'rgba(244,185,66,.08)' : 'var(--panel)',
                  color: 'var(--ink-2)',
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  letterSpacing: '.08em',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                  minWidth: 80,
                }}
                title={(slidesById.get(seg.slideIdx)?.title || '').replace(/<[^>]+>/g, '')}
              >
                <span style={{ color: i === currentSegIdx ? 'var(--accent)' : 'var(--ink-3)' }}>slide {String(seg.slideIdx).padStart(2, '0')}</span>
                <span>{fmt(seg.durationMs)}</span>
                {seg.agentQueries.length > 0 && <span style={{ color: 'var(--accent)', fontSize: 9 }}>{seg.agentQueries.length} Q</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
