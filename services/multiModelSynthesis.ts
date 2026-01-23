/**
 * Phase 5: Multi-Model Synthesis Service
 * 
 * Enables proposal synthesis using multiple AI models in parallel:
 * 1. Route proposals to specialized models (Gemini for speed, Claude for reasoning, etc.)
 * 2. Ensemble voting on synthesis results
 * 3. Cost-optimized model selection
 * 4. Model-specific prompting strategies
 */

import { ProposalOutput, AIProvider, IntelligenceConfig } from '../types';
import { GoogleGenAI } from '@google/genai';

export interface ModelConfig {
  provider: AIProvider;
  modelId: string;
  role: 'speed' | 'reasoning' | 'creativity' | 'balance';
  maxTokens: number;
  temperature: number;
  costPer1kTokens: { input: number; output: number };
  strengths: string[];
  weaknesses: string[];
  bestFor: string[];
}

export const MULTI_MODEL_OPTIONS: Record<AIProvider, ModelConfig> = {
  google: {
    provider: 'google',
    modelId: 'gemini-3-pro-preview',
    role: 'balance',
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kTokens: { input: 0.000075, output: 0.0003 },
    strengths: ['fast', 'multimodal', 'reasoning'],
    weaknesses: ['sometimes verbose'],
    bestFor: ['general synthesis', 'code generation', 'balanced tasks']
  },
  openai: {
    provider: 'openai',
    modelId: 'gpt-4o',
    role: 'reasoning',
    maxTokens: 4096,
    temperature: 0.8,
    costPer1kTokens: { input: 0.005, output: 0.015 },
    strengths: ['deep reasoning', 'nuanced', 'creative'],
    weaknesses: ['slower', 'expensive'],
    bestFor: ['complex reasoning', 'creative synthesis', 'edge cases']
  },
  anthropic: {
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet',
    role: 'reasoning',
    maxTokens: 4096,
    temperature: 0.7,
    costPer1kTokens: { input: 0.003, output: 0.015 },
    strengths: ['thoughtful', 'clear explanations', 'safety-aware'],
    weaknesses: ['context window', 'cost'],
    bestFor: ['policy synthesis', 'safety review', 'nuanced decisions']
  },
  groq: {
    provider: 'groq',
    modelId: 'mixtral-8x7b-32768',
    role: 'speed',
    maxTokens: 32768,
    temperature: 0.7,
    costPer1kTokens: { input: 0.00024, output: 0.00024 },
    strengths: ['very fast', 'cheap', 'long context'],
    weaknesses: ['less refined', 'newer model'],
    bestFor: ['quick ideation', 'fast iteration', 'long documents']
  },
  mistral: {
    provider: 'mistral',
    modelId: 'mistral-large',
    role: 'balance',
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kTokens: { input: 0.0000048, output: 0.000014 },
    strengths: ['fast', 'cheap', 'reliable'],
    weaknesses: ['newer', 'less proven'],
    bestFor: ['cost-sensitive tasks', 'fast turnaround']
  },
  perplex: {
    provider: 'perplex',
    modelId: 'sonar-pro',
    role: 'creativity',
    maxTokens: 4096,
    temperature: 0.9,
    costPer1kTokens: { input: 0.005, output: 0.015 },
    strengths: ['creative', 'web-aware', 'fresh ideas'],
    weaknesses: ['less predictable', 'new provider'],
    bestFor: ['creative ideation', 'market research', 'trend analysis']
  }
};

export interface SynthesisResult {
  mergedArchitecture: string;
  modelWeights: Record<AIProvider, number>; // which models contributed most
  consensusScore: number; // 0-1: how much models agreed
  dissents: string[]; // points where models disagreed
  estimatedCost: number;
  timestamp: Date;
  modelResponses: Array<{
    provider: AIProvider;
    response: string;
    confidence: number;
  }>;
}

/**
 * Select best models for synthesis task
 */
