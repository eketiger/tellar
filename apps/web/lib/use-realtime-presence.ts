'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Lightweight realtime status hook for the topbar LIVE dot.
 *
 * Connects to the NestJS Socket.IO `/ws` namespace once per browser tab
 * and exposes:
 *   - `connected`  — whether the websocket handshake has succeeded.
 *   - `liveCount`  — how many active share sessions the gateway reports
 *                    in its `live:count` ticks (currently the global
 *                    rolling count; per-workspace is a follow-up).
 *
 * Reuses the same env var as LiveFunnel (`NEXT_PUBLIC_WS_URL`) and
 * gracefully no-ops when the WS server is unreachable so the topbar
 * never shows a misleading green dot.
 */
export function useRealtimePresence(): { connected: boolean; liveCount: number | null } {
  const [connected, setConnected] = useState(false);
  const [liveCount, setLiveCount] = useState<number | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3333';
    let socket: Socket | undefined;
    try {
      socket = io(`${url}/ws`, { withCredentials: true, transports: ['websocket'], reconnection: true, reconnectionAttempts: 5 });
      socket.on('connect', () => setConnected(true));
      socket.on('disconnect', () => setConnected(false));
      socket.on('connect_error', () => setConnected(false));
      socket.on('live:count', (payload: { count: number }) => {
        if (typeof payload?.count === 'number') setLiveCount(payload.count);
      });
    } catch {
      setConnected(false);
    }
    return () => {
      try { socket?.disconnect(); } catch {/* noop */}
    };
  }, []);

  return { connected, liveCount };
}
