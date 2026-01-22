export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  inputs: Record<string, any>;
  outputs: Record<string, any> | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  checkpoints: Checkpoint[];
  retries: number;
  maxRetries: number;
}

export interface Checkpoint {
  id: string;
  stepId: string;
  timestamp: string;
  state: Record<string, any>;
  result: any;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialInterval: number; // milliseconds
  };
  timeout: number; // milliseconds
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'task' | 'activity' | 'decision' | 'parallel' | 'loop';
  handler: string; // function name
  inputs: Record<string, any>;
  retryPolicy?: {
    maxRetries: number;
    backoffMultiplier: number;
  };
  dependencies: string[]; // step IDs that must complete first
}

class DurableWorkflowService {
  private executions: Map<string, WorkflowExecution> = new Map();
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private handlers: Map<string, Function> = new Map();
  private persistenceStore: Map<string, any> = new Map(); // Simulated database

  // Register workflow definition
  registerWorkflow(definition: WorkflowDefinition): void {
    this.workflows.set(definition.id, definition);
  }

  // Register step handler
  registerHandler(name: string, handler: Function): void {
    this.handlers.set(name, handler);
  }

  // Start workflow execution
  async startExecution(
    workflowId: string,
    inputs: Record<string, any>,
    resumeFrom?: string
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const executionId = `exec-${workflowId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'pending',
      inputs,
      outputs: null,
      error: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      checkpoints: [],
      retries: 0,
      maxRetries: workflow.retryPolicy.maxRetries,
    };

    // Resume from checkpoint if specified
    if (resumeFrom) {
      const checkpoint = this.loadCheckpoint(executionId, resumeFrom);
      if (checkpoint) {
        execution = this.restoreExecutionFromCheckpoint(execution, checkpoint);
      }
    }

    this.executions.set(executionId, execution);

    // Execute workflow asynchronously
    this.executeWorkflow(executionId, workflow).catch(error => {
      const exec = this.executions.get(executionId);
      if (exec) {
        exec.status = 'failed';
        exec.error = error.message;
        exec.completedAt = new Date().toISOString();
      }
    });

    return execution;
  }

  private async executeWorkflow(executionId: string, workflow: WorkflowDefinition): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    execution.status = 'running';
    execution.startedAt = new Date().toISOString();

    try {
      const stepResults = new Map<string, any>();

      for (const step of workflow.steps) {
        // Check dependencies
        if (step.dependencies.length > 0) {
          for (const depId of step.dependencies) {
            if (!stepResults.has(depId)) {
              throw new Error(`Dependency ${depId} not completed for step ${step.id}`);
            }
          }
        }

        // Execute step with retry logic
        const result = await this.executeStepWithRetry(
          step,
          execution.inputs,
          stepResults,
          step.retryPolicy || workflow.retryPolicy
        );

        stepResults.set(step.id, result);

        // Create checkpoint
        const checkpoint: Checkpoint = {
          id: `cp-${step.id}-${Date.now()}`,
          stepId: step.id,
          timestamp: new Date().toISOString(),
          state: Object.fromEntries(stepResults),
          result,
        };

        execution.checkpoints.push(checkpoint);
        this.saveCheckpoint(executionId, checkpoint);
      }

      execution.status = 'completed';
      execution.outputs = Object.fromEntries(
        Array.from(stepResults.entries()).slice(-5) // Return last 5 results
      );
      execution.completedAt = new Date().toISOString();
    } catch (error: any) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = new Date().toISOString();
      throw error;
    }
  }

  private async executeStepWithRetry(
    step: WorkflowStep,
    inputs: Record<string, any>,
    previousResults: Map<string, any>,
    retryPolicy: { maxRetries: number; backoffMultiplier: number; initialInterval?: number }
  ): Promise<any> {
    let lastError: Error | null = null;
    const initialInterval = retryPolicy.initialInterval || 1000;

    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      try {
        const handler = this.handlers.get(step.handler);
        if (!handler) {
          throw new Error(`Handler ${step.handler} not found`);
        }

        const stepInputs = {
          ...step.inputs,
          ...inputs,
          previousResults: Object.fromEntries(previousResults),
        };

        return await handler(stepInputs);
      } catch (error: any) {
        lastError = error;

        if (attempt < retryPolicy.maxRetries) {
          // Calculate backoff
          const backoffMs = initialInterval * Math.pow(retryPolicy.backoffMultiplier, attempt);
          console.log(`Step ${step.id} failed, retrying in ${backoffMs}ms...`);
          await this.sleep(backoffMs);
        }
      }
    }

    throw lastError || new Error(`Step ${step.id} failed after ${retryPolicy.maxRetries} retries`);
  }

  // Pause execution
  pauseExecution(executionId: string): boolean {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'paused';
      return true;
    }
    return false;
  }

  // Resume execution
  resumeExecution(executionId: string): boolean {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === 'paused') {
      execution.status = 'running';
      const workflow = this.workflows.get(execution.workflowId);
      if (workflow) {
        const lastCheckpoint = execution.checkpoints[execution.checkpoints.length - 1];
        const resumeFromStep = lastCheckpoint?.stepId;
        this.executeWorkflow(executionId, workflow).catch(error => {
          execution.status = 'failed';
          execution.error = error.message;
        });
      }
      return true;
    }
    return false;
  }

  // Get execution status
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  // List executions with filter
  listExecutions(workflowId?: string, status?: string): WorkflowExecution[] {
    let results = Array.from(this.executions.values());

    if (workflowId) {
      results = results.filter(e => e.workflowId === workflowId);
    }

    if (status) {
      results = results.filter(e => e.status === status);
    }

    return results;
  }

  // Checkpoint management
  private saveCheckpoint(executionId: string, checkpoint: Checkpoint): void {
    const key = `cp-${executionId}-${checkpoint.stepId}`;
    this.persistenceStore.set(key, checkpoint);
  }

  private loadCheckpoint(executionId: string, stepId: string): Checkpoint | null {
    const key = `cp-${executionId}-${stepId}`;
    return this.persistenceStore.get(key) || null;
  }

  private restoreExecutionFromCheckpoint(
    execution: WorkflowExecution,
    checkpoint: Checkpoint
  ): WorkflowExecution {
    execution.checkpoints.push(checkpoint);
    execution.inputs = { ...execution.inputs, ...checkpoint.state };
    return execution;
  }

  // Utility
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get execution metrics
  getMetrics(): {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    averageExecutionTime: number;
    activeExecutions: number;
  } {
    const executions = Array.from(this.executions.values());
    const completed = executions.filter(e => e.status === 'completed');
    const failed = executions.filter(e => e.status === 'failed');
    const active = executions.filter(e => e.status === 'running' || e.status === 'paused');

    const executionTimes = completed
      .map(e => {
        if (e.startedAt && e.completedAt) {
          return new Date(e.completedAt).getTime() - new Date(e.startedAt).getTime();
        }
        return 0;
      })
      .filter(t => t > 0);

    const avgTime = executionTimes.length > 0 ? executionTimes.reduce((a, b) => a + b) / executionTimes.length : 0;

    return {
      totalExecutions: executions.length,
      successCount: completed.length,
      failureCount: failed.length,
      averageExecutionTime: avgTime,
      activeExecutions: active.length,
    };
  }

  // Clear old executions (archival)
  archiveOldExecutions(olderThanDays: number): number {
    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let archived = 0;

    const entriesToDelete: string[] = [];

    this.executions.forEach((execution, id) => {
      if (new Date(execution.createdAt).getTime() < cutoffTime) {
        entriesToDelete.push(id);
        archived++;
      }
    });

    entriesToDelete.forEach(id => this.executions.delete(id));

    return archived;
  }
}

export const durableWorkflowService = new DurableWorkflowService();

export default durableWorkflowService;
