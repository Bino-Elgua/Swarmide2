// Advanced monitoring, metrics, and observability service
export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface MetricsSummary {
  name: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

export class MetricsCollector {
  private metrics: Metric[] = [];
  private maxMetrics = 10000;

  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      labels,
    });

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  // Histogram metrics
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(`${name}_histogram`, value, labels);
  }

  // Counter metrics
  recordCounter(name: string, increment = 1, labels?: Record<string, string>): void {
    this.recordMetric(`${name}_counter`, increment, labels);
  }

  // Gauge metrics
  recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(`${name}_gauge`, value, labels);
  }

  // Get metrics summary
  getSummary(name: string, timeWindowMs = 3600000): MetricsSummary {
    const now = Date.now();
    const filtered = this.metrics.filter(
      m => m.name === name && m.timestamp > now - timeWindowMs
    );

    if (filtered.length === 0) {
      return {
        name,
        count: 0,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const values = filtered.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      name,
      count: values.length,
      sum,
      avg: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
    };
  }

  getAllMetrics(timeWindowMs = 3600000): Record<string, MetricsSummary> {
    const now = Date.now();
    const filtered = this.metrics.filter(m => m.timestamp > now - timeWindowMs);

    const names = new Set(filtered.map(m => m.name));
    const summaries: Record<string, MetricsSummary> = {};

    for (const name of names) {
      summaries[name] = this.getSummary(name, timeWindowMs);
    }

    return summaries;
  }

  clear(): void {
    this.metrics = [];
  }
}

export class DistributedTracer {
  private traces: Map<string, any> = new Map();

  startTrace(traceId: string, operation: string): void {
    this.traces.set(traceId, {
      traceId,
      operation,
      startTime: Date.now(),
      spans: [],
      status: 'in-progress',
    });
  }

  addSpan(
    traceId: string,
    spanId: string,
    operation: string,
    duration: number,
    attributes?: Record<string, any>
  ): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.spans.push({
      spanId,
      operation,
      duration,
      attributes,
      timestamp: Date.now(),
    });
  }

  endTrace(traceId: string, status = 'success', error?: string): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    trace.status = status;
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    if (error) trace.error = error;
  }

  getTrace(traceId: string): any {
    return this.traces.get(traceId);
  }

  getAllTraces(): any[] {
    return Array.from(this.traces.values());
  }

  getTraceSummary(traceId: string): any {
    const trace = this.traces.get(traceId);
    if (!trace) return null;

    const totalDuration = trace.spans.reduce((sum: number, s: any) => sum + s.duration, 0);

    return {
      traceId,
      operation: trace.operation,
      status: trace.status,
      duration: trace.duration,
      spanCount: trace.spans.length,
      totalSpanDuration: totalDuration,
      avgSpanDuration: totalDuration / trace.spans.length,
    };
  }

  clear(): void {
    this.traces.clear();
  }
}

export class AlertingSystem {
  private rules: Map<string, any> = new Map();
  private alerts: any[] = [];
  private handlers: Set<(alert: any) => void> = new Set();

  registerRule(
    name: string,
    metric: string,
    condition: (value: number) => boolean,
    severity = 'warning'
  ): void {
    this.rules.set(name, {
      name,
      metric,
      condition,
      severity,
    });
  }

  checkRules(metrics: Record<string, number>): void {
    for (const [ruleName, rule] of this.rules) {
      const value = metrics[rule.metric];
      if (value !== undefined && rule.condition(value)) {
        this.raiseAlert({
          id: `${ruleName}-${Date.now()}`,
          rule: ruleName,
          metric: rule.metric,
          value,
          severity: rule.severity,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private raiseAlert(alert: any): void {
    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // Trigger handlers
    for (const handler of this.handlers) {
      handler(alert);
    }
  }

  onAlert(handler: (alert: any) => void): void {
    this.handlers.add(handler);
  }

  getAlerts(severities?: string[]): any[] {
    if (!severities) return this.alerts;
    return this.alerts.filter(a => severities.includes(a.severity));
  }

  getActiveAlerts(): any[] {
    const oneHourAgo = Date.now() - 3600000;
    return this.alerts.filter(
      a => new Date(a.timestamp).getTime() > oneHourAgo
    );
  }
}

export class SLATracker {
  private slas: Map<string, any> = new Map();
  private measurements: Map<string, number[]> = new Map();

  registerSLA(
    name: string,
    metric: string,
    targetPercentile: number,
    targetValue: number
  ): void {
    this.slas.set(name, {
      name,
      metric,
      targetPercentile,
      targetValue,
      compliant: true,
    });
  }

  recordMeasurement(metric: string, value: number): void {
    if (!this.measurements.has(metric)) {
      this.measurements.set(metric, []);
    }
    this.measurements.get(metric)!.push(value);
  }

  evaluateSLAs(): Record<string, any> {
    const results: Record<string, any> = {};

    for (const [name, sla] of this.slas) {
      const values = this.measurements.get(sla.metric) || [];
      const sorted = values.sort((a, b) => a - b);
      const percentileIndex = Math.floor(sorted.length * (sla.targetPercentile / 100));
      const percentileValue = sorted[percentileIndex] || 0;
      const compliant = percentileValue <= sla.targetValue;

      results[name] = {
        ...sla,
        measurements: values.length,
        percentileValue,
        compliant,
        successRate: compliant ? 100 : (sla.targetValue / percentileValue) * 100,
      };
    }

    return results;
  }
}

// Export singletons
export const metricsCollector = new MetricsCollector();
export const distributedTracer = new DistributedTracer();
export const alertingSystem = new AlertingSystem();
export const slaTracker = new SLATracker();

export default {
  MetricsCollector,
  DistributedTracer,
  AlertingSystem,
  SLATracker,
  metricsCollector,
  distributedTracer,
  alertingSystem,
  slaTracker,
};
