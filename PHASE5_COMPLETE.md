# Phase 5: Advanced Features — Complete Implementation

**Date:** Jan 18, 2026  
**Duration:** Estimated 3-4 days to integrate  
**Status:** Ready for Development

---

## 📋 Overview

Phase 5 adds three powerful advanced capabilities to SwarmIDE2:

| Feature | Purpose | ROI | Complexity |
|---------|---------|-----|-----------|
| **Proposal Caching** | Reuse high-scoring proposals from previous runs | HIGH | LOW |
| **Custom Scoring Rubrics** | Define domain-specific evaluation criteria | HIGH | MEDIUM |
| **Multi-Model Synthesis** | Use multiple AI providers together for better results | MEDIUM | MEDIUM |

---

## 🎯 Feature 1: Proposal Caching

### Problem
- Users run similar projects repeatedly → agents re-generate similar proposals
- No way to rate proposal effectiveness over time
- No historical analysis of what works

### Solution
**Intelligent caching with evaluation tracking:**

```typescript
// Smart proposal reuse
const cached = await findReuseableProposal(
  "Build SaaS dashboard",
  agentId,
  1,  // phase
  "software"
);

// Track evaluation outcomes
proposalCache.recordEvaluation(cacheKey, {
  selectedCount: 1,
  rejectedCount: 0,
  successScore: 0.92,
  resolvedInPhase: 1
});

// Analyze cache performance
const stats = proposalCache.getStats();
console.log(`Cache hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `proposalCache.set()` | Store proposal with cache key |
| `proposalCache.get()` | Retrieve from cache |
| `proposalCache.findSimilar()` | Find proposals by keywords |
| `proposalCache.recordEvaluation()` | Log effectiveness |
| `proposalCache.getSuccessScore()` | Get weighted success rate |
| `findReuseableProposal()` | Smart recommendation |
| `warmCacheFromHistory()` | Batch load previous runs |

### Integration Steps

**Step 1: Import cache manager**
```typescript
import { proposalCache, findReuseableProposal } from './services/proposalCache';
```

**Step 2: In `runExecutionLoop`, before calling agents:**
```typescript
const phaseAgents = project.agents.filter(a => a.phase === phaseIdx + 1);

for (const agent of phaseAgents) {
  // Try cache first
  const cached = await findReuseableProposal(
    project.prompt,
    agent.id,
    phaseIdx,
    project.type
  );

  if (cached) {
    addLog(`♻️  Reusing cached proposal from ${cached.agentName}`);
    // Use cached proposal instead of calling agent
    continue;
  }

  // ... run agent normally
}
```

**Step 3: After resolution, log outcome:**
```typescript
proposalCache.recordEvaluation(selectedProposal.cacheKey, {
  selectedCount: 1,
  rejectedCount: proposals.length - 1,
  successScore: 0.85,  // Rate how well it worked
  resolvedInPhase: phaseIdx
});
```

### Performance Impact
- **Cache hits:** Skip API call (~1–2 sec, $0.01–0.05 saved)
- **Smart reuse:** Only reuse if success score > 0.7
- **Memory:** ~1KB per cached proposal; 1000 proposals = ~1MB

---

## 🎯 Feature 2: Custom Scoring Rubrics

### Problem
- Default scoring (alignment, technical, ethics, etc.) doesn't fit all domains
- No way to weight criteria for specific project types
- Users can't define what "good" means for their use case

### Solution
**Create domain-specific evaluation rubrics:**

```typescript
// Use template rubric for software projects
const softwareRubric = getRubricForProject('software');

// Or create custom rubric
const customRubric = await generateCustomRubric(
  "Prioritize security and privacy over performance",
  "software"
);

// Score proposals using rubric
const scores = await rankProposalsWithRubric(
  proposals,
  customRubric,
  originalPrompt
);

// results: [
//   { proposal: ..., score: { dimensionScores, overallScore: 87, ... } },
//   { proposal: ..., score: { dimensionScores, overallScore: 72, ... } },
//   ...
// ]
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `scoreProposalWithRubric()` | Score single proposal |
| `rankProposalsWithRubric()` | Score and rank multiple |
| `generateCustomRubric()` | Create rubric from description |
| `getRubricForProject()` | Get template for type |
| `saveRubric()`, `loadAllRubrics()` | Persistence |

### Default Rubrics

**Software Engineering Excellence:**
- Alignment (25%): Match requirements
- Technical (30%): Feasibility, scalability, performance
- Ethics (20%): Privacy, security, fairness
- Novelty (10%): Innovation vs. derivative
- Coherence (15%): Internal consistency

**Scientific Rigor:**
- Methodology (35%): Experimental design
- Reproducibility (25%): Can others replicate?
- Impact (20%): Novel findings? Advances field?
- Ethics (20%): IRB approval, consent, bias

### Integration Steps

**Step 1: Import rubric service**
```typescript
import { 
  getRubricForProject, 
  rankProposalsWithRubric 
} from './services/customScoringRubric';
```

**Step 2: In conflict resolution, use rubric instead of voting:**
```typescript
// Before: simple voting
// const winner = proposals.sort((a, b) => b.confidence - a.confidence)[0];

