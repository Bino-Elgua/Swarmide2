/**
 * LLM Provider Router
 * Adds automatic fallback, quality scoring, and cost-aware routing
 * on top of the existing multiProviderService.
 *
 * Key features:
 *  - Fallback chain: if primary provider fails, try secondaries in order
 *  - Health scoring: tracks success rate + latency per provider
 *  - Cost-aware routing: choose cheapest model for simple tasks
 *  - Task complexity routing: heavy reasoning → best model, simple → fastest
 */

import type { AIProvider, ProviderHealthScore } from '../types';
import type { LLMRequest, LLMResponse, ProviderType } from './multiProviderService';
import { multiProviderService } from './multiProviderService';
import { callLLM, type LLMConfig } from './terminal/llmAdapter';

// ─── Task complexity levels ───────────────────────────────────────────────────
export type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'reasoning';

// ─── Routing table: complexity → ordered provider list ────────────────────────
const COMPLEXITY_ROUTES: Record<TaskComplexity, ProviderType[]> = {
  simple:    ['gemini', 'groq', 'openai', 'claude'],   // fast & cheap
  moderate:  ['gemini', 'openai', 'claude', 'groq'],   // balanced
  complex:   ['openai', 'claude', 'gemini', 'mistral'], // high quality
  reasoning: ['openai', 'claude', 'gemini'],            // deep reasoning
};

// ─── Cost estimates (USD per 1k output tokens, approximate) ──────────────────
const COST_PER_1K: Record<ProviderType | string, number> = {
  gemini:     0.0003,
  groq:       0.0002,
  mistral:    0.0004,
  deepseek:   0.0002,
  openai:     0.002,
  claude:     0.001,
  ollama:     0.0,
  perplexity: 0.001,
};

// ─── Health store (in-memory, reset on server restart) ────────────────────────
class ProviderHealthStore {
  private scores: Map<string, ProviderHealthScore> = new Map();

  get(provider: string): ProviderHealthScore {
    if (!this.scores.has(provider)) {
      this.scores.set(provider, {
        provider,
        successRate: 1.0,
        avgLatencyMs: 500,
        errorCount: 0,
        lastChecked: new Date(),
        isAvailable: true,
      });
    }
    return this.scores.get(provider)!;
  }

  recordSuccess(provider: string, latencyMs: number): void {
    const s = this.get(provider);
    s.avgLatencyMs = s.avgLatencyMs * 0.8 + latencyMs * 0.2; // EMA
    s.successRate  = Math.min(1, s.successRate * 0.95 + 0.05);
    s.lastChecked  = new Date();
    s.isAvailable  = true;
  }

  recordFailure(provider: string): void {
    const s = this.get(provider);
    s.errorCount++;
    s.successRate = s.successRate * 0.7;
    s.lastChecked = new Date();
    if (s.successRate < 0.2) s.isAvailable = false;
  }

  /** Reset a provider's availability after a cooldown. */
  resetProvider(provider: string): void {
    const s = this.get(provider);
    s.isAvailable = true;
    s.successRate = 0.5; // cautious reset
    s.errorCount  = 0;
  }

  allScores(): ProviderHealthScore[] {
    return Array.from(this.scores.values());
  }
}

export const providerHealth = new ProviderHealthStore();

// ─── Auto-reset unavailable providers after 5 minutes ────────────────────────
const COOLDOWN_MS = 5 * 60 * 1000;
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    providerHealth.allScores().forEach(s => {
      if (!s.isAvailable && Date.now() - s.lastChecked.getTime() > COOLDOWN_MS) {
        providerHealth.resetProvider(s.provider);
      }
    });
  }, 60_000);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export interface RouteOptions {
  complexity?: TaskComplexity;
  /** If set, always try this provider first before falling back. */
  preferredProvider?: ProviderType;
  /** Pass-through to the LLM call. */
  request: LLMRequest;
  /** Optional max cost ceiling per call (USD). Skips expensive providers. */
  maxCostUSD?: number;
}

export interface RouterResult extends LLMResponse {
  /** Provider that actually served the request. */
  usedProvider: ProviderType;
  /** Latency of the successful call. */
  latencyMs: number;
  /** Number of providers tried before success. */
  fallbackDepth: number;
}

/**
 * Route a request through the provider chain, falling back on failure.
 * Returns the first successful response.
 */
