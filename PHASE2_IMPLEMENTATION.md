# SwarmIDE2 Phase 2: RLM Integration — Complete Implementation Guide

**Status:** Ready for Integration  
**Target Duration:** 2 weeks  
**Priority:** High (20-30% token savings, prevents context rot)  
**Dependencies:** Phase 1 complete  
**Date:** Jan 18, 2026

---

## 📋 Overview

### The Problem
Long projects (1000+ lines, 5+ phases) hit context window limits → outputs degrade, context rot.

**Example:** 5-phase build with 4 agents
- Phase 1: ~80k tokens
- Phase 2: ~80k + previous = 160k tokens  
- Phase 3: ~80k + history = 240k tokens
- Phase 4: ~80k + history = 320k tokens
- Phase 5: ~80k + history = 400k tokens

**Result:** Quality drops on phases 4-5; APIs become slower; costs balloon.

### The Solution: RLM (Recurrent Layer Mechanism)
Compress conversation history into reusable "state snapshots" that preserve decision-critical information while reducing tokens by 20-30%.

**Key Insight:** Agents don't need full conversation history; they need:
1. Architecture decisions (100% fidelity required)
2. Implementation patterns (can be summarized 3:1)
3. Technical constraints (100% fidelity required)
4. Open issues (100% fidelity required)
5. Cost breakdown (reference only)

---

## 🎯 Success Criteria

Phase 2 is complete when:

- ✅ RLM compression service fully implemented and tested
- ✅ RLMDashboard component renders correctly
- ✅ App.tsx integrates RLM into execution loop
- ✅ Snapshot creation triggers after phase completion
- ✅ Sub-query functionality works (retrieve specific context)
- ✅ Token savings verified (20-30% reduction on 5+ phase projects)
- ✅ No TypeScript errors
- ✅ All 4 test scenarios pass

---

## 📦 Deliverables

### Created Files

1. **`services/rlmService.ts`** ✅
   - `compressContextWithRLM()` — Main compression function
   - `queryWithRLM()` — Sub-query compressed snapshot
   - `synthesizeProjectWithRLM()` — Inject snapshot into synthesis
   - `estimateCompressionGain()` — Predict token savings
   - `multiLayerCompress()` — Hierarchical compression for 10k+ token projects

2. **`components/RLMDashboard.tsx`** ✅
   - Real-time compression metrics display
   - Token reduction visualization
   - Cost savings tracker
   - Snapshot contents preview
   - Enable/disable toggle

3. **`types.ts` updates** ✅
   - `ContextSnapshot` interface
   - `RLMQuery` interface
   - `RLMQueryResult` interface
   - `CompressionMetrics` interface
   - `ProjectStateExtended` additions

---

## 🔧 Step-by-Step Implementation

### STEP 1: Update App.tsx State (30 min)

Add RLM state to your `App.tsx`:

```typescript
// Add to state variables section
const [rlmEnabled, setRlmEnabled] = useState(true); // Enable by default
const [compressionMetrics, setCompressionMetrics] = useState<CompressionMetrics | null>(null);
const [currentSnapshot, setCurrentSnapshot] = useState<ContextSnapshot | null>(null);
const [phaseHistory, setPhaseHistory] = useState<ProjectPhaseHistory[]>([]);
```

### STEP 2: Create Phase History Tracker (30 min)

As each phase completes, save its outputs to `phaseHistory`:

