import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  it('allows up to capacity on a cold bucket', () => {
    const rl = new RateLimiter(3, 0.0001); // essentially no refill in the test
    expect(rl.tryConsume('a')).toBe(true);
    expect(rl.tryConsume('a')).toBe(true);
    expect(rl.tryConsume('a')).toBe(true);
    expect(rl.tryConsume('a')).toBe(false);
  });

  it('refills over time', () => {
    // Use fake timers so the test is deterministic regardless of how slow
    // coverage instrumentation makes the surrounding sync calls run.
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const rl = new RateLimiter(2, 1); // 1 token per second
      expect(rl.tryConsume('a')).toBe(true);
      expect(rl.tryConsume('a')).toBe(true);
      expect(rl.tryConsume('a')).toBe(false);
      // Advance the clock by 2 seconds — bucket should be back at capacity.
      jest.setSystemTime(new Date('2026-01-01T00:00:02Z'));
      expect(rl.tryConsume('a')).toBe(true);
      expect(rl.tryConsume('a')).toBe(true);
      expect(rl.tryConsume('a')).toBe(false);
    } finally {
      jest.useRealTimers();
    }
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