// After: rubric-based ranking
const rubric = getRubricForProject(project.type);
const ranked = await rankProposalsWithRubric(
  proposals,
  rubric,
  project.prompt
);

const winner = ranked[0].proposal;
const reasoning = ranked[0].score.reasoning;

addLog(`📊 ${rubric.name}: Selected "${winner.agentName}"`);
addLog(`   Score: ${ranked[0].score.overallScore}/100`);
ranked[0].score.flags.forEach(f => {
  addLog(`   ⚠️  ${f.dimension}: ${f.flag}`);
});
```

**Step 3: Let users customize rubric (optional MissionSettings UI):**
```tsx
<select onChange={(e) => setCustomRubric(e.target.value)}>
  <option value="template">Use Default Rubric</option>
  <option value="custom">Create Custom</option>
</select>
```

### Cost Impact
- **Per-proposal scoring:** 1-2 API calls to Gemini Flash (~$0.001–0.002)
- **Batch scoring:** 3 proposals × 2 calls = 6 calls (~$0.01)
- **Rubric generation:** 1 API call (~$0.0005)

---

## 🎯 Feature 3: Multi-Model Synthesis

### Problem
- Single model has limitations (Gemini fast but sometimes verbose, Claude thoughtful but slow)
- No way to leverage multiple providers for better results
- Cost optimization is manual

### Solution
**Ensemble multiple models → merge results intelligently:**

```typescript
// Default: pick balanced models (Gemini, Claude, Mistral)
const result = await synthesizeProposalsMultiModel(proposals, prompt);

// Or specify models
const models = selectOptimalModels(0.10); // $0.10 budget
const result = await synthesizeProposalsMultiModel(proposals, prompt, models);

// Cost-optimized (cheap, fast)
const cheapResult = await synthesizeCheap(proposals, prompt, 0.05);

// Quality-optimized (reasoning models)
const qualityResult = await synthesizeQuality(proposals, prompt);

// Balanced
const balancedResult = await synthesizeBalanced(proposals, prompt);
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `selectOptimalModels()` | Pick best models for task |
| `synthesizeProposalsMultiModel()` | Multi-model synthesis |
| `synthesizeCheap()` | Budget-constrained |
| `synthesizeQuality()` | Highest quality |
| `synthesizeBalanced()` | Cost-quality balance |

### Available Models

| Provider | Model | Role | Cost (1k tokens) | Best For |
|----------|-------|------|------------------|----------|
| Google | Gemini 3 Pro | Balance | $0.075/$0.3 | General, fast |
| OpenAI | GPT-4o | Reasoning | $5/$15 | Complex logic |
| Anthropic | Claude 3.5 | Reasoning | $3/$15 | Nuanced decisions |
| Groq | Mixtral 8x7b | Speed | $0.00024 | Quick turnaround |
| Mistral | Mistral Large | Balance | $0.0048/$0.014 | Cost-effective |
| Perplexity | Sonar Pro | Creativity | $5/$15 | Creative ideation |

### Integration Steps

**Step 1: Import multi-model service**
```typescript
import { 
  synthesizeBalanced,
  selectOptimalModels 
} from './services/multiModelSynthesis';
```

**Step 2: In conflict resolution, replace single-model synthesis:**
```typescript
// Before: 
// const merged = await synthesizeConflictingProposals(
//   proposals, 'meta_reasoning', prompt, agents
// );

// After: Multi-model synthesis
const synthesis = await synthesizeBalanced(proposals, prompt, costBudgetUSD);

addLog(`🤖 Multi-Model Synthesis (${Object.keys(synthesis.modelWeights).join(', ')})`);
addLog(`   Consensus: ${(synthesis.consensusScore * 100).toFixed(0)}%`);
synthesis.dissents.forEach(d => {
  addLog(`   ⚠️  Disagreement: ${d}`);
});
addLog(`   Estimated cost: $${synthesis.estimatedCost.toFixed(2)}`);
```

