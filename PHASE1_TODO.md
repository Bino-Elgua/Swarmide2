# Phase 1 TODO List — Quick Reference

## ✅ COMPLETED (Spend 2.5 Hours)

- [x] **types.ts** — Add ProposalOutput, ConflictResolution, CostMetrics, ProjectStateExtended interfaces
- [x] **geminiService.ts** — Add proposal extraction + token tracking + cost callback
- [x] **ConflictResolver.tsx** — Full proposal comparison modal (280 lines)
- [x] **CostTracker.tsx** — Real-time cost dashboard with budget warnings (120 lines)

---

## ⏳ IN PROGRESS / REMAINING (3 Hours)

### Step 4.1: App.tsx State Management (30 min)

In the `useState` section of `App.tsx`:

```typescript
// Add after existing project state:
const [proposalHistory, setProposalHistory] = useState<ProposalOutput[]>([]);
const [conflictLog, setConflictLog] = useState<ConflictResolution[]>([]);
const [costMetrics, setCostMetrics] = useState<CostMetrics[]>([]);
const [costBudgetUSD, setCostBudgetUSD] = useState<number | undefined>(10); // Default $10
const [costActualUSD, setCostActualUSD] = useState<number>(0);
const [synthesisStrategy, setSynthesisStrategy] = useState<'voting' | 'hierarchical' | 'meta_reasoning' | 'user_select'>('voting');
const [showConflictResolver, setShowConflictResolver] = useState(false);
const [conflictingProposals, setConflictingProposals] = useState<ProposalOutput[]>([]);
const [selectedProposal, setSelectedProposal] = useState<ProposalOutput | undefined>();
const [resolutionReasoning, setResolutionReasoning] = useState<string>('');
```

---

### Step 4.2: Import New Services & Components (10 min)

At top of `App.tsx`:

```typescript
import { resolveConflictingProposals } from './services/conflictResolver';
import { validateBudget } from './services/costCalculator';
import ConflictResolver from './components/ConflictResolver';
import CostTracker from './components/CostTracker';
```

Also update imports from types:
```typescript
import { 
  ProjectState, Agent, ..., 
  ProposalOutput, ConflictResolution, CostMetrics  // ADD THESE
} from './types';
```

---

### Step 4.3: Modify `runExecutionLoop()` Function (1.5 hours)

**Location:** Find the main orchestration/execution loop in App.tsx

**Modifications:**

1. **Cost callback function** (add inside loop):
```typescript
const handleCostMetric = (metric: CostMetrics) => {
  setCostMetrics(prev => [...prev, metric]);
  setCostActualUSD(prev => prev + metric.costUSD);
  
  // Validate budget
  const validation = validateBudget(costActualUSD + metric.costUSD, costBudgetUSD);
  validation.warnings.forEach(w => {
    addLog(`💰 ${w}`);
  });
};
```

2. **Agent task call** (modify performAgentTask calls):

**Before:**
```typescript
const result = await performAgentTask(
  agent,
  projectContext,
  previousOutputs,
  enableMedia
);
```

**After:**
```typescript
const result = await performAgentTask(
  agent,
  projectContext,
  previousOutputs,
  enableMedia,
  true,  // requestProposal = true for Phase 1
  handleCostMetric  // Pass cost callback
);
```

3. **Collect proposals and detect conflicts** (add after agent calls):
```typescript
const phaseProposals: ProposalOutput[] = [];
results.forEach(result => {
  if (result.proposal) {
    phaseProposals.push(result.proposal);
  }
});

// Add to history
setProposalHistory(prev => [...prev, ...phaseProposals]);

// Detect conflict (2+ proposals)
if (phaseProposals.length > 1) {
  addLog(`⚔️ CONFLICT: ${phaseProposals.length} proposals detected in Phase ${phaseIndex + 1}`);
  setConflictingProposals(phaseProposals);
  setShowConflictResolver(true);
  
  // PAUSE HERE: Wait for user to select proposal
  // (Implementation: modal will update selectedProposal)
}
```

4. **Resolve conflict after user selection** (add in conflict resolution handler):
```typescript
const handleConflictResolution = async () => {
  if (!selectedProposal || conflictingProposals.length === 0) return;
  
  const resolution = await resolveConflictingProposals(
    conflictingProposals,
    synthesisStrategy,
    project.prompt,
    project.agents
  );
  
  // Log resolution
  addLog(`✅ RESOLVED: ${selectedProposal.agentName} selected`);
  addLog(`📝 Reasoning: ${resolution.reasoning}`);
  
  // Store in conflict log
  setConflictLog(prev => [...prev, {
    strategy: synthesisStrategy,
    selectedProposal,
    alternates: conflictingProposals.filter(p => p.id !== selectedProposal.id),
    reasoning: resolution.reasoning,
    mergedArchitecture: resolution.merged || selectedProposal.architecture
  }]);
  
  // Close modal
  setShowConflictResolver(false);
};
```

---

### Step 4.4: Update UI (30 min)

1. **Import components** (already done in Step 4.2)

