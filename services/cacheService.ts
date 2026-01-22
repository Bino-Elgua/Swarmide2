// Caching and performance optimization service
export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
  created: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgHits: number;
}

export class Cache<T = any> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private hits = 0;
  private misses = 0;
  private maxSize = 1000;
  private defaultTTL = 3600000; // 1 hour

  constructor(maxSize = 1000, defaultTTL = 3600000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;

    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 300000);
  }

  set(key: string, value: T, ttl = this.defaultTTL): void {
    // Evict oldest entry if cache is full
    if (this.store.size >= this.maxSize) {
      const oldest = Array.from(this.store.entries()).reduce((prev, current) =>
        current[1].created < prev[1].created ? current : prev
      );
      this.store.delete(oldest[0]);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      hits: 0,
      created: Date.now(),
    });
  }

  get(key: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    entry.hits++;
    this.hits++;
    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt < now) {
        expired.push(key);
      }
    }

    expired.forEach(key => this.store.delete(key));
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;
    const avgHits = this.store.size > 0
      ? Array.from(this.store.values()).reduce((sum, e) => sum + e.hits, 0) / this.store.size
      : 0;

    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      avgHits,
    };
  }
}

export class MemoizedFunction<T extends (...args: any[]) => any> {
  private cache: Cache<ReturnType<T>>;
  private fn: T;
  private keyGenerator: (...args: Parameters<T>) => string;

  constructor(
    fn: T,
    keyGenerator?: (...args: Parameters<T>) => string,
    ttl = 3600000
  ) {
    this.fn = fn;
    this.cache = new Cache<ReturnType<T>>(1000, ttl);
    this.keyGenerator =
      keyGenerator || ((...args) => JSON.stringify(args));
  }

  async execute(...args: Parameters<T>): Promise<ReturnType<T>> {
    const key = this.keyGenerator(...args);
    const cached = this.cache.get(key);

    if (cached !== null) {
      return cached;
    }

    const result = await this.fn(...args);
    this.cache.set(key, result);
    return result;
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return this.cache.getStats();
  }
}

// Request deduplication
export class RequestDeduplicator<T> {
  private pending: Map<string, Promise<T>> = new Map();
  private keyGenerator: (...args: any[]) => string;

  constructor(keyGenerator?: (...args: any[]) => string) {
    this.keyGenerator = keyGenerator || ((...args) => JSON.stringify(args));
  }

  async execute<Args extends any[]>(
    key: string,
    fn: (...args: Args) => Promise<T>,
    ...args: Args
  ): Promise<T> {
    const dedupeKey = `${key}:${this.keyGenerator(...args)}`;

    // Return existing pending request if available
    if (this.pending.has(dedupeKey)) {
      return this.pending.get(dedupeKey)!;
    }

    // Create and store pending request
    const promise = fn(...args).finally(() => {
      this.pending.delete(dedupeKey);
    });

    this.pending.set(dedupeKey, promise);
    return promise;
  }

  getPendingCount(): number {
    return this.pending.size;
  }
}

// Batch processing for bulk operations
export class BatchProcessor<Input, Output> {
  private queue: Input[] = [];
  private isProcessing = false;
  private batchSize = 100;
  private timeout = 1000; // 1 second
  private timer: NodeJS.Timeout | null = null;
  private processor: (batch: Input[]) => Promise<Output[]>;

  constructor(processor: (batch: Input[]) => Promise<Output[]>, batchSize = 100) {
    this.processor = processor;
    this.batchSize = batchSize;
  }

  async add(item: Input): Promise<void> {
    this.queue.push(item);

    if (this.queue.length >= this.batchSize) {
      await this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.timeout);
    }
  }

  async flush(): Promise<Output[]> {
    if (this.isProcessing || this.queue.length === 0) {
      return [];
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.isProcessing = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      return await this.processor(batch);
    } finally {
      this.isProcessing = false;

      // Process remaining items if any
      if (this.queue.length > 0) {
        await this.flush();
      }
    }
  }
}

// Export singletons
export const globalCache = new Cache();
export const requestDeduplicator = new RequestDeduplicator();

export default {
  Cache,
  MemoizedFunction,
  RequestDeduplicator,
  BatchProcessor,
  globalCache,
  requestDeduplicator,
};