export function selectOptimalModels(
  budget?: number,
  preferredRoles: Array<'speed' | 'reasoning' | 'creativity' | 'balance'> = []
): ModelConfig[] {
  let candidates = Object.values(MULTI_MODEL_OPTIONS);

  // Filter by role if specified
  if (preferredRoles.length > 0) {
    candidates = candidates.filter(m => preferredRoles.includes(m.role));
  }

  // Sort by cost-effectiveness if budget constrained
  if (budget) {
    candidates = candidates.sort((a, b) => {
      const costA = a.costPer1kTokens.input + a.costPer1kTokens.output;
      const costB = b.costPer1kTokens.input + b.costPer1kTokens.output;
      return costA - costB;
    });
  } else {
    // By default, pick one from each role category
    const roles = new Set<string>();
    candidates = candidates.filter(m => {
      if (!roles.has(m.role)) {
        roles.add(m.role);
        return true;
      }
      return false;
    });
  }

  return candidates.slice(0, 3); // Use top 3 models
}

/**
 * Synthesize proposals using multiple models in parallel
 */
export async function synthesizeProposalsMultiModel(
  proposals: ProposalOutput[],
  originalPrompt: string,
  selectedModels?: ModelConfig[],
  budget?: number
): Promise<SynthesisResult> {
  const models = selectedModels || selectOptimalModels(budget);
  
  if (models.length === 0) {
    throw new Error('No models selected for synthesis');
  }

  // Build synthesis prompt
  const proposalText = proposals
    .map((p, i) => `PROPOSAL ${i + 1} (${p.agentName}):
Architecture: ${p.architecture}
Rationale: ${p.rationale}
Confidence: ${(p.confidence * 100).toFixed(0)}%
Pro: ${p.tradeoffs.pro.join(', ')}
Con: ${p.tradeoffs.con.join(', ')}
Risks: ${p.risks.join(', ')}
`)
    .join('\n---\n');

  const synthesisPrompt = `
ORIGINAL REQUEST: "${originalPrompt}"

${proposalText}

TASK: Synthesize these proposals into a coherent, unified architecture that:
1. Captures the best ideas from all proposals
2. Resolves contradictions (e.g., monolith vs. microservices)
3. Identifies which agent's insights led to final decisions
4. Explains tradeoff choices

Return ONLY the merged architecture description (no preamble, no numbered lists).
Be concise but comprehensive. Include specific tech choices, patterns, and rationale.`;

  // Call models in parallel
  const modelResponses = await Promise.all(
    models.map(async (model) => {
      try {
        const response = await callModel(model, synthesisPrompt);
        return {
          provider: model.provider,
          response,
          confidence: 0.8 // placeholder; could be enhanced
        };
      } catch (err) {
        console.error(`Model ${model.provider} failed:`, err);
        return {
          provider: model.provider,
          response: '',
          confidence: 0
        };
      }
    })
  );

  // Filter out failed responses
  const successful = modelResponses.filter(r => r.response.length > 0);
  if (successful.length === 0) {
    throw new Error('All models failed to synthesize');
  }

  // Ensemble voting: merge responses intelligently
  const merged = await ensembleVoting(successful, originalPrompt);

  // Estimate total cost
  const estimatedCost = models.reduce((sum, m) => {
    const inputCost = (1000 / 1000) * m.costPer1kTokens.input;
    const outputCost = (1500 / 1000) * m.costPer1kTokens.output;
    return sum + inputCost + outputCost;
  }, 0);

  return {
    mergedArchitecture: merged.architecture,
    modelWeights: Object.fromEntries(
      models.map(m => [
        m.provider,
        successful.filter(r => r.provider === m.provider).length / successful.length
      ])
    ),
    consensusScore: calculateConsensus(successful),
    dissents: identifyDissents(successful),
    estimatedCost,
    timestamp: new Date(),
    modelResponses: successful
  };
}

/**
 * Call a specific model API
 */
async function callModel(config: ModelConfig, prompt: string): Promise<string> {
  if (config.provider === 'google') {
    const apiKey = process.env.VITE_GEMINI_API_KEY || localStorage.getItem('vibe_logic_hub_key');
    if (!apiKey) throw new Error('Google API key not configured');

    const ai = new GoogleGenerativeAI({ apiKey });
    const model = ai.getGenerativeModel({ model: config.modelId });
    const response = await model.generateContent(prompt);
    return response.response.text();
  }

  // Placeholder for other providers
  if (config.provider === 'openai') {
    throw new Error('OpenAI integration not yet implemented');
  }

  throw new Error(`Provider ${config.provider} not supported`);
}

/**
 * Ensemble voting: merge multiple model responses
 */
