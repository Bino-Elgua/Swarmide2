// Rate Limiting Service
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  tier: 'free' | 'pro' | 'enterprise';
}

export interface RateLimitStatus {
  remaining: number;
  limit: number;
  resetAt: number;
  exceeded: boolean;
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  canConsume(amount = 1): boolean {
    this.refill();
    if (this.tokens >= amount) {
      this.tokens -= amount;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  getStatus(): { tokens: number; capacity: number } {
    this.refill();
    return { tokens: this.tokens, capacity: this.capacity };
  }
}

export class SlidingWindow {
  private requests: number[] = [];
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  canConsume(): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove old requests outside the window
    this.requests = this.requests.filter(timestamp => timestamp > windowStart);

    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return true;
    }

    return false;
  }

  getStatus(): RateLimitStatus {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    this.requests = this.requests.filter(timestamp => timestamp > windowStart);

    const resetAt = this.requests.length > 0 
      ? this.requests[0] + this.windowMs 
      : now;

    return {
      remaining: Math.max(0, this.maxRequests - this.requests.length),
      limit: this.maxRequests,
      resetAt,
      exceeded: this.requests.length >= this.maxRequests,
    };
  }
}

export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private slidingWindows: Map<string, SlidingWindow> = new Map();
  private tierConfigs: Record<string, RateLimitConfig> = {
    free: { maxRequests: 100, windowMs: 3600000, tier: 'free' }, // 100/hour
    pro: { maxRequests: 10000, windowMs: 3600000, tier: 'pro' }, // 10k/hour
    enterprise: { maxRequests: -1, windowMs: 3600000, tier: 'enterprise' }, // unlimited
  };

  checkLimit(key: string, tier: 'free' | 'pro' | 'enterprise' = 'free'): RateLimitStatus {
    if (tier === 'enterprise') {
      return {
        remaining: Infinity,
        limit: Infinity,
        resetAt: 0,
        exceeded: false,
      };
    }

    const config = this.tierConfigs[tier];
    const windowKey = `${key}:${tier}`;

    // Use token bucket for simplicity
    if (!this.buckets.has(windowKey)) {
      const refillRate = config.maxRequests / (config.windowMs / 1000);
      this.buckets.set(windowKey, new TokenBucket(config.maxRequests, refillRate));
    }

    const bucket = this.buckets.get(windowKey)!;
    const canConsume = bucket.canConsume();
    const status = bucket.getStatus();

    return {
      remaining: Math.floor(status.tokens),
      limit: status.capacity,
      resetAt: Date.now() + (status.capacity - status.tokens) * 1000 / (config.maxRequests / (config.windowMs / 1000)),
      exceeded: !canConsume,
    };
  }

  reset(key: string): void {
    Array.from(this.buckets.keys())
      .filter(k => k.startsWith(key))
      .forEach(k => this.buckets.delete(k));

    Array.from(this.slidingWindows.keys())
      .filter(k => k.startsWith(key))
      .forEach(k => this.slidingWindows.delete(k));
  }

  getStatus(key: string, tier: 'free' | 'pro' | 'enterprise' = 'free'): RateLimitStatus {
    return this.checkLimit(key, tier);
  }
}

export const rateLimiter = new RateLimiter();

export default rateLimiter;
