// Email Notification Service (SendGrid/Mailgun)
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  createdAt: number;
}

export interface EmailMessage {
  id: string;
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  template?: string;
  variables?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    mimeType: string;
  }>;
  sentAt?: number;
  deliveredAt?: number;
  bounced?: boolean;
  status: 'draft' | 'queued' | 'sent' | 'failed';
}

export interface NotificationPreference {
  userId: string;
  email: string;
  categories: Record<string, boolean>;
  digestFrequency: 'instant' | 'daily' | 'weekly' | 'never';
  unsubscribeToken: string;
}

export class EmailNotificationService {
  private templates: Map<string, EmailTemplate> = new Map();
  private messages: Map<string, EmailMessage> = new Map();
  private preferences: Map<string, NotificationPreference> = new Map();
  private messageQueue: EmailMessage[] = [];
  private bounceList: Set<string> = new Set();
  private sentimentalUnsubscribes: Set<string> = new Set();
  private maxQueueSize = 10000;

  constructor() {
    this.initializeDefaultTemplates();
  }

  // Create email template
  createTemplate(name: string, subject: string, body: string): EmailTemplate {
    // Extract variables from template (e.g., {{name}}, {{email}})
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(body)) !== null) {
      variables.push(match[1]);
    }

    const template: EmailTemplate = {
      id: `tpl-${Date.now()}`,
      name,
      subject,
      body,
      variables,
      createdAt: Date.now(),
    };

    this.templates.set(template.id, template);
    return template;
  }

  // Get template
  getTemplate(templateId: string): EmailTemplate | undefined {
    return this.templates.get(templateId);
  }

  // Send email
  async sendEmail(to: string, subject: string, body: string, options?: {
    cc?: string[];
    bcc?: string[];
    attachments?: any[];
  }): Promise<string> {
    if (this.bounceList.has(to)) {
      throw new Error(`Email address bounced: ${to}`);
    }

    const message: EmailMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      to,
      subject,
      body,
      cc: options?.cc,
      bcc: options?.bcc,
      attachments: options?.attachments,
      status: 'draft',
    };

    this.messages.set(message.id, message);

    // Queue for sending
    this.enqueue(message);

    console.log(`📧 Email queued to ${to}: ${subject}`);
    return message.id;
  }

  // Send templated email
  async sendTemplatedEmail(
    to: string,
    templateId: string,
    variables?: Record<string, any>
  ): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Replace variables in template
    let body = template.body;
    let subject = template.subject;

    for (const [key, value] of Object.entries(variables || {})) {
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    return this.sendEmail(to, subject, body);
  }

  // Send digest email
  async sendDigestEmail(userId: string, events: any[]): Promise<string> {
    const pref = this.preferences.get(userId);
    if (!pref) {
      throw new Error(`User preferences not found: ${userId}`);
    }

    const emailBody = this.generateDigestBody(events);

    const messageId = await this.sendEmail(
      pref.email,
      `Your Daily Digest - ${events.length} updates`,
      emailBody
    );

    return messageId;
  }

  // Get message status
  getMessageStatus(messageId: string): EmailMessage | undefined {
    return this.messages.get(messageId);
  }

  // List messages
  listMessages(userId?: string): EmailMessage[] {
    if (!userId) {
      return Array.from(this.messages.values());
    }

    return Array.from(this.messages.values()).filter(msg =>
      msg.id.includes(userId)
    );
  }

  // Set notification preferences
  setPreferences(userId: string, email: string, preferences: {
    categories?: Record<string, boolean>;
    digestFrequency?: 'instant' | 'daily' | 'weekly' | 'never';
  }): void {
    const unsubToken = `unsub-${Math.random().toString(36).substr(2)}`;

    this.preferences.set(userId, {
      userId,
      email,
      categories: preferences.categories || { all: true },
      digestFrequency: preferences.digestFrequency || 'instant',
      unsubscribeToken: unsubToken,
    });

    console.log(`✅ Preferences set for ${userId}`);
  }

  // Get preferences
  getPreferences(userId: string): NotificationPreference | undefined {
    return this.preferences.get(userId);
  }

  // Unsubscribe
  unsubscribe(unsubscribeToken: string): void {
    for (const [userId, pref] of this.preferences) {
      if (pref.unsubscribeToken === unsubscribeToken) {
        this.sentimentalUnsubscribes.add(email);
        pref.digestFrequency = 'never';
        console.log(`👋 User unsubscribed: ${userId}`);
        break;
      }
    }
  }

  // Mark bounce
  markBounce(email: string): void {
    this.bounceList.add(email);
    console.log(`⚠️ Email marked as bounced: ${email}`);
  }

  // Verify email
  async verifyEmail(email: string): Promise<boolean> {
    // In production, use email verification service
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return isValid && !this.bounceList.has(email);
  }

  // Get queue stats
  getQueueStats(): any {
    const messagesByStatus = Array.from(this.messages.values()).reduce((acc, msg) => {
      acc[msg.status] = (acc[msg.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      queueSize: this.messageQueue.length,
      totalMessages: this.messages.size,
      messagesByStatus,
      bounceListSize: this.bounceList.size,
      unsubscribedCount: this.sentimentalUnsubscribes.size,
    };
  }

  // Private methods
  private initializeDefaultTemplates(): void {
    // Welcome email
    this.createTemplate(
      'welcome',
      'Welcome to {{appName}}!',
      `
        <h1>Hello {{name}}!</h1>
        <p>Welcome to {{appName}}. We're excited to have you on board.</p>
        <p><a href="{{confirmUrl}}">Confirm your email</a></p>
      `
    );

    // Password reset
    this.createTemplate(
      'password-reset',
      'Reset your password',
      `
        <h1>Password Reset Request</h1>
        <p>Click the link below to reset your password:</p>
        <p><a href="{{resetUrl}}">Reset Password</a></p>
        <p>This link expires in 24 hours.</p>
      `
    );

    // Notification
    this.createTemplate(
      'notification',
      '{{title}}',
      `
        <h1>{{title}}</h1>
        <p>{{message}}</p>
        <p><a href="{{actionUrl}}">View Details</a></p>
      `
    );
  }

  private enqueue(message: EmailMessage): void {
    message.status = 'queued';
    this.messageQueue.push(message);

    if (this.messageQueue.length > this.maxQueueSize) {
      this.messageQueue.shift();
    }

    // Process queue async
    setImmediate(() => this.processQueue());
  }

  private async processQueue(): Promise<void> {
    const maxBatch = 10;
    const batch = this.messageQueue.splice(0, maxBatch);

    for (const message of batch) {
      try {
        await this.deliverEmail(message);
        message.status = 'sent';
        message.sentAt = Date.now();
        console.log(`✅ Email sent: ${message.id}`);
      } catch (error) {
        message.status = 'failed';
        console.error(`❌ Failed to send email ${message.id}:`, error);
      }
    }
  }

  private async deliverEmail(message: EmailMessage): Promise<void> {
    // Mock implementation - in production use SendGrid, Mailgun, etc.
    // return fetch('https://api.sendgrid.com/v3/mail/send', {...})

    // Simulate delivery delay
    return new Promise(resolve => setTimeout(resolve, 100));
  }

  private generateDigestBody(events: any[]): string {
    const eventList = events
      .map(e => `<li>${e.title}</li>`)
      .join('');

    return `
      <h1>Your Daily Digest</h1>
      <p>Here are the updates since your last digest:</p>
      <ul>
        ${eventList}
      </ul>
      <p><a href="https://app.example.com">View all updates</a></p>
    `;
  }
}

export const emailNotificationService = new EmailNotificationService();

export default emailNotificationService;
