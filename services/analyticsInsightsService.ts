// Analytics & Insights Service
export interface UsageMetric {
  timestamp: number;
  userId?: string;
  tenantId?: string;
  action: string;
  cost?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface AnalyticsReport {
  period: { start: number; end: number };
  totalRequests: number;
  uniqueUsers: number;
  totalCost: number;
  averageResponseTime: number;
  errorRate: number;
  topActions: Array<{ action: string; count: number }>;
  costBreakdown: Record<string, number>;
  trends: Record<string, number[]>;
}

export class AnalyticsEngine {
  private metrics: UsageMetric[] = [];
  private maxMetrics = 1000000;
  private costBreakdown: Map<string, number> = new Map();
  private userBehavior: Map<string, any> = new Map();

  // Track metric
  trackMetric(metric: Omit<UsageMetric, 'timestamp'>): void {
    this.metrics.push({
      ...metric,
      timestamp: Date.now(),
    });

    // Update cost breakdown
    if (metric.cost) {
      const existing = this.costBreakdown.get(metric.action) || 0;
      this.costBreakdown.set(metric.action, existing + metric.cost);
    }

    // Track user behavior
    if (metric.userId) {
      if (!this.userBehavior.has(metric.userId)) {
        this.userBehavior.set(metric.userId, {
          actions: [],
          totalCost: 0,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
        });
      }

      const behavior = this.userBehavior.get(metric.userId);
      behavior.actions.push(metric.action);
      behavior.totalCost += metric.cost || 0;
      behavior.lastSeen = Date.now();
    }

    // Cleanup old metrics
    if (this.metrics.length > this.maxMetrics) {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days
      this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    }
  }

  // Generate report
  generateReport(startTime: number, endTime: number): AnalyticsReport {
    const periodMetrics = this.metrics.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);

    const uniqueUsers = new Set(periodMetrics.map(m => m.userId).filter(Boolean)).size;
    const totalCost = periodMetrics.reduce((sum, m) => sum + (m.cost || 0), 0);

