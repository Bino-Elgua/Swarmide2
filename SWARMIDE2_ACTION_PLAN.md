# SwarmIDE2 Action Plan — What To Do Next

**Target:** Launch Phase 1 MVP by Jan 25, 2026  
**Current Status:** 85% complete, needs testing & integration  
**Effort Required:** ~10-15 hours  
**Team:** Solo developer

---

## IMMEDIATE ACTIONS (This Week: Jan 20-26)

### 1️⃣ FINISH PHASE 1 (Priority: CRITICAL)
**Estimated Time:** 8-12 hours  
**Blocker Status:** None — can start immediately

#### 1.1 Test All 10 Scenarios (6 hours)
```bash
npm run dev  # Start dev server on localhost:3000 or 5173
```

**Scenario 1: Single Agent (No Conflict)**
- [ ] Select 1 agent (e.g., Confucius)
- [ ] Enter prompt: "Build a React dashboard"
- [ ] Click "Orchestrate"
- [ ] Verify: No conflict modal appears
- [ ] Verify: 1 proposal returned
- [ ] Verify: Cost tracking shows ~$0.50-1.50
- **Expected Time:** 5 min

**Scenario 2: Two Agents - Voting Strategy**
- [ ] Select 2 agents (Kernel + Scale)
- [ ] Set strategy: "Voting"
- [ ] Enter prompt: "Build a SaaS platform"
- [ ] Click "Orchestrate"
- [ ] Verify: Conflict modal appears with 2 proposals
- [ ] Verify: Voting scores displayed
- [ ] Click "Accept" on winning proposal
- **Expected Time:** 10 min

**Scenario 3-10:** See SWARMIDE2_COMPLETION_STATUS.md for full details

#### 1.2 Fix Bugs Found (2 hours)
- Create GitHub issues for each bug
- Fix highest-impact bugs first

#### 1.3 Polish UI/UX (1 hour)
- Verify no console warnings
- Verify modals centered
- Verify responsive design

#### 1.4 Write User Guide (1-2 hours)
Create documentation covering:
- How to set budget
- How to select resolution strategy
- How to interpret conflict modal

### 2️⃣ INTEGRATE PHASE 3: CCA (2-3 hours)

#### 2.1 Update Confucius Config (15 min)
In `constants.ts`, find Confucius agent:
```typescript
intelligenceConfig: { 
  maxTokens: 16384,          // ← CHANGE FROM 8192
  refinementPasses: 5        // ← CHANGE FROM 3
}
```

#### 2.2 Wire App.tsx (30 min)
```typescript
import { generateCCAAuditReport } from './services/ccaService';
import CCAAnalyzer from './components/CCAAnalyzer';

const [ccaReport, setCcaReport] = useState(null);
const [ccaLoading, setCcaLoading] = useState(false);

const runCCAudit = async () => {
  // Implementation here
};
```

#### 2.3 Test 4 CCA Scenarios (60 min)
- Small project (1k lines)
- Medium project (10k lines)
- Complex dependencies
- Dead code detection

### 3️⃣ WIRE PHASE 5 BASICS (2-3 hours, if time)

#### 3.1 Enable Proposal Cache (1 hour)
#### 3.2 Add Rubric Dropdown (1 hour)
#### 3.3 Test (30 min)

---

## WHAT'S COMPLETE vs LEFT

✅ **COMPLETE (No More Work):**
- All Phase 1 services
- All Phase 1 UI components
- Phase 3 code complete
- Phase 2 service complete

⏳ **NEEDS WORK:**
- Phase 1: Testing (6-8 hours)
- Phase 3: Integration (2-3 hours)
- Phase 5: Wiring (8 hours)
- Phase 2: Implementation (2 weeks)
- Phase 4: Completion (1 week)

---

## SUCCESS CRITERIA

### By Jan 22: Phase 1 Testing Complete
- [ ] 10 scenarios tested and passing
- [ ] Cost tracking accurate
- [ ] Ready for integration

### By Jan 25: MVP Ready to Launch
- [ ] Phase 1 production-ready
- [ ] Phase 3 integrated
- [ ] User guide written

---

**Next Step:** Start with Phase 1 testing (Scenario 1-10)

See SWARMIDE2_COMPLETION_STATUS.md for full details.
