// Worker queue system for background jobs
export interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: any;
}

export interface JobHandler<T = any> {
  (data: T): Promise<any>;
}

export class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private handlers: Map<string, JobHandler> = new Map();
  private processingJobs = new Set<string>();
  private workers: number;
  private isRunning = false;

  constructor(workers = 4) {
    this.workers = workers;
  }

  registerHandler<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler);
  }

  async enqueue<T>(type: string, data: T, priority = 0, maxAttempts = 3): Promise<string> {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.jobs.set(jobId, {
      id: jobId,
      type,
      data,
      status: 'pending',
      priority,
      attempts: 0,
      maxAttempts,
      createdAt: Date.now(),
    });

    return jobId;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    const workerPromises = Array(this.workers)
      .fill(null)
      .map(() => this.worker());

    await Promise.all(workerPromises);
  }

  stop(): void {
    this.isRunning = false;
  }

  private async worker(): Promise<void> {
    while (this.isRunning) {
      // Get next job
      const job = this.getNextJob();

      if (!job) {
        // Sleep before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      if (this.processingJobs.has(job.id)) {
        continue;
      }

      this.processingJobs.add(job.id);

      try {
        await this.processJob(job);
      } catch (error: any) {
        console.error(`Job ${job.id} failed:`, error);
      } finally {
        this.processingJobs.delete(job.id);
      }
    }
  }

  private getNextJob(): Job | null {
    const pending = Array.from(this.jobs.values())
      .filter(j => j.status === 'pending' && !this.processingJobs.has(j.id))
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);

    return pending[0] || null;
  }

  private async processJob(job: Job): Promise<void> {
    job.status = 'processing';
    job.startedAt = Date.now();
    job.attempts++;

    const handler = this.handlers.get(job.type);

    if (!handler) {
      job.status = 'failed';
      job.error = `No handler for job type: ${job.type}`;
      job.completedAt = Date.now();
      return;
    }

    try {
      job.result = await handler(job.data);
      job.status = 'completed';
      job.completedAt = Date.now();
    } catch (error: any) {
      job.error = error.message;

      if (job.attempts < job.maxAttempts) {
        job.status = 'pending';
        // Exponential backoff
        const delay = Math.pow(2, job.attempts) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        job.status = 'failed';
        job.completedAt = Date.now();
      }
    }
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  getJobs(status?: string): Job[] {
    if (status) {
      return Array.from(this.jobs.values()).filter(j => j.status === status);
    }
    return Array.from(this.jobs.values());
  }

  getMetrics() {
    const jobs = Array.from(this.jobs.values());

    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      avgProcessingTime:
        jobs.filter(j => j.completedAt).reduce((sum, j) => sum + ((j.completedAt || 0) - (j.startedAt || 0)), 0) /
        Math.max(1, jobs.filter(j => j.completedAt).length),
    };
  }

  clear(): void {
    this.jobs.clear();
    this.processingJobs.clear();
  }
}

// Priority queue implementation
export class PriorityJobQueue extends JobQueue {
  private priorityQueues: Map<number, Job[]> = new Map();

  async enqueue<T>(
    type: string,
    data: T,
    priority = 0,
    maxAttempts = 3
  ): Promise<string> {
    const jobId = await super.enqueue(type, data, priority, maxAttempts);

    if (!this.priorityQueues.has(priority)) {
      this.priorityQueues.set(priority, []);
    }

    const job = this.getJob(jobId)!;
    this.priorityQueues.get(priority)!.push(job);

    return jobId;
  }
}

// Export singleton
export const jobQueue = new JobQueue();

export default {
  JobQueue,
  PriorityJobQueue,
  jobQueue,
};
