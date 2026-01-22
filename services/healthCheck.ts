/**
 * Health Check & API Monitoring Service
 * Provides comprehensive diagnostics for API health, dependencies, and error tracking
 */

export interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  checks: {
    apiKey: CheckResult;
    geminiAPI: CheckResult;
    localStorage: CheckResult;
    network: CheckResult;
    memory: CheckResult;
  };
  errors: ErrorLog[];
  warnings: WarningLog[];
}

export interface CheckResult {
  status: 'ok' | 'warning' | 'error';
  message: string;
  latency?: number;
  lastCheck?: number;
}

export interface ErrorLog {
  id: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  resolved: boolean;
}

export interface WarningLog {
  id: string;
  timestamp: number;
  message: string;
  context?: Record<string, any>;
}

class HealthCheckService {
  private startTime = Date.now();
  private errors: ErrorLog[] = [];
  private warnings: WarningLog[] = [];
  private lastGeminiCheck = 0;
  private geminiCheckInterval = 60000; // 1 minute

  /**
   * Run full health check
   */
  async runFullCheck(): Promise<HealthMetrics> {
    const checks = {
      apiKey: this.checkAPIKey(),
      geminiAPI: await this.checkGeminiAPI(),
      localStorage: this.checkLocalStorage(),
      network: await this.checkNetwork(),
      memory: this.checkMemory(),
    };

    const status = this.determineOverallStatus(checks);

    return {
      status,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      checks,
      errors: this.errors.filter(e => !e.resolved),
      warnings: this.warnings.slice(-10), // Last 10 warnings
    };
  }

  /**
   * Check API key availability
   */
  private checkAPIKey(): CheckResult {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return {
        status: 'error',
        message: 'API key not found in environment',
      };
    }

    if (apiKey.length < 20) {
      return {
        status: 'warning',
        message: 'API key appears to be invalid (too short)',
      };
    }

