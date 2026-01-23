// Webhooks & Event System
export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret: string;
  createdAt: number;
  lastTriggered?: number;
  failureCount: number;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  webhookId?: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  nextRetry?: number;
}

export class WebhookManager {
  private webhooks: Map<string, Webhook> = new Map();
  private events: WebhookEvent[] = [];
  private eventHandlers: Map<string, Set<(data: any) => void>> = new Map();
  private maxRetries = 5;
  private retryDelayMs = 5000;

  registerWebhook(url: string, events: string[]): Webhook {
    const webhook: Webhook = {
      id: `webhook-${Date.now()}`,
      url,
      events,
      active: true,
      secret: this.generateSecret(),
      createdAt: Date.now(),
      failureCount: 0,
    };

    this.webhooks.set(webhook.id, webhook);
    return webhook;
  }

  async triggerEvent(eventType: string, data: any): Promise<void> {
    const event: WebhookEvent = {
      id: `event-${Date.now()}`,
      type: eventType,
      data,
      timestamp: Date.now(),
      status: 'pending',
      attempts: 0,
    };

    this.events.push(event);

    // Trigger local handlers
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }

    // Queue for webhook delivery
    await this.deliverToWebhooks(event);
  }

  private async deliverToWebhooks(event: WebhookEvent): Promise<void> {
    for (const webhook of this.webhooks.values()) {
      if (!webhook.active || !webhook.events.includes(event.type)) continue;

      this.queueDelivery(webhook, event);
    }
  }

  private queueDelivery(webhook: Webhook, event: WebhookEvent): void {
    const deliverWithRetry = async () => {
      if (event.attempts >= this.maxRetries) {
        event.status = 'failed';
        webhook.failureCount++;
        return;
      }

      event.attempts++;

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': this.generateSignature(event, webhook.secret),
            'X-Webhook-ID': webhook.id,
            'X-Event-Type': event.type,
          },
          body: JSON.stringify(event),
          timeout: 10000,
        });

        if (response.ok) {
          event.status = 'delivered';
          webhook.lastTriggered = Date.now();
          webhook.failureCount = 0;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error: any) {
        console.error(`Webhook delivery failed for ${webhook.id}:`, error);

        if (event.attempts < this.maxRetries) {
          const backoffMs = this.retryDelayMs * Math.pow(2, event.attempts - 1);
          event.nextRetry = Date.now() + backoffMs;

          setTimeout(() => deliverWithRetry(), backoffMs);
        } else {
          event.status = 'failed';
          webhook.failureCount++;
        }
      }
    };

    deliverWithRetry();
  }

  // Local event subscriptions
  subscribe(eventType: string, handler: (data: any) => void): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    this.eventHandlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  // Webhook management
  updateWebhook(id: string, updates: Partial<Webhook>): Webhook {
    const webhook = this.webhooks.get(id);
    if (!webhook) throw new Error('Webhook not found');

    Object.assign(webhook, updates);
    return webhook;
  }

  disableWebhook(id: string): void {
    const webhook = this.webhooks.get(id);
    if (webhook) {
      webhook.active = false;
    }
  }

  deleteWebhook(id: string): boolean {
    return this.webhooks.delete(id);
  }

  getWebhooks(): Webhook[] {
    return Array.from(this.webhooks.values());
  }

  getEvents(webhookId?: string, status?: string): WebhookEvent[] {
    let filtered = this.events;

    if (webhookId) {
      filtered = filtered.filter(e => e.webhookId === webhookId);
    }

    if (status) {
      filtered = filtered.filter(e => e.status === status);
    }

    return filtered.slice(-100); // Return last 100
  }

  // Dead letter queue
  getDeadLetterQueue(): WebhookEvent[] {
    return this.events.filter(e => e.status === 'failed');
  }

  // Retry failed events
  async retryFailedEvents(): Promise<number> {
    const failed = this.getDeadLetterQueue();
    let retried = 0;

    for (const event of failed) {
      if (event.attempts < this.maxRetries) {
        event.attempts = 0; // Reset
        event.status = 'pending';

        for (const webhook of this.webhooks.values()) {
          if (webhook.events.includes(event.type)) {
            this.queueDelivery(webhook, event);
            retried++;
          }
        }
      }
    }

    return retried;
  }

  private generateSecret(): string {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  private generateSignature(event: WebhookEvent, secret: string): string {
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(event))
      .digest('hex');
  }
}

export const webhookManager = new WebhookManager();

export default webhookManager;
