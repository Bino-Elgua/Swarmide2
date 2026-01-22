// Conflict resolution for multi-proposal synthesis
// Handles architectural disagreements between parallel agents

import { GoogleGenAI, Type } from "@google/genai";
import { ProposalOutput, Agent, IntelligenceConfig } from "../types";

export interface ProposalScore {
  proposalId: string;
  agentName: string;
  score: number;
  breakdown: {
    alignmentScore: number;
    technicalScore: number;
    ethicsScore: number;
    noveltyScore: number;
    coherenceScore: number;
  };
  redFlags: string[];
}

export interface ScoringCriteria {
  alignmentWeight: number;     // fit to original prompt (0.25)
  technicalWeight: number;     // feasibility, perf (0.30)
  ethicsWeight: number;        // safety, fairness (0.20)
  noveltyWeight: number;       // innovation vs. risk (0.10)
  coherenceWeight: number;     // internal consistency (0.15)
}

export const DEFAULT_SCORING: ScoringCriteria = {
  alignmentWeight: 0.25,
  technicalWeight: 0.30,
  ethicsWeight: 0.20,
  noveltyWeight: 0.10,
  coherenceWeight: 0.15
};

/**
 * Score a single proposal against project context
 */
export async function scoreProposal(
  proposal: ProposalOutput,
  originalPrompt: string,
  criteria: ScoringCriteria = DEFAULT_SCORING
): Promise<ProposalScore> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const scoringPrompt = `
PROPOSAL TO EVALUATE:
Agent: ${proposal.agentName}
Architecture: ${proposal.architecture.slice(0, 500)}
Rationale: ${proposal.rationale}
Confidence: ${(proposal.confidence * 100).toFixed(0)}%

ORIGINAL USER MISSION: "${originalPrompt}"

TASK: Rate this proposal on 5 dimensions (0-100 each):

1. ALIGNMENT: Does it match the original mission goals and constraints?
2. TECHNICAL: Is it feasible, scalable, performant, and maintainable?
3. ETHICS: Is it safe, fair, privacy-preserving, and well-auditable?
4. NOVELTY: Is it innovative or derivative? How much risk does it introduce?
5. COHERENCE: Is it internally consistent? No contradictions or logical gaps?

Also list any red flags (security risks, scalability concerns, missing dependencies, etc.).

Return ONLY valid JSON (no markdown):
{
  "alignmentScore": 0-100,
  "technicalScore": 0-100,
  "ethicsScore": 0-100,
  "noveltyScore": 0-100,
  "coherenceScore": 0-100,
  "redFlags": ["flag1", "flag2", ...]
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', // Fast scoring
    contents: scoringPrompt,
    config: {
      temperature: 0.3,
      maxOutputTokens: 300,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          alignmentScore: { type: Type.NUMBER },
          technicalScore: { type: Type.NUMBER },
          ethicsScore: { type: Type.NUMBER },
          noveltyScore: { type: Type.NUMBER },
          coherenceScore: { type: Type.NUMBER },
          redFlags: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['alignmentScore', 'technicalScore', 'ethicsScore', 'noveltyScore', 'coherenceScore', 'redFlags']
      }
    }
  });

  const scores = JSON.parse(response.text);

  // Calculate weighted score
  const weighted =
    (scores.alignmentScore * criteria.alignmentWeight +
     scores.technicalScore * criteria.technicalWeight +
     scores.ethicsScore * criteria.ethicsWeight +
     scores.noveltyScore * criteria.noveltyWeight +
     scores.coherenceScore * criteria.coherenceWeight);

  return {
    proposalId: proposal.id,
    agentName: proposal.agentName,
    score: Math.round(weighted),
    breakdown: {
      alignmentScore: scores.alignmentScore,
      technicalScore: scores.technicalScore,
      ethicsScore: scores.ethicsScore,
      noveltyScore: scores.noveltyScore,
      coherenceScore: scores.coherenceScore
    },
    redFlags: scores.redFlags || []
  };
}

/**
 * Resolve conflicting proposals using weighted voting
 */
export async function resolveByVoting(
  proposals: ProposalOutput[],
  agents: Agent[],
  originalPrompt: string,
  criteria: ScoringCriteria = DEFAULT_SCORING
): Promise<{ winner: ProposalOutput; reasoning: string; scores: ProposalScore[] }> {
  // Score each proposal
  const scores = await Promise.all(
    proposals.map(p => scoreProposal(p, originalPrompt, criteria))
  );

  // Sort by score
  const sorted = scores.sort((a, b) => b.score - a.score);
  const winner = proposals.find(p => p.id === sorted[0].proposalId)!;

  const reasoning = `Voting result: ${winner.agentName} wins with ${sorted[0].score}/100. ` +
    `Runner-up: ${proposals.find(p => p.id === sorted[1]?.proposalId)?.agentName || 'N/A'} (${sorted[1]?.score || 0}/100). ` +
    `Weights: Alignment(${(criteria.alignmentWeight * 100).toFixed(0)}%) + Technical(${(criteria.technicalWeight * 100).toFixed(0)}%) + ` +
    `Ethics(${(criteria.ethicsWeight * 100).toFixed(0)}%) + Novelty(${(criteria.noveltyWeight * 100).toFixed(0)}%) + ` +
    `Coherence(${(criteria.coherenceWeight * 100).toFixed(0)}%)`;

  return { winner, reasoning, scores };
}

/**
 * Resolve using hierarchical merge (base + improvements)
 */
export async function resolveByHierarchy(
  proposals: ProposalOutput[],
  agents: Agent[],
  originalPrompt: string
): Promise<{ winner: ProposalOutput; reasoning: string; merged: string }> {
  // Find engineering proposal as base
  const engineeringAgent = agents.find(a => a.category === 'engineering');
  const baseProposal = proposals.find(p =>
    p.agentId === engineeringAgent?.id
  ) || proposals[0];

  // Collect improvements from others
  const improvements = proposals
    .filter(p => p.id !== baseProposal.id)
    .flatMap(p => p.tradeoffs.pro.slice(0, 2))
    .slice(0, 5);

  const mergePrompt = `
