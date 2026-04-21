'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { sanitizeSlideHtml } from '@/lib/sanitize';

/**
 * NarrationPanel — 1:1 port of the prototype's capture pane.
 *
 * Features preserved from docs/prototype/editor.html:
 *  - 4 capture modes: cam+mic, mic-only, screen, screen+mic
 *  - Live video preview (hidden placeholder for audio-only mode)
 *  - Live LIVE · 00:00 timer overlay
 *  - Per-slide clip list (one row per slide, "no recording" when empty)
 *  - Playback modal with <video> element
 *  - Delete clip action
 *  - Speaker notes textarea (persisted via slide.notes)
 */

export type RecordingMode = 'cam-mic' | 'mic' | 'screen' | 'screen-mic';

interface Slide {
  id: string;
  idx: number;
  title: string;
  notes: string | null;
}

interface Recording {
  id: string;
  slideId: string | null;
  mode: string;
  durationMs: number;
  sizeBytes: number;
  mime?: string | null;
}

const MODES: { id: RecordingMode; label: string; icon: React.ReactNode }[] = [
  {
    id: 'cam-mic',
    label: 'Cam + Mic',
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.3}>
        <circle cx={9} cy={7} r={3} />
        <path d="M3 16c1-3 3.5-4.5 6-4.5s5 1.5 6 4.5" />
      </svg>
    ),
  },
  {
    id: 'mic',
    label: 'Mic only',
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.3}>
        <rect x={7} y={2} width={4} height={9} rx={2} />
        <path d="M4 9a5 5 0 0010 0M9 14v2" />
      </svg>
    ),
  },
  {
    id: 'screen',
    label: 'Screen',
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.3}>
        <rect x={2} y={4} width={14} height={10} />
        <path d="M7 16h4" />
      </svg>
    ),
  },
  {
    id: 'screen-mic',
    label: 'Screen + Mic',
    icon: (
      <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.3}>
        <rect x={2} y={4} width={14} height={10} />
        <path d="M7 16h4M9 8v2" />
      </svg>
    ),
  },
];

