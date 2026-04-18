import { SharesService } from './shares.service';

describe('SharesService.update', () => {
  it('deep-merges perms rather than replacing', async () => {
    const existing = {
      id: 's1',
      perms: { agent: true, recording: true, download: false, watermark: true },
    };
    const updated: any[] = [];
    const prisma: any = {
      share: {
        findUnique: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockImplementation(args => {
          updated.push(args);
          return Promise.resolve({ ...existing, ...args.data });
        }),
      },
    };
    const svc = new SharesService(prisma);
    await svc.update('s1', { perms: { download: true } } as any);
    // The update data should merge: download=true, but agent/recording/watermark stay
    expect(updated[0].data.perms).toEqual({
      agent: true,
      recording: true,
      download: true,
      watermark: true,
    });
  });

  it('hashes passphrase and strips it from the persisted payload', async () => {
    const prisma: any = {
      share: {
        findUnique: jest.fn().mockResolvedValue({ id: 's1', perms: {} }),
        update: jest.fn().mockImplementation(args => Promise.resolve(args.data)),
      },
    };
    const svc = new SharesService(prisma);
    const out = await svc.update('s1', { passphrase: 'hunter2' } as any);
    expect((out as any).passphrase).toBeUndefined();
    expect((out as any).passphraseHash).toEqual(expect.stringContaining('$argon2'));
  });
});