```typescript
// After phase execution completes
const recordPhaseHistory = (phaseNum: number, phaseDescription: string, agentOutputs: any[]) => {
  const newPhase: ProjectPhaseHistory = {
    phaseNumber: phaseNum,
    description: phaseDescription,
    agentOutputs: agentOutputs.map(ao => ({
      agentName: ao.agentName,
      output: ao.output || '',
      tokens: ao.tokensUsed || 0,
      cost: ao.costUSD || 0
    })),
    decisions: extractDecisions(agentOutputs), // Helper function
    issues: extractOpenIssues(agentOutputs), // Helper function
    timestamp: new Date()
  };
  
  setPhaseHistory([...phaseHistory, newPhase]);
};

// Helper: Extract architectural decisions from outputs
const extractDecisions = (outputs: any[]): string[] => {
  const decisions: string[] = [];
  outputs.forEach(o => {
    // Look for decision markers in output
    const decisionRegex = /(?:decision|decided|will use|will implement):\s*(.+?)(?:\.|$)/gi;
    let match;
    while ((match = decisionRegex.exec(o.output || '')) !== null) {
      decisions.push(match[1].trim());
    }
  });
  return decisions;
};

// Helper: Extract open issues from outputs
const extractOpenIssues = (outputs: any[]): string[] => {
  const issues: string[] = [];
  outputs.forEach(o => {
    const issueRegex = /(?:issue|problem|TODO|FIXME|concern):\s*(.+?)(?:\.|$)/gi;
    let match;
    while ((match = issueRegex.exec(o.output || '')) !== null) {
      issues.push(match[1].trim());
    }
  });
  return issues;
};
```

### STEP 3: Trigger Compression After Phase Completion (45 min)

After each phase completes (when moving to next phase):

```typescript
// In your execution loop, when phase completes:
const onPhaseComplete = async (phaseNum: number) => {
  if (rlmEnabled && phaseNum >= 3) { // Start compressing after phase 3
    try {
      const result = compressContextWithRLM(phaseHistory, 2000);
      setCompressionMetrics({
        originalTokens: result.snapshot.originalTokenCount,
        compressedTokens: result.snapshot.compressedTokenCount,
        reductionPercent: result.reductionPercent,
        tokensSaved: result.tokensSaved,
        estimatedCostSaved: result.estimatedCostSaved,
        compressionRatio: result.snapshot.compressedTokenCount / result.snapshot.originalTokenCount
      });
      
      setCurrentSnapshot(result.snapshot);
      
      addLog(`✅ RLM Compression Complete
        Original: ${result.snapshot.originalTokenCount.toLocaleString()} tokens
        Compressed: ${result.snapshot.compressedTokenCount.toLocaleString()} tokens
        Savings: ${result.reductionPercent.toFixed(1)}% (${result.estimatedCostSaved.toFixed(3)}$)`);
    } catch (error) {
      addLog(`⚠️ RLM Compression Failed: ${error}`);
    }
  }
};
```

### STEP 4: Inject Snapshot into Synthesis (1 hour)

When calling `performAgentTask()`, inject compressed context:

```typescript
import { synthesizeProjectWithRLM } from './services/rlmService';

// Modify your agent task execution
const synthesisContext = currentSnapshot
  ? synthesizeProjectWithRLM(phaseHistory[phaseHistory.length - 1], currentSnapshot)
  : '';

const agentResult = await performAgentTask(
  agent,
  projectContext + synthesisContext, // Inject snapshot here
  previousOutputs,
  enableMedia,
  requestProposal
);
```

### STEP 5: Add RLMDashboard to UI (20 min)

Import and render the dashboard in your sidebar/settings:

```typescript
import { RLMDashboard } from './components/RLMDashboard';

// In your JSX (sidebar or settings panel):
<RLMDashboard
  compressionMetrics={compressionMetrics}
  snapshot={currentSnapshot}
  isEnabled={rlmEnabled}
  onToggleRLM={setRlmEnabled}
  totalPhases={5} // or dynamically calculate
/>
```

### STEP 6: Add RLM Toggle to MissionSettings (15 min)

```typescript
// In MissionSettings component or phase setup:
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    checked={rlmEnabled}
    onChange={(e) => setRlmEnabled(e.target.checked)}
    className="w-4 h-4"
  />
  <label className="text-sm text-slate-300">
    Enable RLM Context Compression (recommended for 5+ phases)
  </label>
</div>
```

