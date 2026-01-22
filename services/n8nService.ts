import axios from 'axios';

export interface N8nWorkflow {
  id: string;
  name: string;
  description: string;
  active: boolean;
  nodes: N8nNode[];
  connections: Record<string, any>;
}

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, any>;
}

export interface N8nExecutionInput {
  workflowId: string;
  data: Record<string, any>;
  webhookData?: Record<string, any>;
}

export interface N8nExecutionResult {
  executionId: string;
  workflowId: string;
  status: 'success' | 'error' | 'running';
  output: any;
  error?: string;
  duration: number;
}

class N8nService {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.N8N_BASE_URL || 'http://localhost:5678';
    this.apiKey = apiKey || process.env.N8N_API_KEY || '';
  }

  async executeWorkflow(input: N8nExecutionInput): Promise<N8nExecutionResult> {
    const startTime = Date.now();
    
    try {
      const url = `${this.baseUrl}/api/v1/workflows/${input.workflowId}/execute`;
      
      const response = await axios.post(url, {
        data: input.data,
        webhookData: input.webhookData,
      }, {
        headers: {
          'X-N8N-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      });

      const duration = Date.now() - startTime;

      return {
        executionId: response.data.id || `exec-${Date.now()}`,
        workflowId: input.workflowId,
        status: response.data.finished ? 'success' : 'running',
        output: response.data.data,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        executionId: `exec-${Date.now()}`,
        workflowId: input.workflowId,
        status: 'error',
        output: null,
        error: error.message,
        duration,
      };
    }
  }

  async getWorkflows(): Promise<N8nWorkflow[]> {
    try {
      const url = `${this.baseUrl}/api/v1/workflows`;
      const response = await axios.get(url, {
        headers: {
          'X-N8N-API-KEY': this.apiKey,
        },
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
      return [];
    }
  }

  async getWorkflow(id: string): Promise<N8nWorkflow | null> {
    try {
      const url = `${this.baseUrl}/api/v1/workflows/${id}`;
      const response = await axios.get(url, {
        headers: {
          'X-N8N-API-KEY': this.apiKey,
        },
      });
      return response.data || null;
    } catch (error) {
      console.error(`Failed to fetch workflow ${id}:`, error);
      return null;
    }
  }

  async createWebhookTrigger(workflowName: string, agentId: string): Promise<string> {
    const webhookUrl = `${this.baseUrl}/webhook/${workflowName}-${agentId}`;
    return webhookUrl;
  }

  async executeTask(
    agentId: string,
    taskName: string,
    taskData: Record<string, any>
  ): Promise<N8nExecutionResult> {
    // Try to find workflow matching task name
    const workflows = await this.getWorkflows();
    const matchingWorkflow = workflows.find(w => 
      w.name.toLowerCase().includes(taskName.toLowerCase())
    );

    if (!matchingWorkflow) {
      return {
        executionId: `exec-${Date.now()}`,
        workflowId: 'unknown',
        status: 'error',
        output: null,
        error: `No workflow found for task: ${taskName}`,
        duration: 0,
      };
    }

    return this.executeWorkflow({
      workflowId: matchingWorkflow.id,
      data: {
        agentId,
        taskName,
        ...taskData,
      },
    });
  }
}

export const n8nService = new N8nService();

export default n8nService;
