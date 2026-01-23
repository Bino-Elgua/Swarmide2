// API Gateway & Request Pipeline Service
import { rateLimiter } from './rateLimitService';
import { authService } from './authService';
import { redisCache } from './redisCacheService';

export interface ApiGatewayConfig {
  enableRateLimit: boolean;
  enableCaching: boolean;
  enableCompression: boolean;
  enableRequestSigning: boolean;
  corsOrigins: string[];
  maxRequestSize: number;
}

export interface ApiRequest {
  id: string;
  method: string;
  path: string;
  userId?: string;
  apiKey?: string;
  timestamp: number;
  headers: Record<string, string>;
  body?: any;
}

export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  cached: boolean;
  rateLimitStatus?: any;
}

export class ApiGateway {
  private config: ApiGatewayConfig = {
    enableRateLimit: true,
    enableCaching: true,
    enableCompression: true,
    enableRequestSigning: true,
    corsOrigins: ['http://localhost:3000', 'http://localhost:5173'],
    maxRequestSize: 50 * 1024 * 1024, // 50MB
  };

  private requestLog: Map<string, ApiRequest> = new Map();
  private apiKeys: Map<string, { userId: string; tier: string }> = new Map();

  constructor(config?: Partial<ApiGatewayConfig>) {
    this.config = { ...this.config, ...config };
  }

  // Authenticate request
  async authenticateRequest(req: ApiRequest): Promise<{ userId: string; tier: string }> {
    const authHeader = req.headers['authorization'];
    const apiKey = req.headers['x-api-key'];

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = authService.verifyToken(token);
        return { userId: payload.userId, tier: 'authenticated' };
      } catch (error) {
        throw new Error('Invalid token');
      }
    }

    if (apiKey) {
      const keyData = this.apiKeys.get(apiKey);
      if (keyData) {
        return keyData;
      }
      throw new Error('Invalid API key');
    }

    return { userId: 'anonymous', tier: 'free' };
  }

  // Validate rate limit
  checkRateLimit(userId: string, tier: string): any {
    if (this.config.enableRateLimit) {
      return rateLimiter.checkLimit(userId, tier as any);
    }
    return { remaining: Infinity, limit: Infinity, resetAt: 0, exceeded: false };
  }

  // Check request cache
  getCachedResponse(path: string, method: string, userId: string): ApiResponse | null {
    if (!this.config.enableCaching) return null;
    if (method !== 'GET') return null;

    const cacheKey = `api:${userId}:${method}:${path}`;
    const cached = redisCache.get<ApiResponse>(cacheKey);

    if (cached) {
      return { ...cached, cached: true };
    }

    return null;
  }

  // Cache response
  cacheResponse(path: string, method: string, userId: string, response: ApiResponse, ttl = 300): void {
    if (!this.config.enableCaching) return;
    if (method !== 'GET') return;

    const cacheKey = `api:${userId}:${method}:${path}`;
    redisCache.set(cacheKey, response, ttl);
  }

  // Process request through pipeline
  async processRequest(req: ApiRequest): Promise<ApiResponse> {
    // 1. Authenticate
    let auth: { userId: string; tier: string };
    try {
      auth = await this.authenticateRequest(req);
    } catch (error: any) {
      return {
        statusCode: 401,
        headers: { 'content-type': 'application/json' },
        body: { error: error.message },
        cached: false,
      };
    }

    // 2. Check rate limit
    const rateLimit = this.checkRateLimit(auth.userId, auth.tier);
    if (rateLimit.exceeded) {
      return {
        statusCode: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          'x-ratelimit-limit': rateLimit.limit.toString(),
          'x-ratelimit-remaining': rateLimit.remaining.toString(),
          'x-ratelimit-reset': rateLimit.resetAt.toString(),
        },
        body: { error: 'Rate limit exceeded' },
        cached: false,
        rateLimitStatus: rateLimit,
      };
    }

    // 3. Check cache (for GET)
    const cached = this.getCachedResponse(req.path, req.method, auth.userId);
    if (cached) {
      return { ...cached, rateLimitStatus: rateLimit };
    }

    // 4. Validate request size
    if (req.body && JSON.stringify(req.body).length > this.config.maxRequestSize) {
      return {
        statusCode: 413,
        headers: { 'content-type': 'application/json' },
        body: { error: 'Request too large' },
        cached: false,
      };
    }

    // 5. Log request
    req.userId = auth.userId;
    this.requestLog.set(req.id, req);

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'x-ratelimit-limit': rateLimit.limit.toString(),
        'x-ratelimit-remaining': rateLimit.remaining.toString(),
        'x-ratelimit-reset': rateLimit.resetAt.toString(),
      },
      body: { success: true },
      cached: false,
      rateLimitStatus: rateLimit,
    };
  }

  // Register API key
  registerApiKey(apiKey: string, userId: string, tier: 'free' | 'pro' | 'enterprise'): void {
    this.apiKeys.set(apiKey, { userId, tier });
  }

  // Revoke API key
  revokeApiKey(apiKey: string): boolean {
    return this.apiKeys.delete(apiKey);
  }

  // Get request log
  getRequestLog(userId?: string): ApiRequest[] {
    if (!userId) {
      return Array.from(this.requestLog.values());
    }
    return Array.from(this.requestLog.values()).filter(r => r.userId === userId);
  }

  // Get gateway stats
  getStats(): any {
    return {
      totalRequests: this.requestLog.size,
      registeredApiKeys: this.apiKeys.size,
      cacheSize: redisCache.getStats().size,
      requestsPerUser: Array.from(this.requestLog.values()).reduce((acc, req) => {
        acc[req.userId || 'anonymous'] = (acc[req.userId || 'anonymous'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  // Clear logs (keep last N)
  clearOldLogs(keepLast = 10000): void {
    if (this.requestLog.size > keepLast) {
      const sorted = Array.from(this.requestLog.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .slice(0, keepLast);

      this.requestLog.clear();
      sorted.forEach(([id, req]) => this.requestLog.set(id, req));
    }
  }
}

export const apiGateway = new ApiGateway();

export default apiGateway;
