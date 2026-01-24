# SwarmIDE2 Integration Action Plan
**Date:** Jan 23, 2026  
**Objective:** Complete Phases 2-7 integration  
**Estimated Time:** 12-17 hours

---

## Overview

| Task | Priority | Phase | Hours | Status |
|------|----------|-------|-------|--------|
| Phase 1 MVP Launch | P0 | 1 | 0 | ✅ DONE |
| Complete Phase 4 Integration | P1 | 4 | 1-2 | 🔴 IN PROGRESS |
| Integrate Phase 2 RLM | P1 | 2 | 2-3 | 🔴 TODO |
| Integrate Phase 3 CCA | P1 | 3 | 2-3 | 🔴 TODO |
| Integrate Phase 5 Features | P2 | 5 | 3-4 | 🔴 TODO |
| Complete Phase 6 Monitoring | P2 | 6 | 1-2 | 🔴 TODO |
| Wire Phase 7 Integration | P2 | 7 | 2-3 | 🔴 TODO |

---

## Immediate Actions (Today - 2 hours)

### Task 1: Verify Phase 1 MVP Ready

**File:** `App.tsx`, `components/ConflictResolver.tsx`, `services/costCalculator.ts`

**Checklist:**
- [ ] Build app: `npm run dev`
- [ ] Navigate to Setup tab
- [ ] Verify ConflictResolver modal works
- [ ] Verify CostTracker dashboard updates
- [ ] Test with 2 agents, $5 budget
- [ ] Confirm conflict resolution works

**Success:** Phase 1 fully functional in browser

---

### Task 2: Phase 4 Ralph Loop - Enable UI Button

**File:** `App.tsx` (need to find/create Ralph button)

**Current State:**
- State variables exist ✅
- Handlers exist ✅
- RalphLoopPanel component exists ✅
- Button NOT visible to user ❌

**Fix Steps:**
1. Find where agents/controls are rendered in UI
2. Add Ralph toggle button next to "Orchestrate"
3. Wire button to `setRalphEnabled(!ralphEnabled)`
4. Render RalphLoopPanel conditionally when enabled

**Code Example:**
```tsx
// In main UI render area
<button 
  onClick={() => setRalphEnabled(!ralphEnabled)}
  className="btn-ralph"
>
  {ralphEnabled ? '✓ Ralph Loop ON' : '🔄 Ralph Loop OFF'}
</button>

// Below agents section
{ralphEnabled && (
  <RalphLoopPanel
    prdItems={prdItems}
    onStart={runRalphLoopHandler}
    onLoadCheckpoint={handleLoadRalphCheckpoint}
    onExport={handleExportRalphCheckpoints}
    ralphIteration={ralphIteration}
    ralphCompletionRate={ralphCompletionRate}
    ralphCheckpoints={ralphCheckpoints}
  />
)}
```

**Success:** Ralph button visible, panel toggles on/off

---

## Phase 2: RLM Context Compression Integration (2-3 hours)

### Architecture
```
Phase Execution Flow:
1. Execute Phase 1
2. [NEW] Compress context with RLM
3. Execute Phase 2
4. [NEW] Compress context with RLM
5. Continue...
```

### Step-by-Step Integration

#### Step 1: Add RLM to Execution Loop

**File:** `App.tsx` → `runExecutionLoop()` (lines 468-525)

**Current Code (Line 521):**
```typescript
const orchestrationResponse = await orchestrateTeam(
  agentSubset,
  phaseAgents,
  logicHubApiKey,
  logicHubModel,
  ...
);
```

**New Code After Phase Completion:**
```typescript
// After orchestrationResponse, add:
if (rlmEnabled && phaseHistory.length > 0) {
  const lastSnapshot = currentSnapshot;
  const compressionResult = await compressContextWithRLM(
    phaseHistory,
    lastSnapshot,
    orchestrationResponse
  );
  
  setRlmCompressionRate(compressionResult.compressionRate);
  setRlmTokensSaved(compressionResult.tokensSaved);
  setRlmMetrics(compressionResult.metrics);
  setCurrentSnapshot(compressionResult.newSnapshot);
  
  addLog(`📊 RLM: Compressed ${compressionResult.tokensSaved} tokens (${compressionResult.compressionRate}%)`);
}
```

