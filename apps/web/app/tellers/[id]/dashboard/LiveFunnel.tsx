'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Row {
  id: string;
  idx: number;
  title: string;
  views: number;
  pct: number;
  drop: number;
}

export function LiveFunnel({ initialFunnel, shareId }: { initialFunnel: Row[]; shareId?: string }) {
  const [rows, setRows] = useState<Row[]>(initialFunnel);

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
          return prev.map(r =>
            r.idx === ev.slideIdx ? { ...r, views: r.views + 1, pct: Math.round(((r.views + 1) / maxViews) * 100) } : r,
          );
        });
      });
    } catch {
      // socket optional
    }
    return () => { socket?.disconnect(); };
  }, [shareId]);

  return (
    <div className="funnel">
      {rows.map((r, i) => (
        <div key={r.id || r.idx} className={`slide-row ${r.drop > 30 ? 'focus' : ''}`}>
          <div className="slide-num">{String(r.idx).padStart(2, '0')}</div>
          <div className="slide-body">
            <div className="slide-title" dangerouslySetInnerHTML={{ __html: r.title }} />
            <div className="bar"><div className={`bar-fill ${r.pct < 20 ? 'dim' : ''}`} style={{ width: r.pct + '%' }} /></div>
          </div>
          <div className="slide-time">{r.views} views</div>
          <div className={`slide-drop ${r.drop > 30 ? 'drop-heavy' : r.drop > 10 ? 'drop-mild' : 'drop-light'}`}>
            {i === 0 ? '—' : `↓ ${r.drop}%`}
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="note">No data yet.</p>}
    </div>
  );
}