async function ensembleVoting(
  responses: Array<{ provider: AIProvider; response: string; confidence: number }>,
  originalPrompt: string
): Promise<{ architecture: string }> {
  if (responses.length === 1) {
    return { architecture: responses[0].response };
  }

  // Use Gemini to merge responses intelligently
  const apiKey = process.env.VITE_GEMINI_API_KEY || localStorage.getItem('vibe_logic_hub_key');
  if (!apiKey) throw new Error('API key not configured');

  const ai = new GoogleGenerativeAI({ apiKey });
  const model = ai.getGenerativeModel({ model: 'gemini-3-pro-preview' });

  const responseText = responses
    .map((r, i) => `MODEL ${i + 1} (${r.provider}, confidence: ${(r.confidence * 100).toFixed(0)}%):
${r.response}`)
    .join('\n---\n');

  const mergePrompt = `
ORIGINAL REQUEST: "${originalPrompt}"

PROPOSALS FROM MULTIPLE MODELS:
${responseText}

TASK: Synthesize these into ONE coherent architecture that:
1. Incorporates the strongest ideas from each model
2. Resolves any contradictions
3. Maintains clarity and specificity

Return the merged architecture (concise, no preamble).`;

  const response = await model.generateContent(mergePrompt);
  return { architecture: response.response.text() };
}

/**
 * Calculate consensus score based on similarity of model outputs
 */
function calculateConsensus(responses: Array<{ response: string }>): number {
  if (responses.length <= 1) return 1.0;

  // Simple similarity: count common key terms
  const responses_lower = responses.map(r => r.response.toLowerCase());
  const words = responses_lower[0].split(/\s+/).slice(0, 50); // First 50 words

  let matches = 0;
  words.forEach(word => {
    const found = responses_lower.filter(r => r.includes(word)).length;
    matches += found / responses.length;
  });

  return Math.min(matches / words.length, 1.0);
}

/**
 * Identify points where models disagreed
 */
function identifyDissents(responses: Array<{ provider: AIProvider; response: string }>): string[] {
  // Look for contradictory patterns in responses
  const dissents: string[] = [];

  const patterns = [
    { pattern: /monolith|monolithic/i, group: 'architecture' },
    { pattern: /microservices|distributed/i, group: 'architecture' },
    { pattern: /sql|relational/i, group: 'database' },
    { pattern: /nosql|document|graph/i, group: 'database' },
    { pattern: /synchronous|blocking/i, group: 'async' },
    { pattern: /asynchronous|event-driven/i, group: 'async' }
  ];

  patterns.forEach(({ pattern, group }) => {
    const matches = responses.filter(r => pattern.test(r.response));
    if (matches.length > 0 && matches.length < responses.length) {
      const agreeing = matches.map(m => m.provider).join(', ');
      const disagreeing = responses
        .filter(r => !matches.includes(r))
        .map(r => r.provider)
        .join(', ');
      dissents.push(`${group}: ${agreeing} vs ${disagreeing}`);
    }
  });

  return dissents;
}

/**
 * Cost-optimized synthesis for budget-constrained scenarios
 */
export async function synthesizeCheap(
  proposals: ProposalOutput[],
  originalPrompt: string,
  maxBudget: number = 0.05
): Promise<SynthesisResult> {
  // Use only fast, cheap models
  const cheapModels = Object.values(MULTI_MODEL_OPTIONS)
    .filter(m => m.costPer1kTokens.input < 0.001)
    .sort((a, b) => a.costPer1kTokens.input - b.costPer1kTokens.input)
    .slice(0, 2);

  return synthesizeProposalsMultiModel(proposals, originalPrompt, cheapModels, maxBudget);
}

/**
 * High-quality synthesis using best reasoning models
 */
export async function synthesizeQuality(
  proposals: ProposalOutput[],
  originalPrompt: string
): Promise<SynthesisResult> {
  const reasoningModels = Object.values(MULTI_MODEL_OPTIONS)
    .filter(m => m.role === 'reasoning');

  return synthesizeProposalsMultiModel(proposals, originalPrompt, reasoningModels);
}

/**
 * Balanced synthesis: balance cost vs. quality
 */
export async function synthesizeBalanced(
  proposals: ProposalOutput[],
  originalPrompt: string,
  budget?: number
): Promise<SynthesisResult> {
  const models = selectOptimalModels(budget, ['balance', 'reasoning', 'speed']);
  return synthesizeProposalsMultiModel(proposals, originalPrompt, models);
}
