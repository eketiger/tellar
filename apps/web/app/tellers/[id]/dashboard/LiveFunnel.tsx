'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { sanitizeSlideHtml } from '@/lib/sanitize';

interface Row { id: string; idx: number; title: string; views: number; pct: number; drop: number; }

export function LiveFunnel({ initialFunnel, biggestDropIdx, shareId }: { initialFunnel: Row[]; biggestDropIdx: number; shareId?: string }) {
  const [rows, setRows] = useState<Row[]>(initialFunnel);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t); }, []);

  useEffect(() => {
    if (!shareId) return;
    const url = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3333';
    let socket: Socket | undefined;
    try {
      socket = io(`${url}/ws`, { withCredentials: true, transports: ['websocket'] });
      socket.emit('share:subscribe', { shareId, jwt: '' });
      socket.on('event', (ev: any) => {
        if (ev.type !== 'SLIDE_VIEW' || !ev.slideIdx) return;
        setRows(prev => {
          const maxViews = prev[0]?.views || 1;
          return prev.map(r => r.idx === ev.slideIdx ? { ...r, views: r.views + 1, pct: Math.round(((r.views + 1) / maxViews) * 100) } : r);
        });
      });
    } catch {/* noop */}
    return () => { socket?.disconnect(); };
  }, [shareId]);

  return (
    <>
      <div className="td-funnel">
        {rows.map((r, i) => {
          const dropClass = r.drop >= 20 ? 'td-drop-heavy' : r.drop >= 6 ? 'td-drop-mild' : 'td-drop-light';
          const focus = r.idx === biggestDropIdx && r.drop > 0;
          return (
            <div key={r.id || r.idx} className={`td-slide-row${focus ? ' focus' : ''}`} style={{ animationDelay: `${i * 35}ms` }}>
              <div className="td-slide-num">{String(r.idx).padStart(2, '0')}</div>
              <div className="td-slide-body">
                <div className="td-slide-title" dangerouslySetInnerHTML={{ __html: sanitizeSlideHtml(r.title) }} />
                <div className="td-bar"><div className={`td-bar-fill${r.pct < 50 ? ' dim' : ''}`} style={{ width: mounted ? r.pct + '%' : '0%' }} /></div>
              </div>
              <div className="td-slide-views">{r.views} views</div>
              <div className={`td-slide-drop ${dropClass}`}>{i === 0 ? '—' : `${r.drop > 0 ? '−' : ''}${r.drop}%`}</div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="note">No data yet.</p>}
      </div>
      <div className="funnel-legend">
        <span><span className="dot" style={{ background: 'linear-gradient(90deg,var(--accent),var(--accent-2))' }} />viewed</span>
        <span><span className="dot" style={{ background: '#4a4844' }} />low reach</span>
        <span><span className="dot" style={{ background: 'var(--bad)' }} />heavy drop-off (&gt;20%)</span>
      </div>
    </>
  );
}