2. **Add MissionSettings fields** (in MissionSettings.tsx):
```typescript
// Add to props:
costBudgetUSD?: number;
synthesisStrategy: string;
onCostBudgetChange: (budget: number) => void;
onSynthesisStrategyChange: (strategy: string) => void;

// Add form inputs:
<div className="space-y-2">
  <label className="text-xs font-bold">Budget (USD)</label>
  <input 
    type="number" 
    value={costBudgetUSD || ''} 
    onChange={e => onCostBudgetChange(parseFloat(e.target.value))}
    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white"
  />
</div>

<div className="space-y-2">
  <label className="text-xs font-bold">Conflict Strategy</label>
  <select 
    value={synthesisStrategy} 
    onChange={e => onSynthesisStrategyChange(e.target.value)}
    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white"
  >
    <option value="voting">Voting</option>
    <option value="hierarchical">Hierarchical</option>
    <option value="meta_reasoning">Meta-Reasoning</option>
    <option value="user_select">User Select</option>
  </select>
</div>
```

3. **Render ConflictResolver modal** (in main render, e.g., after AgentLiveFeed):
```typescript
<ConflictResolver
  isOpen={showConflictResolver}
  proposals={conflictingProposals}
  selectedProposal={selectedProposal}
  resolution={resolutionReasoning}
  onSelectProposal={setSelectedProposal}
  onClose={() => setShowConflictResolver(false)}
  onConfirm={handleConflictResolution}
/>
```

4. **Render CostTracker** (in sidebar/panel area):
```typescript
<CostTracker
  metrics={costMetrics}
  budgetUSD={costBudgetUSD}
/>
```

---

## 🧪 Testing Checklist

### Manual Tests

- [ ] **No Proposals**
  - [ ] Run with 1 agent
  - [ ] Verify no modal appears
  - [ ] Cost tracking works

- [ ] **Single Proposal**
  - [ ] Run with 1 agent requesting proposal
  - [ ] Verify proposal stored in history
  - [ ] No modal shown

- [ ] **2 Conflicting Proposals**
  - [ ] Run with 2 agents
  - [ ] Verify ConflictResolver modal appears
  - [ ] Click each proposal, expand/collapse
  - [ ] Select one, click Confirm
  - [ ] Verify resolution logged

- [ ] **Cost Tracking**
  - [ ] Set budget to $5
  - [ ] Run orchestration
  - [ ] Verify CostTracker updates live
  - [ ] Check cost per agent
  - [ ] Verify total matches sum

- [ ] **Budget Warning**
  - [ ] Set budget to $1
  - [ ] Run small orchestration (use flash model)
  - [ ] Verify "80% budget" warning at ~$0.80
  - [ ] CostTracker shows amber bar

- [ ] **Budget Exceeded**
  - [ ] Set budget to $0.50
  - [ ] Run orchestration
  - [ ] Verify red warning when exceeded
  - [ ] Check that further calls are blocked

- [ ] **Voting Strategy**
  - [ ] Set synthesisStrategy to 'voting'
  - [ ] Run with 3 proposals
  - [ ] Verify winner determined by score
  - [ ] Check reasoning logged

---

## 📊 Code Checklist

- [ ] All imports added to App.tsx
- [ ] All new state variables declared
- [ ] Cost callback implemented
- [ ] performAgentTask calls updated with requestProposal=true
- [ ] Proposal collection logic added
- [ ] Conflict detection logic added
- [ ] ConflictResolver modal integrated
- [ ] CostTracker component integrated
- [ ] MissionSettings updated with budget/strategy inputs
- [ ] No TypeScript errors
- [ ] No console warnings

---

## 🎯 Success Criteria

**Phase 1 Complete When:**

1. ✅ Types defined (DONE)
2. ✅ Services updated (DONE)
3. ✅ Components created (DONE)
4. ⏳ App.tsx integrated (IN PROGRESS)
5. ⏳ UI renders without errors
6. ⏳ Manual tests pass
7. ⏳ Conflicts resolved via modal
8. ⏳ Costs tracked accurately
9. ⏳ Budget warnings work
10. ⏳ README updated

---

## 🚀 Quick Command Reference

```bash
# Start dev server
npm run dev

# Check for TypeScript errors
npm run build

# Manual testing checklist
# 1. Go to browser: http://localhost:1111
# 2. Enter prompt (e.g., "Build a SaaS dashboard")
# 3. Set budget: $5, Strategy: Voting
# 4. Click "Orchestrate"
# 5. Watch for conflicts modal
# 6. Observe CostTracker in sidebar
# 7. Select proposal, click Confirm
# 8. Verify logs show resolution
```

---

## ⏱️ Time Estimate

| Task | Time | Status |
|------|------|--------|
| State management | 30 min | ⏳ TODO |
| Service imports | 10 min | ⏳ TODO |
| Loop modification | 1.5 hours | ⏳ TODO |
| UI integration | 30 min | ⏳ TODO |
| Testing | 1+ hours | ⏳ TODO |
| **TOTAL** | **~3.5 hours** | **⏳ REMAINING** |

---

**Last Updated:** Jan 18, 2026  
**Next Review:** After App.tsx integration  
**Blockers:** None