BASE ARCHITECTURE (${baseProposal.agentName}):
${baseProposal.architecture}

IMPROVEMENTS TO GRAFT:
${improvements.map((imp, i) => `${i + 1}. ${imp}`).join('\n')}

TASK: Create a unified architecture that:
1. Keeps the base structure from ${baseProposal.agentName}
2. Incorporates the best improvements where they enhance, not complicate
3. Explains what was grafted and why

Return ONLY JSON:
{
  "merged_architecture": "...",
  "explanation": "..."
}`;

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: mergePrompt,
    config: {
      temperature: 0.5,
      maxOutputTokens: 1000,
      responseMimeType: 'application/json'
    }
  });

  const result = JSON.parse(response.text);
  const reasoning = `Hierarchical merge: Base from ${baseProposal.agentName}, grafted ${improvements.length} improvements. ` + result.explanation;

  return { winner: baseProposal, reasoning, merged: result.merged_architecture };
}

/**
 * Resolve using deep reasoning (meta-synthesis)
 */
export async function resolveByMetaReasoning(
  proposals: ProposalOutput[],
  originalPrompt: string,
  config?: IntelligenceConfig
): Promise<{ winner: ProposalOutput; reasoning: string; merged: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const proposalText = proposals
    .map(p => `
[${p.agentName}]
Architecture: ${p.architecture.slice(0, 400)}
Rationale: ${p.rationale}
Confidence: ${(p.confidence * 100).toFixed(0)}%
Tradeoffs - Pro: ${p.tradeoffs.pro.join(', ')}
Tradeoffs - Con: ${p.tradeoffs.con.join(', ')}
`)
    .join('\n---\n');

  const synthesisPrompt = `
CONFLICTING PROPOSALS FROM MULTI-AGENT TEAM:
${proposalText}

ORIGINAL MISSION: "${originalPrompt}"

TASK: You are a meta-synthesizer. Your goal is to:
1. Identify the ROOT disagreement (performance vs. scalability? simplicity vs. features? etc.)
2. Propose a UNIFIED architecture that resolves the conflict by taking the best from each proposal
3. Explain trade-offs made and why this unified version is superior
4. Rate likelihood of success (0-1)