---

## 🧪 Testing Scenarios

### TEST 1: Single Phase (No Compression)

**Input:**
- 1 phase completed
- RLM enabled

**Expected:**
- No compression triggered (need 3+ phases)
- Metrics remain null

**Verification:**
```
✓ RLMDashboard shows "Compression metrics pending"
✓ No snapshot created
✓ Phase history recorded correctly
```

### TEST 2: Three Phases (Compression Triggered)

**Input:**
- 3 phases completed, 4 agents per phase
- Each phase ~80k tokens
- RLM enabled

**Expected:**
- Compression triggered after phase 3
- Token reduction: 15-25%
- Snapshot created with architecture decisions

**Verification:**
```
✓ RLMDashboard shows metrics
✓ Token reduction 15%+ achieved
✓ Cost savings calculated ($0.05-0.10)
✓ Snapshot ID generated
```

**Code to test:**
```typescript
// Simulate 3 phases
const mockPhases: ProjectPhaseHistory[] = [
  {
    phaseNumber: 1,
    description: 'Architecture Planning',
    agentOutputs: [
      { agentName: 'Confucius', output: 'Long output...', tokens: 8000, cost: 0.03 },
      // ... 3 more agents
    ],
    decisions: ['Use microservices', 'Event-driven messaging'],
    issues: [],
    timestamp: new Date()
  },
  // ... phase 2 & 3
];

const result = compressContextWithRLM(mockPhases, 2000);
console.log('Reduction:', result.reductionPercent); // Should be 15-25%
```

### TEST 3: Five Phases (Long Project)

**Input:**
- 5 phases, 4 agents, ~80k tokens per phase
- Total: ~400k tokens before RLM
- RLM enabled

**Expected:**
- Token reduction: 25-30% (highest gains)
- Snapshot preserves all architecture decisions
- Sub-queries work correctly

**Verification:**
```
✓ Reduction 25%+ achieved
✓ Synthesis prompt uses snapshot instead of full history
✓ Agent outputs remain coherent with compressed context
✓ Cost savings: $0.30-0.50 per run
```

### TEST 4: Sub-Query Functionality

**Input:**
- Snapshot from 5-phase project
- Query: `{ topic: 'database', keywords: ['postgres', 'schema'] }`

**Expected:**
- Retrieve relevant context from snapshot
- Confidence score 0.7+
- Retrieved text < 500 tokens

**Code:**
```typescript
const query: RLMQuery = {
  topic: 'database',
  keywords: ['postgres', 'schema'],
  maxTokens: 500
};

const result = queryWithRLM(currentSnapshot!, query);
console.log('Confidence:', result.confidence); // Should be 0.7+
console.log('Tokens:', result.tokens_used); // Should be < 500
```

---

## 🔌 Integration Checklist

Copy-paste this into your implementation:

- [ ] Add RLM state to App.tsx (`rlmEnabled`, `compressionMetrics`, `currentSnapshot`, `phaseHistory`)
- [ ] Implement `extractDecisions()` and `extractOpenIssues()` helpers
- [ ] Call `recordPhaseHistory()` after each phase completes
- [ ] Call `compressContextWithRLM()` after phase 3+ completes
- [ ] Update `performAgentTask()` calls to inject snapshot context
- [ ] Import and render `RLMDashboard` component
- [ ] Add RLM toggle to MissionSettings
- [ ] Test all 4 scenarios above
- [ ] Verify token savings in logs (should be 20-30% on 5+ phases)
- [ ] Fix any TypeScript errors
- [ ] Run `npm run dev` and test in browser

---

## 📊 Expected Token Savings

### Before RLM (5 Phases)
```
Phase 1: 80k tokens (no history)
Phase 2: 80k + 80k = 160k tokens
Phase 3: 80k + 160k = 240k tokens
Phase 4: 80k + 240k = 320k tokens
Phase 5: 80k + 320k = 400k tokens
────────────────────────────
Total: 1.28M tokens
```

