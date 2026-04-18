import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { EventType } from '@prisma/client';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => RealtimeGateway)) private gateway: RealtimeGateway,
  ) {}

  async track(input: {
    type: EventType;
    tellerId: string;
    shareId?: string;
    sessionId: string;
    email?: string;
    slideIdx?: number;
    dwellMs?: number;
    meta?: any;
  }) {
    const e = await this.prisma.event.create({ data: { ...input, meta: input.meta || {} } });
    if (input.shareId) this.gateway.broadcast(input.shareId, e);
    return { ok: true, id: e.id };
  }

  async funnel(tellerId: string) {
    // Pull only the columns we need; the three counts run in parallel at the DB.
    const [slides, slideViews, agentQueries, agentQueriesToday] = await Promise.all([
      this.prisma.slide.findMany({
        where: { tellerId },
        orderBy: { idx: 'asc' },
        select: { id: true, idx: true, title: true },
      }),
      this.prisma.event.findMany({
        where: { tellerId, type: 'SLIDE_VIEW' },
        select: { sessionId: true, email: true, slideIdx: true, dwellMs: true, at: true },
      }),
      this.prisma.event.count({ where: { tellerId, type: 'AGENT_QUERY' } }),
      this.prisma.event.count({
        where: { tellerId, type: 'AGENT_QUERY', at: { gte: new Date(Date.now() - 86_400_000) } },
      }),
    ]);
    const totalSlides = slides.length || 1;

    // Single pass over slideViews to build every aggregate.
    const perSlide: Map<number, Set<string | null>> = new Map();
    const sessions: Map<string, number> = new Map();
    const sessionDur: Map<string, number> = new Map();
    const perEmail: Map<string, { slidesSeen: Set<number>; dwellMs: number; lastSeen: number }> = new Map();
    const uniqEmails = new Set<string | null>();
    for (const e of slideViews) {
      uniqEmails.add(e.email);
      if (e.slideIdx != null) {
        let bucket = perSlide.get(e.slideIdx);
        if (!bucket) { bucket = new Set(); perSlide.set(e.slideIdx, bucket); }
        bucket.add(e.email);
        sessions.set(e.sessionId, Math.max(sessions.get(e.sessionId) || 0, e.slideIdx));
      }
      sessionDur.set(e.sessionId, (sessionDur.get(e.sessionId) || 0) + (e.dwellMs || 0));
      const k = e.email || 'anonymous';
      let v = perEmail.get(k);
      if (!v) { v = { slidesSeen: new Set(), dwellMs: 0, lastSeen: 0 }; perEmail.set(k, v); }
      if (e.slideIdx != null) v.slidesSeen.add(e.slideIdx);
      v.dwellMs += e.dwellMs || 0;
      v.lastSeen = Math.max(v.lastSeen, e.at.getTime());
    }

    const totalSessions = sessions.size || 1;
    const completedSessions = Array.from(sessions.values()).filter(r => r === totalSlides).length;
    const completion = Math.round((completedSessions / totalSessions) * 100);

    const funnel: Array<{ id: string; idx: number; title: string; views: number; pct: number; drop: number }> = [];
    let prevViews = 0;
    let maxViews = 0;
    for (const s of slides) {
      const views = perSlide.get(s.idx)?.size ?? 0;
      if (maxViews === 0) maxViews = views || 1;
      funnel.push({
        id: s.id,
        idx: s.idx,
        title: s.title,
        views,
        pct: Math.round((views / maxViews) * 100),
        drop: funnel.length === 0 ? 0 : Math.max(0, Math.round(((prevViews - views) / Math.max(prevViews, 1)) * 100)),
      });
      prevViews = views;
    }

    let biggestDrop: { drop: number; idx: number; title: string } = { drop: 0, idx: 0, title: '' };
    for (const r of funnel) {
      if (r.drop > biggestDrop.drop) biggestDrop = { drop: r.drop, idx: r.idx, title: r.title };
    }

    let dwellSum = 0;
    for (const v of sessionDur.values()) dwellSum += v;
    const avgSessionMs = dwellSum / (sessionDur.size || 1);

    const viewers = Array.from(perEmail.entries())
      .map(([email, v]) => ({
        email,
        name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        slidesSeen: v.slidesSeen.size,
        totalSlides,
        dwellMs: v.dwellMs,
        lastSeen: v.lastSeen,
      }))
      .sort((a, b) => b.slidesSeen - a.slidesSeen);

    return {
      totalSlides,
      uniqueViewers: uniqEmails.size,
      completion,
      biggestDrop,
      agentQueries,
      agentQueriesToday,
      avgSessionMs,
      funnel,
      viewers,
    };
  }
}
