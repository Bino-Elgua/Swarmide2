# Phase 5: Developer Implementation Checklist

**Difficulty:** Medium  
**Estimated Time:** 3-4 days  
**Prerequisites:** Phase 1 & 2 complete (conflict resolution, cost tracking)

---

## Pre-Integration Checklist

- [ ] Read PHASE5_COMPLETE.md (full understanding)
- [ ] Read PHASE5_QUICK_INTEGRATION.md (quick reference)
- [ ] All 3 services imported: proposalCache.ts, customScoringRubric.ts, multiModelSynthesis.ts
- [ ] TypeScript types updated in types.ts (already done)
- [ ] LocalStorage available in browser environment
- [ ] API keys configured (for multi-model: OpenAI, Anthropic if needed)

---

## Integration Steps

### Step 1: Proposal Caching (1.5 hours)

**Files:**
- `services/proposalCache.ts` ✅
- `App.tsx` (modify)

**Checklist:**

- [ ] Import proposalCache
  ```typescript
  import { proposalCache, findReuseableProposal } from './services/proposalCache';
  ```

- [ ] In `useEffect` (startup):
  ```typescript
  useEffect(() => {
    proposalCache.prune(); // Remove stale
    const stats = proposalCache.getStats();
    addLog(`♻️  Cache: ${stats.totalCached} proposals, ${(stats.hitRate * 100).toFixed(0)}% hit rate`);
  }, []);
  ```

- [ ] Before agent calls in `runExecutionLoop`:
  ```typescript
  const cached = await findReuseableProposal(
    project.prompt, agent.id, phaseIdx, project.type
  );
  if (cached && proposalCache.getSuccessScore(cached.cacheKey) > 0.7) {
    addLog(`♻️  Cached proposal from ${cached.agentName}`);
    results.push({ proposal: cached, tokensUsed: 0, costUSD: 0 });
    continue; // Skip agent call
  }
  ```

- [ ] After conflict resolution, cache winner:
  ```typescript
  proposalCache.set(selectedProposal, selectedProposal.id);
  proposalCache.recordEvaluation(selectedProposal.id, {
    selectedCount: 1,
    rejectedCount: proposals.length - 1,
    successScore: 0.85
  });
  ```

- [ ] Test:
  - [ ] Run orchestration with "Build REST API"
  - [ ] Run again with similar prompt
  - [ ] Verify cache hit (check logs)
  - [ ] Check success score calculation

---

### Step 2: Custom Scoring Rubrics (2 hours)

**Files:**
- `services/customScoringRubric.ts` ✅
- `App.tsx` (modify)
- `components/RubricEditor.tsx` ✅ (optional)

**Checklist:**

- [ ] Import rubric service
  ```typescript
  import { 
    getRubricForProject, 
    rankProposalsWithRubric 
  } from './services/customScoringRubric';
  ```

- [ ] Replace conflict resolution voting with rubric scoring:
  ```typescript
  if (phaseProposals.length > 1) {
    const rubric = getRubricForProject(project.type);
    const ranked = await rankProposalsWithRubric(
      phaseProposals, rubric, project.prompt
    );
    
    addLog(`📊 ${rubric.name}`);
    ranked.slice(0, 3).forEach((r, i) => {
      addLog(`  ${i + 1}. ${r.proposal.agentName}: ${r.score.overallScore}/100`);
    });
    
    const winner = ranked[0].proposal;
    previousOutputs = winner.architecture;
  }
  ```

- [ ] Test:
  - [ ] Create 2 conflicting proposals (monolith vs microservices)
  - [ ] Verify scoring by dimension
  - [ ] Check that higher-confidence proposals score higher
  - [ ] Verify dimension weights sum to 1.0

- [ ] (Optional) Add RubricEditor component:
  - [ ] Import: `import RubricEditor from './components/RubricEditor'`
  - [ ] Add modal trigger in MissionSettings
  - [ ] Test custom rubric generation

---

### Step 3: Multi-Model Synthesis (2 hours)

**Files:**
- `services/multiModelSynthesis.ts` ✅
- `App.tsx` (modify)
- `components/MultiModelPanel.tsx` ✅ (optional)

**Checklist:**

- [ ] Import synthesis service
  ```typescript
  import { 
    synthesizeBalanced,
    synthesizeCheap,
    selectOptimalModels
  } from './services/multiModelSynthesis';
  ```

- [ ] Add state for synthesis method (optional):
  ```typescript
  const [synthesisMethod, setSynthesisMethod] = useState<'voting' | 'multi-model'>('multi-model');
  ```

- [ ] In conflict resolution, after rubric scoring:
  ```typescript
  if (phaseProposals.length >= 2) {
    try {
      const synthesis = await synthesizeBalanced(
        phaseProposals,
        project.prompt,
        project.costBudgetUSD * 0.1  // 10% of budget for synthesis
      );
      
      totalCostUSD += synthesis.estimatedCost;
      
      addLog(`🤖 Multi-Model Synthesis`);
      addLog(`   Models: ${Object.keys(synthesis.modelWeights).join(', ')}`);
      addLog(`   Consensus: ${(synthesis.consensusScore * 100).toFixed(0)}%`);
      
      if (synthesis.dissents.length > 0) {
        addLog(`   ⚠️  Disagreements:`);
        synthesis.dissents.forEach(d => addLog(`      - ${d}`));
      }
      
      previousOutputs = synthesis.mergedArchitecture;
    } catch (err) {
      addLog(`❌ Synthesis failed: ${err.message}, using rubric winner`);
      previousOutputs = ranked[0].proposal.architecture;
    }
  }
  ```