### After RLM (5 Phases)
```
Phase 1: 80k tokens (no history, RLM triggers at phase 3)
Phase 2: 80k + 80k = 160k tokens
Phase 3: 80k + compress(160k → 40k) = 120k tokens ← RLM START
Phase 4: 80k + compress(240k → 60k) = 140k tokens
Phase 5: 80k + compress(320k → 80k) = 160k tokens
────────────────────────────
Total: 740k tokens
Savings: 42% (1.28M → 740k)
Cost: $0.73 → $0.42 (42% cheaper)
```

---

## 🚀 Advanced Features (Optional)

### Multi-Layer Compression
For projects exceeding 10k tokens:

```typescript
const compressionLayers = multiLayerCompress(phaseHistory);
// Returns Map<level, snapshot>
// Level 0 (phases 1-2): Detailed
// Level 1 (phases 3-4): Medium compression
// Level 2 (phases 5+): Ultra-compressed
```

### Custom Compression Ratio
```typescript
const estimatedGain = estimateCompressionGain(
  totalTokens,
  0.20 // 20% compression ratio (compress to 80%)
);
// { estimatedCompressed: ..., estimatedSavings: ..., estimatedCostSaved: ... }
```

---

## 🐛 Debugging

### Issue: No compression triggered
**Cause:** `phaseHistory` empty or RLM threshold not met  
**Fix:** Verify `recordPhaseHistory()` called after each phase

### Issue: Compression metrics show 0% reduction
**Cause:** Not enough history to compress (< 1000 tokens)  
**Fix:** RLM triggers only after 3+ phases or 80k+ tokens

### Issue: Snapshot not used in synthesis
**Cause:** `synthesizeProjectWithRLM()` not called  
**Fix:** Verify snapshot injected in `performAgentTask()` prompt

### Issue: Sub-queries return low confidence (<0.5)
**Cause:** Topic index not built or keywords don't match  
**Fix:** Ensure `buildTopicalIndex()` completes in compression

---

## 📚 File Reference

| File | Purpose |
|------|---------|
| `services/rlmService.ts` | Core compression logic |
| `components/RLMDashboard.tsx` | UI for metrics |
| `types.ts` | Type definitions |
| `App.tsx` | Integration (you'll update) |
| `ENHANCEMENT_ROADMAP.md` | Technical spec (reference) |

---

## ⏱️ Time Breakdown

| Task | Duration | Status |
|------|----------|--------|
| Service implementation | ✅ DONE | 2 hours |
| Component creation | ✅ DONE | 1 hour |
| Type definitions | ✅ DONE | 30 min |
| **App.tsx integration** | **⏳ TODO** | **3 hours** |
| Testing (all 4 scenarios) | **⏳ TODO** | **2 hours** |
| Documentation | **⏳ TODO** | **30 min** |
| **TOTAL PHASE 2** | **~9 hours** | **55% DONE** |

---

## 🎯 Next Steps

1. **Follow STEP 1-6 above** in your App.tsx
2. **Run TEST 1-4** to verify functionality
3. **Check logs** for token savings metrics
4. **Iterate** on snapshot settings if needed

---

## 💡 Tips

- RLM is most effective on 5+ phase projects
- Start with `targetTokenBudget = 2000` for good compression/quality tradeoff
- Test with 3+ phases before committing to Phase 3
- Save snapshots to localStorage for persistence across sessions

---

## ✨ Phase 3 Preview

After Phase 2 is complete, Phase 3 (CCA Upgrade) builds on RLM:
- Dependency graph builder (analyzes code structure)
- Refactoring recommendations
- Module extraction suggestions

RLM snapshots + CCA = powerful large codebase analysis!

---

**Status:** Ready for integration  
**Questions?** See `ENHANCEMENT_ROADMAP.md` section 2 for technical details
