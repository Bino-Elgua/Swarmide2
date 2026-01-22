// Advanced error recovery with circuit breaker pattern
export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Failures before opening
  successThreshold: number; // Successes before closing
  timeout: number; // Time before half-open (ms)
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // Initial delay in ms
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number = 0;
  private readonly config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      successThreshold: config.successThreshold || 2,
      timeout: config.timeout || 60000,
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.config.timeout) {
        this.state = 'half-open';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();

      if (this.state === 'half-open') {
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.state = 'closed';
          this.failureCount = 0;
          this.successCount = 0;
        }
      } else if (this.state === 'closed') {
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.config.failureThreshold) {
        this.state = 'open';
      } else if (this.state === 'half-open') {
        this.state = 'open';
      }

      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
  }
}

export class RetryPolicy {
  private readonly config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries || 3,
      baseDelay: config.baseDelay || 1000,
      maxDelay: config.maxDelay || 30000,
      backoffMultiplier: config.backoffMultiplier || 2,
      jitter: config.jitter !== false,
    };
  }

  async execute<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        if (attempt < this.config.maxRetries) {
          const delay = this.calculateDelay(attempt);
          console.log(
            `[${context || 'Retry'}] Attempt ${attempt + 1}/${this.config.maxRetries + 1} failed. Retrying in ${delay}ms...`
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  private calculateDelay(attempt: number): number {
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt);

    // Add jitter to prevent thundering herd
    if (this.config.jitter) {
      delay *= 0.5 + Math.random();
    }

    return Math.min(delay, this.config.maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class FallbackChain<T> {
  private handlers: Array<() => Promise<T>> = [];

  add(handler: () => Promise<T>): this {
    this.handlers.push(handler);
    return this;
  }

  async execute(): Promise<T> {
    const errors: Error[] = [];

    for (const handler of this.handlers) {
      try {
        return await handler();
      } catch (error: any) {
        errors.push(error);
      }
    }

    throw new Error(`All ${this.handlers.length} fallbacks failed: ${errors.map(e => e.message).join('; ')}`);
  }
}

export class ErrorAggregator {
  private errors: Array<{ error: Error; timestamp: Date; context?: string }> = [];
  private readonly maxErrors = 1000;

  record(error: Error, context?: string): void {
    this.errors.push({
      error,
      timestamp: new Date(),
      context,
    });

    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
  }

  getErrors(limit = 10): typeof this.errors {
    return this.errors.slice(-limit);
  }

  getSummary(): {
    totalErrors: number;
    byContext: Record<string, number>;
    recentErrors: string[];
  } {
    const byContext: Record<string, number> = {};

    this.errors.forEach(({ context }) => {
      if (context) {
        byContext[context] = (byContext[context] || 0) + 1;
      }
    });

    return {
      totalErrors: this.errors.length,
      byContext,
      recentErrors: this.errors
        .slice(-5)
        .map(e => `${e.context}: ${e.error.message}`),
    };
  }

  clear(): void {
    this.errors = [];
  }
}

export class HealthCheck {
  private checks: Map<string, () => Promise<boolean>> = new Map();
  private lastResults: Map<string, { healthy: boolean; error?: string; timestamp: Date }> = new Map();

  registerCheck(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check);
  }

  async runChecks(): Promise<{
    healthy: boolean;
    checks: Record<string, { healthy: boolean; error?: string }>;
  }> {
    const results: Record<string, { healthy: boolean; error?: string }> = {};

    for (const [name, check] of this.checks) {
      try {
        const healthy = await check();
        results[name] = { healthy };
        this.lastResults.set(name, { healthy, timestamp: new Date() });
      } catch (error: any) {
        results[name] = { healthy: false, error: error.message };
        this.lastResults.set(name, {
          healthy: false,
          error: error.message,
          timestamp: new Date(),
        });
      }
    }

    const healthy = Object.values(results).every(r => r.healthy);

    return { healthy, checks: results };
  }

  getLastResults(): Record<string, any> {
    const results: Record<string, any> = {};
    for (const [name, result] of this.lastResults) {
      results[name] = result;
    }
    return results;
  }
}

// Export singleton instances
export const circuitBreaker = new CircuitBreaker();
export const retryPolicy = new RetryPolicy();
export const errorAggregator = new ErrorAggregator();
export const healthCheck = new HealthCheck();

// Initialize health checks
healthCheck.registerCheck('api', async () => {
  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    return true;
  } catch {
    return false;
  }
});

export default {
  CircuitBreaker,
  RetryPolicy,
  FallbackChain,
  ErrorAggregator,
  HealthCheck,
  circuitBreaker,
  retryPolicy,
  errorAggregator,
  healthCheck,
};
