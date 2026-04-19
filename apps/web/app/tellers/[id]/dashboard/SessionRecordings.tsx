'use client';

import { useState } from 'react';

interface Rec { idx: number; name: string; email: string; bg: string; fg: string; min: number; sec: number; when: string; live: boolean; slidesSeen: number; totalSlides: number; reachPct: number; }

export function SessionRecordings({ items }: { items: Rec[] }) {
  const [open, setOpen] = useState<Rec | null>(null);

  if (!items.length) {
    return <p className="note">No session recordings yet.</p>;
  }

  return (
    <>
      <div className="rec-grid">
        {items.map(r => (
          <div key={r.idx} className="rec-card" onClick={() => setOpen(r)}>
            <div className="rec-thumb">
              <div className="rec-thumb-grid">
                <div className="rec-thumb-bar" />
                <div className="rec-thumb-body">
                  <div /><div />
                </div>
              </div>
              {r.live && <div className="rec-live">live</div>}
              <div className="rec-play" />
              <div className="rec-dur">{r.min}:{String(r.sec).padStart(2, '0')}</div>
            </div>
            <div className="rec-meta">
              <div className="rec-top">
                <div className="rec-av" style={{ background: r.bg, color: r.fg }}>{r.name[0].toUpperCase()}</div>
                <div className="rec-who">
                  <div className="rec-name">{r.name}</div>
                  <div className="rec-when">{r.when}</div>
                </div>
              </div>
              <div className="rec-stats">
                <span>read <b>{r.slidesSeen}/{r.totalSlides}</b> slides</span>
                <span className="sep">/</span>
                <span><b>{r.reachPct}%</b> reach</span>
                <span className="sep">/</span>
                <span><b>1080p</b></span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div
          onClick={() => setOpen(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(12,13,15,.85)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, cursor: 'pointer' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 1000, width: '100%', background: 'var(--panel)', border: '1px solid var(--line-2)', cursor: 'default' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="rec-av" style={{ background: open.bg, color: open.fg, width: 32, height: 32, fontSize: 13 }}>{open.name[0].toUpperCase()}</div>
                <div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>
                    {open.name} <em style={{ color: 'var(--ink-3)', fontStyle: 'italic', fontWeight: 400 }}>— session replay</em>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.05em' }}>
                    {open.email} · {open.when} · {open.min}:{String(open.sec).padStart(2, '0')}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(null)}
                style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--ink-2)', fontFamily: 'var(--mono)', fontSize: 11, padding: '6px 12px', cursor: 'pointer', letterSpacing: '.15em', textTransform: 'uppercase' }}
              >
                Close
              </button>
            </div>
            <div style={{ aspectRatio: '16/9', background: '#0c0d0f', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase' }}>
                <div className="rec-play" style={{ position: 'static', margin: '0 auto 16px', transform: 'none', width: 56, height: 56 }} />
                Press play to replay screen capture
              </div>
            </div>
            <div style={{ padding: '14px 20px', background: 'var(--panel-2)', borderTop: '1px solid var(--line)', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.05em', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <span>reached <b style={{ color: 'var(--accent)' }}>{open.slidesSeen}/{open.totalSlides}</b> slides</span>
              <span>dwell <b style={{ color: 'var(--ink)' }}>{open.min}m {String(open.sec).padStart(2, '0')}s</b></span>
              <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>encrypted · viewer-consented</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
