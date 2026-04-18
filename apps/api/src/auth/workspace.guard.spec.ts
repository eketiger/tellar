import { ForbiddenException } from '@nestjs/common';
import { WorkspaceGuard } from './workspace.guard';

function mkCtx(opts: { user?: any; params?: any; url?: string }) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: opts.user,
        params: opts.params || {},
        originalUrl: opts.url || '/api/',
        url: opts.url || '/api/',
      }),
    }),
  } as any;
}

describe('WorkspaceGuard', () => {
  it('rejects when no session', async () => {
    const g = new WorkspaceGuard({} as any);
    await expect(g.canActivate(mkCtx({ user: undefined }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects on cross-tenant workspaceId param', async () => {
    const g = new WorkspaceGuard({} as any);
    await expect(
      g.canActivate(mkCtx({ user: { ws: 'ws1' }, params: { workspaceId: 'ws2' } })),
    ).rejects.toThrow(/Cross-tenant/);
  });

  it('lets same-tenant workspaceId through', async () => {
    const g = new WorkspaceGuard({} as any);
    await expect(
      g.canActivate(mkCtx({ user: { ws: 'ws1' }, params: { workspaceId: 'ws1' } })),
    ).resolves.toBe(true);
  });

  it('rejects when teller belongs to another workspace', async () => {
    const prisma = {
      teller: { findUnique: jest.fn().mockResolvedValue({ id: 't1', workspaceId: 'other' }) },
    } as any;
    const g = new WorkspaceGuard(prisma);
    await expect(
      g.canActivate(
        mkCtx({ user: { ws: 'ws1' }, params: { id: 't1' }, url: '/api/tellers/t1' }),
      ),
    ).rejects.toThrow(/Not yours/);
  });

  it('passes when teller belongs to the active workspace', async () => {
    const prisma = {
      teller: { findUnique: jest.fn().mockResolvedValue({ id: 't1', workspaceId: 'ws1' }) },
    } as any;
    const g = new WorkspaceGuard(prisma);
    await expect(
      g.canActivate(
        mkCtx({ user: { ws: 'ws1' }, params: { id: 't1' }, url: '/api/tellers/t1' }),
      ),
    ).resolves.toBe(true);
  });

  it('rejects when slide belongs to a teller in another workspace', async () => {
    const prisma = {
      slide: {
        findUnique: jest.fn().mockResolvedValue({ id: 's1', teller: { workspaceId: 'other' } }),
      },
    } as any;
    const g = new WorkspaceGuard(prisma);
    await expect(
      g.canActivate(mkCtx({ user: { ws: 'ws1' }, params: { slideId: 's1' } })),
    ).rejects.toThrow(/Not yours/);
  });
});