**Step 3: Add cost tracking:**
```typescript
totalCostUSD += synthesis.estimatedCost;
const budget = validateBudget(totalCostUSD, project.costBudgetUSD);
if (!budget.valid) {
  // Fallback to cheap synthesis
  const cheapResult = await synthesizeCheap(proposals, prompt);
  totalCostUSD += cheapResult.estimatedCost;
}
```

### Cost Scenarios

**Example: 3 proposals, $0.20 budget**

1. **Cheap (Groq + Mistral):** $0.012 ✅
2. **Balanced (Gemini + Claude):** $0.18 ✅
3. **Quality (Claude + GPT-4):** $0.45 ❌ exceeds budget

---

## 🔌 End-to-End Integration in App.tsx

### Step 1: Add state variables
```typescript
const [cacheStats, setCacheStats] = useState<any>(null);
const [usedRubric, setUsedRubric] = useState('template');
const [synthesisMethod, setSynthesisMethod] = useState<'voting' | 'multi-model'>('multi-model');
```

### Step 2: Warm cache on startup
```typescript
useEffect(() => {
  // Load previous runs into cache
  proposalCache.prune(); // Remove stale entries
  setCacheStats(proposalCache.getStats());
}, []);
```

### Step 3: Try cache before agent calls
```typescript
const runExecutionLoop = async (initialAgents: Agent[], phases: Phase[]) => {
  for (let phaseIdx = 0; phaseIdx < phases.length; phaseIdx++) {
    const phaseAgents = initialAgents.filter(a => a.phase === phaseIdx + 1);
    const results = [];

    for (const agent of phaseAgents) {
      // Try cache
      const cached = await findReuseableProposal(
        project.prompt, agent.id, phaseIdx, project.type
      );
      
      if (cached && proposalCache.getSuccessScore(cached.cacheKey) > 0.7) {
        addLog(`♻️  Reusing proposal from cache (success: ${proposalCache.getSuccessScore(cached.cacheKey).toFixed(2)})`);
        results.push({ proposal: cached, tokensUsed: 0, costUSD: 0 });
        continue;
      }

      // Run agent normally
      const result = await performAgentTask(...);
      results.push(result);
    }

    // ... resolve conflicts with rubric
  }
};
```

### Step 4: Score with rubric
```typescript
const phaseProposals = results
  .filter(r => r.proposal)
  .map(r => r.proposal as ProposalOutput);

if (phaseProposals.length > 1) {
  const rubric = getRubricForProject(project.type);
  const ranked = await rankProposalsWithRubric(
    phaseProposals, rubric, project.prompt
  );

  addLog(`📊 Scoring with "${rubric.name}" rubric`);
  ranked.forEach((r, i) => {
    addLog(`  ${i + 1}. ${r.proposal.agentName}: ${r.score.overallScore}/100`);
  });

  // Cache the winning proposal
  const winner = ranked[0].proposal;
  proposalCache.set(winner, winner.id);
  proposalCache.recordEvaluation(winner.id, {
    selectedCount: 1,
    successScore: ranked[0].score.normalizedScore
  });
}
```

### Step 5: Use multi-model synthesis
```typescript
if (synthesisMethod === 'multi-model') {
  const synthesis = await synthesizeBalanced(
    phaseProposals, project.prompt, project.costBudgetUSD
  );
  
  // Use merged architecture instead of single proposal
  phaseOutput = synthesis.mergedArchitecture;
  totalCostUSD += synthesis.estimatedCost;
} else {
  // Fallback to simple voting
  phaseOutput = ranked[0].proposal.architecture;
}
```

---

## 📊 UI Components (Optional)

### ProposalCacheStats Component
```typescript
// Show cache performance dashboard
interface Props {
  stats: ProposalCacheIndex;
  onClearCache: () => void;
}

// Displays: hit rate, top proposals, total cached, recent usage
```

### ScoringRubricEditor Component
```typescript
// Let users create/edit rubrics
interface Props {
  rubric: CustomScoringRubric;
  onSave: (rubric: CustomScoringRubric) => void;
  onCancel: () => void;
}

// Drag-drop dimensions, adjust weights, preview scoring
```

### MultiModelSynthesisPanel Component
```typescript
// Show multi-model synthesis results
interface Props {
  result: SynthesisResult;
  models: ModelConfig[];
}

// Display model contributions, disagreements, cost breakdown
```

---

## ✅ Testing Checklist

### Proposal Caching
- [ ] Cache stores proposal with unique key
- [ ] `findReuseableProposal()` returns match for similar prompt
- [ ] Hit rate > 30% on repeated projects
- [ ] Success score reflects actual outcomes
- [ ] Cache persists across page reload
- [ ] Expired entries pruned after 24h

