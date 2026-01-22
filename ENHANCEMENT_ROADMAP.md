# SwarmIDE2 Enhancement Roadmap
## Advanced Multi-Agent Synthesis & Cost Optimization

---

## Phase 1: Conflict Resolution in Synthesis (Immediate)

### Problem
When 4–6 agents propose architectural alternatives in parallel, synthesis currently concatenates outputs naively → incoherent/conflicting code.

**Example conflict:**
- **Confucius** (architect): "Microservices with event-driven topology"
- **Kernel** (systems): "Monolith for latency; shared memory pools"
- **Nexus** (integration): "Hybrid: modular monolith with async boundaries"
- **Scale** (optimization): "Serverless for elasticity; cold-start issues resolved via persistent warm pools"

### Solution: Multi-Proposal Scoring + User-in-Loop

#### 1.1 Extend `types.ts`

```typescript
// Add to types.ts
export interface ProposalOutput {
  id: string;
  agentId: string;
  agentName: string;
  architecture: string;  // structured design rationale
  rationale: string;     // why this approach
  tradeoffs: {
    pro: string[];
    con: string[];
  };
  confidence: number;    // 0-1
  dependencies: string[]; // other agents' proposals this builds on
  risks: string[];
  costEstimate?: number; // tokens/$ for this proposal
}

export interface ConflictResolution {
  strategy: 'voting' | 'hierarchical' | 'debate' | 'meta_reasoning' | 'user_select';
  selectedProposal: ProposalOutput;
  alternates: ProposalOutput[];
  reasoning: string;
  mergedArchitecture: string;
}

export interface ProjectState {
  // ... existing fields ...
  proposalHistory: ProposalOutput[];
  conflictLog: ConflictResolution[];
  synthesisStrategy: 'voting' | 'hierarchical' | 'debate' | 'meta_reasoning' | 'user_select';
  costBudget?: number;  // $ cap per run
  costActual?: number;  // $ spent this run
}
```

#### 1.2 Update `geminiService.ts` - Structured Agent Output

```typescript
export const performAgentTask = async (
  agent: Agent,
  projectContext: string,
  previousOutputs: string,
  enableMedia: boolean = false,
  requestProposal: boolean = false  // NEW: request structured proposal
): Promise<{ 
  result: string; 
  thoughts: string[]; 
  media?: MediaAsset;
  proposal?: ProposalOutput;  // NEW
  tokensUsed?: number;  // NEW: for cost tracking
}> => {
  // ... existing code ...
  
  const proposalSchema = requestProposal ? `
  4. 'proposal': If synthesizing architecture/major design decisions, return:
     {
       "architecture": "detailed design",
       "rationale": "why this approach wins",
       "tradeoffs": { "pro": [...], "con": [...] },
       "confidence": 0.85,
       "dependencies": [],
       "risks": [],
       "costEstimate": 2500  // tokens
     }
  ` : '';

  const initialPrompt = `ROLE: ${agent.role}
  ...existing prompt...
  ${proposalSchema}
  MANDATORY RESPONSE FORMAT:
  Return a JSON object with:
  1. 'thoughts': [...]
  2. 'result': "..."
  3. 'mediaPrompt': null or "..."
  ${proposalSchema ? '4. \'proposal\': {...}' : ''}`;

  // After response parsing:
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      thoughts: { type: Type.ARRAY, items: { type: Type.STRING } },
      result: { type: Type.STRING },
      mediaPrompt: { type: Type.STRING, nullable: true },
      ...(requestProposal && {
        proposal: {
          type: Type.OBJECT,
          properties: {
            architecture: { type: Type.STRING },
            rationale: { type: Type.STRING },
            tradeoffs: {
              type: Type.OBJECT,
              properties: {
                pro: { type: Type.ARRAY, items: { type: Type.STRING } },
                con: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            confidence: { type: Type.NUMBER },
            dependencies: { type: Type.ARRAY, items: { type: Type.STRING } },
            risks: { type: Type.ARRAY, items: { type: Type.STRING } },
            costEstimate: { type: Type.NUMBER, nullable: true }
          }
        }
      })
    }
  };

  // Extract token usage from response
  const tokensUsed = response.usageMetadata?.totalTokenCount || 0;

  // Build proposal object if present
  let proposal: ProposalOutput | undefined;
  if (requestProposal && currentData.proposal) {
    proposal = {
      id: `proposal-${agent.id}-${Date.now()}`,
      agentId: agent.id,
      agentName: agent.name,
      ...currentData.proposal
    };
  }

  return { ...currentData, media, proposal, tokensUsed };
};
```

