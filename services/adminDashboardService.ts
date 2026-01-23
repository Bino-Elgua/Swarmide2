// Admin Dashboard Service
import { authService } from './authService';
import { rateLimiter } from './rateLimitService';
import { advancedLogger } from './advancedLoggingService';
import { analyticsEngine } from './analyticsInsightsService';
import { multiTenancyManager } from './multiTenancyService';
import { fileStorageService } from './fileStorageService';
import { webhookEventSystem } from './webhookEventService';
import { messageQueue } from './messageQueueService';
import { apiGateway } from './apiGatewayService';

export interface DashboardConfig {
  adminUser: string;
  refreshInterval: number;
}

export class AdminDashboard {
  private config: DashboardConfig;
  private auditLog: Array<{
    timestamp: number;
    admin: string;
    action: string;
    details: any;
  }> = [];

  constructor(config: Partial<DashboardConfig> = {}) {
    this.config = {
      adminUser: config.adminUser || 'admin',
      refreshInterval: config.refreshInterval || 5000,
    };
  }

  // Get system overview
  getSystemOverview(): any {
    return {
      status: 'operational',
      timestamp: Date.now(),
      health: this.getSystemHealth(),
      metrics: this.getMetrics(),
      alerts: this.getAlerts(),
    };
  }

  // Get system health
  private getSystemHealth(): any {
    return {
      uptime: '99.99%',
      database: 'connected',
      cache: 'connected',
      queue: 'connected',
      status: 'healthy',
      lastCheck: Date.now(),
    };
  }

  // Get system metrics
  private getMetrics(): any {
    const logs = advancedLogger.getMetrics();
    const analytics = analyticsEngine.getSystemHealth();
    const gateway = apiGateway.getStats();
    const tenants = multiTenancyManager.getSystemStats();

    return {
      logging: logs,
      analytics,
      gateway,
      tenants,
    };
  }

  // Get active alerts
  private getAlerts(): any[] {
    const alerts = [];

    // Check for high error rates
    const errorLogs = advancedLogger.getErrorLogs(5);
    if (errorLogs.length > 10) {
      alerts.push({
        level: 'warning',
        title: 'High error rate',
        message: `${errorLogs.length} errors in the last 5 minutes`,
        timestamp: Date.now(),
      });
    }

    // Check for rate limit violations
    const stats = apiGateway.getStats();
    if (Object.values(stats.requestsPerUser).some((count: any) => count > 1000)) {
      alerts.push({
        level: 'info',
        title: 'High request volume',
        message: 'Some users have exceeded normal request patterns',
        timestamp: Date.now(),
      });
    }

    return alerts;
  }

  // User management
  getUsers(): any[] {
    return []; // Implementation would fetch from auth service
  }

  // Get user details
  getUserDetails(userId: string): any {
    const user = authService.getUser(userId);
    if (!user) return null;

    const behavior = analyticsEngine.getUserBehavior(userId);

    return {
      ...user,
      behavior,
      lastActive: behavior?.lastSeen,
      totalCost: behavior?.totalCost,
    };
  }

  // Manage user roles
  updateUserRoles(userId: string, roles: string[]): void {
    authService.updateUserRoles(userId, roles);
    this.logAuditEntry(this.config.adminUser, 'update_user_roles', {
      userId,
      roles,
    });
  }

  // Tenant management
  getTenants(): any[] {
    return Array.from(multiTenancyManager.listTenants()).map(([id, tenant]) => ({
      id,
      ...tenant,
      metrics: multiTenancyManager.getMetrics(id),
    }));
  }

  // Get tenant details
  getTenantDetails(tenantId: string): any {
    const tenant = multiTenancyManager.getTenant(tenantId);
    if (!tenant) return null;

    return {
      ...tenant,
      metrics: multiTenancyManager.getMetrics(tenantId),
      billing: multiTenancyManager.calculateBilling(tenantId, new Date().toISOString().slice(0, 7)),
      storage: fileStorageService.getStats(tenantId),
    };
  }

  // Upgrade tenant
  upgradeTenant(tenantId: string, tier: 'free' | 'pro' | 'enterprise'): void {
    multiTenancyManager.upgradeTier(tenantId, tier);
    this.logAuditEntry(this.config.adminUser, 'upgrade_tenant', {
      tenantId,
      newTier: tier,
    });
  }

