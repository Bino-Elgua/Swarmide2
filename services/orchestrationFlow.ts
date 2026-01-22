/**
 * End-to-End Orchestration Flow Service
 * Coordinates complete mission execution with all Phase 1-5 features integrated
 */

import { Agent, Phase, ProjectState, IntelligenceConfig } from '../types';
import { performAgentTask } from './geminiService';
import { validateBudget, estimateCost } from './costCalculator';
import { proposalCache, findReuseableProposal } from './proposalCache';
import { rankProposalsWithRubric, getRubricForProject } from './customScoringRubric';
import { synthesizeBalanced } from './multiModelSynthesis';
import { resolveConflictingProposals } from './conflictResolver';

export interface OrchestrationPhaseResult {
  phaseNumber: number;
  phaseName: string;
  agentResults: Map<string, AgentTaskResult>;
  selectedProposal?: ProposalData;
  conflictsResolved: number;
  costUSD: number;
  tokensUsed: number;
}

export interface AgentTaskResult {
  agentId: string;
  agentName: string;
  status: 'completed' | 'failed' | 'skipped';
  proposal?: string;
  confidence?: number;
  error?: string;
  tokensUsed: number;
  costUSD: number;
}

export interface ProposalData {
  content: string;
  agentId: string;
  agentName: string;
  confidence: number;
  source: 'cache' | 'generated' | 'synthesized';
}

export interface OrchestrationContext {
  projectId: string;
  mission: string;
  agents: Agent[];
  phases: Phase[];
  config: IntelligenceConfig;
  budgetUSD: number;
  onLog: (message: string) => void;
  onProgress: (phase: number, total: number) => void;
  onConflictDetected?: (proposals: any[]) => Promise<string>;
  onCostWarning?: (spent: number, budget: number) => void;
}

export interface OrchestrationResult {
  success: boolean;
  completedPhases: OrchestrationPhaseResult[];
  totalCostUSD: number;
  totalTokensUsed: number;
  errors: string[];
  timeElapsedMs: number;
}

export class OrchestrationFlow {
  private context: OrchestrationContext;
  private phaseResults: OrchestrationPhaseResult[] = [];
  private totalCostUSD = 0;
  private totalTokensUsed = 0;
  private errors: string[] = [];
  private startTime = 0;

  constructor(context: OrchestrationContext) {
    this.context = context;
  }

