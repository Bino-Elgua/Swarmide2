# SwarmIDE2 Enhancement Implementation Checklist

## Status: Ready for Development (5 Modules, 2-3 Week Sprint)

---

## 📋 Deliverables Inventory

### ✅ Phase 1: Conflict Resolution (1 week)
**Files Created:**
- ✅ `services/conflictResolver.ts` (ready to import)
  - `scoreProposal()` — Rate proposals on 5 dimensions
  - `resolveByVoting()` — Weighted voting mechanism
  - `resolveByHierarchy()` — Base + improvements merge
  - `resolveByMetaReasoning()` — Deep reasoning synthesis
  - `resolveConflictingProposals()` — Main dispatcher
  - `generateProposalDiff()` — UI comparison helper

**Still to Build:**
- [ ] Update `types.ts` → Add `ProposalOutput`, `ConflictResolution`
- [ ] Update `geminiService.ts` → Structured proposal extraction
- [ ] Create `components/ConflictResolver.tsx` → UI modal
- [ ] Update `App.tsx` → Integrate conflict detection + resolution in `runExecutionLoop()`

**Estimated effort:** 2–3 days

---

### ✅ Phase 2: Cost Tracking & Efficiency (3 days)
**Files Created:**
- ✅ `services/costCalculator.ts` (ready to import)
  - `estimateCost()` — Per-call cost
  - `validateBudget()` — Budget enforcement
  - `recommendModelTiering()` — Smart model selection
  - `estimateFullRunCost()` — Best/worst/typical breakdown
  - `estimateLatency()` — Parallelism impact
  - `selectModelByBudget()` — Constraint-based selection
  - `formatMetrics()` — UI display helper

**Still to Build:**
- [ ] Update `types.ts` → Add `CostMetrics`, update `ProjectState`
- [ ] Update `geminiService.ts` → Extract `usageMetadata` from all API calls
- [ ] Create `components/CostTracker.tsx` → Live dashboard
- [ ] Update `MissionSettings.tsx` → Budget input field
- [ ] Update `App.tsx` → Track costs during orchestration

**Estimated effort:** 1–2 days

---

### Phase 3: RLM Integration (2 weeks, defer to Phase 2)
**Files to Create:**
- [ ] `services/rlmService.ts`
  - `compressContextWithRLM()` — Context folding
  - `queryWithRLM()` — Sub-query capability
  - `synthesizeProjectWithRLM()` — RLM-aware synthesis

**Why defer:** Lower immediate ROI; Phase 1+2 deliver conflict + cost control first. RLM synergizes with CCA for long-context scenarios.

---

### Phase 4: CCA Agent Upgrade (2 weeks, parallel with Phase 3)
**Files to Create:**
- [ ] `services/ccaService.ts`
  - `buildDependencyGraph()` — Code structure analysis
  - `identifyRefactoringOpportunities()` — Modular extraction

**Still to Update:**
- [ ] `constants.ts` → Upgrade Confucius agent definition (18384 max tokens, recursion depth 8)

**Why parallel:** Evolves existing agent; doesn't block Phase 1+2.

---

### Phase 5: Ralph Loop (1 week, optional)
**Files to Create:**
- [ ] `services/ralphLoop.ts`
  - `runRalphLoop()` — Iterative PRD-driven execution

**Still to Update:**
- [ ] `types.ts` → Add `RalphConfig`, `PRDItem`
- [ ] `App.tsx` → Toggle for ralph mode

**Why optional:** Enables "long-running" projects; not required for MVP.

---

## 🎯 Recommended Rollout Plan

### Week 1: Conflict + Cost (MVP)
**Days 1–2:** Phase 1 Integration
- Update `types.ts` with proposal schemas
- Integrate `conflictResolver.ts` into `geminiService.ts`
- Build `ConflictResolver.tsx` modal
- Add conflict detection logic to `App.tsx` phase loop

**Day 3:** Phase 2 Integration
- Update `types.ts` with cost schemas
- Integrate token tracking into all API calls
- Build `CostTracker.tsx` dashboard
- Add budget input to `MissionSettings.tsx`

**Days 4–5:** Testing + Polish
- E2E test: 2 agents, conflicting proposals → resolution
- E2E test: Cost tracking, budget warning, cutoff
- UI refinements, error handling

**Deliverable:** Production-ready MVP with conflict resolution + cost transparency

---

