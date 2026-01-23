// Redis Distributed Caching Service
export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class RedisCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private subscribers: Map<string, Set<(value: T) => void>> = new Map();
  private pubSubChannels: Map<string, Set<string>> = new Map();

  set(key: string, value: T, ttl = 3600): void {
    const expiresAt = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiresAt });

    // Cleanup expired entries
    this.cleanupExpired();
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  del(key: string): boolean {
    return this.cache.delete(key);
  }

  exists(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  getOrSet(key: string, fn: () => Promise<T>, ttl = 3600): Promise<T> {
    const cached = this.get(key);
    if (cached) return Promise.resolve(cached);

    return fn().then(value => {
      this.set(key, value, ttl);
      return value;
    });
  }

  // Pub/Sub support
  subscribe(channel: string, handler: (value: any) => void): void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(handler);
  }

  unsubscribe(channel: string, handler: (value: any) => void): void {
    const handlers = this.subscribers.get(channel);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  publish(channel: string, message: any): number {
    const handlers = this.subscribers.get(channel);
    if (!handlers) return 0;

    handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error(`Error in subscriber for ${channel}:`, error);
      }
    });

    return handlers.size;
  }

  // Cache invalidation
  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern);
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  // Cache warming
  async warm(key: string, fn: () => Promise<T>, ttl = 3600): Promise<void> {
    const value = await fn();
    this.set(key, value, ttl);
  }

  // Statistics
  getStats(): {
    size: number;
    keys: string[];
    expiredCount: number;
  } {
    let expiredCount = 0;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      if (entry.expiresAt < now) {
        expiredCount++;
      }
    }

    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      expiredCount,
    };
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  clear(): void {
    this.cache.clear();
    this.subscribers.clear();
  }

  // Batch operations
  async mget(keys: string[]): Promise<(T | null)[]> {
    return keys.map(key => this.get(key));
  }

  async mset(entries: Array<[string, T, number]>): Promise<void> {
    entries.forEach(([key, value, ttl]) => this.set(key, value, ttl));
  }
}

export const redisCache = new RedisCache();

export default redisCache;
