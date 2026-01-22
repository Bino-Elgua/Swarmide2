# Phase 2: RLM Integration — Copy-Paste Code Snippets

**Purpose:** Ready-to-use code blocks for App.tsx integration  
**How to use:** Copy each snippet and paste into App.tsx at the indicated location

---

## SNIPPET 1: State Variables (Add to App.tsx)

**Location:** In your state declarations section (near other `useState` calls)

```typescript
// Phase 2: RLM Context Compression
const [rlmEnabled, setRlmEnabled] = useState(true); // Enable by default
const [compressionMetrics, setCompressionMetrics] = useState<CompressionMetrics | null>(null);
const [currentSnapshot, setCurrentSnapshot] = useState<ContextSnapshot | null>(null);
const [phaseHistory, setPhaseHistory] = useState<ProjectPhaseHistory[]>([]);
```

---

## SNIPPET 2: Imports (Add to top of App.tsx)

```typescript
// RLM Services
import {
  compressContextWithRLM,
  queryWithRLM,
  synthesizeProjectWithRLM,
  estimateCompressionGain,
  estimateTokenCount,
  type ContextSnapshot,
  type ProjectPhaseHistory
} from './services/rlmService';

// RLM Component
import { RLMDashboard } from './components/RLMDashboard';

// Types
import type { CompressionMetrics, RLMQuery, RLMQueryResult } from './types';
```

---

## SNIPPET 3: Helper Functions (Add to App.tsx)

```typescript
/**
 * Extract architectural decisions from agent outputs
 * Looks for decision markers like "decision:", "will use", "implements"
 */
const extractDecisions = (outputs: any[]): string[] => {
  const decisions: string[] = [];
  outputs.forEach((o) => {
    const decisionRegex = /(?:decision|decided|will use|will implement|architecture):\s*(.+?)(?:\.|$)/gi;
    let match;
    while ((match = decisionRegex.exec(o.output || '')) !== null) {
      const decision = match[1].trim();
      if (decision.length > 5 && decision.length < 200) {
        decisions.push(decision);
      }
    }
  });
  return [...new Set(decisions)]; // Deduplicate
};

/**
 * Extract open issues from agent outputs
 * Looks for issue markers like "issue:", "problem:", "TODO", "FIXME"
 */
const extractOpenIssues = (outputs: any[]): string[] => {
  const issues: string[] = [];
  outputs.forEach((o) => {
    const issueRegex = /(?:issue|problem|TODO|FIXME|concern|challenge):\s*(.+?)(?:\.|$)/gi;
    let match;
    while ((match = issueRegex.exec(o.output || '')) !== null) {
      const issue = match[1].trim();
      if (issue.length > 5 && issue.length < 200) {
        issues.push(issue);
      }
    }
  });
  return [...new Set(issues)]; // Deduplicate
};

/**
 * Record phase history after phase completion
 * Call this after all agents in a phase have finished
 */
const recordPhaseHistory = (
  phaseNum: number,
  phaseDescription: string,
  agentOutputs: Array<{ agentName: string; output: string; tokensUsed: number; costUSD: number }>
) => {
  const newPhase: ProjectPhaseHistory = {
    phaseNumber: phaseNum,
    description: phaseDescription,
    agentOutputs: agentOutputs.map((ao) => ({
      agentName: ao.agentName,
      output: ao.output || '',
      tokens: ao.tokensUsed || 0,
      cost: ao.costUSD || 0
    })),
    decisions: extractDecisions(agentOutputs),
    issues: extractOpenIssues(agentOutputs),
    timestamp: new Date()
  };

  const updated = [...phaseHistory, newPhase];
  setPhaseHistory(updated);

  addLog(`📊 Phase ${phaseNum} recorded: ${agentOutputs.length} agents, ${newPhase.decisions.length} decisions`);
};

/**
 * Trigger RLM compression after phase completion
 * Call after phase 3+ for meaningful compression
 */
const triggerRLMCompression = async (phaseNum: number) => {
  if (!rlmEnabled || phaseNum < 3 || phaseHistory.length === 0) {
    return;
  }

  try {
    addLog(`🔄 RLM: Starting context compression for phases 1-${phaseNum}...`);

    const result = compressContextWithRLM(phaseHistory, 2000); // 2000 token budget for snapshot

    setCompressionMetrics({
      originalTokens: result.snapshot.originalTokenCount,
      compressedTokens: result.snapshot.compressedTokenCount,
      reductionPercent: result.reductionPercent,
      tokensSaved: result.tokensSaved,
      estimatedCostSaved: result.estimatedCostSaved,
      compressionRatio:
        result.snapshot.compressedTokenCount / result.snapshot.originalTokenCount
    });

    setCurrentSnapshot(result.snapshot);

    addLog(`