- [ ] Add budget validation:
  ```typescript
  const budget = validateBudget(totalCostUSD, project.costBudgetUSD);
  if (!budget.valid && phaseProposals.length > 0) {
    // Fall back to cheap synthesis
    const cheap = await synthesizeCheap(phaseProposals, project.prompt);
    totalCostUSD = (totalCostUSD - synthesis.estimatedCost) + cheap.estimatedCost;
  }
  ```

- [ ] Test:
  - [ ] Run with 3+ conflicting proposals
  - [ ] Verify multiple models called (check API logs)
  - [ ] Check consensus score (should be 0-1)
  - [ ] Verify dissents identified (if any disagreements)
  - [ ] Check cost estimates accurate

- [ ] (Optional) Add MultiModelPanel:
  - [ ] Import: `import MultiModelPanel from './components/MultiModelPanel'`
  - [ ] Show after synthesis in results panel
  - [ ] Test UI renders correctly

---

### Step 4: End-to-End Integration (1 hour)

**Checklist:**

- [ ] All three features working together
  - [ ] Cache lookup → rubric scoring → multi-model synthesis
  - [ ] Proper logging at each step
  - [ ] Results flow correctly through phases

- [ ] State management:
  - [ ] proposalHistory tracks all proposals
  - [ ] costMetrics accumulates all calls
  - [ ] synthesisStrategy passed correctly

- [ ] Error handling:
  - [ ] Cache hit miss gracefully (fall back to agents)
  - [ ] Rubric generation errors caught (use default)
  - [ ] Multi-model synthesis errors caught (use rubric winner)

- [ ] No TypeScript errors

- [ ] Performance acceptable:
  - [ ] Cache operations < 100ms
  - [ ] Rubric scoring < 2s
  - [ ] Multi-model synthesis < 5s (parallel)

---

## Testing Scenarios

### Scenario 1: Proposal Caching
```
Input: "Build SaaS dashboard"
Expected:
  1. First run: agents called, proposals generated
  2. Second run (similar prompt): cache hit, proposal reused
  3. Terminal shows: "♻️  Reusing cached proposal from [agent]"
  4. Cost reduced by $0.01-0.05
Status: ✅ / ❌
```

### Scenario 2: Rubric Scoring
```
Input: 3 proposals (monolith, microservices, serverless)
Expected:
  1. Rubric loaded: "Software Engineering Excellence"
  2. Proposals scored on 5 dimensions
  3. Confidence reflected in scores
  4. Top proposal selected based on overall score
Status: ✅ / ❌
```

### Scenario 3: Multi-Model Synthesis
```
Input: 3 proposals, $1 budget
Expected:
  1. Models selected: Gemini + Claude (balanced)
  2. Both called in parallel
  3. Results merged intelligently
  4. Consensus score: 0.75-0.95
  5. Cost: ~$0.15-0.25
Status: ✅ / ❌
```

### Scenario 4: Budget Constraint
```
Input: 3 proposals, $0.10 budget
Expected:
  1. Synthesis tries multi-model
  2. Budget check fails (too expensive)
  3. Falls back to cheap synthesis (Groq)
  4. Cost: ~$0.01
Status: ✅ / ❌
```

### Scenario 5: Multiple Phases
```
Input: "Build SaaS" (3 phases, 4 agents per phase)
Expected:
  1. Phase 1: 4 proposals, conflict resolution, synthesis
  2. Phase 2: Uses Phase 1 output, may reuse cached proposals
  3. Phase 3: Uses Phase 2 output, continues
  4. Cache grows as proposals generated
Status: ✅ / ❌
```

### Scenario 6: Error Handling
```
Input: No API key configured for multi-model
Expected:
  1. Multi-model synthesis fails gracefully
  2. Falls back to rubric-based selection
  3. Log shows error message
  4. App continues normally
Status: ✅ / ❌
```

---

## Code Review Checklist

- [ ] No hardcoded API keys (use localStorage/env)
- [ ] All imports correct (no missing dependencies)
- [ ] Error handling present (try/catch blocks)
- [ ] Types correct (no `any` unless unavoidable)
- [ ] Comments explain non-obvious logic
- [ ] Logging helpful (debug-level info)
- [ ] Performance acceptable (no N² loops)
- [ ] Memory leak free (cleanup intervals)

---

## Deployment Checklist

- [ ] All tests pass
- [ ] TypeScript strict mode: no errors
- [ ] Build succeeds: `npm run build`
- [ ] Preview works: `npm run preview`
- [ ] No console warnings
- [ ] Cache doesn't grow unbounded (pruning works)
- [ ] Cost tracking accurate
- [ ] Rubrics persist across sessions

---

## Performance Targets

| Operation | Target | Actual |
|-----------|--------|--------|
| Cache lookup | <100ms | |
| Rubric scoring (1 proposal) | <2s | |
| Multi-model synthesis (2 models) | <5s | |
| Cache memory (1000 proposals) | <5MB | |

---

**Completion Status:** In Progress / Complete

---

**Next Steps After Phase 5:**
1. Deploy Phase 1-5 to production
2. Monitor cache hit rates and success scores
3. Gather user feedback on rubric quality
4. Plan Phase 6+ enhancements