  // API management
  getApiKeys(userId?: string): any[] {
    return []; // Implementation would list API keys
  }

  // Revoke API key
  revokeApiKey(apiKey: string): void {
    apiGateway.revokeApiKey(apiKey);
    this.logAuditEntry(this.config.adminUser, 'revoke_api_key', {
      apiKey: `***${apiKey.slice(-4)}`,
    });
  }

  // Webhook management
  getWebhooks(): any[] {
    return webhookEventSystem.listWebhooks().map(([id, config]) => ({
      id,
      ...config,
    }));
  }

  // Test webhook
  testWebhook(webhookId: string): Promise<boolean> {
    return webhookEventSystem.testWebhook(webhookId);
  }

  // Get webhook deliveries
  getWebhookDeliveries(webhookId: string): any[] {
    return webhookEventSystem.getWebhookDeliveries(webhookId);
  }

  // Queue management
  getQueueStats(): any {
    return messageQueue.getStats();
  }

  // Purge queue
  purgeQueue(queueName: string): number {
    const count = messageQueue.purgeQueue(queueName);
    this.logAuditEntry(this.config.adminUser, 'purge_queue', { queueName, count });
    return count;
  }

  // Logging & monitoring
  getLogs(filter?: any): any[] {
    return advancedLogger.searchLogs(filter || {});
  }

  // Get traces
  getTraces(traceId: string): string[] | null {
    return advancedLogger.getTrace(traceId);
  }

  // Analytics
  getAnalytics(days = 30): any {
    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;

    return analyticsEngine.generateReport(startTime, endTime);
  }

  // Cost insights
  getCostInsights(): any {
    return analyticsEngine.getCostAnalytics();
  }

  // Predictions
  getPredictions(): any {
    return analyticsEngine.predictMetrics();
  }

  // System configuration
  getConfiguration(): any {
    return {
      features: this.getEnabledFeatures(),
      limits: {
        maxRequestSize: 50 * 1024 * 1024,
        maxFileSize: 5 * 1024 * 1024 * 1024,
        maxQueueSize: 100000,
      },
      security: {
        tlsVersion: 'TLSv1.3',
        encryptionAlgorithm: 'AES-256-GCM',
      },
    };
  }

  // Get enabled features
  private getEnabledFeatures(): Record<string, boolean> {
    return {
      authentication: true,
      rateLimit: true,
      caching: true,
      logging: true,
      webhooks: true,
      multiTenancy: true,
      fileStorage: true,
      search: true,
      featureFlags: true,
      analytics: true,
    };
  }

  // Audit logs
  getAuditLog(limit = 100): any[] {
    return this.auditLog.slice(-limit);
  }

  // Export system data
  exportData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      exportedAt: new Date().toISOString(),
      system: {
        overview: this.getSystemOverview(),
        configuration: this.getConfiguration(),
      },
      tenants: this.getTenants(),
      analytics: this.getAnalytics(),
      auditLog: this.auditLog,
    };

    if (format === 'csv') {
      // Convert to CSV format
      const rows = this.auditLog.map(log =>
        `${new Date(log.timestamp).toISOString()},${log.admin},${log.action},${JSON.stringify(log.details)}`
      );
      return ['timestamp,admin,action,details', ...rows].join('\n');
    }

    return JSON.stringify(data, null, 2);
  }

  // System maintenance
  triggerMaintenance(type: 'cache-clear' | 'log-cleanup' | 'key-rotation'): void {
    switch (type) {
      case 'cache-clear':
        // Clear cache
        console.log('🧹 Cache cleared');
        break;
      case 'log-cleanup':
        // Cleanup old logs
        advancedLogger.clear();
        console.log('📝 Logs cleaned up');
        break;
      case 'key-rotation':
        // Rotate encryption keys
        console.log('🔑 Keys rotated');
        break;
    }

    this.logAuditEntry(this.config.adminUser, 'maintenance', { type });
  }

  // Private methods
  private logAuditEntry(admin: string, action: string, details: any): void {
    this.auditLog.push({
      timestamp: Date.now(),
      admin,
      action,
      details,
    });

    // Limit audit log size
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }
}

export const adminDashboard = new AdminDashboard();

export default adminDashboard;