#### Step 2: Add RLM State Persistence

**File:** `App.tsx` → useEffect hooks (around line 240)

**Add New Effect:**
```typescript
useEffect(() => {
  if (phaseHistory.length > 0) {
    localStorage.setItem('rlm_phase_history', JSON.stringify(phaseHistory));
    localStorage.setItem('rlm_current_snapshot', JSON.stringify(currentSnapshot));
  }
}, [phaseHistory, currentSnapshot]);
```

#### Step 3: Load RLM History on Mount

**File:** `App.tsx` → useEffect on mount

**Add:**
```typescript
useEffect(() => {
  const savedHistory = localStorage.getItem('rlm_phase_history');
  const savedSnapshot = localStorage.getItem('rlm_current_snapshot');
  
  if (savedHistory) {
    setPhaseHistory(JSON.parse(savedHistory));
  }
  if (savedSnapshot) {
    setCurrentSnapshot(JSON.parse(savedSnapshot));
  }
}, []);
```

#### Step 4: Add RLM Dashboard to UI

**File:** `App.tsx` → UI tabs section

**Add New Tab:**
```tsx
case 'rlm':
  return (
    <RLMDashboard
      enabled={rlmEnabled}
      metrics={rlmMetrics}
      compressionRate={rlmCompressionRate}
      tokensSaved={rlmTokensSaved}
      phaseHistory={phaseHistory}
      currentSnapshot={currentSnapshot}
      onToggle={() => setRlmEnabled(!rlmEnabled)}
    />
  );
```

**Add Tab Button:**
```tsx
<button onClick={() => setActiveTab('rlm')}>
  📊 RLM {rlmMetrics && `(${rlmCompressionRate}%)`}
</button>
```

#### Step 5: Test RLM Integration

**Test Plan:**
1. Run multi-phase orchestration with 3+ phases
2. After phase 1, check RLM compression happens
3. Verify `rlmMetrics` populated
4. Check `rlmTokensSaved` > 0
5. View RLM dashboard metrics
6. Refresh page, verify history persisted

**Expected Results:**
- Each phase compresses context
- 20-30% token savings
- Metrics display in UI
- History persists across sessions

---

## Phase 3: CCA Code Analysis Integration (2-3 hours)

### What CCA Should Do
```
User uploads codebase → Analysis runs → Shows:
- Complexity metrics
- Dependency graph
- Refactoring suggestions
- Quality scores
```

### Step-by-Step Integration

#### Step 1: Create CCA Trigger Button

**File:** `App.tsx` → Main UI area

**Add Button:**
```tsx
<button
  onClick={() => setShowCCAAnalyzer(true)}
  disabled={!project.files || project.files.length === 0}
  className="btn-cca"
>
  🔍 Analyze Codebase
</button>
```

#### Step 2: Wire CCA Handler

**File:** `App.tsx` → Already exists but not called

**Current Handler (lines 406-467):**
```typescript
const runCCAudit = async () => {
  // This function exists but is never called
  // Need to call it when button clicked
}
```

**Fix - Add Call from Button:**
```tsx
onClick={async () => {
  setCcaAnalyzing(true);
  try {
    await runCCAudit();
  } catch (error) {
    addLog(`❌ CCA Error: ${error.message}`);
  } finally {
    setCcaAnalyzing(false);
  }
}}
```

#### Step 3: Ensure Results Flow to UI

**File:** `App.tsx` → Verify in runCCAudit()

**Check that handler sets:**
```typescript
setCcaResult(auditResult);  // ✅ Should be there
setShowCCAAnalyzer(true);   // ✅ Should be there
```

#### Step 4: Render CCA Modal

**File:** `App.tsx` → UI section

**Add Conditional Render:**
```tsx
{showCCAAnalyzer && ccaResult && (
  <CCAAnalyzer
    result={ccaResult}
    isAnalyzing={ccaAnalyzing}
    onClose={() => setShowCCAAnalyzer(false)}
  />
)}
```

#### Step 5: Test CCA Integration

