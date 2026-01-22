/**
 * API Error Handler
 * Centralized error handling and reporting for all API calls
 */

import { healthCheck } from './healthCheck';

export interface APIError {
  code: string;
  message: string;
  status?: number;
  isRetryable: boolean;
  context?: Record<string, any>;
}

export interface APICall {
  id: string;
  service: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error' | 'timeout';
  error?: APIError;
  tokensUsed?: number;
  costUSD?: number;
}

class APIErrorHandler {
  private calls: APICall[] = [];
  private maxRetries = 3;
  private retryDelays = [1000, 2000, 5000]; // ms

  /**
   * Wrap API call with error handling and monitoring
   */
  async executeWithRetry<T>(
    service: string,
    method: string,
    fn: () => Promise<T>,
    options?: { maxRetries?: number; timeout?: number }
  ): Promise<T> {
    const callId = this.generateCallId();
    const call: APICall = {
      id: callId,
      service,
      method,
      startTime: Date.now(),
      status: 'pending',
    };

    const maxRetries = options?.maxRetries ?? this.maxRetries;
    let lastError: APIError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Add timeout if specified
        if (options?.timeout) {
          return await this.withTimeout(fn(), options.timeout);
        }

        const result = await fn();
        call.status = 'success';
        call.endTime = Date.now();
        call.duration = call.endTime - call.startTime;
        this.recordCall(call);

        return result;
      } catch (error) {
        lastError = this.parseError(error, service, method);

        // Check if error is retryable
        if (!lastError.isRetryable || attempt === maxRetries) {
          call.status = 'error';
          call.error = lastError;
          call.endTime = Date.now();
          call.duration = call.endTime - call.startTime;
          this.recordCall(call);

          const severity = this.determineSeverity(lastError.status);
          healthCheck.logError(
            service,
            severity,
            `${method} failed: ${lastError.message}`,
            {
              code: lastError.code,
              attempt,
              totalDuration: call.duration,
              ...lastError.context,
            }
          );

          throw lastError;
        }

        // Retry with backoff
        const delay = this.retryDelays[Math.min(attempt, this.retryDelays.length - 1)];
        healthCheck.logWarning(
          `${service}_retry`,
          `${method} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`,
          { code: lastError.code, delay }
        );

        await this.sleep(delay);
      }
    }

    // Should not reach here, but just in case
    throw lastError || new Error('Unknown error');
  }

  /**
   * Parse error into standardized APIError
   */
  private parseError(error: any, service: string, method: string): APIError {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Network request failed',
        isRetryable: true,
        context: { originalError: error.message },
      };
    }

    // Handle timeout errors
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return {
        code: 'TIMEOUT_ERROR',
        message: 'Request timeout',
        isRetryable: true,
        context: {},
      };
    }

    // Handle Gemini API errors
    if (error.status === 401 || error.status === 403) {
      return {
        code: 'AUTH_ERROR',
        message: 'Authentication failed. Check API key.',
        status: error.status,
        isRetryable: false,
        context: { service, method },
      };
    }

    if (error.status === 429) {
      return {
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded. Please wait before retrying.',
        status: 429,
        isRetryable: true,
        context: { retryAfter: error.headers?.['retry-after'] },
      };
    }

    if (error.status === 500 || error.status === 502 || error.status === 503) {
      return {
        code: 'SERVER_ERROR',
        message: `Server error (${error.status})`,
        status: error.status,
        isRetryable: true,
        context: {},
      };
    }

    if (error.status === 400) {
      return {
        code: 'BAD_REQUEST',
        message: error.message || 'Invalid request',
        status: 400,
        isRetryable: false,
        context: error.details,
      };
    }

    // Handle JSON parse errors
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return {
        code: 'JSON_PARSE_ERROR',
        message: 'Invalid JSON response from server',
        isRetryable: true,
        context: { originalError: error.message },
      };
    }

    // Generic error
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || String(error),
      isRetryable: true,
      context: {
        errorType: error.name || typeof error,
      },
    };
  }

  /**
   * Determine severity based on HTTP status
   */
  private determineSeverity(status?: number): 'low' | 'medium' | 'high' | 'critical' {
    if (!status) return 'medium';
    if (status >= 500) return 'high';
    if (status === 429) return 'medium';
    if (status === 401 || status === 403) return 'high';
    return 'medium';
  }

  /**
   * Record API call for monitoring
   */
  private recordCall(call: APICall) {
    this.calls.push(call);

    // Keep last 100 calls
    if (this.calls.length > 100) {
      this.calls = this.calls.slice(-100);
    }
  }

  /**
   * Get call history
   */
  getCallHistory(service?: string, limit = 20): APICall[] {
    let history = this.calls.slice(-limit);
    if (service) {
      history = history.filter(c => c.service === service);
    }
    return history;
  }

  /**
   * Get API statistics
   */
  getStats(service?: string) {
    let calls = this.calls;
    if (service) {
      calls = calls.filter(c => c.service === service);
    }

    const total = calls.length;
    const successful = calls.filter(c => c.status === 'success').length;
    const failed = calls.filter(c => c.status === 'error').length;
    const avgDuration = calls.reduce((sum, c) => sum + (c.duration || 0), 0) / (total || 1);
    const totalCost = calls.reduce((sum, c) => sum + (c.costUSD || 0), 0);
    const totalTokens = calls.reduce((sum, c) => sum + (c.tokensUsed || 0), 0);

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total * 100).toFixed(2) + '%' : '0%',
      avgDuration: avgDuration.toFixed(0) + 'ms',
      totalCost: totalCost.toFixed(2),
      totalTokens,
    };
  }

  /**
   * Wait with promise
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute with timeout
   */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => {
          const error: any = new Error('Request timeout');
          error.name = 'TimeoutError';
          reject(error);
        }, ms)
      ),
    ]);
  }

  /**
   * Generate unique call ID
   */
  private generateCallId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear old call history (older than 1 hour)
   */
  clearOldCalls() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.calls = this.calls.filter(c => c.startTime > oneHourAgo);
  }

  /**
   * Export call logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(
      {
        timestamp: Date.now(),
        calls: this.calls,
        stats: this.getStats(),
      },
      null,
      2
    );
  }
}

// Singleton instance
export const apiErrorHandler = new APIErrorHandler();

/**
 * Convenience function for wrapping API calls
 */
export async function withErrorHandling<T>(
  service: string,
  method: string,
  fn: () => Promise<T>
): Promise<T> {
  return apiErrorHandler.executeWithRetry(service, method, fn);
}
