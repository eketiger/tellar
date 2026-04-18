import { GdprService } from './gdpr.service';

describe('GdprService', () => {
  it('redacts passwordHash from data export', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'a@b.com',
          passwordHash: 'secret-hash-should-never-leave',
          memberships: [],
          sessions: [],
          ownedWorkspaces: [],
          subscriptions: [],
          invoices: [],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      cookieConsent: { create: jest.fn() },
    };
    const svc = new GdprService(prisma);
    const out = await svc.dataExport('u1');
    expect((out.user as any).passwordHash).toBeUndefined();
    // Update stamped the request time
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { dataExportRequestedAt: expect.any(Date) },
    });
  });

  it('requestDeletion soft-deletes and schedules a 30-day hard delete', async () => {
    const prisma: any = { user: { update: jest.fn().mockResolvedValue({}) } };
    const svc = new GdprService(prisma);
    const r = await svc.requestDeletion('u1');
    expect(r.ok).toBe(true);
    const at = new Date(r.scheduledDeletionAt);
    const ms = at.getTime() - Date.now();
    expect(ms).toBeGreaterThan(29 * 86_400_000);
    expect(ms).toBeLessThan(31 * 86_400_000);
    // Suspension is set immediately so a revoked account can't keep taking actions
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isSuspended: true }) }),
    );
  });

  it('hashIp returns a stable 24-char fingerprint', () => {
    const prisma: any = {};
    const svc = new GdprService(prisma);
    const a = svc.hashIp('1.2.3.4');
    const b = svc.hashIp('1.2.3.4');
    const c = svc.hashIp('5.6.7.8');
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.length).toBe(24);
  });
});
