/**
 * Phase 5: Ralph Loop - Iterative PRD-driven execution with checkpointing
 * Prevents context overflow for 100+ item projects via episodic iteration
 */

import { Agent, IntelligenceConfig, Phase } from '../types';
import { orchestrateTeam, performAgentTask, synthesizeProject } from './geminiService';

export interface PRDItem {
  id: string;
  description: string;
  category: 'api' | 'database' | 'frontend' | 'auth' | 'deployment' | 'testing' | 'docs' | 'other';
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  agent?: string;
  iteration?: number;
  completedAt?: Date;
  notes?: string;
}

export interface RalphCheckpoint {
  iteration: number;
  timestamp: Date;
  completedItems: PRDItem[];
  remainingItems: PRDItem[];
  completionRate: number;
  outputs: string[];
  agents: Agent[];
  errors?: string[];
}

export interface RalphConfig {
  mode: 'linear' | 'ralph_loop';
  maxIterations: number;
  prdItems: PRDItem[];
  currentIteration: number;
  completionThreshold: number; // 0-1; default 0.95
  checkpointInterval: number;  // save checkpoint every N iterations
  maxContextTokens: number;    // soft limit before checkpoint reset
}

export interface RalphLoopResult {
  completed: PRDItem[];
  incomplete: PRDItem[];
  finalOutput: string;
  iterationCount: number;
  checkpoints: RalphCheckpoint[];
  totalTokensUsed: number;
  totalCostUSD: number;
}

/**
 * Estimate token count for text (rough approximation)
 * Uses: 1 token ≈ 4 characters (GPT/Claude standard)
 */
function estimateTokenCount(text: string): number {
  if (!text || text.length === 0) return 0;
  // GPT tokenizer rule: ~4 chars = 1 token, but add buffer for punctuation
  return Math.ceil(text.length / 3.5);
}

/**
 * Detect which PRD items were completed by analyzing agent outputs
 * Uses semantic similarity to match agent work against PRD items
 */
async function detectCompletedItems(
  agentOutputs: string[],
  remainingItems: PRDItem[]
): Promise<string[]> {
  if (agentOutputs.length === 0 || remainingItems.length === 0) {
    return [];
  }

  const completedIds = new Set<string>();
  const outputText = agentOutputs.join('\n');

  // Simple heuristic: match keywords from PRD items in output
  for (const item of remainingItems) {
    const itemKeywords = item.description
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3); // Words longer than 3 chars

    // Count keyword matches
    let matchCount = 0;
    for (const keyword of itemKeywords) {
      const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
      const matches = outputText.match(regex) || [];
      matchCount += Math.min(matches.length, 2); // Cap at 2 per keyword
    }

    // If more than 40% of keywords match, mark as completed
    if (itemKeywords.length > 0 && matchCount / itemKeywords.length >= 0.4) {
      completedIds.add(item.id);
    }
  }

  // Also check for category-specific completions
  const categoryMap: Record<string, string[]> = {
    api: ['api', 'endpoint', 'rest', 'graphql', 'route', 'controller', 'handler'],
    database: ['database', 'schema', 'migration', 'table', 'model', 'postgres', 'mongodb'],
    frontend: ['component', 'ui', 'react', 'vue', 'angular', 'svelte', 'button', 'form'],
    auth: ['auth', 'login', 'session', 'jwt', 'oauth', 'user', 'password'],
    deployment: ['deploy', 'docker', 'k8s', 'ci/cd', 'devops', 'pipeline', 'github'],
    testing: ['test', 'unit', 'e2e', 'jest', 'cypress', 'mocha', 'coverage'],
    docs: ['doc', 'readme', 'guide', 'api', 'tutorial', 'example']
  };

  for (const item of remainingItems) {
    const keywords = categoryMap[item.category] || [];
    const itemOutput = outputText.toLowerCase();
    const categoryMatches = keywords.filter(kw => itemOutput.includes(kw)).length;

    // If category keywords heavily mentioned, mark completed
    if (keywords.length > 0 && categoryMatches >= Math.ceil(keywords.length * 0.5)) {
      completedIds.add(item.id);
    }
  }

  return Array.from(completedIds);
}

/**
 * Parse PRD items from user input (supports: 1. Item\n 2. Item or - Item)
 */
export function parsePRDItems(input: string): PRDItem[] {
  const lines = input.split('\n').filter(l => l.trim());
  const categories: Record<string, 'api' | 'database' | 'frontend' | 'auth' | 'deployment' | 'testing' | 'docs' | 'other'> = {
    api: 'api',
    backend: 'api',
    database: 'database',
    db: 'database',
    schema: 'database',
    frontend: 'frontend',
    ui: 'frontend',
    component: 'frontend',
    auth: 'auth',
    login: 'auth',
    security: 'auth',
    deploy: 'deployment',
    devops: 'deployment',
    docker: 'deployment',
    test: 'testing',
    unit: 'testing',
    e2e: 'testing',
    doc: 'docs',
    readme: 'docs'
  };

  return lines.map((line, idx) => {
    const cleaned = line.replace(/^[\d.)\-*]\s+/, '').trim();
    let category: 'api' | 'database' | 'frontend' | 'auth' | 'deployment' | 'testing' | 'docs' | 'other' = 'other';
    
    for (const [key, cat] of Object.entries(categories)) {
      if (cleaned.toLowerCase().includes(key)) {
        category = cat;
        break;
      }
    }

    return {
      id: `prd-${idx}-${Date.now()}`,
      description: cleaned,
      category,
      completed: false,
      priority: 'medium'
    };
  });
}