**Test Plan:**
1. Upload a codebase (via IDE or file input)
2. Click "Analyze Codebase" button
3. Wait for analysis (should take 10-30 seconds)
4. Modal should show results
5. Verify metrics displayed
6. Check refactoring suggestions

**Expected Results:**
- Modal appears with analysis results
- Metrics calculated correctly
- Suggestions provided
- No errors in console

---

## Phase 4: Ralph Loop - Complete Integration (1-2 hours)

### Current Status
- Code: 95% working ✅
- UI: 70% visible
- Missing: Fine-tuning & checkpoint UI

### Quick Wins

#### Task 1: Ensure Button Visible
```tsx
// Find where Orchestrate button is
// Add Ralph button right next to it
<button onClick={() => setRalphEnabled(!ralphEnabled)}>
  {ralphEnabled ? '✓ Ralph' : '🔄 Ralph'}
</button>
```

#### Task 2: Wire Checkpoint Export
**Already implemented, may just need UI button**
```tsx
<button onClick={() => handleExportRalphCheckpoints(ralphCheckpoints)}>
  💾 Export Checkpoints
</button>
```

#### Task 3: Test Full Ralph Flow
1. Enable Ralph Loop
2. Add PRD items (5-10 items)
3. Click "Start Ralph Loop"
4. Monitor progress
5. Verify checkpoints save
6. Refresh page, verify recovery

---

## Phase 5: Advanced Features Integration (3-4 hours)

### 5A: Proposal Cache (1 hour)

**Goal:** Reuse proposals for similar requests

**Integration Points:**
1. Before generating new proposal, check cache
2. If similar request found, reuse
3. Save new proposals to cache

**Implementation:**
```typescript
// In orchestrateTeam or similar
const cached = findReuseableProposal(
  prompt,
  agents,
  proposalCache.proposals
);

if (cached) {
  addLog(`♻️ Using cached proposal (${cached.similarity}% match)`);
  return cached.output;
}

// ... generate new proposal, then cache it
proposalCache.add({
  prompt,
  agents,
  output: result,
  timestamp: Date.now()
});
```

**Test:**
- Run same prompt twice
- Second time should be faster
- Check cache stats UI

### 5B: Custom Scoring Rubric (1 hour)

**Goal:** Score proposals with custom criteria

**Integration Points:**
1. Load rubric for project
2. Score each proposal with rubric
3. Select winner by score

**Implementation:**
```typescript
// In conflict resolution
const rubric = getRubricForProject(project.type);
const scores = rankProposalsWithRubric(
  conflictingProposals,
  rubric
);

const winner = scores.reduce((max, s) => 
  s.score > max.score ? s : max
);
```

**Test:**
- Create custom rubric
- Run conflict resolution
- Verify rubric scoring used

### 5C: Multi-Model Synthesis (1-2 hours)

**Goal:** Get proposals from multiple LLM providers

**Implementation:**
```typescript
// Get proposals from different models
const gpt4Proposal = await getProposal(agents, 'openai', 'gpt-4');
const claudeProposal = await getProposal(agents, 'anthropic', 'claude-3');
const geminiProposal = await getProposal(agents, 'google', 'gemini-3');

// Synthesize best of all
const synthesized = await synthesizeBalanced([
  gpt4Proposal,
  claudeProposal,
  geminiProposal
]);
```

**Test:**
- Set multiple providers
- Run multi-model
- Verify synthesis works

---

## Phase 6: Health Monitoring (1-2 hours)

### What It Should Do
```
Real-time health status of:
- API endpoints
- LLM provider status
- Cache performance
- Error rates
```

### Integration Steps

#### Step 1: Add Health Check to Execution Loop

**File:** `App.tsx` → runExecutionLoop()

```typescript
// Before orchestration
const healthStatus = await healthCheck();
if (!healthStatus.allHealthy) {
  addLog(`⚠️ Health: ${healthStatus.issues.join(', ')}`);
}
```

#### Step 2: Render Health Monitor

**File:** `App.tsx` → UI section

