import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  it('allows up to capacity on a cold bucket', () => {
    const rl = new RateLimiter(3, 0.0001); // essentially no refill in the test
    expect(rl.tryConsume('a')).toBe(true);
    expect(rl.tryConsume('a')).toBe(true);
    expect(rl.tryConsume('a')).toBe(true);
    expect(rl.tryConsume('a')).toBe(false);
  });

  it('refills over time', async () => {
    const rl = new RateLimiter(2, 1000); // 1000 tokens/sec → refills fast
    expect(rl.tryConsume('a')).toBe(true);
    expect(rl.tryConsume('a')).toBe(true);
    expect(rl.tryConsume('a')).toBe(false);
    await new Promise(r => setTimeout(r, 20));
    expect(rl.tryConsume('a')).toBe(true);
  });

  it('buckets are per-key', () => {
    const rl = new RateLimiter(1, 0.0001);
    expect(rl.tryConsume('a')).toBe(true);
    expect(rl.tryConsume('a')).toBe(false);
    expect(rl.tryConsume('b')).toBe(true);
  });

  it('evicts when maxKeys is exceeded', () => {
    const rl = new RateLimiter(1, 0.0001, 2);
    expect(rl.tryConsume('a')).toBe(true);
    expect(rl.tryConsume('b')).toBe(true);
    expect(rl.tryConsume('c')).toBe(true); // triggers eviction, 'c' starts with full bucket
  });
});
