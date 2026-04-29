import { ForbiddenException } from '@nestjs/common';
import { AuthoringService } from './authoring.service';

describe('AuthoringService.chatTurn', () => {
  const orig = { ...process.env };
  beforeEach(() => { process.env = { ...orig }; });
  afterAll(() => { process.env = orig; });

  function makeSvc(prisma: any) {
    return new AuthoringService(prisma);
  }

  it('returns mock reply when ANTHROPIC_API_KEY is unset', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const prisma: any = {
      teller: { findUnique: jest.fn(async () => ({ id: 't1', workspaceId: 'ws1', title: 'D', slides: [] })) },
    };
    const svc = makeSvc(prisma);
    const r = await svc.chatTurn({ tellerId: 't1', workspaceId: 'ws1', message: 'hi' });
    expect(r.fallback).toBe(true);
    expect(r.reply).toMatch(/mock mode/i);
    expect(r.appliedTools).toEqual([]);
  });

  it('rejects cross-workspace requests', async () => {
    const prisma: any = {
      teller: { findUnique: jest.fn(async () => ({ id: 't1', workspaceId: 'ws-other', title: 'D', slides: [] })) },
    };
    const svc = makeSvc(prisma);
    await expect(
      svc.chatTurn({ tellerId: 't1', workspaceId: 'ws1', message: 'hi' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects unknown teller', async () => {
    const prisma: any = { teller: { findUnique: jest.fn(async () => null) } };
    const svc = makeSvc(prisma);
    await expect(
      svc.chatTurn({ tellerId: 'nope', workspaceId: 'ws1', message: 'hi' }),
    ).rejects.toThrow(ForbiddenException);
  });
});