#### 1.3 Scoring Rubric (new file: `src/lib/conflictResolver.ts`)

```typescript
import { ProposalOutput, Agent } from '../types';

export interface ScoringCriteria {
  alignmentWeight: number;     // fit to original prompt
  technicalWeight: number;     // feasibility, perf
  ethicsWeight: number;        // safety, fairness, privacy
  noveltyWeight: number;       // innovation vs. risk
  coherenceWeight: number;     // internal consistency
}

export const DEFAULT_SCORING: ScoringCriteria = {
  alignmentWeight: 0.25,
  technicalWeight: 0.30,
  ethicsWeight: 0.20,
  noveltyWeight: 0.10,
  coherenceWeight: 0.15
};

export async function scoreProposal(
  proposal: ProposalOutput,
  originalPrompt: string,
  agents: Agent[],
  criteria: ScoringCriteria = DEFAULT_SCORING,
  aiConfig?: any
): Promise<{
  score: number;
  breakdown: Record<keyof ScoringCriteria, number>;
  flags: string[];
}> {
  // Use a fast reasoning model (Gemini Flash or Claude Haiku) to quickly score
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const scoringPrompt = `
  PROPOSAL TO SCORE:
  ${JSON.stringify(proposal, null, 2)}
  
  ORIGINAL USER MISSION: "${originalPrompt}"
  
  TASK: Return JSON with score (0-100) and breakdown:
  {
    "alignmentScore": 0-100,    // Does it match the original request?
    "technicalScore": 0-100,    // Feasible? Scalable? Performant?
    "ethicsScore": 0-100,       // Safe? Fair? Privacy-preserving?
    "noveltyScore": 0-100,      // Innovative or derivative?
    "coherenceScore": 0-100,    // Internally consistent? Non-contradictory?
    "redFlags": []              // ["risk_1", "concern_2", ...]
  }`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', // Fast, cheap
    contents: scoringPrompt,
    config: {
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
        }
      }
    }
  });

  const scores = JSON.parse(response.text);
  const weighted =
    (scores.alignmentScore * criteria.alignmentWeight +
     scores.technicalScore * criteria.technicalWeight +
     scores.ethicsScore * criteria.ethicsWeight +
     scores.noveltyScore * criteria.noveltyWeight +
     scores.coherenceScore * criteria.coherenceWeight) / 100;

  return {
    score: Math.round(weighted * 100),
    breakdown: {
      alignmentWeight: scores.alignmentScore,
      technicalWeight: scores.technicalScore,
      ethicsWeight: scores.ethicsScore,
      noveltyWeight: scores.noveltyScore,
      coherenceWeight: scores.coherenceScore
    },
    flags: scores.redFlags
  };
}

export async function resolveConflictingProposals(
  proposals: ProposalOutput[],
  strategy: 'voting' | 'hierarchical' | 'debate' | 'meta_reasoning' | 'user_select',
  originalPrompt: string,
  agents: Agent[],
  aiConfig?: any
): Promise<{
  winner: ProposalOutput;
  reasoning: string;
  merged?: string;
}> {
  if (strategy === 'user_select') {
    // Return null; UI will present options and let user choose
    return { winner: proposals[0], reasoning: 'User selection pending' };
  }

  if (strategy === 'voting') {
    // Weight by agent category confidence
    const categoryWeights: Record<string, number> = {
      engineering: 0.40,
      security: 0.25,
      ethics: 0.20,
      discovery: 0.15
    };

    const scores = await Promise.all(
      proposals.map(p => scoreProposal(p, originalPrompt, agents))
    );

    const votedScore = proposals.map((p, i) => ({
      proposal: p,
      score: scores[i].score * (categoryWeights[agents.find(a => a.id === p.agentId)?.category || 'general'] || 0.10)
    }));

    const winner = votedScore.sort((a, b) => b.score - a.score)[0].proposal;
    return { winner, reasoning: `Voted highest: ${winner.agentName}'s ${(votedScore[0].score * 100).toFixed(1)}%` };
  }

  if (strategy === 'hierarchical') {
    // Engineering base, craft improvements
    const engineeringProposal = proposals.find(p =>
      agents.find(a => a.id === p.agentId)?.category === 'engineering'
    ) || proposals[0];

    const improvements = proposals
      .filter(p => p.id !== engineeringProposal.id)
      .map(p => p.tradeoffs.pro.slice(0, 2))
      .flat();

    return {
      winner: engineeringProposal,
      reasoning: `Base: ${engineeringProposal.agentName}; Grafted improvements: ${improvements.join(', ')}`
    };
  }

  if (strategy === 'meta_reasoning') {
    // Use o1 or Claude 3.5 Sonnet to synthesize
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const mergePrompt = `
    CONFLICTING PROPOSALS:
    ${proposals.map(p => `\n${p.agentName}:\n${JSON.stringify(p, null, 2)}`).join('\n---\n')}
    
    ORIGINAL MISSION: "${originalPrompt}"
    
    TASK: Synthesize a unified architecture that:
    1. Resolves conflicts by adopting best elements from each.
    2. Explains tradeoffs made.
    3. Ranks by feasibility + alignment.
    
    Return JSON:
    {
      "unified_architecture": "...",
      "synthesis_reasoning": "...",
      "recommended_proposal": "agentName",
      "why_this_wins": "...",
      "modifications": ["...", "..."]
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // o1-equivalent in Gemini suite
      contents: mergePrompt,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 5000 } // Deep reasoning
      }
    });

    const synthesis = JSON.parse(response.text);
    const recommendedProposal = proposals.find(p => p.agentName === synthesis.recommended_proposal) || proposals[0];

    return {
      winner: recommendedProposal,
      reasoning: synthesis.synthesis_reasoning,
      merged: synthesis.unified_architecture
    };
  }

  if (strategy === 'debate') {
    // Run critique sub-phase: agents attack each other's proposals
    // Return after debate concludes
    // (Implementation: see Phase 2 below)
  }

  return { winner: proposals[0], reasoning: 'Default: first proposal' };
}
```

#### 1.4 App.tsx Integration - Synthesis with Conflict Handling

```typescript
// In App.tsx, update synthesizeProject logic:

const runExecutionLoop = async (initialAgents: Agent[], phases: Phase[]) => {
  // ... existing phase loop code ...
  
  // NEW: Collect proposals during phase execution
  const phaseProposals: Record<number, ProposalOutput[]> = {};
  
  for (let phaseIdx = 0; phaseIdx < phases.length; phaseIdx++) {
    const phaseAgents = initialAgents.filter(a => a.phase === phaseIdx);
    
    // Run agents in parallel, REQUEST PROPOSALS for architectural phases
    const results = await Promise.all(
      phaseAgents.map(agent =>
        performAgentTask(
          agent,
          project.prompt,
          project.agents
            .filter(a => a.phase < phaseIdx)
            .map(a => a.output || '')
            .join('\n---\n'),
          false,
          phaseIdx === 1  // Request proposals during Phase 1 (execution)
        )
      )
    );

    // Collect proposals
    const phaseProposalList = results
      .filter(r => r.proposal)
      .map(r => r.proposal as ProposalOutput);
    
    if (phaseProposalList.length > 1) {
      phaseProposals[phaseIdx] = phaseProposalList;
      
      // Resolve conflicts
      const resolution = await resolveConflictingProposals(
        phaseProposalList,
        project.synthesisStrategy,
        project.prompt,
        initialAgents,
        project.orchestratorConfig
      );
      
      addLog(`SYNTHESIS: ${resolution.reasoning}`);
      addProtocolMessage({
        sourceId: 'synthesizer',
        sourceName: 'Conflict Resolver',
        sourceIcon: 'scale-balanced',
        sourceColor: '#f59e0b',
        action: 'SYNTHESIZE_MEDIA', // Reuse for synthesis
        text: `Resolved ${phaseProposalList.length} proposals. Winner: ${resolution.winner.agentName}`
      });

      // If user selection needed, pause here (see UI code below)
    }
  }

  // ... rest of synthesis ...
};
```

#### 1.5 UI Component: Conflict Resolution Modal (new file)

```typescript
// components/ConflictResolver.tsx
import React, { useState } from 'react';
import { ProposalOutput, Agent } from '../types';

interface ConflictResolverProps {
  proposals: ProposalOutput[];
  agents: Agent[];
  onResolved: (selected: ProposalOutput, custom?: string) => void;
  onCancel: () => void;
}

const ConflictResolver: React.FC<ConflictResolverProps> = ({
  proposals, agents, onResolved, onCancel
}) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [customMerge, setCustomMerge] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl">
      <div className="w-4/5 h-5/6 bg-slate-950 border border-slate-800 rounded-3xl p-8 overflow-auto flex flex-col">
        <h2 className="text-2xl font-black text-white mb-6 flex items-center">
          <i className="fa-solid fa-code-branch text-amber-400 mr-3" />
          Conflicting Architecture Proposals
        </h2>

        <div className="grid grid-cols-2 gap-6 mb-8 flex-1 overflow-y-auto">
          {proposals.map((p, i) => {
            const agent = agents.find(a => a.id === p.agentId);
            return (
              <button
                key={p.id}
                onClick={() => setSelectedIdx(i)}
                className={`p-6 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                  selectedIdx === i
                    ? 'border-indigo-500 bg-indigo-600/10 shadow-lg shadow-indigo-500/20'
                    : 'border-white/10 bg-slate-900/50 hover:border-white/20'
                }`}
              >
                <div className="flex items-center mb-4">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white mr-3"
                    style={{ backgroundColor: agent?.color }}
                  >
                    <i className={`fa-solid fa-${agent?.icon}`} />
                  </div>
                  <h4 className="font-black text-white text-sm">{p.agentName}</h4>
                </div>

                <p className="text-[11px] text-slate-300 mb-3">{p.architecture.slice(0, 150)}...</p>

                <div className="flex justify-between text-[9px] text-slate-500 mb-3">
                  <span>Confidence: {(p.confidence * 100).toFixed(0)}%</span>
                  <span className="text-emerald-400">Pros: {p.tradeoffs.pro.length}</span>
                </div>

                <div className="space-y-2">
                  <div className="text-[8px] font-black text-emerald-400 uppercase">Strengths</div>
                  {p.tradeoffs.pro.slice(0, 2).map((pro, idx) => (
                    <div key={idx} className="text-[9px] text-slate-400">• {pro}</div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-slate-800 pt-6 space-y-4">
          <h4 className="font-black text-slate-400 uppercase text-xs">Selected Proposal Details</h4>
          <p className="text-sm text-slate-300">{proposals[selectedIdx].rationale}</p>

          <div className="grid grid-cols-2 gap-4 text-[10px]">
            <div>
              <span className="text-slate-500 uppercase font-black">Risks</span>
              <div className="text-red-400 mt-2">
                {proposals[selectedIdx].risks.slice(0, 2).map((r, i) => (
                  <div key={i}>• {r}</div>
                ))}
              </div>
            </div>
            <div>
              <span className="text-slate-500 uppercase font-black">Dependencies</span>
              <div className="text-blue-400 mt-2">
                {proposals[selectedIdx].dependencies.length > 0
                  ? proposals[selectedIdx].dependencies.map((d, i) => (
                      <div key={i}>• {d}</div>
                    ))
                  : 'None'}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-black text-slate-400 uppercase mb-2 block">
              Custom Merge Instructions (Optional)
            </label>
            <textarea
              value={customMerge}
              onChange={(e) => setCustomMerge(e.target.value)}
              placeholder="E.g., 'Use Nexus's event-driven approach but apply Kernel's memory optimization...'"
              className="w-full h-16 bg-slate-900 border border-slate-800 rounded-xl p-3 text-[10px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-4 mt-6">
          <button
            onClick={onCancel}
            className="px-6 py-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onResolved(proposals[selectedIdx], customMerge)}
            className="px-8 py-2 bg-indigo-600 text-white font-black rounded-lg hover:bg-indigo-500 transition"
          >
            Accept & Merge
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictResolver;
```