### Week 2–3: Advanced Features (Parallel)
**Parallel Track A: CCA Upgrade**
- Evolve Confucius in `constants.ts`
- Implement `ccaService.ts` for dependency analysis
- Test with large codebases (10k+ lines)

**Parallel Track B: RLM + Ralph**
- Implement `rlmService.ts` for context folding
- Build Ralph loop for PRD-driven iteration
- Integration tests with long-running projects

---

## 📊 Success Criteria

| Feature | Metric | Target |
|---------|--------|--------|
| **Conflict Resolution** | Accuracy (coherent merged output) | >85% |
| **Cost Tracking** | Budget adherence | 100% (no surprise overruns) |
| **Proposal Scoring** | Decision speed | <2s per proposal |
| **Latency (4 agents, 3 phases)** | E2E time | <3 min |
| **Token efficiency** | Tokens/run | 150k–250k (typical) |
| **Cost/run** | Gemini primary | <$1.00 (best), $2–3 (typical), <$5 (worst) |

---

## 🔧 Code Integration Guide

### 1. Update `types.ts` (Add Before App.tsx Changes)

```typescript
// Add to types.ts
export interface ProposalOutput {
  id: string;
  agentId: string;
  agentName: string;
  architecture: string;
  rationale: string;
  tradeoffs: { pro: string[]; con: string[] };
  confidence: number;
  dependencies: string[];
  risks: string[];
  costEstimate?: number;
}

export interface CostMetrics {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  timestamp: Date;
  agentName?: string;
  phaseNumber?: number;
}

export interface ProjectState {
  // ... existing fields ...
  proposalHistory: ProposalOutput[];
  costMetrics: CostMetrics[];
  costBudgetUSD?: number;
  costActualUSD?: number;
  synthesisStrategy: 'voting' | 'hierarchical' | 'meta_reasoning' | 'user_select';
}
```

### 2. Update `geminiService.ts` (Add Token Tracking)

```typescript
// In performAgentTask, after API call:
const usageMetadata = (response as any).usageMetadata || {};
const inputTokens = usageMetadata.promptTokenCount || 0;
const outputTokens = usageMetadata.candidatesTokenCount || 0;
const { total: costUSD } = estimateCost(modelToUse, inputTokens, outputTokens);

// Return in output
return { 
  ...currentData, 
  tokensUsed: inputTokens + outputTokens,
  costUSD,
  proposal  // IF requestProposal=true
};
```

### 3. Integrate in `App.tsx` (runExecutionLoop)

```typescript
import { resolveConflictingProposals } from './services/conflictResolver';
import { estimateCost, validateBudget } from './services/costCalculator';

const runExecutionLoop = async (initialAgents: Agent[], phases: Phase[]) => {
  const phaseProposals: Record<number, ProposalOutput[]> = {};
  let totalCostUSD = 0;

  for (let phaseIdx = 0; phaseIdx < phases.length; phaseIdx++) {
    const results = await Promise.all(
      phaseAgents.map(agent =>
        performAgentTask(
          agent,
          project.prompt,
          previousOutputs,
          enableMedia,
          phaseIdx === 1,  // Request proposals in Phase 1
          (metrics: CostMetrics) => {
            setCostMetrics(prev => [...prev, metrics]);
            totalCostUSD += metrics.costUSD;
            
            // Check budget
            const validation = validateBudget(totalCostUSD, project.costBudgetUSD);
            if (!validation.valid) {
              validation.warnings.forEach(w => addLog(`⚠️ ${w}`));
            }
          }
        )
      )
    );

    // Collect proposals
    const phaseProposalList = results
      .filter(r => r.proposal)
      .map(r => r.proposal as ProposalOutput);

    if (phaseProposalList.length > 1) {
      // Resolve conflicts
      const resolution = await resolveConflictingProposals(
        phaseProposalList,
        project.synthesisStrategy || 'voting',
        project.prompt,
        initialAgents
      );

      addLog(`SYNTHESIS: ${resolution.reasoning}`);
      phaseProposals[phaseIdx] = phaseProposalList;
    }
  }

  setProject(p => ({ ...p, costActualUSD: totalCostUSD }));
};
```

### 4. Create `components/ConflictResolver.tsx`

Use the code from `ENHANCEMENT_ROADMAP.md` → "1.5 UI Component" section.

### 5. Create `components/CostTracker.tsx`

