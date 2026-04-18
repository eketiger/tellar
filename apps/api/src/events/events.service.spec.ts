import { EventsService } from './events.service';

describe('EventsService.funnel', () => {
  it('computes per-slide pct and drop correctly', async () => {
    const slides = [
      { id: 's1', idx: 1, title: 'One' },
      { id: 's2', idx: 2, title: 'Two' },
      { id: 's3', idx: 3, title: 'Three' },
    ];
    const events = [
      { sessionId: 'a', email: 'a@x.com', slideIdx: 1, dwellMs: 1000, at: new Date() },
      { sessionId: 'a', email: 'a@x.com', slideIdx: 2, dwellMs: 1000, at: new Date() },
      { sessionId: 'b', email: 'b@x.com', slideIdx: 1, dwellMs: 1000, at: new Date() },
    ];
    const prisma = {
      slide: { findMany: jest.fn().mockResolvedValue(slides) },
      event: {
        findMany: jest.fn().mockResolvedValue(events),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const gateway = { broadcast: jest.fn() };
    const svc = new EventsService(prisma as any, gateway as any);
    const r: any = await svc.funnel('tlr1');
    expect(r.totalSlides).toBe(3);
    expect(r.uniqueViewers).toBe(2);
    expect(r.funnel.map((f: any) => f.views)).toEqual([2, 1, 0]);
    // first row has no drop; second row dropped from 2 → 1 = 50%
    expect(r.funnel[0].drop).toBe(0);
    expect(r.funnel[1].drop).toBe(50);
  });
});
