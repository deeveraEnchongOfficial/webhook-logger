const WINDOW_MS = 60_000;
const EVICT_AFTER_MS = 2 * WINDOW_MS;

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(private readonly perMinute: number) {}

  allow(key: string, now: number = Date.now()): boolean {
    this.evict(now);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.perMinute, updatedAt: now };
      this.buckets.set(key, bucket);
    }
    const elapsed = now - bucket.updatedAt;
    const refill = (elapsed / WINDOW_MS) * this.perMinute;
    bucket.tokens = Math.min(this.perMinute, bucket.tokens + refill);
    bucket.updatedAt = now;
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  get size(): number {
    return this.buckets.size;
  }

  private evict(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updatedAt > EVICT_AFTER_MS) this.buckets.delete(key);
    }
  }
}