✅ RLM Compression Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Original tokens:  ${result.snapshot.originalTokenCount.toLocaleString()} 
Compressed:       ${result.snapshot.compressedTokenCount.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📉 Reduction:     ${result.reductionPercent.toFixed(1)}%
💰 Cost saved:    $${result.estimatedCostSaved.toFixed(3)}
🎯 Ratio:         ${(result.snapshot.compressedTokenCount / result.snapshot.originalTokenCount * 100).toFixed(1)}%`);
  } catch (error: any) {
    addLog(`⚠️ RLM Compression failed: ${error.message}`);
  }
};
```

---

## SNIPPET 4: Modify Agent Task Call (Update your performAgentTask call)

**Location:** In your execution loop where you call `performAgentTask()`

**Before:**
```typescript
const agentResult = await performAgentTask(
  agent,
  projectContext,
  previousOutputs,
  enableMedia,
  requestProposal
);
```

**After (with RLM):**
```typescript
// Prepare context with RLM snapshot if available
let enhancedContext = projectContext;
if (rlmEnabled && currentSnapshot && phaseHistory.length > 0) {
  const currentPhaseForSnapshot = phaseHistory[phaseHistory.length - 1];
  const rlmContext = synthesizeProjectWithRLM(
    currentPhaseForSnapshot,
    currentSnapshot,
    '' // Optional: additional context
  );
  enhancedContext = projectContext + '\n\n' + rlmContext;
}

const agentResult = await performAgentTask(
  agent,
  enhancedContext, // Use enhanced context with snapshot
  previousOutputs,
  enableMedia,
  requestProposal
);
```

---

## SNIPPET 5: Phase Completion Handler (Call after all agents in phase finish)

**Location:** In your phase execution loop, after all agents complete

```typescript
// After all agents in current phase have completed
const currentPhaseNumber = 2; // Example: phase 2
const currentPhaseDescription = 'Implementation Planning';
const phaseAgentOutputs = [
  { agentName: 'Confucius', output: agentOutputs[0], tokensUsed: 8000, costUSD: 0.03 },
  { agentName: 'Kernel', output: agentOutputs[1], tokensUsed: 7500, costUSD: 0.025 },
  { agentName: 'Scale', output: agentOutputs[2], tokensUsed: 8200, costUSD: 0.032 },
  { agentName: 'Nexus', output: agentOutputs[3], tokensUsed: 7800, costUSD: 0.028 }
];

// Record the phase
recordPhaseHistory(currentPhaseNumber, currentPhaseDescription, phaseAgentOutputs);

// Trigger compression if appropriate
await triggerRLMCompression(currentPhaseNumber);
```

---

## SNIPPET 6: RLMDashboard Rendering (Add to your UI)

**Location:** In your sidebar or settings panel (e.g., next to CostTracker)

```typescript
{/* RLM Dashboard */}
<RLMDashboard
  compressionMetrics={compressionMetrics}
  snapshot={currentSnapshot}
  isEnabled={rlmEnabled}
  onToggleRLM={(enabled) => {
    setRlmEnabled(enabled);
    addLog(`RLM ${enabled ? 'enabled' : 'disabled'}`);
  }}
  totalPhases={5} // Or calculate from orchestration response
/>
```

---

## SNIPPET 7: RLM Toggle in Settings (Optional)

**Location:** In your MissionSettings or phase configuration component

```typescript
{/* RLM Enable/Disable */}
<div className="space-y-2 border-t border-slate-600 pt-4">
  <label className="text-sm font-medium text-slate-300">Context Compression</label>
  <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded">
    <input
      type="checkbox"
      checked={rlmEnabled}
      onChange={(e) => setRlmEnabled(e.target.checked)}
      className="w-4 h-4 rounded accent-green-500"
    />
    <div className="flex-1">
      <div className="text-sm text-slate-300">Enable RLM Compression</div>
      <div className="text-xs text-slate-500">
        Recommended for 5+ phase projects. Saves 20-30% tokens.
      </div>
    </div>
    <div className={`text-xs font-mono px-2 py-1 rounded ${
      rlmEnabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'
    }`}>
      {rlmEnabled ? 'ON' : 'OFF'}
    </div>
  </div>
</div>
```

---

## SNIPPET 8: Sub-Query Example (Advanced)

**Location:** If you want to query a snapshot for specific context

```typescript
/**
 * Query the current snapshot for specific context
 * Example: Get database-related decisions
 */
const querySnapshotForContext = async (topic: string, keywords: string[]) => {
  if (!currentSnapshot) {
    addLog(`⚠️ No snapshot available yet`);
    return;
  }

  const query: RLMQuery = {
    topic,
    keywords,
    maxTokens: 500
  };

  const result = queryWithRLM(currentSnapshot, query);

  addLog(`
🔍 RLM Query Result
Topic: ${topic}
Confidence: ${(result.confidence * 100).toFixed(0)}%
Tokens: ${result.tokens_used}

${result.relevant_context.substring(0, 300)}...`);

  return result;
};

// Usage example:
// await querySnapshotForContext('database', ['postgres', 'schema', 'migrations']);
```

---

## SNIPPET 9: Compression Gain Estimation (Before Running)

**Location:** In your pre-run validation or settings

```typescript
/**
 * Estimate compression gains before orchestration
 * Helps users understand expected token savings
 */
const estimateRLMSavings = (expectedTotalTokens: number) => {
  const estimate = estimateCompressionGain(expectedTotalTokens, 0.25); // 25% compression ratio

  addLog(`
📊 RLM Compression Estimate (5-phase project)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Expected total tokens: ${estimate.estimatedCompressedTokens.toLocaleString()}
Estimated savings:     ${estimate.estimatedSavings.toLocaleString()} tokens
Estimated cost saved:  $${estimate.estimatedCostSaved.toFixed(3)}`);
};

// Usage:
// estimateRLMSavings(1_200_000); // Estimate for 1.2M token project
```

---

## SNIPPET 10: Test Validation (Browser Console)

**Location:** Test in browser console after integration

```javascript
// Paste this into browser console to validate integration

console.log('=== Phase 2 Integration Validation ===');
console.log('✓ RLM State:', { rlmEnabled, phaseHistory: phaseHistory.length, hasSnapshot: !!currentSnapshot });
console.log('✓ Compression Metrics:', compressionMetrics);
console.log('✓ Current Snapshot ID:', currentSnapshot?.id);

// Check phase history
if (phaseHistory.length > 0) {
  console.log('✓ Phase History:');
  phaseHistory.forEach((p, i) => {
    console.log(`  Phase ${p.phaseNumber}: ${p.agentOutputs.length} agents, ${p.decisions.length} decisions, ${p.issues.length} issues`);
  });
}

// Check compression metrics after phase 3+
if (compressionMetrics) {
  console.log('✓ Compression Results:');
  console.log(`  Original: ${compressionMetrics.originalTokens} tokens`);
  console.log(`  Compressed: ${compressionMetrics.compressedTokens} tokens`);
  console.log(`  Reduction: ${compressionMetrics.reductionPercent.toFixed(1)}%`);
  console.log(`  Cost Saved: $${compressionMetrics.estimatedCostSaved.toFixed(3)}`);
}

console.log('=== All checks complete ===');
```

---

## Integration Checklist

Use this checklist to track your integration:

```
PHASE 2 INTEGRATION CHECKLIST
============================

[ ] STEP 1: Imports
  [ ] Added rlmService imports
  [ ] Added RLMDashboard import
  [ ] Added type imports

[ ] STEP 2: State Variables
  [ ] Added rlmEnabled state
  [ ] Added compressionMetrics state
  [ ] Added currentSnapshot state
  [ ] Added phaseHistory state

[ ] STEP 3: Helper Functions
  [ ] Added extractDecisions()
  [ ] Added extractOpenIssues()
  [ ] Added recordPhaseHistory()
  [ ] Added triggerRLMCompression()

[ ] STEP 4: Agent Task Integration
  [ ] Modified performAgentTask calls
  [ ] Added rlmContext injection
  [ ] Tested with and without RLM

[ ] STEP 5: Phase Completion
  [ ] Call recordPhaseHistory after phase
  [ ] Call triggerRLMCompression after phase 3+
  [ ] Added logging for phase completion

[ ] STEP 6: UI Integration
  [ ] Added RLMDashboard to sidebar
  [ ] Added RLM toggle to settings
  [ ] Tested dashboard rendering

[ ] STEP 7: Testing
  [ ] TEST 1: Single phase (no compression)
  [ ] TEST 2: Three phases (compression triggered)
  [ ] TEST 3: Five phases (max savings)
  [ ] TEST 4: Sub-query functionality

[ ] STEP 8: Validation
  [ ] No TypeScript errors
  [ ] No console warnings
  [ ] Token savings verified
  [ ] Dashboard updates in real-time

DONE! Phase 2 Integration Complete ✅
```

---

## Troubleshooting

### Issue: "Cannot find module 'rlmService'"
**Fix:** Make sure `services/rlmService.ts` exists and path is correct
```typescript
// Check import path
import { ... } from './services/rlmService'; // Correct
import { ... } from '../services/rlmService'; // May be wrong depending on location
```

### Issue: "No compression triggered"
**Fix:** Ensure `recordPhaseHistory()` called after each phase
```typescript
// Should be called after ALL agents in phase complete
recordPhaseHistory(phaseNum, description, agentOutputs);
await triggerRLMCompression(phaseNum); // Phase 3+ only
```

### Issue: "Compression metrics show 0%"
**Fix:** Need at least 3 phases before compression triggers
```typescript
if (phaseHistory.length < 3) {
  return; // Not enough history yet
}
```

### Issue: "Dashboard not rendering"
**Fix:** Check state values passed to component
```typescript
<RLMDashboard
  compressionMetrics={compressionMetrics} // Should be null until phase 3
  snapshot={currentSnapshot}
  isEnabled={rlmEnabled}
  onToggleRLM={setRlmEnabled}
  totalPhases={5}
/>
```

---

## Next Steps

1. Copy snippets 1-7 into App.tsx
2. Update your phase execution loop (snippet 4)
3. Call recordPhaseHistory after each phase completes
4. Run `npm run dev` and test in browser
5. Verify token savings in logs
6. Fix any errors (see Troubleshooting)

---

**Ready?** Start with SNIPPET 1 and work through in order.

**Expected integration time:** 3-4 hours (can finish today!)