function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function NarrationPanel({
  tellerId,
  slides,
  active,
  initialRecordings,
  onSelectSlide,
}: {
  tellerId: string;
  slides: Slide[];
  active: Slide | undefined;
  initialRecordings: Recording[];
  onSelectSlide: (slideId: string) => void;
}) {
  const [mode, setMode] = useState<RecordingMode>('cam-mic');
  const [scope, setScope] = useState<'slide' | 'deck'>('slide');
  const [recordings, setRecordings] = useState<Recording[]>(initialRecordings);
  const [isRecording, setIsRecording] = useState(false);
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ url: string; mime: string } | null>(null);

  // Whole-deck recording carries the slide being narrated in a ref so the
  // MediaRecorder.onstop closure reads the latest index; setSlideIdx
  // fires on every nextSlideDuringRecording() call.
  const [liveSlideIdx, setLiveSlideIdx] = useState<number>(0);
  const deckSplitsRef = useRef<Array<{ slideId: string; startMs: number; endMs: number }>>([]);
  const currentSegmentStartRef = useRef<number>(0);
  const currentSegmentSlideIdRef = useRef<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Attach preview stream to the <video> tag when it changes
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = preview;
  }, [preview]);

  // Clean up streams on unmount
  useEffect(() => () => stopMediaStream(), []);

  function stopMediaStream() {
    preview?.getTracks().forEach(t => t.stop());
    setPreview(null);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function startPreview(selected: RecordingMode): Promise<MediaStream | null> {
    setError(null);
    try {
      let stream: MediaStream;
      if (selected === 'cam-mic') {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 400 }, audio: true });
      } else if (selected === 'mic') {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else if (selected === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      } else {
        const disp = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream = new MediaStream([...disp.getTracks(), ...mic.getTracks()]);
      }
      setPreview(stream);
      return stream;
    } catch (e: any) {
      setError(`Permission denied: ${e?.message ?? 'unknown'}`);
      return null;
    }
  }

  async function selectMode(next: RecordingMode) {
    if (isRecording) return;
    setMode(next);
    // Restart preview under the new mode if a stream was already live.
    if (preview) {
      preview.getTracks().forEach(t => t.stop());
      setPreview(null);
      await startPreview(next);
    }
  }

  /** Close the current deck segment and open one for the next slide. */
  function advanceDeckSegment(nextSlideId: string | null) {
    const now = Date.now() - startedAtRef.current;
    const prevSlideId = currentSegmentSlideIdRef.current;
    if (prevSlideId) {
      deckSplitsRef.current.push({
        slideId: prevSlideId,
        startMs: currentSegmentStartRef.current,
        endMs: now,
      });
    }
    if (nextSlideId) {
      currentSegmentSlideIdRef.current = nextSlideId;
      currentSegmentStartRef.current = now;
    } else {
      currentSegmentSlideIdRef.current = null;
    }
  }

  // Observe slide changes while recording in deck scope and seal/open
  // segments in response. We intentionally read isRecording/scope via refs
  // so changing either mid-take doesn't replay stale effects.
  const isRecordingRef = useRef(isRecording);
  const scopeRef = useRef(scope);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { scopeRef.current = scope; }, [scope]);
  useEffect(() => {
    if (!isRecordingRef.current || scopeRef.current !== 'deck') return;
    if (!active) return;
    if (currentSegmentSlideIdRef.current === active.id) return;
    advanceDeckSegment(active.id);
    setLiveSlideIdx(active.idx);
    // advanceDeckSegment is a stable helper — no dep required.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  async function toggle() {
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }
    if (scope === 'slide' && !active) {
      setError('Select a slide first.');
      return;
    }
    if (scope === 'deck' && slides.length === 0) {
      setError('Deck has no slides.');
      return;
    }
    const stream = preview ?? (await startPreview(mode));
    if (!stream) return;

    const hasVideo = stream.getVideoTracks().length > 0;
    const mime = hasVideo
      ? MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm'
      : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      rec = new MediaRecorder(stream);
    }
    recorderRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = e => e.data.size && chunksRef.current.push(e.data);

    // Capture scope + starting slide at record start so onstop reads a stable
    // snapshot (scope may have changed by the time the user hits stop).
    const recScope = scope;
    const startingSlide = scope === 'deck' ? slides[0] : active;

    rec.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const durationMs = Date.now() - startedAtRef.current;
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
      stream.getTracks().forEach(t => t.stop());
      setPreview(null);

      // For deck scope, seal the last open segment.
      if (recScope === 'deck') advanceDeckSegment(null);

      try {
        const up = await api<{ id: string; uploadUrl: string; method: string; headers: Record<string, string> }>(
          '/recordings/upload-url',
          {
            method: 'POST',
            json: {
              tellerId,
              slideId: recScope === 'slide' ? startingSlide?.id : null,
              mode,
              contentType: mime,
            },
          },
        );
        await fetch(up.uploadUrl, { method: up.method, body: blob, headers: up.headers });
        const parent = await api<Recording>(`/recordings/${up.id}/confirm`, {
          method: 'POST',
          json: { sizeBytes: blob.size, durationMs },
        });

        if (recScope === 'slide') {
          setRecordings(rs => [parent, ...rs.filter(r => r.slideId !== startingSlide?.id)]);
        } else {
          // Ship the per-slide split to the backend so one child row is
          // created for each segment captured during the take.
          const splits = deckSplitsRef.current.filter(s => s.endMs > s.startMs);
          const { children } = await api<{ children: Recording[] }>(`/recordings/${up.id}/split`, {
            method: 'POST',
            json: { splits },
          });
          // Drop the parent and any previous per-slide rows for the covered
          // slides; replace with the children so the clip list reflects reality.
          const coveredSlideIds = new Set(splits.map(s => s.slideId));
          setRecordings(rs => [
            ...children,
            ...rs.filter(r => !coveredSlideIds.has(r.slideId || '') && r.id !== parent.id),
          ]);
          deckSplitsRef.current = [];
          currentSegmentSlideIdRef.current = null;
        }
      } catch (e: any) {
        setError(`Upload failed: ${e?.message ?? 'unknown'}`);
      }
    };

    startedAtRef.current = Date.now();

    // Deck mode: mark the first slide as the current segment and jump to it.
    if (recScope === 'deck' && startingSlide) {
      deckSplitsRef.current = [];
      currentSegmentStartRef.current = 0;
      currentSegmentSlideIdRef.current = startingSlide.id;
      setLiveSlideIdx(startingSlide.idx);
      onSelectSlide(startingSlide.id);
    }

    rec.start();
    setIsRecording(true);
    timerRef.current = setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200);
  }

  async function play(rec: Recording) {
    try {
      const r = await api<{ url: string }>(`/recordings/${rec.id}/stream`);
      setPlaying({ url: r.url, mime: rec.mime || 'video/webm' });
    } catch (e: any) {
      setError(`Playback failed: ${e?.message ?? 'unknown'}`);
    }
  }

  async function deleteRec(id: string) {
    if (!confirm('Delete this clip?')) return;
    await api(`/recordings/${id}`, { method: 'DELETE' });
    setRecordings(rs => rs.filter(r => r.id !== id));
  }

  const hasVideo = preview?.getVideoTracks().length ?? 0;
  const recForActive = recordings.find(r => r.slideId === active?.id);

  return (
    <>
      <div className="panel" style={{ padding: 16 }}>
        <header className="section-head" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 14 }}>
            <span className="num">R</span>Narration
          </h2>
          <span className="aux">
            {recordings.length} of {slides.length}
          </span>
        </header>

        {/* Preview */}
        <div
          style={{
            aspectRatio: '16/10',
            background: 'linear-gradient(135deg, #1a1c21, #0f1014)',
            border: '1px solid var(--line)',
            marginBottom: 14,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000', display: hasVideo ? 'block' : 'none' }}
          />
          {!hasVideo && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 8,
                color: 'var(--ink-3)',
                fontFamily: 'var(--mono)',
                fontSize: 10,
                letterSpacing: '.15em',
                textTransform: 'uppercase',
                textAlign: 'center',
                padding: 20,
              }}
            >
              {preview && mode === 'mic' ? 'audio-only · mic active' : 'click start to request capture'}
            </div>
          )}
          {isRecording && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                padding: '4px 8px',
                fontFamily: 'var(--mono)',
                fontSize: 9,
                letterSpacing: '.15em',
                color: '#fff',
                background: 'rgba(212,122,122,.9)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                textTransform: 'uppercase',
                borderRadius: 2,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulse 1.2s infinite' }} />
              REC · {fmtTime(elapsed)}
            </div>
          )}
        </div>

        {/* Record button */}
        <button
          onClick={toggle}
          disabled={!active}
          style={{
            width: '100%',
            padding: 14,
            border: '1px solid var(--bad)',
            background: isRecording ? 'var(--bad)' : 'rgba(212,122,122,.08)',
            color: isRecording ? '#fff' : 'var(--bad)',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            letterSpacing: '.2em',
            textTransform: 'uppercase',
            cursor: active ? 'pointer' : 'not-allowed',
            transition: 'all .2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: isRecording ? '#fff' : 'var(--bad)',
              animation: isRecording ? 'pulse 1.2s infinite' : undefined,
            }}
          />
          {isRecording
            ? (scope === 'deck'
                ? `Stop · slide ${String(liveSlideIdx || 0).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`
                : 'Stop recording')
            : (scope === 'deck' ? 'Record whole deck' : 'Record this slide')}
        </button>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            color: 'var(--ink-3)',
            letterSpacing: '.1em',
            textAlign: 'center',
            marginBottom: 18,
          }}
        >
          {scope === 'deck'
            ? (isRecording
                ? 'advance slides with ← → or the slide list — we auto-split on stop'
                : 'walk through the full deck · we auto-split clips per slide')
            : 'records just the current slide · streams to backend'}
        </div>

        {/* Scope toggle — per slide vs. whole deck */}
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.15em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 10 }}>
          take
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
          {[
            { id: 'slide' as const, label: 'This slide', hint: 'one clip per click' },
            { id: 'deck' as const,  label: 'Whole deck', hint: 'auto-split as you advance' },
          ].map(s => {
            const selected = s.id === scope;
            return (
              <button
                key={s.id}
                onClick={() => !isRecording && setScope(s.id)}
                disabled={isRecording}
                style={{
                  padding: 10,
                  border: '1px solid ' + (selected ? 'var(--accent)' : 'var(--line)'),
                  background: selected ? 'rgba(244,185,66,.05)' : 'var(--panel)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  cursor: isRecording ? 'not-allowed' : 'pointer',
                  transition: 'all .2s',
                  textAlign: 'left',
                  color: selected ? 'var(--ink)' : 'var(--ink-2)',
                }}
              >
                <span style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500 }}>{s.label}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.08em', color: 'var(--ink-3)' }}>{s.hint}</span>
              </button>
            );
          })}
        </div>

        {/* Mode selector */}
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '.15em',
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          capture mode
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
          {MODES.map(m => {
            const selected = m.id === mode;
            return (
              <button
                key={m.id}
                onClick={() => selectMode(m.id)}
                disabled={isRecording}
                style={{
                  padding: 10,
                  border: '1px solid ' + (selected ? 'var(--accent)' : 'var(--line)'),
                  background: selected ? 'rgba(244,185,66,.05)' : 'var(--panel)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  cursor: isRecording ? 'not-allowed' : 'pointer',
                  transition: 'all .2s',
                  textAlign: 'center',
                  color: selected ? 'var(--accent)' : 'var(--ink-2)',
                }}
              >
                <span>{m.icon}</span>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    letterSpacing: '.1em',
                    color: selected ? 'var(--ink)' : 'var(--ink-2)',
                    textTransform: 'uppercase',
                  }}
                >
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <div
            className="err"
            style={{ marginBottom: 12 }}
            role="alert"
          >
            ! {error}
          </div>
        )}

        {/* Clip list — one row per slide */}
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '.15em',
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          clips · {recordings.length} of {slides.length} slides recorded
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {slides.map(s => {
            const rec = recordings.find(r => r.slideId === s.id);
            const isCurrent = s.id === active?.id;
            return (
              <div
                key={s.id}
                onClick={() => onSelectSlide(s.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSlide(s.id); } }}
                style={{
                  padding: 10,
                  border: '1px solid ' + (isCurrent ? 'var(--accent)' : 'var(--line)'),
                  background: isCurrent ? 'rgba(244,185,66,.05)' : 'var(--panel)',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'border-color .15s',
                }}
              >
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', width: 22 }}>
                  {String(s.idx).padStart(2, '0')}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div
                    style={{ fontSize: 12, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {(s.title || '').replace(/<[^>]+>/g, '').slice(0, 40) || 'Untitled'}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.05em' }}>
                    {rec ? `${rec.mode} · ${Math.max(1, Math.round(rec.sizeBytes / 1024))} KB` : 'no recording'}
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-2)' }}>
                  {rec ? fmtTime(rec.durationMs) : '—'}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    disabled={!rec}
                    onClick={e => { e.stopPropagation(); if (rec) play(rec); }}
                    style={{
                      width: 24,
                      height: 24,
                      border: '1px solid var(--line-2)',
                      background: 'var(--panel-2)',
                      color: rec ? 'var(--accent)' : 'var(--ink-3)',
                      cursor: rec ? 'pointer' : 'not-allowed',
                      opacity: rec ? 1 : 0.3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-label="Play"
                  >
                    <svg width={8} height={8} viewBox="0 0 8 8" fill="currentColor">
                      <path d="M1 0l6 4-6 4z" />
                    </svg>
                  </button>
                  {rec && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteRec(rec.id); }}
                      style={{
                        width: 24,
                        height: 24,
                        border: '1px solid var(--line-2)',
                        background: 'var(--panel-2)',
                        color: 'var(--bad)',
                        cursor: 'pointer',
                        fontSize: 14,
                        lineHeight: 1,
                      }}
                      aria-label="Delete"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {playing && (
        <div
          onClick={() => setPlaying(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(12,13,15,.9)',
            zIndex: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 900, width: '100%' }}
          >
            <video
              src={playing.url}
              controls
              autoPlay
              style={{ width: '100%', maxHeight: '80vh', background: '#000' }}
            />
            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <button className="btn btn-ghost" onClick={() => setPlaying(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Keep the EditorClient's other panels & sanitizer helpers available to callers.
export { sanitizeSlideHtml };
