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
    const slides = await this.prisma.slide.findMany({
      where: { tellerId },
      orderBy: { idx: 'asc' },
    });
    const totalSlides = slides.length || 1;
    const slideViews = await this.prisma.event.findMany({
      where: { tellerId, type: 'SLIDE_VIEW' },
    });

    const uniqViewers = new Set(slideViews.map(e => e.email)).size;
    const sessions: Record<string, number> = {};
    for (const e of slideViews) {
      const id = e.sessionId;
      sessions[id] = Math.max(sessions[id] || 0, e.slideIdx || 0);
    }
    const totalSessions = Object.keys(sessions).length || 1;
    const completedSessions = Object.values(sessions).filter(r => r === totalSlides).length;
    const completion = Math.round((completedSessions / totalSessions) * 100);

    const funnel = slides.map(s => {
      const uniq = new Set(slideViews.filter(e => e.slideIdx === s.idx).map(e => e.email));
      return { ...s, views: uniq.size };
    });
    const max = funnel[0]?.views || 1;
    funnel.forEach((r, i) => {
      (r as any).pct = Math.round((r.views / max) * 100);
      (r as any).drop =
        i === 0
          ? 0
          : Math.max(0, Math.round(((funnel[i - 1].views - r.views) / Math.max(funnel[i - 1].views, 1)) * 100));
    });

    let biggestDrop: any = { drop: 0, idx: 0, title: '' };
    for (const r of funnel as any[]) {
      if (r.drop > biggestDrop.drop) biggestDrop = { drop: r.drop, idx: r.idx, title: r.title };
    }

    const agentQueries = await this.prisma.event.count({ where: { tellerId, type: 'AGENT_QUERY' } });
    const agentQueriesToday = await this.prisma.event.count({
      where: { tellerId, type: 'AGENT_QUERY', at: { gte: new Date(Date.now() - 86_400_000) } },
    });

    const sessionDur: Record<string, number> = {};
    for (const e of slideViews) sessionDur[e.sessionId] = (sessionDur[e.sessionId] || 0) + (e.dwellMs || 0);
    const avgSessionMs =
      Object.values(sessionDur).reduce((a, b) => a + b, 0) / (Object.keys(sessionDur).length || 1);

    const perEmail: Record<string, any> = {};
    for (const e of slideViews) {
      const k = e.email || 'anonymous';
      if (!perEmail[k]) perEmail[k] = { email: k, slidesSeen: new Set<number>(), dwellMs: 0, lastSeen: 0 };
      perEmail[k].slidesSeen.add(e.slideIdx!);
      perEmail[k].dwellMs += e.dwellMs || 0;
      perEmail[k].lastSeen = Math.max(perEmail[k].lastSeen, e.at.getTime());
    }
    const viewers = Object.values(perEmail)
      .map((v: any) => ({
        email: v.email,
        name: v.email
          .split('@')[0]
          .replace(/[._]/g, ' ')
          .replace(/\b\w/g, (c: string) => c.toUpperCase()),
        slidesSeen: v.slidesSeen.size,
        totalSlides,
        dwellMs: v.dwellMs,
        lastSeen: v.lastSeen,
      }))
      .sort((a, b) => b.slidesSeen - a.slidesSeen);

    return {
      totalSlides,
      uniqueViewers: uniqViewers,
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
