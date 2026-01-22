# SwarmIDE2 Enhancements — Quick Reference

## 🎯 What's Included

**3 production-ready service files:**

1. **`services/costCalculator.ts`** — Complete cost tracking
2. **`services/conflictResolver.ts`** — Proposal conflict resolution
3. **`ENHANCEMENT_ROADMAP.md`** — Full technical spec + implementation guide

**2 integration checklists:**

1. **`IMPLEMENTATION_CHECKLIST.md`** — Step-by-step rollout (Week 1–3 sprint)
2. **This file** — Quick reference

---

## 📦 What Each Feature Does

### Conflict Resolution (Phase 1)
**Problem:** 4–6 agents propose different architectures → concatenation = incoherent output

**Solution:**
- Each agent outputs structured `ProposalOutput` JSON (architecture, rationale, confidence, tradeoffs, risks)
- Resolver scores proposals on 5 dimensions (alignment, technical, ethics, novelty, coherence)
- 4 resolution strategies:
  - **Voting:** Weighted by score + agent category
  - **Hierarchical:** Engineering base + craft improvements
  - **Meta-reasoning:** Deep reasoning model synthesizes hybrid
  - **User-select:** Present UI modal, let user choose

**Result:** Single coherent architecture + merge reasoning + conflict log

---

### Cost Tracking (Phase 2)
**Problem:** No visibility into API costs → surprise overruns

**Solution:**
- Track input/output tokens for every API call
- Estimate cost per call using live pricing data (Gemini, GPT, Claude)
- Enforce budget caps with real-time warnings
- Recommend model tiering (flash for cheap, pro for quality, opus for reasoning)

**Pricing (Jan 2026):**
| Model | Input | Output |
|-------|-------|--------|
| Gemini Flash | $0.075/M | $0.30/M |
| Gemini Pro | $1.25/M | $5/M |
| GPT-4o | $3/M | $6/M |
| Claude 3.5 | $3/M | $15/M |

**Result:** Cost forecast before run + real-time budget tracking + cost report

---

### RLM Integration (Phase 3)
**Problem:** Long projects (1000+ lines, 5+ phases) hit context window → outputs degrade ("context rot")

**Solution:**
- Compress conversation history into reusable "state snapshots"
- Agents reference compressed state instead of re-reading full history
- Supports "sub-queries" for details when needed
- Reduces tokens without losing coherence

**Result:** Better long-context reliability, cheaper synthesis

---

### CCA Agent Upgrade (Phase 4)
**Problem:** Confucius agent doesn't analyze large codebases well

**Solution:**
- Build cross-file dependency graphs (imports, exports, circular refs)
- Identify dead code, anti-patterns, refactoring opportunities
- Propose modular extraction strategies
- Enable with `archetype: 'expert'` + `reasoningDepth: 'exhaustive'`

**Result:** Better code audits for 10k+ line projects

---

### Ralph Loop (Phase 5)
**Problem:** Full-app builds (100+ PRD items) exceed context in single run

**Solution:**
- Define PRD checklist (API, DB schema, UI, auth, deployment, etc.)
- Run orchestration → execution → check completeness
- If <95% complete, restart fresh with updated context
- Repeat for N iterations (typical: 3–5)

**Result:** Long-running projects complete without context overflow

---

## 🚀 Implementation Timeline

| Week | Phase | Effort | Status |
|------|-------|--------|--------|
| 1 | Conflict + Cost | 5 days | **MVP** (do this first) |
| 2–3 | RLM + CCA (parallel) | 4 weeks | Enhancement (optional) |
| 3 | Ralph | 1 week | Advanced (optional) |

**MVP Deliverable (Week 1):** SwarmIDE with conflict resolution + cost transparency

---

## 📊 Impact on User Experience

### Before
```
User: "Build a SaaS dashboard"
→ Orchestrator recruits Kernel, Scale, Nexus, Confucius
→ All run in parallel, generate conflicting proposals
→ Concatenated output: messy architecture, no cost visibility
→ "Why is this $15? Didn't warn me."
```

### After
```
User: "Build a SaaS dashboard"
Cost Budget: $10
Resolution Strategy: Voting

→ Orchestrator recruits team + estimates cost ($8.50)
→ Phase execution:
  - Kernel proposes: monolith (high perf)
  - Scale proposes: serverless (elasticity)
  - Nexus proposes: event-driven hybrid
→ Voting resolves:
  - Alignment: 85, 80, 90 → Nexus wins
  - Tradeoffs explained in UI modal
→ Merged architecture: Event-driven with fallback to monolith for startup
→ Cost tracking: $0.50 (orch) + $4.20 (phases) + $2.80 (synthesis) = $7.50
→ Report: "2 proposals, voting resolution, $7.50 cost, within $10 budget ✅"
```

---

## 🔌 API Changes Summary

### `performAgentTask()` Signature

**Before:**
```typescript
performAgentTask(
  agent: Agent,
  projectContext: string,
  previousOutputs: string,
  enableMedia?: boolean
): Promise<{ result: string; thoughts: string[]; media?: MediaAsset }>
```

**After:**
```typescript
performAgentTask(
  agent: Agent,
  projectContext: string,
  previousOutputs: string,
  enableMedia?: boolean,
  requestProposal?: boolean,  // NEW
  costTracker?: (metrics: CostMetrics) => void  // NEW callback
): Promise<{ 
  result: string; 
  thoughts: string[]; 
  media?: MediaAsset;
  proposal?: ProposalOutput;  // NEW
  tokensUsed?: number;  // NEW
  costUSD?: number;  // NEW
}>
```

