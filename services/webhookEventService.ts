// Webhook & Event System Service
export interface WebhookConfig {
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface WebhookEvent {
  id: string;
  type: string;
  timestamp: number;
  data: any;
  metadata?: Record<string, any>;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempts: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  response?: {
    statusCode: number;
    body: string;
  };
  error?: string;
}

export class WebhookEventSystem {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private events: Map<string, WebhookEvent> = new Map();
  private deliveries: Map<string, WebhookDelivery> = new Map();
  private eventHistory: WebhookEvent[] = [];
  private maxHistorySize = 10000;

  // Register webhook
  registerWebhook(webhookId: string, config: WebhookConfig): void {
    this.webhooks.set(webhookId, config);
    console.log(`✅ Webhook registered: ${webhookId} → ${config.url}`);
  }

  // Unregister webhook
  unregisterWebhook(webhookId: string): boolean {
    return this.webhooks.delete(webhookId);
  }

  // Update webhook
  updateWebhook(webhookId: string, config: Partial<WebhookConfig>): void {
    const existing = this.webhooks.get(webhookId);
    if (existing) {
      this.webhooks.set(webhookId, { ...existing, ...config });
    }
  }

  // Publish event
  async publishEvent(eventType: string, data: any, metadata?: Record<string, any>): Promise<string> {
    const event: WebhookEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      timestamp: Date.now(),
      data,
      metadata,
    };

    this.events.set(event.id, event);
    this.eventHistory.push(event);

    // Cleanup history if too large
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }

    // Deliver to interested webhooks
    const targetWebhooks = Array.from(this.webhooks.entries()).filter(
      ([_, config]) => config.active && config.events.includes(eventType)
    );

    for (const [webhookId, config] of targetWebhooks) {
      this.deliverEvent(webhookId, config, event);
    }

    return event.id;
  }

  // Deliver event to webhook
  private async deliverEvent(webhookId: string, config: WebhookConfig, event: WebhookEvent): Promise<void> {
    const delivery: WebhookDelivery = {
      id: `dlv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      webhookId,
      eventId: event.id,
      status: 'pending',
      attempts: 0,
    };

    this.deliveries.set(delivery.id, delivery);

    // Execute delivery with retries
    await this.executeDelivery(delivery, config, event);
  }

  // Execute delivery with retry logic
  private async executeDelivery(
    delivery: WebhookDelivery,
    config: WebhookConfig,
    event: WebhookEvent
  ): Promise<void> {
    const maxRetries = config.retryPolicy?.maxRetries || 3;
    const backoffMs = config.retryPolicy?.backoffMs || 1000;

    while (delivery.attempts < maxRetries) {
      delivery.attempts++;
      delivery.lastAttemptAt = Date.now();

      try {
        const response = await this.sendWebhookRequest(config, event);

        if (response.statusCode >= 200 && response.statusCode < 300) {
          delivery.status = 'success';
          delivery.response = response;
          console.log(`✅ Webhook delivered: ${delivery.id}`);
          break;
        } else if (response.statusCode >= 400 && response.statusCode < 500) {
          // Client error - don't retry
          delivery.status = 'failed';
          delivery.error = `HTTP ${response.statusCode}: ${response.body}`;
          delivery.response = response;
          console.warn(`⚠️ Webhook failed (client error): ${delivery.id}`);
          break;
        } else {
          // Server error - retry
          throw new Error(`HTTP ${response.statusCode}`);
        }
      } catch (error: any) {
        delivery.error = error.message;

        if (delivery.attempts < maxRetries) {
          // Schedule retry
          const delay = backoffMs * Math.pow(2, delivery.attempts - 1); // exponential backoff
          delivery.status = 'retrying';
          delivery.nextRetryAt = Date.now() + delay;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          delivery.status = 'failed';
          console.error(`❌ Webhook failed after ${maxRetries} attempts: ${delivery.id}`);
        }
      }
    }
  }

  // Send webhook request
  private async sendWebhookRequest(
    config: WebhookConfig,
    event: WebhookEvent
  ): Promise<{ statusCode: number; body: string }> {
    // Mock implementation - in production, use fetch/axios
    try {
      const payload = JSON.stringify(event);

      // In real implementation:
      // const response = await fetch(config.url, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'X-Webhook-Signature': this.generateSignature(payload, config.secret),
      //   },
      //   body: payload,
      //   timeout: 30000,
      // });

      // Mock response
      return {
        statusCode: 200,
        body: JSON.stringify({ received: true }),
      };
    } catch (error: any) {
      throw error;
    }
  }

  // Generate webhook signature for verification
  private generateSignature(payload: string, secret?: string): string {
    if (!secret) return '';

    // In production: use HMAC-SHA256
    // const crypto = require('crypto');
    // return crypto.createHmac('sha256', secret).update(payload).digest('hex');

    return 'mock-signature';
  }

  // Get webhook
  getWebhook(webhookId: string): WebhookConfig | undefined {
    return this.webhooks.get(webhookId);
  }

  // List webhooks
  listWebhooks(): Array<[string, WebhookConfig]> {
    return Array.from(this.webhooks.entries());
  }

  // Get event
  getEvent(eventId: string): WebhookEvent | undefined {
    return this.events.get(eventId);
  }

  // Get delivery status
  getDelivery(deliveryId: string): WebhookDelivery | undefined {
    return this.deliveries.get(deliveryId);
  }

  // Get deliveries for webhook
  getWebhookDeliveries(webhookId: string): WebhookDelivery[] {
    return Array.from(this.deliveries.values()).filter(d => d.webhookId === webhookId);
  }

  // Get event history
  getEventHistory(eventType?: string): WebhookEvent[] {
    if (!eventType) return this.eventHistory;
    return this.eventHistory.filter(e => e.type === eventType);
  }

  // Test webhook
  async testWebhook(webhookId: string): Promise<boolean> {
    const config = this.webhooks.get(webhookId);
    if (!config) return false;

    const testEvent: WebhookEvent = {
      id: `test-${Date.now()}`,
      type: 'test.webhook',
      timestamp: Date.now(),
      data: { message: 'Webhook test' },
    };

    try {
      const response = await this.sendWebhookRequest(config, testEvent);
      return response.statusCode >= 200 && response.statusCode < 300;
    } catch {
      return false;
    }
  }

  // Get statistics
  getStats(): any {
    const deliveries = Array.from(this.deliveries.values());
    const byStatus = deliveries.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      webhookCount: this.webhooks.size,
      eventCount: this.events.size,
      eventHistorySize: this.eventHistory.length,
      deliveryCount: this.deliveries.size,
      deliveriesByStatus: byStatus,
      failedDeliveries: deliveries.filter(d => d.status === 'failed').length,
    };
  }

  // Clear old data
  clearOldData(olderThanMs: number): number {
    const cutoff = Date.now() - olderThanMs;
    let removed = 0;

    // Clear old events
    for (const [id, event] of this.events) {
      if (event.timestamp < cutoff) {
        this.events.delete(id);
        removed++;
      }
    }

    // Clear old deliveries
    for (const [id, delivery] of this.deliveries) {
      if ((delivery.lastAttemptAt || 0) < cutoff) {
        this.deliveries.delete(id);
        removed++;
      }
    }

    return removed;
  }
}

export const webhookEventSystem = new WebhookEventSystem();

export default webhookEventSystem;
