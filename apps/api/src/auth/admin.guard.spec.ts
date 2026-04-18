import { ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

function mkCtx(userSub: string) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: { sub: userSub } }) }),
  } as any;
}

describe('AdminGuard', () => {
  it('throws when no user', async () => {
    const prisma = { user: { findUnique: jest.fn() } };
    const g = new AdminGuard(prisma as any);
    const ctx = { switchToHttp: () => ({ getRequest: () => ({}) }) } as any;
    await expect(g.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when user is not admin', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ role: 'USER', isSuspended: false }) } };
    const g = new AdminGuard(prisma as any);
    await expect(g.canActivate(mkCtx('u1'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when suspended, even if admin', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ role: 'ADMIN', isSuspended: true }) } };
    const g = new AdminGuard(prisma as any);
    await expect(g.canActivate(mkCtx('u1'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admin', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ role: 'ADMIN', isSuspended: false }) } };
    const g = new AdminGuard(prisma as any);
    await expect(g.canActivate(mkCtx('u1'))).resolves.toBe(true);
  });
});