export async function routeRequest(opts: RouteOptions): Promise<RouterResult> {
  const complexity  = opts.complexity ?? 'moderate';
  const baseChain   = COMPLEXITY_ROUTES[complexity];
  const chain: ProviderType[] = opts.preferredProvider
    ? [opts.preferredProvider, ...baseChain.filter(p => p !== opts.preferredProvider)]
    : baseChain;

  // Filter by availability and cost ceiling
  const candidates = chain.filter(provider => {
    const health = providerHealth.get(provider);
    if (!health.isAvailable) return false;
    if (opts.maxCostUSD !== undefined) {
      const costPer1k = COST_PER_1K[provider] ?? 0.01;
      const estimatedCost = (opts.request.maxTokens ?? 1024) / 1000 * costPer1k;
      if (estimatedCost > opts.maxCostUSD) return false;
    }
    return true;
  });

  if (candidates.length === 0) {
    throw new Error('No available providers match the routing criteria');
  }

  let fallbackDepth = 0;
  for (const provider of candidates) {
    const t0 = Date.now();
    try {
      const response = await multiProviderService.callProvider(provider, opts.request);
      const latencyMs = Date.now() - t0;
      providerHealth.recordSuccess(provider, latencyMs);
      return { ...response, usedProvider: provider, latencyMs, fallbackDepth };
    } catch (err) {
      providerHealth.recordFailure(provider);
      fallbackDepth++;
      console.warn(`[llmProviderRouter] ${provider} failed (depth ${fallbackDepth}):`, (err as Error).message);
    }
  }

  throw new Error(`All ${candidates.length} providers failed after ${fallbackDepth} attempts`);
}

/**
 * Convenience wrapper: call via the raw fetch-based llmAdapter with routing.
 * Use this when you need reliability but multiProviderService SDKs aren't set up.
 */
export async function routeWithAdapter(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  opts: Omit<RouteOptions, 'request'> & { maxTokens?: number },
): Promise<{ text: string; provider: string; latencyMs: number; fallbackDepth: number }> {
  const complexity = opts.complexity ?? 'moderate';
  const chain      = COMPLEXITY_ROUTES[complexity];
  const preferred  = opts.preferredProvider;
  const fullChain: string[] = preferred
    ? [preferred, ...chain.filter(p => p !== preferred)]
    : chain;

  let fallbackDepth = 0;
  for (const provider of fullChain) {
    if (!providerHealth.get(provider).isAvailable) { fallbackDepth++; continue; }
    const t0 = Date.now();
    try {
      const config: LLMConfig = { provider: provider as LLMConfig['provider'], model: getDefaultModel(provider), maxTokens: opts.maxTokens ?? 1024 };
      const result = await callLLM(config, messages);
      if (result.text === '__NO_API_KEY__') { fallbackDepth++; continue; }
      providerHealth.recordSuccess(provider, Date.now() - t0);
      return { text: result.text, provider, latencyMs: Date.now() - t0, fallbackDepth };
    } catch {
      providerHealth.recordFailure(provider);
      fallbackDepth++;
    }
  }
  throw new Error('All providers exhausted');
}

// ─── Cost estimation ──────────────────────────────────────────────────────────

export function estimateCost(provider: string, outputTokens: number): number {
  return (outputTokens / 1000) * (COST_PER_1K[provider] ?? 0.001);
}

export function cheapestAvailableProvider(complexity: TaskComplexity = 'simple'): ProviderType {
  const chain = COMPLEXITY_ROUTES[complexity];
  const available = chain.filter(p => providerHealth.get(p).isAvailable);
  return available.sort((a, b) => (COST_PER_1K[a] ?? 999) - (COST_PER_1K[b] ?? 999))[0] ?? 'gemini';
}

export function getProviderHealthSummary(): ProviderHealthScore[] {
  return providerHealth.allScores();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultModel(provider: string): string {
  const map: Record<string, string> = {
    gemini: 'gemini-2.0-flash', openai: 'gpt-4o-mini', claude: 'claude-haiku-4-5-20251001',
    anthropic: 'claude-haiku-4-5-20251001', groq: 'llama3-8b-8192',
    mistral: 'mistral-small-latest', deepseek: 'deepseek-chat', ollama: 'llama3',
  };
  return map[provider] ?? 'gpt-4o-mini';
}