    return {
      status: 'ok',
      message: 'API key loaded successfully',
    };
  }

  /**
   * Check Gemini API connectivity
   */
  private async checkGeminiAPI(): Promise<CheckResult> {
    // Rate limit checks to once per minute
    if (Date.now() - this.lastGeminiCheck < this.geminiCheckInterval) {
      return {
        status: 'ok',
        message: 'Gemini API (cached check)',
      };
    }

    try {
      const start = performance.now();
      
      // Lightweight test call
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.API_KEY || process.env.GEMINI_API_KEY || '',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'ping' }]
          }]
        }),
      });

      const latency = performance.now() - start;
      this.lastGeminiCheck = Date.now();

      if (response.status === 401 || response.status === 403) {
        return {
          status: 'error',
          message: 'Gemini API: Authentication failed',
          latency,
        };
      }

      if (!response.ok) {
        return {
          status: 'warning',
          message: `Gemini API: HTTP ${response.status}`,
          latency,
        };
      }

      return {
        status: 'ok',
        message: `Gemini API responding (${latency.toFixed(0)}ms)`,
        latency,
      };
    } catch (error) {
      this.logError('gemini_api_check', 'high', `Gemini API check failed: ${error}`);
      return {
        status: 'error',
        message: `Gemini API unreachable: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check localStorage availability
   */
  private checkLocalStorage(): CheckResult {
    try {
      const testKey = '__health_check__';
      localStorage.setItem(testKey, 'test');
      const value = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);

      if (value !== 'test') {
        return {
          status: 'error',
          message: 'localStorage: Write/read verification failed',
        };
      }

      // Check available space
      const spaceUsed = this.estimateStorageSize();
      if (spaceUsed > 4.5) { // Close to 5MB limit
        return {
          status: 'warning',
          message: `localStorage: ${spaceUsed.toFixed(1)}MB used (near limit)`,
        };
      }

      return {
        status: 'ok',
        message: `localStorage: ${spaceUsed.toFixed(1)}MB used`,
      };
    } catch (error) {
      return {
        status: 'error',
        message: `localStorage unavailable: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Estimate localStorage size
   */
  private estimateStorageSize(): number {
    let size = 0;
    try {
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          size += (key.length + localStorage[key].length) * 2; // UTF-16
        }
      }
      return size / (1024 * 1024); // Convert to MB
    } catch {
      return 0;
    }
  }

  /**
   * Check network connectivity
   */
  private async checkNetwork(): Promise<CheckResult> {
    try {
      const start = performance.now();
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
      });
      const latency = performance.now() - start;

      return {
        status: 'ok',
        message: `Network: Online (${latency.toFixed(0)}ms)`,
        latency,
      };
    } catch (error) {
      this.logWarning('network_offline', 'Network connectivity appears offline');
      return {
        status: 'error',
        message: 'Network: Offline or unreachable',
      };
    }
  }

  /**
   * Check memory usage
   */
  private checkMemory(): CheckResult {
    try {
      const perf = performance as any;
      if (!perf.memory) {
        return {
          status: 'ok',
          message: 'Memory: Not available (non-Chrome browser)',
        };
      }

      const used = perf.memory.usedJSHeapSize / (1024 * 1024);
      const limit = perf.memory.jsHeapSizeLimit / (1024 * 1024);
      const percent = (used / limit) * 100;

      if (percent > 90) {
        return {
          status: 'error',
          message: `Memory: Critical (${percent.toFixed(1)}% of ${limit.toFixed(0)}MB)`,
        };
      }

      if (percent > 75) {
        return {
          status: 'warning',
          message: `Memory: High (${percent.toFixed(1)}% of ${limit.toFixed(0)}MB)`,
        };
      }

      return {
        status: 'ok',
        message: `Memory: OK (${percent.toFixed(1)}% of ${limit.toFixed(0)}MB)`,
      };
    } catch (error) {
      return {
        status: 'ok',
        message: 'Memory: Stats unavailable',
      };
    }
  }

  /**
   * Determine overall health status
   */
  private determineOverallStatus(checks: HealthMetrics['checks']): HealthMetrics['status'] {
    const errorChecks = Object.values(checks).filter(c => c.status === 'error').length;
    const warningChecks = Object.values(checks).filter(c => c.status === 'warning').length;

    if (errorChecks >= 2) return 'unhealthy';
    if (errorChecks >= 1) return 'degraded';
    if (warningChecks >= 2) return 'degraded';
    return 'healthy';
  }

  /**
   * Log API error with context
   */
  logError(category: string, severity: 'low' | 'medium' | 'high' | 'critical', message: string, context?: Record<string, any>, stack?: string) {
    const errorId = `${category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const error: ErrorLog = {
      id: errorId,
      timestamp: Date.now(),
      severity,
      category,
      message,
      context,
      stack,
      resolved: false,
    };
    this.errors.push(error);
    
    // Keep last 50 errors
    if (this.errors.length > 50) {
      this.errors = this.errors.slice(-50);
    }

    // Log to console based on severity
    const logLevel = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'log';
    console[logLevel as 'error' | 'warn' | 'log'](`[${category.toUpperCase()}] ${message}`, { errorId, context });

    return errorId;
  }

  /**
   * Log API warning
   */
  logWarning(id: string, message: string, context?: Record<string, any>) {
    const warning: WarningLog = {
      id: `${id}-${Date.now()}`,
      timestamp: Date.now(),
      message,
      context,
    };
    this.warnings.push(warning);

    // Keep last 30 warnings
    if (this.warnings.length > 30) {
      this.warnings = this.warnings.slice(-30);
    }

    console.warn(`[WARNING] ${message}`, context);
  }

  /**
   * Mark error as resolved
   */
  resolveError(errorId: string) {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
    }
  }

  /**
   * Get all active errors
   */
  getActiveErrors(): ErrorLog[] {
    return this.errors.filter(e => !e.resolved);
  }

  /**
   * Clear old errors (older than 1 hour)
   */
  clearOldErrors() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.errors = this.errors.filter(e => e.timestamp > oneHourAgo);
  }

  /**
   * Export diagnostics as JSON
   */
  exportDiagnostics(): string {
    return JSON.stringify({
      health: {
        status: 'generating',
      },
      errors: this.errors,
      warnings: this.warnings,
      timestamp: Date.now(),
    }, null, 2);
  }
}

// Singleton instance
export const healthCheck = new HealthCheckService();