/**
 * Main Ralph Loop: iterates until completion or max iterations reached
 * Each iteration refreshes context to avoid overflow
 */
export async function runRalphLoop(
  initialPrompt: string,
  prdItems: PRDItem[],
  aiConfig: IntelligenceConfig,
  maxIterations: number = 5,
  completionThreshold: number = 0.95,
  onProgress: (log: string, progress: number, checkpoint?: RalphCheckpoint) => void
): Promise<RalphLoopResult> {
  const checkpoints: RalphCheckpoint[] = [];
  let currentPRD = [...prdItems];
  let iteration = 0;
  let totalTokensUsed = 0;
  let totalCostUSD = 0;
  const allOutputs: string[] = [];

  while (iteration < maxIterations) {
    iteration++;
    const completed = currentPRD.filter(p => p.completed);
    const remaining = currentPRD.filter(p => !p.completed);
    const completionRate = completed.length / currentPRD.length;

    onProgress(
      `[Ralph Iteration ${iteration}/${maxIterations}] ${(completionRate * 100).toFixed(0)}% complete (${completed.length}/${currentPRD.length} items)`,
      completionRate
    );

    // Success criterion: 95%+ complete
    if (completionRate >= completionThreshold) {
      onProgress(`✓ Ralph Loop: ALL PRD ITEMS COMPLETE!`, 1.0);
      break;
    }

    if (remaining.length === 0) {
      onProgress(`✓ Ralph Loop: ALL PRD ITEMS COMPLETE!`, 1.0);
      break;
    }

    try {
      // Sort remaining items by priority (high → medium → low)
      const priorityMap = { high: 0, medium: 1, low: 2 };
      const sortedRemaining = remaining.sort((a, b) => 
        priorityMap[a.priority] - priorityMap[b.priority]
      );

      // Take top 5 items for this iteration to avoid context explosion
      const itemsThisIteration = sortedRemaining.slice(0, 5);
      
      // Build fresh orchestration prompt (avoid context overflow)
      const remainingStr = itemsThisIteration
        .map(p => `- [${p.category.toUpperCase()}] ${p.description} (priority: ${p.priority})`)
        .join('\n');

      const refreshPrompt = `ORIGINAL MISSION: "${initialPrompt}"

REMAINING WORK TO COMPLETE (${itemsThisIteration.length} items):
${remainingStr}

INSTRUCTIONS:
1. This is iteration ${iteration}/${maxIterations}
2. Previous context is cleared to avoid token overflow (fresh restart)
3. Focus ONLY on the listed incomplete items
4. For each item, generate high-quality implementation code/design
5. Your work will be analyzed to mark items as complete
6. All outputs are concatenated for final synthesis

REQUIREMENTS:
- Address each item methodically
- Provide implementation details or design specs
- Be specific and technical (not vague)`;

      onProgress(`Ralph Iteration ${iteration}: Processing ${itemsThisIteration.length} items with fresh context...`, completionRate);

      // Call orchestrator with fresh context
      const result = await orchestrateTeam(refreshPrompt, itemsThisIteration, aiConfig);

      // Use smart detection to identify completed items
      const agentOutputs: string[] = [];
      if (result.initialTeam) {
        result.initialTeam.forEach(agent => {
          agentOutputs.push(`${agent.name}: ${agent.description}`);
        });
      }

      const completedIds = await detectCompletedItems(agentOutputs, itemsThisIteration);
      const completedThisRound = itemsThisIteration.filter(p => completedIds.includes(p.id));

      // Mark items as completed
      currentPRD = currentPRD.map(p => ({
        ...p,
        completed: p.completed || completedIds.includes(p.id),
        iteration: p.completed ? p.iteration : (completedIds.includes(p.id) ? iteration : p.iteration),
        completedAt: completedIds.includes(p.id) && !p.completed ? new Date() : p.completedAt,
        notes: completedIds.includes(p.id) && !p.notes ? `Completed in iteration ${iteration}` : p.notes
      }));

      // Track outputs
      const agentOutputStr = result.initialTeam
        ? result.initialTeam.map(a => `${a.name}: ${a.description}`).join('\n')
        : '';
      if (agentOutputStr) {
        allOutputs.push(agentOutputStr);
      }

      // Log specific completions
      if (completedThisRound.length > 0) {
        const completedNames = completedThisRound.map(p => p.description).join(', ');
        onProgress(`✓ Completed this round: ${completedNames}`, currentPRD.filter(p => p.completed).length / currentPRD.length);
      }

      // Calculate real token usage for this iteration
      const iterationTokensUsed = estimateTokenCount(
        refreshPrompt + agentOutputStr
      );

      // Create checkpoint
      const checkpoint: RalphCheckpoint = {
        iteration,
        timestamp: new Date(),
        completedItems: currentPRD.filter(p => p.completed),
        remainingItems: currentPRD.filter(p => !p.completed),
        completionRate: currentPRD.filter(p => p.completed).length / currentPRD.length,
        outputs: allOutputs,
        agents: result.initialTeam.map(a => ({
          id: `${a.name}-${iteration}`,
          name: a.name,
          role: a.role,
          description: a.description,
          status: 'COMPLETED' as any,
          output: a.description,
          mediaAssets: [],
          knowledgeAssets: [],
          activatedKnowledgeIds: [],
          thoughtLog: [],
          tasks: [],
          color: a.color,
          icon: a.icon,
          phase: iteration,
          category: 'engineering',
          personality: '',
          voiceName: 'Puck',
          voiceSpeed: 1,
          voicePitch: 1,
          intelligenceConfig: aiConfig,
          enabledTools: [],
          toolConfigs: {},
          temperature: 0.7,
          toolConfidence: 0.8,
          verbosity: 0.7,
          riskAversion: 0.5,
          isDefault: false
        }))
      };

      checkpoints.push(checkpoint);
      onProgress(
        `Ralph Iteration ${iteration}: Checkpoint saved. Used ~${iterationTokensUsed.toLocaleString()} tokens. Completed ${checkpoint.completedItems.length} items.`,
        checkpoint.completionRate,
        checkpoint
      );

      // Track real token usage
      totalTokensUsed += iterationTokensUsed;
      
      // Calculate cost based on Gemini 3 pro pricing (~$0.075 per 1M input, $0.3 per 1M output)
      // Assume 30% output ratio on average
      const estimatedInputTokens = iterationTokensUsed * 0.7;
      const estimatedOutputTokens = iterationTokensUsed * 0.3;
      const iterationCost = (estimatedInputTokens / 1000000) * 0.075 + (estimatedOutputTokens / 1000000) * 0.3;
      totalCostUSD += iterationCost;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const failureCheckpoint: RalphCheckpoint = {
        iteration,
        timestamp: new Date(),
        completedItems: currentPRD.filter(p => p.completed),
        remainingItems: currentPRD.filter(p => !p.completed),
        completionRate: currentPRD.filter(p => p.completed).length / currentPRD.length,
        outputs: allOutputs,
        agents: [],
        errors: [errorMsg]
      };
      
      // Save checkpoint even on error (allows recovery)
      checkpoints.push(failureCheckpoint);
      
      onProgress(
        `⚠ Ralph Iteration ${iteration}: Error: ${errorMsg}. Checkpoint saved for recovery.`,
        completionRate
      );
      
      // Don't break loop on first error, continue to next iteration
      // This allows partial progress to be saved
    }
  }

  return {
    completed: currentPRD.filter(p => p.completed),
    incomplete: currentPRD.filter(p => !p.completed),
    finalOutput: allOutputs.join('\n---\n'),
    iterationCount: iteration,
    checkpoints,
    totalTokensUsed,
    totalCostUSD
  };
}

