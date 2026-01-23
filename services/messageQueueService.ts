// Message Queue Service (RabbitMQ/Kafka-style)
export interface Message {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  priority: number; // 0-10
  retryCount: number;
  maxRetries: number;
  deadLetterQueue?: boolean;
}

export interface ConsumerGroup {
  name: string;
  consumers: Set<string>;
  offset: number;
  lastMessage?: string;
}

export class MessageQueue {
  private queues: Map<string, Message[]> = new Map();
  private consumerGroups: Map<string, ConsumerGroup> = new Map();
  private deadLetterQueue: Message[] = [];
  private messageHistory: Map<string, Message> = new Map();
  private maxQueueSize = 100000;
  private maxHistorySize = 10000;

  // Enqueue message
  enqueue(queueName: string, message: Omit<Message, 'id' | 'timestamp' | 'retryCount'>): string {
    const msg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      ...message,
    };

    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }

    const queue = this.queues.get(queueName)!;

    // Insert by priority (higher priority first)
    const insertIndex = queue.findIndex(m => m.priority < msg.priority);
    if (insertIndex === -1) {
      queue.push(msg);
    } else {
      queue.splice(insertIndex, 0, msg);
    }

    // Cleanup if too large
    if (queue.length > this.maxQueueSize) {
      queue.shift(); // Remove oldest
    }

    // Store in history
    this.storeMessage(msg);

    console.log(`📨 Message enqueued: ${queueName}/${msg.id}`);
    return msg.id;
  }

  // Dequeue message
  dequeue(queueName: string): Message | null {
    const queue = this.queues.get(queueName);
    if (!queue || queue.length === 0) return null;

    return queue.shift() || null;
  }

  // Peek at message without removing
  peek(queueName: string): Message | null {
    const queue = this.queues.get(queueName);
    return queue?.[0] || null;
  }

  // Get queue size
  getQueueSize(queueName: string): number {
    return this.queues.get(queueName)?.length || 0;
  }

  // List all messages in queue
  listQueue(queueName: string, limit = 100): Message[] {
    const queue = this.queues.get(queueName);
    return queue?.slice(0, limit) || [];
  }

  // Create consumer group
  createConsumerGroup(groupName: string): void {
    if (!this.consumerGroups.has(groupName)) {
      this.consumerGroups.set(groupName, {
        name: groupName,
        consumers: new Set(),
        offset: 0,
      });
    }
  }

  // Register consumer
  registerConsumer(groupName: string, consumerId: string): void {
    const group = this.consumerGroups.get(groupName);
    if (group) {
      group.consumers.add(consumerId);
      console.log(`👤 Consumer registered: ${groupName}/${consumerId}`);
    }
  }

  // Unregister consumer
  unregisterConsumer(groupName: string, consumerId: string): void {
    const group = this.consumerGroups.get(groupName);
    if (group) {
      group.consumers.delete(consumerId);
    }
  }

  // Consume message (for consumer groups)
  consume(groupName: string, queueName: string): Message | null {
    const group = this.consumerGroups.get(groupName);
    if (!group) return null;

    const message = this.dequeue(queueName);
    if (message) {
      group.lastMessage = message.id;
      group.offset++;
    }

    return message;
  }

  // Acknowledge message
  acknowledge(queueName: string, messageId: string): void {
    const msg = this.messageHistory.get(messageId);
    if (msg) {
      msg.retryCount = 0; // Reset retries on success
    }
  }

  // Retry message
  retry(queueName: string, messageId: string): boolean {
    const msg = this.messageHistory.get(messageId);
    if (!msg) return false;

    if (msg.retryCount < msg.maxRetries) {
      msg.retryCount++;
      this.enqueue(queueName, {
        type: msg.type,
        payload: msg.payload,
        priority: msg.priority,
        maxRetries: msg.maxRetries,
      });
      return true;
    } else {
      // Move to dead letter queue
      msg.deadLetterQueue = true;
      this.deadLetterQueue.push(msg);
      console.warn(`💀 Message moved to DLQ: ${messageId}`);
      return false;
    }
  }

  // Handle failed message
  handleFailedMessage(queueName: string, messageId: string, error: string): void {
    const msg = this.messageHistory.get(messageId);
    if (msg && !this.retry(queueName, messageId)) {
      console.error(`❌ Message failed after retries: ${messageId} - ${error}`);
    }
  }

  // Message replay
  replay(queueName: string, fromTimestamp: number): number {
    const messages = Array.from(this.messageHistory.values()).filter(
      msg => msg.timestamp >= fromTimestamp
    );

    let count = 0;
    for (const msg of messages) {
      this.enqueue(queueName, {
        type: msg.type,
        payload: msg.payload,
        priority: msg.priority,
        maxRetries: msg.maxRetries,
      });
      count++;
    }

    console.log(`🔄 Replayed ${count} messages from ${new Date(fromTimestamp).toISOString()}`);
    return count;
  }

  // Get dead letter queue
  getDeadLetterQueue(): Message[] {
    return [...this.deadLetterQueue];
  }

  // Get consumer group
  getConsumerGroup(groupName: string): ConsumerGroup | undefined {
    return this.consumerGroups.get(groupName);
  }

  // List consumer groups
  listConsumerGroups(): Array<[string, ConsumerGroup]> {
    return Array.from(this.consumerGroups.entries());
  }

  // Purge queue
  purgeQueue(queueName: string): number {
    const queue = this.queues.get(queueName);
    if (!queue) return 0;

    const count = queue.length;
    this.queues.set(queueName, []);
    return count;
  }

  // Get message
  getMessage(messageId: string): Message | undefined {
    return this.messageHistory.get(messageId);
  }

  // Search messages
  searchMessages(filter: {
    type?: string;
    fromTimestamp?: number;
    toTimestamp?: number;
  }): Message[] {
    return Array.from(this.messageHistory.values()).filter(msg => {
      if (filter.type && msg.type !== filter.type) return false;
      if (filter.fromTimestamp && msg.timestamp < filter.fromTimestamp) return false;
      if (filter.toTimestamp && msg.timestamp > filter.toTimestamp) return false;
      return true;
    });
  }

  // Get statistics
  getStats(): any {
    const queueStats: Record<string, number> = {};
    for (const [name, queue] of this.queues) {
      queueStats[name] = queue.length;
    }

    const messagesByType = Array.from(this.messageHistory.values()).reduce((acc, msg) => {
      acc[msg.type] = (acc[msg.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      queues: queueStats,
      totalQueued: Array.from(this.queues.values()).reduce((sum, q) => sum + q.length, 0),
      totalMessages: this.messageHistory.size,
      messagesByType,
      deadLetterQueueSize: this.deadLetterQueue.length,
      consumerGroupCount: this.consumerGroups.size,
    };
  }

  // Private methods
  private storeMessage(msg: Message): void {
    this.messageHistory.set(msg.id, msg);

    // Cleanup if too large
    if (this.messageHistory.size > this.maxHistorySize) {
      const oldest = Array.from(this.messageHistory.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, Math.floor(this.maxHistorySize * 0.1)); // Remove oldest 10%

      oldest.forEach(([id]) => this.messageHistory.delete(id));
    }
  }

  // Clear old messages
  clearOldMessages(olderThanMs: number): number {
    const cutoff = Date.now() - olderThanMs;
    let removed = 0;

    for (const [id, msg] of this.messageHistory) {
      if (msg.timestamp < cutoff && !msg.deadLetterQueue) {
        this.messageHistory.delete(id);
        removed++;
      }
    }

    return removed;
  }
}

export const messageQueue = new MessageQueue();

export default messageQueue;