---

## Phase 2: Cost Tracking & Efficiency (Critical for Production)

### 2.1 Extend `types.ts`

```typescript
export interface CostMetrics {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  timestamp: Date;
}

export interface ProjectState {
  // ... existing ...
  costMetrics: CostMetrics[];
  costBudgetUSD?: number;
  costActualUSD?: number;
  tokenBudget?: number;
  tokenUsed?: number;
}
```

### 2.2 Cost Calculator Service (new file: `src/lib/costCalculator.ts`)

```typescript
// Prices as of Jan 2026 (update quarterly)
export const MODEL_PRICING = {
  'gemini-3-pro-preview': { input: 0.00125, output: 0.005 },      // per 1k tokens
  'gemini-3-flash-preview': { input: 0.000075, output: 0.0003 },  // cheapest
  'gpt-4o': { input: 0.003, output: 0.006 },
  'o1-mini': { input: 0.003, output: 0.012 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-opus': { input: 0.015, output: 0.06 }
};

export function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): { inputCost: number; outputCost: number; total: number } {
  const pricing = MODEL_PRICING[modelId as keyof typeof MODEL_PRICING] || {
    input: 0.001,
    output: 0.003
  };

  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;

  return {
    inputCost,
    outputCost,
    total: inputCost + outputCost
  };
}

export function validateBudget(
  costActual: number,
  costBudget?: number,
  tokenUsed?: number,
  tokenBudget?: number
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (costBudget && costActual > costBudget) {
    warnings.push(`Cost overrun: $${costActual.toFixed(2)} > $${costBudget.toFixed(2)} budget`);
  }

  if (costBudget && costActual > costBudget * 0.8) {
    warnings.push(`Cost warning: ${((costActual / costBudget) * 100).toFixed(0)}% of budget used`);
  }

  if (tokenBudget && tokenUsed && tokenUsed > tokenBudget) {
    warnings.push(`Token overrun: ${tokenUsed} > ${tokenBudget} tokens`);
  }

  if (tokenBudget && tokenUsed && tokenUsed > tokenBudget * 0.8) {
    warnings.push(`Token warning: ${((tokenUsed / tokenBudget) * 100).toFixed(0)}% of token budget used`);
  }

  return {
    valid: warnings.length === 0,
    warnings
  };
}

export function recommendModelTiering(
  projectType: 'software' | 'science' | 'story' | 'general',
  phases: number,
  agentCount: number
): Record<string, string> {
  const tieringRules: Record<string, Record<string, string>> = {
    software: {
      orchestration: 'gemini-3-flash-preview',
      engineering: 'gemini-3-pro-preview',
      tactical: 'gemini-3-flash-preview',
      synthesis: 'claude-3-5-sonnet' // reasoning-heavy
    },
    science: {
      orchestration: 'gemini-3-flash-preview',
      discovery: 'gemini-3-pro-preview',
      synthesis: 'claude-3-opus' // deep reasoning needed
    },
    story: {
      orchestration: 'gemini-3-flash-preview',
      creative: 'gemini-3-pro-preview',
      synthesis: 'claude-3-5-sonnet'
    },
    general: {
      orchestration: 'gemini-3-flash-preview',
      default: 'gemini-3-pro-preview',
      synthesis: 'gemini-3-pro-preview'
    }
  };

  return tieringRules[projectType] || tieringRules.general;
}
```