  async executeFullMission(): Promise<OrchestrationResult> {
    this.startTime = Date.now();
    this.context.onLog(`🚀 Starting full mission orchestration: "${this.context.mission}"`);
    this.context.onLog(`📊 Budget: $${this.context.budgetUSD}, Agents: ${this.context.agents.length}, Phases: ${this.context.phases.length}`);

    try {
      for (let phaseIdx = 0; phaseIdx < this.context.phases.length; phaseIdx++) {
        const phase = this.context.phases[phaseIdx];
        this.context.onProgress(phaseIdx, this.context.phases.length);

        try {
          const result = await this.executePhase(phase, phaseIdx);
          this.phaseResults.push(result);
          this.totalCostUSD += result.costUSD;
          this.totalTokensUsed += result.tokensUsed;

          this.context.onLog(`✓ Phase ${phaseIdx + 1} complete: ${result.phaseName}`);
          this.context.onLog(`  Cost: $${result.costUSD.toFixed(4)}, Tokens: ${result.tokensUsed}`);

          // Check budget after each phase
          if (this.totalCostUSD > this.context.budgetUSD) {
            this.context.onCostWarning?.(this.totalCostUSD, this.context.budgetUSD);
            this.context.onLog(`⚠️  Budget exceeded: $${this.totalCostUSD.toFixed(2)} / $${this.context.budgetUSD}`);
            break;
          }
        } catch (phaseError) {
          const msg = phaseError instanceof Error ? phaseError.message : String(phaseError);
          this.errors.push(`Phase ${phaseIdx + 1} failed: ${msg}`);
          this.context.onLog(`❌ Phase ${phaseIdx + 1} error: ${msg}`);
        }
      }

      this.context.onLog(`✅ Mission execution complete`);
      return this.buildResult(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.errors.push(`Mission failed: ${msg}`);
      this.context.onLog(`❌ Mission fatal error: ${msg}`);
      return this.buildResult(false);
    }
  }

  private async executePhase(phase: Phase, phaseIdx: number): Promise<OrchestrationPhaseResult> {
    const phaseAgents = this.context.agents.filter(a => a.phase === phaseIdx);
    const result: OrchestrationPhaseResult = {
      phaseNumber: phaseIdx,
      phaseName: phase.name,
      agentResults: new Map(),
      conflictsResolved: 0,
      costUSD: 0,
      tokensUsed: 0
    };

    if (phaseAgents.length === 0) {
      this.context.onLog(`  ⏭️  Phase ${phaseIdx + 1} has no agents, skipping`);
      return result;
    }

    this.context.onLog(`  📋 Phase ${phaseIdx + 1} agents: ${phaseAgents.map(a => a.name).join(', ')}`);

    // Execute all agents in parallel
    const agentResults = await Promise.all(
      phaseAgents.map(agent => this.executeAgent(agent, phase, phaseIdx))
    );

    agentResults.forEach(ar => {
      result.agentResults.set(ar.agentId, ar);
      result.costUSD += ar.costUSD;
      result.tokensUsed += ar.tokensUsed;
    });

    // Detect and resolve conflicts if multiple agents
    if (phaseAgents.length > 1) {
      const selectedProposal = await this.resolvePhaseConflicts(phaseAgents, phaseIdx, result);
      result.selectedProposal = selectedProposal;
    } else if (phaseAgents.length === 1) {
      const ar = agentResults[0];
      if (ar.proposal) {
        result.selectedProposal = {
          content: ar.proposal,
          agentId: ar.agentId,
          agentName: ar.agentName,
          confidence: ar.confidence || 0.9,
          source: 'generated'
        };
      }
    }

    return result;
  }

  private async executeAgent(agent: Agent, phase: Phase, phaseIdx: number): Promise<AgentTaskResult> {
    const result: AgentTaskResult = {
      agentId: agent.id,
      agentName: agent.name,
      status: 'completed',
      tokensUsed: 0,
      costUSD: 0
    };

    try {
      // Try cache first for efficiency
      const cachedProposal = await findReuseableProposal(
        this.context.mission,
        agent.id,
        phaseIdx,
        'general' // project type
      );

      if (cachedProposal && proposalCache.getSuccessScore(cachedProposal.cacheKey) > 0.75) {
        this.context.onLog(`    💾 ${agent.name}: Cache hit (quality: ${(proposalCache.getSuccessScore(cachedProposal.cacheKey) * 100).toFixed(0)}%)`);
        result.proposal = cachedProposal.architecture;
        result.confidence = proposalCache.getSuccessScore(cachedProposal.cacheKey);
        result.source = 'cache';
        return result;
      }

      // Estimate cost before execution
      const costEstimate = await estimateCost(this.context.config);
      const budgetRemaining = this.context.budgetUSD - this.totalCostUSD;

      if (costEstimate > budgetRemaining) {
        const msg = `Budget exceeded: $${costEstimate.toFixed(2)} needed, $${budgetRemaining.toFixed(2)} remaining`;
        result.status = 'skipped';
        result.error = msg;
        this.context.onLog(`    ⊘ ${agent.name}: ${msg}`);
        return result;
      }

      // Execute agent task
      this.context.onLog(`    ⚙️  ${agent.name}: Processing...`);

      const taskResult = await performAgentTask({
        agentId: agent.id,
        agentName: agent.name,
        phase: phaseIdx,
        phaseDescription: phase.description,
        role: agent.role,
        mission: this.context.mission,
        config: this.context.config,
        onCostMetric: (cost) => {
          result.costUSD += cost;
          this.totalCostUSD += cost;
        }
      });

      if (taskResult.proposal) {
        result.proposal = taskResult.proposal;
        result.confidence = taskResult.confidence || 0.8;
        result.tokensUsed = taskResult.tokensUsed || 0;
        result.costUSD = taskResult.costUSD || costEstimate;

        // Cache successful proposal
        proposalCache.set(taskResult.proposal, `${agent.id}-${phaseIdx}`);

        this.context.onLog(`    ✓ ${agent.name}: Proposal generated (${result.tokensUsed} tokens, $${result.costUSD.toFixed(4)})`);
      } else {
        result.status = 'failed';
        result.error = 'No proposal generated';
        this.context.onLog(`    ✗ ${agent.name}: Failed to generate proposal`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.status = 'failed';
      result.error = msg;
      this.context.onLog(`    ✗ ${agent.name}: Error - ${msg}`);
    }

    return result;
  }

  private async resolvePhaseConflicts(
    agents: Agent[],
    phaseIdx: number,
    phaseResult: OrchestrationPhaseResult
  ): Promise<ProposalData | undefined> {
    const proposals = Array.from(phaseResult.agentResults.values())
      .filter(ar => ar.status === 'completed' && ar.proposal)
      .map(ar => ({
        id: ar.agentId,
        agentName: ar.agentName,
        architecture: ar.proposal || '',
        confidence: ar.confidence || 0.8,
        rationale: `Proposed by ${ar.agentName}`,
        tradeoffs: { pro: [], con: [] },
        risks: [],
        dependencies: [],
        costEstimate: ar.costUSD
      }));

    if (proposals.length < 2) {
      return proposals[0]
        ? {
            content: proposals[0].architecture,
            agentId: proposals[0].id,
            agentName: proposals[0].agentName,
            confidence: proposals[0].confidence,
            source: 'generated'
          }
        : undefined;
    }

    this.context.onLog(`  🔀 ${proposals.length} conflicting proposals detected`);

    // Score with rubric
    const rubric = getRubricForProject('general');
    const rankedProposals = await rankProposalsWithRubric(
      proposals,
      rubric,
      this.context.mission
    );

    if (rankedProposals.length === 0) {
      return undefined;
    }

    // Multi-model synthesis for top proposals
    const topProposals = rankedProposals.slice(0, 3);
    this.context.onLog(`  🤖 Synthesizing ${topProposals.length} top proposals...`);

    const synthesisResult = await synthesizeBalanced(
      topProposals.map(p => ({ architecture: p.architecture })),
      this.context.mission,
      this.context.budgetUSD - this.totalCostUSD
    );

    if (synthesisResult.mergedArchitecture) {
      this.context.onLog(`  ✓ Synthesis consensus: ${(synthesisResult.consensusScore * 100).toFixed(0)}%`);
      phaseResult.conflictsResolved++;

      // Cache synthesized result
      proposalCache.set(
        synthesisResult.mergedArchitecture,
        `synthesis-${phaseIdx}-${Date.now()}`
      );

      return {
        content: synthesisResult.mergedArchitecture,
        agentId: 'system-synthesis',
        agentName: 'System (Synthesis)',
        confidence: synthesisResult.consensusScore,
        source: 'synthesized'
      };
    }

    // Fallback to top-ranked proposal
    const topProposal = rankedProposals[0];
    this.context.onLog(`  ✓ Selected: ${topProposal.agentName} (score: ${topProposal.confidence.toFixed(2)})`);

    return {
      content: topProposal.architecture,
      agentId: topProposal.id,
      agentName: topProposal.agentName,
      confidence: topProposal.confidence,
      source: 'generated'
    };
  }

  private buildResult(success: boolean): OrchestrationResult {
    return {
      success,
      completedPhases: this.phaseResults,
      totalCostUSD: parseFloat(this.totalCostUSD.toFixed(4)),
      totalTokensUsed: this.totalTokensUsed,
      errors: this.errors,
      timeElapsedMs: Date.now() - this.startTime
    };
  }
}

export async function executeFullOrchestration(context: OrchestrationContext): Promise<OrchestrationResult> {
  const flow = new OrchestrationFlow(context);
  return flow.executeFullMission();
}
