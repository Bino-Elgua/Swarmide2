// Email Notification Service
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  text: string;
}

export interface Email {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, any>;
}

export class EmailService {
  private templates: Map<string, EmailTemplate> = new Map();
  private sentEmails: Email[] = [];
  private preferences: Map<string, Record<string, boolean>> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    this.templates.set('execution-started', {
      id: 'execution-started',
      name: 'Execution Started',
      subject: 'SwarmIDE2: Project execution started',
      html: '<p>Your project execution has started.</p>',
      text: 'Your project execution has started.',
    });

    this.templates.set('execution-completed', {
      id: 'execution-completed',
      name: 'Execution Completed',
      subject: 'SwarmIDE2: Project execution completed',
      html: '<p>Your project execution has completed successfully.</p>',
      text: 'Your project execution has completed successfully.',
    });

    this.templates.set('execution-failed', {
      id: 'execution-failed',
      name: 'Execution Failed',
      subject: 'SwarmIDE2: Project execution failed',
      html: '<p>Your project execution has failed.</p>',
      text: 'Your project execution has failed.',
    });

    this.templates.set('welcome', {
      id: 'welcome',
      name: 'Welcome',
      subject: 'Welcome to SwarmIDE2',
      html: '<p>Welcome to SwarmIDE2. Get started now.</p>',
      text: 'Welcome to SwarmIDE2. Get started now.',
    });
  }

  async sendEmail(email: Email): Promise<{ success: boolean; messageId: string }> {
    // Check preferences
    if (!this.hasPreference(email.to[0], email.subject)) {
      return { success: false, messageId: '' };
    }

    // In production, integrate with SendGrid/Mailgun
    const messageId = `msg-${Date.now()}`;

    this.sentEmails.push(email);

    console.log(`📧 Email sent to ${email.to.join(', ')}: ${email.subject}`);

    return { success: true, messageId };
  }

  async sendTemplateEmail(
    to: string[],
    templateId: string,
    data: Record<string, any> = {}
  ): Promise<{ success: boolean; messageId: string }> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const html = this.renderTemplate(template.html, data);
    const text = this.renderTemplate(template.text, data);
    const subject = this.renderTemplate(template.subject, data);

    return this.sendEmail({
      to,
      subject,
      html,
      text,
      templateId,
      templateData: data,
    });
  }

  async sendBatch(emails: Email[]): Promise<number> {
    let sent = 0;

    for (const email of emails) {
      try {
        await this.sendEmail(email);
        sent++;
      } catch (error) {
        console.error('Error sending email:', error);
      }
    }

    return sent;
  }

  // Template management
  registerTemplate(template: EmailTemplate): void {
    this.templates.set(template.id, template);
  }

  getTemplate(id: string): EmailTemplate | undefined {
    return this.templates.get(id);
  }

  listTemplates(): EmailTemplate[] {
    return Array.from(this.templates.values());
  }

  // User preferences
  setPreference(email: string, type: string, enabled: boolean): void {
    if (!this.preferences.has(email)) {
      this.preferences.set(email, {});
    }

    this.preferences.get(email)![type] = enabled;
  }

  private hasPreference(email: string, type: string): boolean {
    const prefs = this.preferences.get(email);
    return prefs?.[type] !== false; // Default to true
  }

  getPreferences(email: string): Record<string, boolean> {
    return this.preferences.get(email) || {};
  }

  // Email history
  getsentEmails(filter?: Partial<Email>): Email[] {
    if (!filter) return this.sentEmails;

    return this.sentEmails.filter(email => {
      if (filter.to && !filter.to.some(t => email.to.includes(t))) return false;
      if (filter.subject && !email.subject.includes(filter.subject)) return false;
      return true;
    });
  }

  clearSentEmails(): void {
    this.sentEmails = [];
  }

  // Template rendering
  private renderTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }
}

export const emailService = new EmailService();

export default emailService;