### 2.3 Update `geminiService.ts` - Token Tracking

```typescript
export const performAgentTask = async (
  agent: Agent,
  projectContext: string,
  previousOutputs: string,
  enableMedia: boolean = false,
  requestProposal: boolean = false,
  costTracker?: (metrics: CostMetrics) => void  // NEW callback
): Promise<{ 
  result: string; 
  thoughts: string[]; 
  media?: MediaAsset;
  proposal?: ProposalOutput;
  tokensUsed?: number;
  costUSD?: number;
}> => {
  // ... existing code ...

  const initialResponse = await ai.models.generateContent({
    model: modelToUse as any,
    contents: initialPrompt,
    config: {
      temperature: agent.temperature,
      maxOutputTokens: maxOutputTokens,
      thinkingConfig: { thinkingBudget: Math.floor(maxOutputTokens / 2) },
      topP: agent.intelligenceConfig?.topP || 0.95,
      responseMimeType: 'application/json',
      responseSchema: { /* ... */ }
    }
  });

  // Extract usage metrics
  const usageMetadata = (initialResponse as any).usageMetadata || {};
  const inputTokens = usageMetadata.promptTokenCount || 0;
  const outputTokens = usageMetadata.candidatesTokenCount || 0;
  const totalTokens = inputTokens + outputTokens;

  const { total: costUSD } = estimateCost(modelToUse, inputTokens, outputTokens);

  // Track cost
  if (costTracker) {
    costTracker({
      modelId: modelToUse,
      inputTokens,
      outputTokens,
      costUSD,
      timestamp: new Date()
    });
  }

  // ... rest of function ...

  return { 
    ...currentData, 
    media, 
    proposal, 
    tokensUsed: totalTokens,
    costUSD
  };
};
```

