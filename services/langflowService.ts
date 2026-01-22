import axios from 'axios';

export interface LangflowFlow {
  id: string;
  name: string;
  description: string;
  data: {
    nodes: LangflowNode[];
    edges: LangflowEdge[];
  };
  created_at: string;
  updated_at: string;
}

export interface LangflowNode {
  id: string;
  type: string;
  position?: { x: number; y: number };
  data: Record<string, any>;
}

export interface LangflowEdge {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface LangflowExecutionRequest {
  flowId: string;
  input: Record<string, any>;
  sessionId?: string;
}

export interface LangflowExecutionResult {
  executionId: string;
  flowId: string;
  status: 'success' | 'error' | 'running';
  output: any;
  error?: string;
  duration: number;
}

class LangflowService {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.LANGFLOW_BASE_URL || 'http://localhost:7860';
    this.apiKey = apiKey || process.env.LANGFLOW_API_KEY || '';
  }

  async executeFlow(request: LangflowExecutionRequest): Promise<LangflowExecutionResult> {
    const startTime = Date.now();

    try {
      const url = `${this.baseUrl}/api/v1/flows/${request.flowId}/execute`;

      const response = await axios.post(url, {
        input: request.input,
        sessionId: request.sessionId || `session-${Date.now()}`,
      }, {
        headers: {
          'X-Langflow-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      });

      const duration = Date.now() - startTime;

      return {
        executionId: response.data.id || `exec-${Date.now()}`,
        flowId: request.flowId,
        status: response.data.error ? 'error' : 'success',
        output: response.data.output,
        error: response.data.error,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      return {
        executionId: `exec-${Date.now()}`,
        flowId: request.flowId,
        status: 'error',
        output: null,
        error: error.message,
        duration,
      };
    }
  }

  async getFlows(): Promise<LangflowFlow[]> {
    try {
      const url = `${this.baseUrl}/api/v1/flows`;
      const response = await axios.get(url, {
        headers: {
          'X-Langflow-API-Key': this.apiKey,
        },
      });
      return response.data.flows || [];
    } catch (error) {
      console.error('Failed to fetch flows:', error);
      return [];
    }
  }

  async getFlow(id: string): Promise<LangflowFlow | null> {
    try {
      const url = `${this.baseUrl}/api/v1/flows/${id}`;
      const response = await axios.get(url, {
        headers: {
          'X-Langflow-API-Key': this.apiKey,
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch flow ${id}:`, error);
      return null;
    }
  }

  async createFlow(name: string, description: string, nodes: LangflowNode[], edges: LangflowEdge[]): Promise<LangflowFlow | null> {
    try {
      const url = `${this.baseUrl}/api/v1/flows`;
      const response = await axios.post(url, {
        name,
        description,
        data: {
          nodes,
          edges,
        },
      }, {
        headers: {
          'X-Langflow-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to create flow:', error);
      return null;
    }
  }

  async updateFlow(id: string, name?: string, description?: string, nodes?: LangflowNode[], edges?: LangflowEdge[]): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/api/v1/flows/${id}`;
      const updateData: Record<string, any> = {};
      if (name) updateData.name = name;
      if (description) updateData.description = description;
      if (nodes && edges) {
        updateData.data = { nodes, edges };
      }

      await axios.patch(url, updateData, {
        headers: {
          'X-Langflow-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });
      return true;
    } catch (error) {
      console.error(`Failed to update flow ${id}:`, error);
      return false;
    }
  }

  // Convert SwarmIDE2 orchestration to Langflow flow
  async buildFlowFromOrchestration(
    projectName: string,
    phases: Array<{ id: number; name: string; description: string }>,
    agents: Array<{ id: string; name: string; role: string }>
  ): Promise<LangflowFlow | null> {
    const nodes: LangflowNode[] = [];
    const edges: LangflowEdge[] = [];

    let yOffset = 0;

    // Add input node
    nodes.push({
      id: 'input',
      type: 'input',
      position: { x: 50, y: 50 },
      data: { label: 'Start' },
    });

    // Add phase nodes
    phases.forEach((phase, idx) => {
      const phaseId = `phase-${phase.id}`;
      nodes.push({
        id: phaseId,
        type: 'phase',
        position: { x: 300, y: yOffset },
        data: {
          label: phase.name,
          description: phase.description,
        },
      });

      if (idx === 0) {
        edges.push({
          source: 'input',
          sourceHandle: 'out',
          target: phaseId,
          targetHandle: 'in',
        });
      } else {
        edges.push({
          source: `phase-${phases[idx - 1].id}`,
          sourceHandle: 'out',
          target: phaseId,
          targetHandle: 'in',
        });
      }

      yOffset += 150;
    });

    // Add agent nodes
    agents.forEach((agent, idx) => {
      nodes.push({
        id: `agent-${agent.id}`,
        type: 'agent',
        position: { x: 550, y: idx * 150 },
        data: {
          label: agent.name,
          role: agent.role,
          agentId: agent.id,
        },
      });
    });

    // Add output node
    nodes.push({
      id: 'output',
      type: 'output',
      position: { x: 800, y: yOffset },
      data: { label: 'Complete' },
    });

    const lastPhaseId = `phase-${phases[phases.length - 1].id}`;
    edges.push({
      source: lastPhaseId,
      sourceHandle: 'out',
      target: 'output',
      targetHandle: 'in',
    });

    return this.createFlow(projectName, `Orchestration flow for ${projectName}`, nodes, edges);
  }
}

export const langflowService = new LangflowService();

export default langflowService;
