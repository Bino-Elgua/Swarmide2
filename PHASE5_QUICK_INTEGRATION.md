# Phase 5: Quick Integration Guide

**Duration:** 1 hour to integrate (excluding testing)

---

## ⚡ 3-Step Fast Integration

### Step 1: Import Services (5 min)

Add to top of `App.tsx`:

```typescript
import { proposalCache, findReuseableProposal } from './services/proposalCache';
import { getRubricForProject, rankProposalsWithRubric } from './services/customScoringRubric';
import { synthesizeBalanced } from './services/multiModelSynthesis';
```

### Step 2: Update `runExecutionLoop` (30 min)

Find the section where you resolve conflicts (around Phase 1 integration):

```typescript
// BEFORE: Simple conflict resolution
if (phaseProposals.length > 1) {
  const resolution = await resolveConflictingProposals(
    phaseProposals,
    strategy,
    project.prompt,
    initialAgents
  );
  // ...
}

// AFTER: Phase 5 enhanced conflict resolution
if (phaseProposals.length > 1) {
  addLog('📊 Phase 5: Enhanced Synthesis...');

  // 1. Score with custom rubric
  const rubric = getRubricForProject(project.type);
  const ranked = await rankProposalsWithRubric(
    phaseProposals,
    rubric,
    project.prompt
  );

  addLog(`   Rubric: "${rubric.name}"`);
  ranked.slice(0, 3).forEach((r, i) => {
    addLog(`   ${i + 1}. ${r.proposal.agentName}: ${r.score.overallScore}/100`);
    r.score.flags.slice(0, 2).forEach(f => {
      addLog(`      ⚠️  ${f.dimension}: ${f.flag}`);
    });
  });

  // 2. Use multi-model synthesis if multiple proposals
  if (phaseProposals.length >= 2 && project.costBudgetUSD) {
    const synthesis = await synthesizeBalanced(
      phaseProposals,
      project.prompt,
      project.costBudgetUSD * 0.1  // Use 10% of budget for synthesis
    );

    totalCostUSD += synthesis.estimatedCost;
    addLog(`   Multi-Model: ${Object.keys(synthesis.modelWeights).join(', ')}`);
    addLog(`   Consensus: ${(synthesis.consensusScore * 100).toFixed(0)}%`);
    
    // Use merged result
    previousOutputs = synthesis.mergedArchitecture;
  } else {
    // Use top-ranked proposal
    previousOutputs = ranked[0].proposal.architecture;
  }

  // 3. Cache winning proposal
  proposalCache.set(ranked[0].proposal, ranked[0].proposal.id);
  proposalCache.recordEvaluation(ranked[0].proposal.id, {
    selectedCount: 1,
    rejectedCount: phaseProposals.length - 1,
    successScore: ranked[0].score.normalizedScore
  });
}
```

### Step 3: Add Cache Warmup (5 min)

In the `useEffect` that initializes the app:

```typescript
useEffect(() => {
  // Warm cache at startup
  proposalCache.prune();  // Remove stale entries
  
  // Show cache stats (optional)
  const stats = proposalCache.getStats();
  if (stats.totalCached > 0) {
    addLog(`♻️  Cache initialized: ${stats.totalCached} proposals (hit rate: ${(stats.hitRate * 100).toFixed(0)}%)`);
  }
}, []);
```

---

## 🧪 Quick Testing (30 min)

### Test 1: Proposal Caching
```
1. Run orchestration for "Build REST API"
2. Run again with similar prompt "Create REST API"
3. Check terminal: Should see "♻️  Reusing cached proposal"
4. Expected: Cost reduced by ~$0.02
```

### Test 2: Custom Rubric Scoring
```
1. Create 2 conflicting proposals (monolith vs microservices)
2. Run conflict resolution
3. Check terminal: Should show dimension scores (alignment, technical, etc.)
4. Expected: Top proposal matches requirements better than default voting
```

### Test 3: Multi-Model Synthesis
```
1. Set cost budget to $1.00
2. Run with 3 conflicting proposals
3. Check terminal: Should show "Multi-Model Synthesis: google, openai..."
4. Expected: Merged architecture better than any single proposal
```

---

## 🐛 Troubleshooting

### "proposalCache is undefined"
→ Make sure import is at top: `import { proposalCache } from './services/proposalCache'`

### "API key not configured"
→ Set in MissionSettings: OpenAI/Anthropic API keys for multi-model

### "Type error: synthesizeBalanced"
→ Make sure TypeScript config has `strict: false` or update imports

### "Cache getting too large"
→ Add periodic pruning:
```typescript
setInterval(() => proposalCache.prune(), 60 * 60 * 1000); // Every hour
```

---

## 📊 Success Metrics

After integration, measure:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Cache hit rate | >30% | `proposalCache.getStats().hitRate` |
| Rubric consistency | >0.85 | Score same proposal twice |
| Multi-model consensus | >0.75 | `synthesis.consensusScore` |
| Cost per run | <$0.50 | `totalCostUSD` in logs |

---

## 🚀 Next Steps (Optional)

After basic integration:

1. **Add UI for cache stats:**
   ```tsx
   import ProposalCacheStats from './components/ProposalCacheStats';
   // Add to sidebar
   <ProposalCacheStats onClearCache={() => { /* reset */ }} />
   ```

2. **Add UI for custom rubrics:**
   ```tsx
   import RubricEditor from './components/RubricEditor';
   // Add modal when user wants to customize rubric
   ```

3. **Add multi-model panel:**
   ```tsx
   import MultiModelPanel from './components/MultiModelPanel';
   // Show synthesis results with model contributions
   ```

---

## ✅ Checklist

- [ ] Import all 3 services in App.tsx
- [ ] Update `runExecutionLoop` with Phase 5 logic
- [ ] Add cache warmup in useEffect
- [ ] Test proposal caching (Step 1)
- [ ] Test rubric scoring (Step 2)
- [ ] Test multi-model synthesis (Step 3)
- [ ] Verify costs stay within budget
- [ ] No TypeScript errors
- [ ] Terminal logs show Phase 5 operations
- [ ] (Optional) Add UI components

---

That's it! Phase 5 is now integrated into SwarmIDE2.

For detailed docs, see `PHASE5_COMPLETE.md`.
