// Cost tracking and efficiency calculations for SwarmIDE2
// Updated pricing as of January 2026

export interface CostMetrics {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  timestamp: Date;
  agentName?: string;
  phaseNumber?: number;
}

export const MODEL_PRICING = {
  'gemini-3-pro-preview': { input: 0.00125, output: 0.005 },      // $ per 1k tokens
  'gemini-3-flash-preview': { input: 0.000075, output: 0.0003 },  // cheapest
  'gemini-2.5-flash-lite-latest': { input: 0.0000375, output: 0.00015 },
  'gpt-4o': { input: 0.003, output: 0.006 },
  'o1-mini': { input: 0.003, output: 0.012 },
  'o1-preview': { input: 0.015, output: 0.06 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-opus': { input: 0.015, output: 0.06 }
};

export const MODEL_LATENCY_MS = {
  'gemini-3-flash-preview': 800,
  'gemini-3-pro-preview': 1500,
  'gpt-4o': 2000,
  'claude-3-5-sonnet': 2500,
  'o1-preview': 5000,
  'claude-3-opus': 3000
};

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  total: number;
}

/**
 * Calculate cost for a single API call
 */
export function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): CostEstimate {
  const pricing = MODEL_PRICING[modelId as keyof typeof MODEL_PRICING] || {
    input: 0.001,
    output: 0.003
  };

  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;

  return {
    inputCost: parseFloat(inputCost.toFixed(6)),
    outputCost: parseFloat(outputCost.toFixed(6)),
    total: parseFloat((inputCost + outputCost).toFixed(6))
  };
}

/**
 * Validate costs against budget
 */
export function validateBudget(
  costActual: number,
  costBudget?: number,
  tokenUsed?: number,
  tokenBudget?: number
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (costBudget && costActual > costBudget) {
    warnings.push(`🔴 Cost overrun: $${costActual.toFixed(2)} > $${costBudget.toFixed(2)} budget`);
  } else if (costBudget && costActual > costBudget * 0.8) {
    warnings.push(`🟡 Cost warning: ${((costActual / costBudget) * 100).toFixed(0)}% of budget used`);
  }

  if (tokenBudget && tokenUsed && tokenUsed > tokenBudget) {
    warnings.push(`🔴 Token overrun: ${tokenUsed} > ${tokenBudget} tokens`);
  } else if (tokenBudget && tokenUsed && tokenUsed > tokenBudget * 0.8) {
    warnings.push(`🟡 Token warning: ${((tokenUsed / tokenBudget) * 100).toFixed(0)}% of token budget used`);
  }

  return {
    valid: warnings.length === 0,
    warnings
  };
}

/**
 * Recommend model tiering strategy based on project type
 */
export function recommendModelTiering(
  projectType: 'software' | 'science' | 'story' | 'general',
  agentCount: number = 5
): Record<string, { model: string; rationale: string }> {
  const strategies: Record<string, Record<string, { model: string; rationale: string }>> = {
    software: {
      orchestration: {
        model: 'gemini-3-flash-preview',
        rationale: 'Fast team recruitment, minimal reasoning needed'
      },
      engineering_phase: {
        model: 'gemini-3-pro-preview',
        rationale: 'Medium complexity, good balance of quality/cost'
      },
      tactical: {
        model: 'gemini-3-flash-preview',
        rationale: 'DevOps/CI-CD are deterministic; flash sufficient'
      },
      synthesis: {
        model: 'claude-3-5-sonnet',
        rationale: 'High-quality code merge; reasoning-heavy conflict resolution'
      }
    },
    science: {
      orchestration: {
        model: 'gemini-3-flash-preview',
        rationale: 'Team setup only'
      },
      discovery_phase: {
        model: 'gemini-3-pro-preview',
        rationale: 'Data analysis and hypothesis formation'
      },
      synthesis: {
        model: 'claude-3-opus',
        rationale: 'Deep reasoning for scientific synthesis; worth the cost'
      }
    },
    story: {
      orchestration: {
        model: 'gemini-3-flash-preview',
        rationale: 'Minimal setup overhead'
      },
      creative_phase: {
        model: 'gemini-3-pro-preview',
        rationale: 'Creative reasoning, plot coherence'
      },
      synthesis: {
        model: 'claude-3-5-sonnet',
        rationale: 'Narrative synthesis, prose quality'
      }
    },
    general: {
      default: {
        model: 'gemini-3-pro-preview',
        rationale: 'Balanced quality/cost for mixed workloads'
      }
    }
  };

  return strategies[projectType] || strategies.general;
}

/**
 * Calculate total cost for a full orchestration run
 */