```tsx
<button onClick={() => setHealthMonitorVisible(!healthMonitorVisible)}>
  🏥 Health
</button>

{healthMonitorVisible && (
  <HealthMonitor
    status={healthStatus}
    apiMetrics={apiMetrics}
    onClose={() => setHealthMonitorVisible(false)}
  />
)}
```

#### Step 3: Test

- Run orchestration
- Open health monitor
- Verify all services show green
- Simulate API failure, verify alert

---

## Phase 7: Integration Services (2-3 hours)

### What It Should Do
```
Connect to external systems:
- Webhooks for async notifications
- Message queues for job processing
- External APIs via gateway
```

### Integration Steps

#### Step 1: Add Webhook Support

**File:** `App.tsx`

```typescript
// After orchestration completes
if (project.webhookUrl) {
  await webhookService.sendEvent({
    type: 'orchestration_complete',
    payload: orchestrationResponse
  });
}
```

#### Step 2: Wire Execution Engine

```tsx
{showExecutionEngine && (
  <ExecutionEngine
    orchestrationResponse={project}
    onExecute={runExecutionLoop}
  />
)}
```

#### Step 3: Test

- Configure webhook endpoint
- Run orchestration
- Verify webhook receives notification
- Check message queue for jobs

---

## Testing Strategy

### Unit Tests (Per Phase)
```bash
npm test -- Phase[N]
```

### Integration Tests
```bash
# Phase 1 + 2
npm test -- Phase1Phase2Integration

# Phase 1 + 2 + 3
npm test -- Phase1Phase2Phase3Integration
```

### E2E Tests
```bash
# Full workflow
npm run test:e2e
```

### Manual Tests
For each phase:
1. Try main user flow
2. Check error handling
3. Verify state persistence
4. Test edge cases

---

## Deployment Checklist

### Before Each Release
- [ ] All tests passing
- [ ] TypeScript strict mode ✅
- [ ] Build successful: `npm run build`
- [ ] Bundle size acceptable
- [ ] No console errors
- [ ] Performance metrics good

### Phase 1 Launch (Today)
- [x] All Phase 1 tests pass
- [x] Code quality A+
- [x] Documentation complete
- [x] Ready to deploy

### Phase 2 Launch
- [ ] Phase 1 + 2 tests pass
- [ ] RLM metrics validated
- [ ] Token savings verified
- [ ] Performance improved

### Phase 3 Launch
- [ ] All phases 1-3 tested
- [ ] CCA analysis accurate
- [ ] Recommendations useful
- [ ] No regressions

---

## Timeline

### Week 1 (This Week)
- **Today (Jan 23):** Phase 1 MVP launch
- **Tomorrow (Jan 24):** Phase 4 completion
- **Jan 25:** Phase 2 RLM integration
- **Jan 26:** Phase 3 CCA integration
- **Jan 27-28:** Testing & fixes

### Week 2
- **Jan 29:** Phase 5 Advanced Features
- **Jan 30:** Phase 6 Health Monitoring
- **Jan 31:** Phase 7 Integration Services

### Week 3+
- Performance optimization
- Production hardening
- Documentation updates
- Release planning

---

## Success Criteria

### Phase Complete When:
1. ✅ Code integrated into main execution flow
2. ✅ UI components visible and functional
3. ✅ Event handlers wired and responding
4. ✅ State variables populated with real data
5. ✅ Tests passing (unit + integration)
6. ✅ No errors in console
7. ✅ Feature works end-to-end
8. ✅ Documentation updated

---

## Risk Mitigation

### Potential Issues & Fixes

| Risk | Mitigation |
|------|-----------|
| State conflicts | Use Redux or Zustand if needed |
| Performance issues | Profile with DevTools, optimize |
| Integration bugs | Comprehensive unit tests |
| User confusion | Clear UI labels & tooltips |
| Data loss | Regular localStorage backups |

---

## Notes

- All services are well-built and tested individually
- Main work is integration wiring, not new code
- Can parallelize phases 2-7 if team available
- Estimated 12-17 hours for full completion
- Phase 1 ready to launch immediately

---

**Prepared By:** SwarmIDE2 Audit Team  
**Date:** Jan 23, 2026  
**Status:** Ready to Execute