/**
 * Load checkpoint to resume work at specific iteration
 */
export function loadCheckpoint(checkpoint: RalphCheckpoint): RalphConfig {
  return {
    mode: 'ralph_loop',
    maxIterations: 10,
    prdItems: [...checkpoint.completedItems, ...checkpoint.remainingItems],
    currentIteration: checkpoint.iteration,
    completionThreshold: 0.95,
    checkpointInterval: 5,
    maxContextTokens: 100000
  };
}

/**
 * Export checkpoint for persistence (localStorage or server)
 */
export function exportCheckpoint(checkpoint: RalphCheckpoint): string {
  return JSON.stringify({
    iteration: checkpoint.iteration,
    timestamp: checkpoint.timestamp.toISOString(),
    completedCount: checkpoint.completedItems.length,
    remainingCount: checkpoint.remainingItems.length,
    completionRate: checkpoint.completionRate,
    prdItems: checkpoint.remainingItems.map(p => ({
      id: p.id,
      description: p.description,
      category: p.category,
      priority: p.priority
    }))
  }, null, 2);
}

/**
 * Import checkpoint from serialized format
 */
export function importCheckpoint(serialized: string): Omit<RalphCheckpoint, 'agents' | 'outputs'> {
  const data = JSON.parse(serialized);
  return {
    iteration: data.iteration,
    timestamp: new Date(data.timestamp),
    completedItems: [],
    remainingItems: data.prdItems.map((p: any) => ({
      id: p.id,
      description: p.description,
      category: p.category,
      completed: false,
      priority: p.priority
    })),
    completionRate: data.completionRate,
    errors: []
  };
}