### 2.4 App.tsx Integration - Budget Tracking

```typescript
// In App.tsx:

const [costMetrics, setCostMetrics] = useState<CostMetrics[]>([]);
const [costBudgetUSD, setCostBudgetUSD] = useState(10); // Default $10 cap
const [costActualUSD, setCostActualUSD] = useState(0);

const trackCost = (metrics: CostMetrics) => {
  setCostMetrics(prev => [...prev, metrics]);
  setCostActualUSD(prev => prev + metrics.costUSD);

  const validation = validateBudget(costActualUSD + metrics.costUSD, costBudgetUSD);
  if (!validation.valid) {
    validation.warnings.forEach(w => addLog(`⚠️ ${w}`));
  }
};

// Pass tracker to orchestration loop
const results = await Promise.all(
  phaseAgents.map(agent =>
    performAgentTask(
      agent,
      project.prompt,
      previousOutputs,
      false,
      phaseIdx === 1,
      trackCost  // NEW
    )
  )
);
```

---

## Phase 3: RLM (Recursive Language Models) Integration (2–3 week sprint)

### 3.1 Why RLM?
- **Long-context without rot:** RLM compresses conversation/state into reusable subroutines (like REPL env vars)
- **Cheaper synthesis:** Sub-queries avoid re-processing full context each call
- **Better conflict resolution:** Recursive narrowing of disagreement space