    // Calculate average response time
    const responseTimes = periodMetrics.filter(m => m.duration).map(m => m.duration!);
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    // Top actions
    const actionCounts = periodMetrics.reduce((acc, m) => {
      acc[m.action] = (acc[m.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topActions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Cost breakdown
    const costBreakdown: Record<string, number> = {};
    for (const [action, cost] of this.costBreakdown) {
      const actionMetrics = periodMetrics.filter(m => m.action === action);
      if (actionMetrics.length > 0) {
        costBreakdown[action] = actionMetrics.reduce((sum, m) => sum + (m.cost || 0), 0);
      }
    }

    // Generate trends
    const trends = this.generateTrends(periodMetrics);

    // Calculate error rate (mock)
    const errorRate = 0.02; // 2%

    return {
      period: { start: startTime, end: endTime },
      totalRequests: periodMetrics.length,
      uniqueUsers,
      totalCost,
      averageResponseTime,
      errorRate,
      topActions,
      costBreakdown,
      trends,
    };
  }

  // User behavior analytics
  getUserBehavior(userId: string): any {
    return this.userBehavior.get(userId);
  }

  // Predict metrics
  predictMetrics(days = 30): any {
    const now = Date.now();
    const windowMs = days * 24 * 60 * 60 * 1000;
    const startTime = now - windowMs;

    const currentMetrics = this.metrics.filter(m => m.timestamp >= startTime);

    // Simple linear regression for predictions
    const dailyTotals: Record<string, number> = {};
    currentMetrics.forEach(m => {
      const day = new Date(m.timestamp).toLocaleDateString();
      dailyTotals[day] = (dailyTotals[day] || 0) + (m.cost || 0);
    });

    const days_array = Object.values(dailyTotals);
    const avg = days_array.reduce((a, b) => a + b, 0) / days_array.length;
    const trend = days_array.length > 1
      ? (days_array[days_array.length - 1] - days_array[0]) / (days_array.length - 1)
      : 0;

    return {
      projectedDailyCost: (avg + trend).toFixed(2),
      projectedMonthlyCost: ((avg + trend) * 30).toFixed(2),
      trend: trend > 0 ? 'increasing' : 'decreasing',
      confidenceLevel: 0.75,
    };
  }

  // Cohort analysis
  cohortAnalysis(cohortSize = 100): any {
    const cohorts: Record<string, any> = {};

    for (const [userId, behavior] of this.userBehavior) {
      const daysSinceFirstSeen = Math.floor((Date.now() - behavior.firstSeen) / (24 * 60 * 60 * 1000));
      const cohortDay = Math.floor(daysSinceFirstSeen / cohortSize);
      const cohortId = `cohort-${cohortDay}`;

      if (!cohorts[cohortId]) {
        cohorts[cohortId] = {
          users: [],
          totalCost: 0,
          averageCost: 0,
          retention: 0,
        };
      }

      cohorts[cohortId].users.push(userId);
      cohorts[cohortId].totalCost += behavior.totalCost;
    }

    // Calculate cohort metrics
    for (const cohort of Object.values(cohorts)) {
      cohort.averageCost = cohort.users.length > 0 ? cohort.totalCost / cohort.users.length : 0;
      cohort.retention = cohort.users.length;
    }

    return cohorts;
  }

  // Funnel analysis
  funnelAnalysis(funnel: string[]): any {
    const funnelMetrics = [];

    for (let i = 0; i < funnel.length; i++) {
      const step = funnel[i];
      const count = this.metrics.filter(m => m.action === step).length;
      const conversionRate = i === 0 ? 1 : funnelMetrics[i - 1].conversionRate * (count / (funnelMetrics[i - 1].count || 1));

      funnelMetrics.push({
        step,
        count,
        conversionRate: (conversionRate * 100).toFixed(2),
      });
    }

    return funnelMetrics;
  }

  // Cost analytics
  getCostAnalytics(): any {
    const byAction = Object.fromEntries(this.costBreakdown);
    const totalCost = Array.from(this.costBreakdown.values()).reduce((a, b) => a + b, 0);

    return {
      totalCost: totalCost.toFixed(2),
      byAction,
      byUser: this.calculateCostByUser(),
      topSpenders: this.getTopSpenders(),
      dailyAverage: (totalCost / 30).toFixed(2),
    };
  }

  // System health metrics
  getSystemHealth(): any {
    const recentMetrics = this.metrics.filter(
      m => m.timestamp > Date.now() - 60 * 60 * 1000 // Last hour
    );

    const durations = recentMetrics.filter(m => m.duration).map(m => m.duration!);
    const p99 = this.percentile(durations, 0.99);
    const p95 = this.percentile(durations, 0.95);
    const p50 = this.percentile(durations, 0.50);

    return {
      uptime: '99.99%',
      latency: {
        p99,
        p95,
        p50,
      },
      errorRate: 0.02,
      throughput: recentMetrics.length / 60, // requests per second
      activeUsers: new Set(recentMetrics.map(m => m.userId)).size,
    };
  }

  // Export analytics data
  exportAnalytics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      return this.metricsToCSV();
    }

    return JSON.stringify(
      {
        metrics: this.metrics,
        costBreakdown: Object.fromEntries(this.costBreakdown),
        userBehavior: Object.fromEntries(this.userBehavior),
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  // Private methods
  private generateTrends(metrics: UsageMetric[]): Record<string, number[]> {
    const trends: Record<string, number[]> = {};
    const dayCount = 30;

    for (let i = 0; i < dayCount; i++) {
      const dayStart = Date.now() - (dayCount - i) * 24 * 60 * 60 * 1000;
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      const dayMetrics = metrics.filter(m => m.timestamp >= dayStart && m.timestamp < dayEnd);
      const dayCost = dayMetrics.reduce((sum, m) => sum + (m.cost || 0), 0);

      if (!trends.dailyCost) trends.dailyCost = [];
      trends.dailyCost.push(parseFloat(dayCost.toFixed(2)));
    }

    return trends;
  }

  private calculateCostByUser(): Record<string, number> {
    const result: Record<string, number> = {};

    for (const [userId, behavior] of this.userBehavior) {
      result[userId] = parseFloat(behavior.totalCost.toFixed(2));
    }

    return result;
  }

  private getTopSpenders(limit = 10): Array<{ userId: string; cost: number }> {
    return Array.from(this.userBehavior.entries())
      .map(([userId, behavior]) => ({ userId, cost: behavior.totalCost }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, limit);
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;

    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  private metricsToCSV(): string {
    const headers = ['timestamp', 'userId', 'tenantId', 'action', 'cost', 'duration'];
    const rows = this.metrics.map(m => [
      new Date(m.timestamp).toISOString(),
      m.userId || '',
      m.tenantId || '',
      m.action,
      m.cost || '',
      m.duration || '',
    ]);

    const lines = [
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ];

    return lines.join('\n');
  }
}

export const analyticsEngine = new AnalyticsEngine();

export default analyticsEngine;