```typescript
import React from 'react';
import { CostMetrics, formatMetrics } from '../services/costCalculator';

interface CostTrackerProps {
  metrics: CostMetrics[];
  budgetUSD?: number;
}

const CostTracker: React.FC<CostTrackerProps> = ({ metrics, budgetUSD }) => {
  const formatted = formatMetrics(metrics);
  const percentUsed = budgetUSD ? (formatted.totalCost / budgetUSD * 100) : 0;

  return (
    <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-4">
      <h4 className="text-xs font-black uppercase text-indigo-400">Cost Tracking</h4>
      
      <div className="space-y-2">
        <div className="flex justify-between text-[10px]">
          <span className="text-slate-400">Total Cost</span>
          <span className="text-white font-bold">${formatted.totalCost.toFixed(2)}</span>
        </div>
        <div className="w-full h-2 bg-slate-900 rounded overflow-hidden">
          <div 
            className={`h-full transition-all ${
              percentUsed > 80 ? 'bg-red-500' : percentUsed > 50 ? 'bg-amber-500' : 'bg-emerald-500'
            }`} 
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
        {budgetUSD && (
          <div className="flex justify-between text-[9px] text-slate-500">
            <span>${formatted.totalCost.toFixed(2)} / ${budgetUSD.toFixed(2)}</span>
            <span>{percentUsed.toFixed(0)}%</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[9px]">
        <div className="bg-slate-900 p-2 rounded">
          <div className="text-slate-500 uppercase">Tokens</div>
          <div className="text-white font-bold">{formatted.totalTokens.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900 p-2 rounded">
          <div className="text-slate-500 uppercase">$/1k tokens</div>
          <div className="text-white font-bold">${(formatted.averageTokenPrice).toFixed(4)}</div>
        </div>
      </div>
    </div>
  );
};

export default CostTracker;
```

---

## 🚀 Quick Start for Contributors

1. **Clone the files:**
   ```bash
   cp ENHANCEMENT_ROADMAP.md /your/docs/
   cp services/costCalculator.ts /your/src/services/
   cp services/conflictResolver.ts /your/src/services/
   ```

2. **Follow checklist in order:**
   - Update `types.ts` (5 min)
   - Update `geminiService.ts` (30 min)
   - Integrate `costCalculator.ts` (30 min)
   - Integrate `conflictResolver.ts` (1 hour)
   - Build UI components (2–3 hours)
   - Test (1–2 hours)

3. **Test scenarios:**
   ```
   ✅ Single proposal → no conflict
   ✅ 2 proposals → voting resolution
   ✅ 3 proposals → hierarchical + cost breakdown
   ✅ Budget overage → warning + log
   ✅ Model tiering → flash for tactical, pro for engineering
   ```

4. **Merge & deploy:**
   - Feature branch: `feat/conflict-resolution-cost-tracking`
   - PR checklist: Cost tests, conflict resolution tests, UI screenshots

---

## 📚 Reference Documentation

- **ENHANCEMENT_ROADMAP.md** — Full technical spec
- **costCalculator.ts** — Ready-to-use cost service (no dependencies beyond `types.ts`)
- **conflictResolver.ts** — Ready-to-use conflict service (uses Gemini API)

---

## ❓ FAQ

**Q: Do I need to modify App.tsx significantly?**
A: No. Just add cost tracking callback + conflict resolution in `runExecutionLoop()`. ~50 lines of integration code.

**Q: Can I skip Phase 2 (cost tracking)?**
A: Not recommended. It's trivial to add (~1 day) and critical for production. Budget overruns surprise users.

**Q: Should I implement RLM/Ralph before Phase 1+2?**
A: No. Phase 1+2 deliver immediate value (conflict resolution + cost transparency). RLM/Ralph are Phase 3–5 enhancements.

**Q: How do I test conflict resolution locally?**
A: Mock two agents with `requestProposal: true`, call `resolveConflictingProposals()`, inspect JSON. See tests in roadmap.

**Q: What if Gemini API changes pricing?**
A: Update `MODEL_PRICING` in `costCalculator.ts`. Quarterly review recommended.

---

## 📞 Support

- Questions about cost calculations? See `costCalculator.ts` docstrings.
- Questions about conflict strategies? See `conflictResolver.ts` examples.
- Need to add a new proposal type? Extend `ProposalOutput` in `types.ts`.

---

**Last Updated:** 2026-01-18  
**Version:** 1.0 (MVP Ready)  
**Status:** Ready for Development Sprint