### 3.2 Browser-Compatible Wrapper

```typescript
// src/lib/rlmService.ts
export interface RLMState {
  context: string;
  subQueries: Array<{id: string; query: string; result: string}>;
  compressionRatio: number;
}

export async function compressContextWithRLM(
  fullContext: string,
  aiConfig: IntelligenceConfig
): Promise<RLMState> {
  // Use Gemini to create a "summarized state" representing key info
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const compressionPrompt = `
  FULL PROJECT STATE:
  ${fullContext}
  
  TASK: Compress this context into a REUSABLE state document (300 tokens max):
  - Keep ONLY critical decisions, agent outputs, and unresolved questions.
  - Use markdown headers for structure.
  - Be ready for agents to REFERENCE this later without re-reading full history.
  
  Return JSON: { "compressed": "...", "keyQuestions": ["?1", "?2", ...] }`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: compressionPrompt,
    config: {
      responseMimeType: 'application/json',
      maxOutputTokens: 400
    }
  });

  const compressed = JSON.parse(response.text);
  return {
    context: compressed.compressed,
    subQueries: [],
    compressionRatio: fullContext.length / compressed.compressed.length
  };
}

export async function queryWithRLM(
  query: string,
  rlmState: RLMState,
  aiConfig: IntelligenceConfig
): Promise<{ answer: string; subQueriesMade: number }> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const enrichedPrompt = `
  COMPRESSED STATE (reference as needed):
  ${rlmState.context}
  
  QUERY: ${query}
  
  If you need details not in the compressed state, ASK for them explicitly (mark as [SUBQUERY: ...]).
  Answer based on what's available; otherwise request.`;

  const response = await ai.models.generateContent({
    model: aiConfig.model as any,
    contents: enrichedPrompt,
    config: {
      temperature: 0.3,
      maxOutputTokens: 1000
    }
  });

  const answer = response.text;
  const subQueryCount = (answer.match(/\[SUBQUERY:/g) || []).length;

  return { answer, subQueriesMade: subQueryCount };
}
```

### 3.3 Synthesis with RLM

```typescript
// In synthesizeProject, use RLM to compress agent outputs
export const synthesizeProjectWithRLM = async (
  prompt: string,
  projectType: string,
  agents: Agent[],
  config: IntelligenceConfig
): Promise<SynthesisResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Step 1: Compress all agent outputs
  const fullContext = agents.map(a => `[${a.name}]\n${a.output}`).join('\n\n---\n\n');
  const rlmState = await compressContextWithRLM(fullContext, config);

  // Step 2: Query RLM for architecture decisions
  const archQuery = `Based on the compressed state, what is the unified architecture that resolves all agent proposals?`;
  const { answer: unifiedArch } = await queryWithRLM(archQuery, rlmState, config);

  // Step 3: Generate final files using compressed context
  const synthesisPrompt = `
  ORIGINAL MISSION: "${prompt}"
  UNIFIED ARCHITECTURE (from RLM): ${unifiedArch}
  COMPRESSED PROJECT STATE: ${rlmState.context}
  
  Generate a complete file structure.`;

  const response = await ai.models.generateContent({
    model: config.model as any,
    contents: synthesisPrompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          files: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                path: { type: Type.STRING },
                content: { type: Type.STRING },
                language: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });

  return JSON.parse(response.text) as SynthesisResponse;
};
```

---

## Phase 4: CCA (Confucius Code Agent) Upgrade (2-week sprint)

### 4.1 Evolve Confucius Agent

Update `constants.ts` - Confucius definition:

```typescript
{
  id: 'reg-confucius-cca',
  name: 'Confucius CCA',  // CCA = Confucius Code Agent
  role: 'Meta-Code Architect (CCA-Enhanced)',
  category: 'engineering',
  description: 'Large-scale codebase auditor with recursive refinement, cross-file dependency analysis, and modular tool discovery. Inspired by Meta CCA SDK.',
  // ... existing fields ...
  enabledTools: ['logicEngine', 'codeInterpreter', 'fileSystem', 'knowledgeBase'],
  intelligenceConfig: {
    provider: 'google',
    model: 'gemini-3-pro-preview',
    maxTokens: 16384,  // 2x for CCA mode
    topP: 0.95,
    recursiveRefinement: true,
    refinementPasses: 5,  // Deep recursive analysis
    reasoningDepth: 'exhaustive'
  },
  toolConfigs: {
    logicEngine: {
      wisdomRefinement: true,
      recursionDepth: 8,  // Ultra-deep for cross-file analysis
      knowledgeAssetIds: []
    },
    codeInterpreter: {
      sandboxMode: true,
      selfCorrection: true,
      libraries: ['ast', 'networkx', 'tree-sitter']  // For code graph analysis
    },
    fileSystem: {
      permissions: ['read'],
      rootDir: '/workspace',
      allowedExtensions: ['ts', 'js', 'py', 'rs', 'go', 'java']
    },
    knowledgeBase: {
      indexType: 'vector',
      chunkSize: 512,
      retrievalStrategy: 'hybrid'
    }
  },
  tasks: [
    { id: 'cca1', label: 'Build cross-file dependency graph' },
    { id: 'cca2', label: 'Identify circular deps, dead code, anti-patterns' },
    { id: 'cca3', label: 'Propose refactoring modularization strategy' },
    { id: 'cca4', label: 'Generate test coverage for critical paths' },
    { id: 'cca5', label: 'Synthesize modular tool extraction opportunities' }
  ],
  // Add new archetype hint
  archetype: 'expert'
}
```

### 4.2 CCA-Specific Task Runner

```typescript
// src/lib/ccaService.ts
export interface ModuleGraph {
  nodes: Array<{ id: string; path: string; size: number; deps: string[] }>;
  edges: Array<{ from: string; to: string; type: 'import' | 'export' | 'circular' }>;
  criticalPaths: string[][];
}