Return ONLY JSON:
{
  "root_disagreement": "...",
  "unified_architecture": "...",
  "synthesis_explanation": "...",
  "recommended_agent": "agentName",
  "success_likelihood": 0.85,
  "modifications": ["mod1", "mod2", ...]
}`;

  const response = await ai.models.generateContent({
    model: config?.model || 'gemini-3-pro-preview', // Reasoning-heavy
    contents: synthesisPrompt,
    config: {
      temperature: 0.5,
      maxOutputTokens: 1500,
      thinkingConfig: { thinkingBudget: 5000 }, // Deep reasoning
      responseMimeType: 'application/json'
    }
  });

  const synthesis = JSON.parse(response.text);
  const recommendedProposal = proposals.find(p => p.agentName === synthesis.recommended_agent) || proposals[0];

  const reasoning = `Meta-reasoning: Root disagreement is "${synthesis.root_disagreement}". ` +
    `Recommended: ${synthesis.recommended_agent} as base. Success likelihood: ${(synthesis.success_likelihood * 100).toFixed(0)}%. ` +
    `Modifications: ${synthesis.modifications.join('; ')}`;

  return {
    winner: recommendedProposal,
    reasoning,
    merged: synthesis.unified_architecture
  };
}

/**
 * Main conflict resolution dispatcher
 */
export async function resolveConflictingProposals(
  proposals: ProposalOutput[],
  strategy: 'voting' | 'hierarchical' | 'meta_reasoning' | 'user_select',
  originalPrompt: string,
  agents: Agent[],
  criteria?: ScoringCriteria,
  config?: IntelligenceConfig
): Promise<{
  winner: ProposalOutput;
  reasoning: string;
  merged?: string;
  scores?: ProposalScore[];
}> {
  if (proposals.length === 0) {
    throw new Error('No proposals to resolve');
  }

  if (proposals.length === 1) {
    return { winner: proposals[0], reasoning: 'Only one proposal; no conflict' };
  }

  if (strategy === 'user_select') {
    // Return all proposals; let UI handle selection
    return { winner: proposals[0], reasoning: 'User selection required' };
  }

  if (strategy === 'voting') {
    return resolveByVoting(proposals, agents, originalPrompt, criteria || DEFAULT_SCORING);
  }

  if (strategy === 'hierarchical') {
    return resolveByHierarchy(proposals, agents, originalPrompt);
  }

  if (strategy === 'meta_reasoning') {
    return resolveByMetaReasoning(proposals, originalPrompt, config);
  }

  // Default: voting
  return resolveByVoting(proposals, agents, originalPrompt, criteria || DEFAULT_SCORING);
}

/**
 * Generate a visual diff for UI comparison
 */
export function generateProposalDiff(
  proposal1: ProposalOutput,
  proposal2: ProposalOutput
): { similarities: string[]; differences: string[] } {
  const similarities: string[] = [];
  const differences: string[] = [];

  // Simple heuristic: shared keywords = similarity
  const words1 = new Set(proposal1.architecture.toLowerCase().split(/\W+/));
  const words2 = new Set(proposal2.architecture.toLowerCase().split(/\W+/));

  const shared = [...words1].filter(w => words2.has(w) && w.length > 5);
  if (shared.length > 0) {
    similarities.push(`Both mention: ${shared.slice(0, 3).join(', ')}`);
  }

  // Tradeoff differences
  const uniquePros1 = proposal1.tradeoffs.pro.filter(
    p => !proposal2.tradeoffs.pro.some(p2 => p.toLowerCase().includes(p2.slice(0, 10).toLowerCase()))
  );
  const uniquePros2 = proposal2.tradeoffs.pro.filter(
    p => !proposal1.tradeoffs.pro.some(p2 => p.toLowerCase().includes(p2.slice(0, 10).toLowerCase()))
  );

  if (uniquePros1.length > 0) {
    differences.push(`${proposal1.agentName} emphasizes: ${uniquePros1[0]}`);
  }
  if (uniquePros2.length > 0) {
    differences.push(`${proposal2.agentName} emphasizes: ${uniquePros2[0]}`);
  }

  return { similarities, differences };
}
