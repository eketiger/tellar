/**
 * Token-bucket rate limiter in memory. Per process.
 * For single-node dev + small-scale prod this is enough; we wire Redis when we
 * horizontally scale. Kept intentionally dumb: O(1) per call, no timers.
 */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();
  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
    private readonly maxKeys = 10_000,
  ) {}

  tryConsume(key: string, cost = 1): boolean {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b) {
      if (this.buckets.size >= this.maxKeys) {
        // Cheap eviction: drop the oldest key we happen to see first.
        const firstKey = this.buckets.keys().next().value;
        if (firstKey) this.buckets.delete(firstKey);
      }
      b = { tokens: this.capacity, lastRefill: now };
      this.buckets.set(key, b);
    }
    const elapsedSec = (now - b.lastRefill) / 1000;
    b.tokens = Math.min(this.capacity, b.tokens + elapsedSec * this.refillPerSec);
    b.lastRefill = now;
    if (b.tokens < cost) return false;
    b.tokens -= cost;
    return true;
  }
}
