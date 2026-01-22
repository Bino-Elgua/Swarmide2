import { Langfuse } from 'langfuse';
import { CostMetrics } from '../types';

// Initialize Langfuse client
let langfuseClient: Langfuse | null = null;

const initLangfuse = () => {
  if (langfuseClient) return langfuseClient;
  
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY || 'pk_default';
  const secretKey = process.env.LANGFUSE_SECRET_KEY || 'sk_default';
  const baseUrl = process.env.LANGFUSE_URL || 'https://cloud.langfuse.com';
  
  langfuseClient = new Langfuse({
    publicKey,
    secretKey,
    baseUrl,
  });
  
  return langfuseClient;
};

export interface LLMCallTrace {
  traceId: string;
  spanId: string;
  model: string;
  input: string;
  output: string;
  cost: CostMetrics;
  agentId?: string;
  phase?: string;
}

export const traceLLMCall = async (
  model: string,
  input: string,
  output: string,
  cost: CostMetrics,
  agentId?: string,
  phase?: string
): Promise<LLMCallTrace> => {
  const langfuse = initLangfuse();
  const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const trace = langfuse.trace({
    name: 'llm_call',
    userId: agentId || 'system',
    metadata: {
      model,
      phase,
      cost: cost,
    },
  });
  
  const span = trace.span({
    name: `${model}_execution`,
    input: { prompt: input },
    output: { completion: output },
    metadata: {
      inputTokens: cost.inputTokens,
      outputTokens: cost.outputTokens,
      totalCost: cost.totalCost,
      agentId,
    },
  });
  
  return {
    traceId,
    spanId: span.spanId || '',
    model,
    input,
    output,
    cost,
    agentId,
    phase,
  };
};

export const tracePhase = (phaseName: string, phaseNumber: number) => {
  const langfuse = initLangfuse();
  const trace = langfuse.trace({
    name: `phase_${phaseNumber}`,
    metadata: {
      phaseName,
      phaseNumber,
      timestamp: new Date().toISOString(),
    },
  });
  
  return trace;
};

export const trackAgentCost = (agentId: string, cost: CostMetrics) => {
  const langfuse = initLangfuse();
  langfuse.event({
    name: 'agent_cost',
    userId: agentId,
    metadata: {
      agentId,
      inputTokens: cost.inputTokens,
      outputTokens: cost.outputTokens,
      totalCost: cost.totalCost,
      timestamp: new Date().toISOString(),
    },
  });
};

export const flushLangfuse = async () => {
  if (langfuseClient) {
    await langfuseClient.flush();
  }
};