### Custom Scoring Rubrics
- [ ] Default rubric loads for project type
- [ ] Custom rubric created from description
- [ ] `scoreProposalWithRubric()` returns valid JSON
- [ ] Dimension weights normalize to 1.0
- [ ] Flags identify concerning proposals
- [ ] Rubric saved/loaded from localStorage

### Multi-Model Synthesis
- [ ] Models selected based on budget
- [ ] Multiple models called in parallel
- [ ] Ensemble voting merges responses
- [ ] Consensus score reflects agreement
- [ ] Dissents identify contradictions
- [ ] Cost estimates accurate within 10%

### End-to-End
- [ ] Phase 1 conflict detection still works
- [ ] Cached proposals skip API calls
- [ ] Rubric scoring influences decisions
- [ ] Multi-model synthesis improves quality
- [ ] Total cost <= budget
- [ ] No TypeScript errors

---

## 🚀 Rollout Plan

### Day 1: Proposal Caching
- Integrate `proposalCache.ts` into execution loop
- Add cache warming on startup
- Test hit rate, success scoring
- Estimate: 2 hours

### Day 2: Custom Scoring Rubrics
- Integrate `customScoringRubric.ts` into conflict resolution
- Replace voting with rubric-based ranking
- Add rubric editor UI (optional)
- Test: multiple rubrics, dimension weighting
- Estimate: 2 hours

### Day 3: Multi-Model Synthesis
- Integrate `multiModelSynthesis.ts` into synthesis pipeline
- Add model selection UI in MissionSettings
- Handle budget constraints
- Test: cheap, balanced, quality modes
- Estimate: 2 hours

### Day 4: Testing & Refinement
- E2E tests: caching + rubrics + multi-model together
- Performance testing: overhead, latency
- Error handling: missing API keys, network failures
- Documentation & cleanup
- Estimate: 2 hours

**Total: ~8 hours of development**

---

## 📁 Files Reference

| File | Purpose | Size |
|------|---------|------|
| `services/proposalCache.ts` | In-memory cache with persistence | 300 LOC |
| `services/customScoringRubric.ts` | Rubric management and scoring | 400 LOC |
| `services/multiModelSynthesis.ts` | Multi-model ensemble | 350 LOC |
| `components/ProposalCacheStats.tsx` | Cache dashboard (optional) | 150 LOC |
| `components/RubricEditor.tsx` | Custom rubric UI (optional) | 200 LOC |
| `components/MultiModelPanel.tsx` | Synthesis results (optional) | 180 LOC |

---

## 🎓 Key Insights

### Proposal Caching
- **Problem solved:** Avoid re-generating proposals for similar tasks
- **Key metric:** Hit rate (target: >30% for repeated project types)
- **Cost savings:** $0.05–0.10 per cache hit

### Custom Scoring Rubrics
- **Problem solved:** Define "good" for domain-specific use cases
- **Key metric:** Score consistency (same proposal always scores similarly)
- **Quality improvement:** Better alignment with user expectations

### Multi-Model Synthesis
- **Problem solved:** Leverage multiple AI providers for better results
- **Key metric:** Consensus score (target: >0.75 for agreement)
- **Quality improvement:** Better architectures through ensemble voting

---

## 💡 Next Steps

1. **Implement proposal caching** (~2 hours)
   - Test cache hit rate
   - Verify success scoring accuracy

2. **Add custom rubrics** (~2 hours)
   - Test rubric generation from descriptions
   - Verify dimension weighting

3. **Integrate multi-model synthesis** (~2 hours)
   - Test model selection logic
   - Verify ensemble voting quality

4. **Optimize & refine** (~2 hours)
   - Profile performance
   - Reduce API call overhead
   - Improve user guidance

---

## 🔗 Dependencies

### Phase 5 → Earlier Phases
- ✅ Uses Phase 1: Conflict Resolution (proposals, scoring)
- ✅ Uses Phase 2: Cost Tracking (budget constraints)
- ⏳ Synergizes with Phase 3: RLM (caching helps with long contexts)
- ⏳ Synergizes with Phase 4: CCA (custom rubrics for code analysis)

### External Dependencies
- `@google/generative-ai` (already installed)
- localStorage (browser API, no setup needed)

---

**Status:** Ready for implementation  
**Difficulty:** Medium  
**Estimated Time:** 8–12 hours  
**ROI:** HIGH (saves time, improves quality, reduces cost)