export function estimateFullRunCost(
  agentCount: number,
  phasesCount: number,
  avgInputTokensPerAgent: number = 8000,
  avgOutputTokensPerAgent: number = 4000,
  modelMix: Record<string, number> = { 'gemini-3-pro-preview': 0.6, 'gemini-3-flash-preview': 0.4 }
): {
  bestCase: number;
  worstCase: number;
  typical: number;
  breakdown: Record<string, number>;
} {
  let bestCost = 0;
  let worstCost = 0;
  let typicalCost = 0;
  const breakdown: Record<string, number> = {};

  // Orchestration call (once, fast)
  const orchModel = 'gemini-3-flash-preview';
  const orchCost = estimateCost(orchModel, 3000, 2000);
  bestCost += orchCost.total;
  typicalCost += orchCost.total;
  worstCost += orchCost.total;
  breakdown['orchestration'] = orchCost.total;

  // Phase execution
  const agentsPerPhase = Math.max(2, Math.ceil(agentCount / phasesCount));
  const parallelCallsPerPhase = agentsPerPhase;

  for (let p = 0; p < phasesCount; p++) {
    for (let a = 0; a < parallelCallsPerPhase; a++) {
      // Best case: flash model, low tokens
      const flashCost = estimateCost(
        'gemini-3-flash-preview',
        avgInputTokensPerAgent * 0.7,
        avgOutputTokensPerAgent * 0.5
      );
      bestCost += flashCost.total;

      // Worst case: pro model, high tokens, media gen
      const proCost = estimateCost(
        'gemini-3-pro-preview',
        avgInputTokensPerAgent * 1.5,
        avgOutputTokensPerAgent * 2.0
      );
      worstCost += proCost.total;

      // Typical: mix of models
      const mixedCost = estimateCost(
        'gemini-3-pro-preview',
        avgInputTokensPerAgent,
        avgOutputTokensPerAgent
      );
      typicalCost += mixedCost.total;
    }
  }

  // Synthesis call
  const synthCost = estimateCost(
    'claude-3-5-sonnet',
    agentCount * avgOutputTokensPerAgent,
    avgOutputTokensPerAgent * 3
  );
  bestCost += synthCost.total * 0.5;  // best case: already synthesized
  typicalCost += synthCost.total;
  worstCost += synthCost.total * 1.5;  // worst: conflict resolution needed

  breakdown['phase_execution'] = (typicalCost - breakdown['orchestration'] - synthCost.total);
  breakdown['synthesis'] = synthCost.total;

  return {
    bestCase: parseFloat(bestCost.toFixed(2)),
    worstCase: parseFloat(worstCost.toFixed(2)),
    typical: parseFloat(typicalCost.toFixed(2)),
    breakdown
  };
}

/**
 * Get estimated latency for a full run (accounting for parallelism)
 */
export function estimateLatency(
  agentCount: number,
  phasesCount: number,
  parallelizationFactor: number = 1.0  // 1.0 = full parallel, 0.5 = semi-serial
): { minMs: number; maxMs: number; expectedMs: number } {
  const handshakeMs = 200;
  const agentsPerPhase = Math.max(1, Math.ceil(agentCount / phasesCount));

  // Orchestration
  const orchLatency = MODEL_LATENCY_MS['gemini-3-flash-preview'] || 800;

  // Phase execution: parallel calls reduce overall latency
  const maxAgentLatency = MODEL_LATENCY_MS['gemini-3-pro-preview'] || 1500;
  const parallelPhaseLatency = (maxAgentLatency + handshakeMs) / parallelizationFactor;

  // Synthesis
  const synthLatency = (MODEL_LATENCY_MS['claude-3-5-sonnet'] || 2500) + handshakeMs;

  const minMs = orchLatency + (parallelPhaseLatency * phasesCount) + synthLatency;
  const maxMs = minMs * 1.5;  // 50% overhead for network, retries
  const expectedMs = minMs * 1.2;  // typical: 20% overhead

  return {
    minMs: Math.round(minMs),
    maxMs: Math.round(maxMs),
    expectedMs: Math.round(expectedMs)
  };
}

/**
 * Recommend model based on token budget constraint
 */
export function selectModelByBudget(
  availableTokenBudget: number,
  needsReasoning: boolean = false
): string {
  // High-reasoning tasks → heavier models
  if (needsReasoning && availableTokenBudget > 20000) {
    return 'claude-3-5-sonnet';
  }
  if (needsReasoning && availableTokenBudget > 10000) {
    return 'gemini-3-pro-preview';
  }

  // Balanced
  if (availableTokenBudget > 8000) {
    return 'gemini-3-pro-preview';
  }

  // Constrained
  if (availableTokenBudget > 3000) {
    return 'gemini-3-flash-preview';
  }

  // Severely constrained
  return 'gemini-2.5-flash-lite-latest';
}

/**
 * Format cost metrics for UI display
 */
export function formatMetrics(metrics: CostMetrics[]): {
  totalCost: number;
  totalTokens: number;
  averageTokenPrice: number;
  byPhase: Record<number, { cost: number; tokens: number }>;
  byAgent: Record<string, { cost: number; tokens: number }>;
} {
  const totalCost = metrics.reduce((sum, m) => sum + m.costUSD, 0);
  const totalTokens = metrics.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);
  const averageTokenPrice = totalTokens > 0 ? (totalCost / totalTokens) * 1000 : 0;

  const byPhase: Record<number, { cost: number; tokens: number }> = {};
  const byAgent: Record<string, { cost: number; tokens: number }> = {};

  metrics.forEach(m => {
    const phase = m.phaseNumber ?? 0;
    const agent = m.agentName ?? 'unknown';
    const tokens = m.inputTokens + m.outputTokens;

    if (!byPhase[phase]) byPhase[phase] = { cost: 0, tokens: 0 };
    byPhase[phase].cost += m.costUSD;
    byPhase[phase].tokens += tokens;

    if (!byAgent[agent]) byAgent[agent] = { cost: 0, tokens: 0 };
    byAgent[agent].cost += m.costUSD;
    byAgent[agent].tokens += tokens;
  });

  return {
    totalCost: parseFloat(totalCost.toFixed(2)),
    totalTokens,
    averageTokenPrice: parseFloat(averageTokenPrice.toFixed(4)),
    byPhase,
    byAgent
  };
}
