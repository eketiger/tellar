import { HttpException } from '@nestjs/common';
import { ViewerController } from './viewer.controller';

const passShare = (over: Partial<any> = {}) => ({
  id: 'share_1',
  slug: 'abc',
  accessMode: 'PASSPHRASE' as const,
  expiresAt: null as Date | null,
  perms: {},
  invitees: [],
  ...over,
});

function makeCtl(overrides: Partial<{ verify: () => Promise<boolean> }> = {}) {
  const verify = overrides.verify ?? jest.fn(async () => false);
  const shares = {
    bySlug: jest.fn(async () => passShare()),
    verifyPassphrase: verify,
    touchInvitee: jest.fn(),
  } as any;
  const jwt = { signAsync: jest.fn(async () => 'tok') } as any;
  return { ctl: new ViewerController(shares, jwt), shares, verify };
}

describe('ViewerController.authorize rate-limit', () => {
  it('rejects after the per-IP bucket runs out', async () => {
    const { ctl } = makeCtl();
    const ip = '1.2.3.4';
    const dto: any = { passphrase: 'wrong' };

    // Bucket capacity is 10 — the 11th call must be rate-limited even if
    // the verifier itself would just return ForbiddenException.
    let lastError: unknown;
    for (let i = 0; i < 11; i++) {
      try {
        await ctl.authorize('abc', ip, dto);
      } catch (e) {
        lastError = e;
      }
    }
    expect(lastError).toBeInstanceOf(HttpException);
    expect((lastError as HttpException).getStatus()).toBe(429);
    expect((lastError as HttpException).getResponse()).toMatchObject({ reason: 'rate-limited' });
  });

  it('IPs are isolated — one attacker does not lock out a different visitor', async () => {
    const { ctl } = makeCtl();
    const dto: any = { passphrase: 'wrong' };
    for (let i = 0; i < 10; i++) {
      try { await ctl.authorize('abc', '1.1.1.1', dto); } catch {}
    }
    // Use a *different* slug so the slug-level bucket is fresh, and a
    // different IP — the new visitor should hit the verifier
    // (ForbiddenException 403), not the rate-limiter (429).
    let err: any = null;
    try { await ctl.authorize('zzz', '2.2.2.2', dto); } catch (e) { err = e; }
    expect(err).not.toBeNull();
    expect(err.getStatus()).toBe(403);
  });
});