export async function buildDependencyGraph(
  fileContents: Record<string, string>,
  agent: Agent
): Promise<ModuleGraph> {
  // Use code interpreter to parse imports
  const graphBuildPrompt = `
  FILES TO ANALYZE:
  ${Object.entries(fileContents).map(([p, c]) => `${p}:\n${c.slice(0, 500)}`).join('\n---\n')}
  
  TASK: Extract import/export relationships. Return JSON:
  {
    "nodes": [{"id": "file.ts", "path": "...", "size": 1000, "deps": [...]}],
    "edges": [...],
    "criticalPaths": [[...], [...]]  // longest chains
  }`;

  // Call Confucius with this task
  const result = await performAgentTask(agent, graphBuildPrompt, '', false);
  return JSON.parse(result.result) as ModuleGraph;
}

export async function identifyRefactoringOpportunities(
  moduleGraph: ModuleGraph,
  agent: Agent
): Promise<Array<{type: string; modules: string[]; benefit: string; effort: 'low'|'med'|'high'}>> {
  const refactoringPrompt = `
  DEPENDENCY GRAPH:
  ${JSON.stringify(moduleGraph, null, 2)}
  
  Identify refactoring opportunities:
  - Circular dependencies to break
  - Dead code to remove
  - Modules to extract/consolidate
  - Anti-patterns to fix
  
  Return JSON: [{"type": "...", "modules": [...], "benefit": "...", "effort": "..."}]`;

  const result = await performAgentTask(agent, refactoringPrompt, '', false);
  return JSON.parse(result.result);
}
```

---

## Phase 5: Ralph Integration (Autonomous Iterative Loop)

### 5.1 What is Ralph?
- Runs an outer loop: **Check progress → Generate → Test → Iterate**
- For long-running projects (e.g., full app builds), avoids context window overflow
- Uses PRD (Product Requirements Doc) as checklist

### 5.2 Implementation: Ralph-Style Orchestrator Mode

```typescript
// Add to types.ts
export interface PRDItem {
  id: string;
  description: string;
  completed: boolean;
  agent?: string;  // who should handle this
}

export interface RalphConfig {
  mode: 'linear' | 'ralph_loop';  // linear = current; ralph_loop = iterative
  maxIterations: number;
  prdItems: PRDItem[];
  currentIteration: number;
  completionThreshold: number;  // 0-1; default 0.95
}