**Migration:** Backward compatible. Existing calls work; new params are optional.

---

## 📁 File Structure After Implementation

```
SwarmIDE2/
├── services/
│   ├── geminiService.ts          (modified: token tracking + proposals)
│   ├── costCalculator.ts         (NEW: ✅ ready)
│   ├── conflictResolver.ts       (NEW: ✅ ready)
│   ├── rlmService.ts            (Phase 3, not yet created)
│   ├── ccaService.ts            (Phase 4, not yet created)
│   └── ralphLoop.ts             (Phase 5, not yet created)
│
├── components/
│   ├── ConflictResolver.tsx      (NEW: Phase 1)
│   ├── CostTracker.tsx           (NEW: Phase 2)
│   └── ... (existing)
│
├── types.ts                      (modified: add ProposalOutput, CostMetrics)
├── App.tsx                       (modified: integration hooks)
│
├── ENHANCEMENT_ROADMAP.md        (NEW: ✅ full spec)
├── IMPLEMENTATION_CHECKLIST.md   (NEW: ✅ step-by-step)
└── QUICK_REFERENCE.md            (NEW: this file)
```

---

## 💡 Implementation Tips

### Tip 1: Start with Cost Tracking
It's **independent** of conflict resolution. Add token counting → cost calc → UI. Takes 1 day, delivers immediate value.

### Tip 2: Use Gemini Flash for Scoring
Don't use expensive models for proposal scoring. `gemini-3-flash-preview` scores 5 proposals in <2s for ~$0.01.

### Tip 3: Make Conflict Resolution Optional
Add `synthesisStrategy` to `ProjectState`. Let users choose (voting, hierarchical, etc.) per project.

### Tip 4: Cache Proposal Scores
If same proposals appear twice, reuse scores. Saves ~$0.02 per run.

### Tip 5: Enable RLM Only for Long Projects
RLM adds complexity. Only enable if `agentCount > 8` or `phasesCount > 4`.

---

## 🧪 Quick Test Scenarios

### Test 1: Single Proposal (No Conflict)
```
Input: 1 agent proposal
Expected: Return proposal as-is, reasoning: "Only one proposal"
```

### Test 2: Voting Resolution
```
Input: 2 proposals (Confucius=95 score, Kernel=78 score)
Expected: Return Confucius, reasoning: "Voting: Confucius 95 > Kernel 78"
```

### Test 3: Cost Warning
```
Input: Budget = $5, Actual = $4.50
Expected: Log warning "🟡 Cost: 90% of budget used"
```

### Test 4: Cost Cutoff
```
Input: Budget = $2, Actual = $2.05
Expected: Block further calls, log error "🔴 Budget exceeded"
```

### Test 5: Model Tiering
```
Input: projectType='software', agentCount=6
Expected: Use 'gemini-3-flash-preview' for tactical, 'gemini-3-pro-preview' for engineering
```

---

## 📈 Expected Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| **Proposal scoring latency** | <2s per proposal | Using gemini-flash |
| **Conflict resolution accuracy** | >85% coherent output | Measured by user satisfaction |
| **Cost forecast accuracy** | ±10% | Depends on model pricing stability |
| **Token efficiency improvement** | +20% (with RLM) | Deferred context folding |
| **E2E latency (4 agents, 3 phases)** | <3 min | With parallelism, Gemini models |

---

## ❓ Common Questions

**Q: Do I need RLM for the MVP?**
A: No. Phase 1+2 are sufficient. RLM is Phase 3 (deferred).

**Q: What if Gemini API is down?**
A: Fallback to OpenAI (GPT-4o) or Claude. Add to `MODEL_PRICING` + routing logic in `costCalculator.ts`.

**Q: Can users override the chosen proposal?**
A: Yes. Set `synthesisStrategy: 'user_select'` to show UI modal before merge.

**Q: How do I handle multi-language code (Python + TypeScript)?**
A: CCA's dependency graph works on AST level. Add language parsers in Phase 4.

**Q: What if a proposal's cost estimate is wrong?**
A: Use actual tokens from API response, not estimate. See `estimateCost()` in `costCalculator.ts`.

---

## 🔗 Related Resources

- **OpenAI Pricing:** https://openai.com/api/pricing
- **Anthropic Pricing:** https://claude.ai/pricing
- **Google Genai Pricing:** https://ai.google.dev/pricing
- **RLM Paper (arxiv):** 2512.24601
- **CCA Paper (arxiv):** 2512.10398
- **Ralph GitHub:** github.com/snarktank/ralph

---

## 📞 Support Contacts

- **Cost Questions?** See `costCalculator.ts` docstrings + pricing table above
- **Conflict Strategies?** See `conflictResolver.ts` + ENHANCEMENT_ROADMAP.md section 1
- **Integration Help?** See IMPLEMENTATION_CHECKLIST.md step-by-step guide

---

**Version:** 1.0 (MVP Ready)  
**Last Updated:** 2026-01-18  
**Status:** Ready for Development Sprint

**Next Steps:** Read `IMPLEMENTATION_CHECKLIST.md` → assign Phase 1 + Phase 2 tasks → merge by EOW.