export interface ProjectState {
  // ... existing ...
  ralphConfig?: RalphConfig;
}
```

```typescript
// src/lib/ralphLoop.ts
export async function runRalphLoop(
  initialPrompt: string,
  prdItems: PRDItem[],
  maxIterations: number = 5,
  onProgress: (log: string, progress: number) => void
): Promise<{
  completed: PRDItem[];
  incomplete: PRDItem[];
  finalOutput: string;
  iterationCount: number;
}> {
  let currentPRD = prdItems;
  let finalOutput = '';
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    const completionRate = currentPRD.filter(p => p.completed).length / currentPRD.length;

    onProgress(`Ralph Loop: Iteration ${iteration}, ${(completionRate * 100).toFixed(0)}% complete`, completionRate);

    if (completionRate >= 0.95) {
      onProgress('Ralph Loop: All PRD items complete!', 1.0);
      break;
    }

    // Find incomplete items
    const incomplete = currentPRD.filter(p => !p.completed);
    const incompleteStr = incomplete.map(p => `- ${p.description}`).join('\n');

    // Fresh orchestration for remaining items
    const refreshPrompt = `
    ORIGINAL MISSION: "${initialPrompt}"
    
    REMAINING WORK:
    ${incompleteStr}
    
    (This is iteration ${iteration}/${maxIterations}. Previous context cleared to avoid overflow.)
    
    Re-assess and build/complete the remaining items.`;

    // Run fresh orchestration + execution
    const result = await orchestrateTeam(refreshPrompt, [], {
      provider: 'google',
      model: 'gemini-3-pro-preview',
      maxTokens: 4096,
      topP: 0.9
    });

    // Mark items as completed based on result
    currentPRD = currentPRD.map(p => ({
      ...p,
      completed: result.phases.some(ph =>
        ph.description.toLowerCase().includes(p.description.slice(0, 10).toLowerCase())
      )
    }));

    finalOutput = result.initialTeam
      .map(a => `[${a.name}] ${a.description}`)
      .join('\n\n');
  }

  return {
    completed: currentPRD.filter(p => p.completed),
    incomplete: currentPRD.filter(p => !p.completed),
    finalOutput,
    iterationCount: iteration
  };
}
```

### 5.3 App.tsx Ralph Mode

```typescript
// Add toggle in MissionSettings or new tab
const [ralphEnabled, setRalphEnabled] = useState(false);
const [prdItems, setPrdItems] = useState<PRDItem[]>([
  { id: '1', description: 'API Backend Structure', completed: false },
  { id: '2', description: 'Database Schema', completed: false },
  { id: '3', description: 'Frontend Components', completed: false },
  { id: '4', description: 'Auth System', completed: false },
  { id: '5', description: 'Deployment Config', completed: false }
]);

const runOrchestration = async () => {
  if (ralphEnabled) {
    // Ralph loop mode
    const { completed, incomplete, iterationCount } = await runRalphLoop(
      inputPrompt,
      prdItems,
      5,
      (log, progress) => {
        addLog(log);
        // Update UI progress bar
      }
    );

    setPrdItems([...completed, ...incomplete]);
    addLog(`Ralph Loop complete: ${completed.length}/${prdItems.length} items, ${iterationCount} iterations`);
  } else {
    // Linear orchestration (current behavior)
    // ... existing code ...
  }
};
```

---

## Priority Implementation Order

1. **Phase 1: Conflict Resolution** (1 week) — Immediate ROI; avoids incoherent outputs
2. **Phase 2: Cost Tracking** (3 days) — Essential for production; cheap to add
3. **Phase 4: CCA Upgrade** (2 weeks) — High quality for large codebases
4. **Phase 3: RLM Integration** (2 weeks) — Long-context win; synergizes with CCA
5. **Phase 5: Ralph Loop** (1 week) — Optional; enable per-project mode

## Rough Token Budgets

| Scenario | Input Tokens | Output Tokens | Cost (Gemini) | Cost (Claude) |
|----------|--------------|---------------|---------------|---------------|
| Simple web app (3 phases, 4 agents) | 80k | 20k | ~$0.30 | ~$0.50 |
| Medium software (6 agents, proposals) | 150k | 40k | ~$0.65 | ~$1.20 |
| Complex science (exhaustive reasoning) | 250k | 80k | ~$1.50 | ~$2.50 |
| Full app + media + Ralph loop (5 iters) | 600k | 200k | ~$3.50 | ~$7.00 |

---

## Quick Wins (Already Possible)

- ✅ Token counting (already in `usageMetadata`)
- ✅ Model tiering by project type
- ✅ Proposal JSON schemas (minimal changes)
- ✅ Conflict UI (new component only)

Deploy Phase 1 + 2 **this week**; they're low-risk, high-value.
