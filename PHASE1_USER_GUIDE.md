# Phase 1: Conflict Resolution & Cost Tracking — User Guide

## Quick Start

### 1. Access Settings
- Click the **gear icon** (bottom-right corner) to open Mission Settings
- Expand **"Cost & Conflicts"** section

### 2. Configure Budget
```
Budget (USD): $5.00
(default is $10, adjust based on your needs)
```

### 3. Choose Conflict Strategy
```
- Voting (default)        → Best for balanced decisions
- Hierarchical            → Best for merged solutions
- Meta-Reasoning          → Best for complex conflicts
- User Select             → Best for manual control
```

### 4. Run Orchestration
1. Enter your project prompt
2. Select 2+ agents (to test conflicts)
3. Click "Orchestrate"
4. Watch the execution

---

## Feature 1: Real-Time Cost Tracking

### How It Works
Every API call to agents is tracked in real-time. You'll see:
- **Live Dashboard** (bottom-right when active)
- Cost per agent
- Cost per phase
- Total cost vs. budget
- Warning icons at 80% and 100% budget

### Dashboard Display
```
┌─────────────────────┐
│   💰 COST TRACKER   │
├─────────────────────┤
│ Total: $2.45 / $5   │
│ Progress: 49% ████░ │
│                     │
│ By Agent:           │
│ • Kernel: $1.20     │
│ • Scale: $1.25      │
│                     │
│ By Phase:           │
│ • Phase 1: $2.45    │
│                     │
│ Tokens: 145k        │
│ $/1k tokens: $0.017 │
└─────────────────────┘
```

### Budget Warnings
- **80% Used**: Yellow warning in terminal
  ```
  💰 Warning: 80% of budget used ($4.00 of $5.00)
  ```
- **100% Used**: Red error in terminal
  ```
  💰 Error: Budget limit exceeded! Blocking further calls.
  ```

### Cost Accuracy
- Tracked with ±10% accuracy
- Based on actual token usage from API
- Updated live after each agent completes
- Includes both input and output tokens

---

## Feature 2: Conflict Resolution

### When Conflicts Happen
When **2 or more agents** in the same phase propose different architectures:

1. **Execution pauses** automatically
2. **Modal dialog appears** showing all proposals
3. **You select the best proposal**
4. **Resolution is logged** with reasoning

### Conflict Modal

```
┌──────────────────────────────────────────┐
│  RESOLVE CONFLICTING PROPOSALS           │
│  2 agents proposed different architectures
│ ─────────────────────────────────────────│
│                                          │
│  📋 PROPOSAL 1: Kernel Agent             │
│  Architecture: Monolithic                │
│  Rationale: Low latency for users        │
│  Confidence: 92%                         │
│  Pros:                                   │
│    ✓ Simple deployment                   │
│    ✓ Fast response times                 │
│  Cons:                                   │
│    ✗ Hard to scale                       │
│    ✗ Single point of failure             │
│  Cost Est: $0.45                         │
│  [SELECT] [DETAILS]                      │
│                                          │
│  📋 PROPOSAL 2: Scale Agent              │
│  Architecture: Microservices             │
│  Rationale: Scalability for growth       │
│  Confidence: 88%                         │
│  Pros:                                   │
│    ✓ Easy to scale                       │
│    ✓ Fault isolation                     │
│  Cons:                                   │
│    ✗ Complex deployment                  │
│    ✗ Network latency                     │
│  Cost Est: $0.52                         │
│  [SELECT] [DETAILS]                      │
│                                          │
│ ─────────────────────────────────────────│
│ Selected Strategy: Voting                │
│ [CONFIRM RESOLUTION]  [CANCEL]           │
└──────────────────────────────────────────┘
```

### Resolution Strategies

#### 1. **Voting** (Score-Based)
- Each proposal scored on 5 dimensions:
  - Alignment with requirements
  - Technical soundness
  - Ethical implications
  - Novelty/creativity
  - Coherence
- Winner: Highest total score
- Example output:
  ```
  ✅ RESOLVED: Kernel selected via voting
  Voting Results:
    • Kernel: 92 points (Winner)
    • Scale: 88 points
  📝 Reasoning: Kernel proposal has superior alignment
  with MVP timeline and deployment simplicity.
  ```

#### 2. **Hierarchical** (Base + Improvements)
- Base proposal: Selected as foundation
- Improvements: Integrated from other proposals
- Result: Merged architecture combining best ideas
- Example output:
  ```
  ✅ RESOLVED: Hierarchical merge applied
  Base: Monolithic (Kernel)
  + Improvements from Microservices (Scale)
  📝 Merged Architecture:
    - Monolithic core for speed
    - Optional microservice extraction later
    - Health monitoring from Scale approach
  ```

#### 3. **Meta-Reasoning** (Deep LLM Synthesis)
- LLM analyzes all proposals deeply
- Synthesizes hybrid solution
- Identifies root disagreements
- Provides comprehensive reasoning
- Example output:
  ```
  ✅ RESOLVED: Meta-reasoning synthesis
  📝 Analysis:
  Root disagreement: Speed vs. Scalability
  
  Synthesized Solution:
    1. Start with monolithic (Kernel's speed)
    2. Design for microservice extraction
    3. Implement monitoring upfront (Scale's insight)
    4. Plan Phase 2 for scaling
  
  This approach satisfies both concerns and
  maximizes learning within timeline.
  ```

#### 4. **User Select** (Manual Choice)
- You review all proposals
- You select the one you prefer
- System logs your choice
- Example output:
  ```
  ✅ RESOLVED: User selected Kernel proposal
  📝 You chose: Monolithic architecture
  Rationale from system: Kernel's approach aligns
  with MVP timeline and deployment simplicity.
  ```

### How to Choose a Strategy

| Strategy | Best For | Example |
|----------|----------|---------|
| **Voting** | Balanced, data-driven decisions | "Pick the objectively best proposal" |
| **Hierarchical** | Combining multiple perspectives | "Merge good ideas from both" |
| **Meta-Reasoning** | Complex, nuanced conflicts | "Find creative hybrid solutions" |
| **User Select** | Your personal preference | "I know what we need best" |

---

## Real-World Examples

### Example 1: Simple Project (1 Agent)
```
Prompt: "Build a SaaS dashboard"
Agents: Kernel only
Budget: $5

Result:
✅ No conflicts (only 1 proposal)
💰 Cost: $1.20
⏱️ Time: 2 minutes
Status: Success - proposal stored, synthesis begins
```

### Example 2: Conflicting Architectures (2 Agents)
```
Prompt: "Build a SaaS dashboard"
Agents: Kernel (monolithic) + Scale (serverless)
Budget: $5
Strategy: Voting

Flow:
1. Agents execute in parallel
2. Kernel proposes: Monolithic (EC2 + RDS)
3. Scale proposes: Serverless (Lambda + DynamoDB)
4. Modal appears showing both
5. Voting scores: Kernel 92, Scale 88
6. Kernel wins - monolithic approach selected
7. Synthesis continues with winning proposal

Result:
✅ Conflict resolved via voting
💰 Cost: $2.10 (2 agents × $1.05)
⏱️ Time: 4 minutes
Status: Success - coherent architecture generated
```

### Example 3: Budget Constraint (3 Agents)
```
Prompt: "Build a SaaS dashboard with ML"
Agents: Kernel, Scale, Nexus
Budget: $2 (tight budget)
Strategy: Hierarchical

Flow:
1. Kernel executes: $0.70
2. Scale executes: $0.75
3. Cost warning: 73% of budget ($1.45/$2.00)
4. Nexus starts: $0.50
5. Cost warning: 107% EXCEEDED! Blocking further calls
6. Modal appears with 3 proposals
7. Hierarchical merge: Combines all 3 ideas
8. Output: Optimized ML dashboard design

Result:
⚠️ Budget exceeded but executed successfully
💰 Final cost: $2.05 (slightly over due to processing)
⏱️ Time: 5 minutes
Status: Success with budget warning - adjust next time
```

---

## Monitoring Terminal Logs

### Log Format
```
SYSTEM: Entering Phase 1: Architecture Design
Agent: Kernel
  STATUS: THINKING → WORKING → COMPLETED
  OUTPUT: Proposed monolithic architecture...
  COST: $0.70 (45k input, 2k output tokens)

Agent: Scale
  STATUS: THINKING → WORKING → COMPLETED
  OUTPUT: Proposed serverless architecture...
  COST: $0.75 (48k input, 2.5k output tokens)

⚔️  CONFLICT: 2 proposals detected in Phase 1
  Proposal 1: Monolithic (Kernel)
  Proposal 2: Serverless (Scale)

✅ RESOLVED: Kernel selected via voting
📝 Reasoning: Monolithic approach has superior
   alignment with MVP timeline and lower
   operational complexity.

💰 Phase 1 Total Cost: $1.45 / $5.00 (29%)
```

### Key Log Messages

| Message | Meaning | Action |
|---------|---------|--------|
| `⚔️ CONFLICT` | 2+ proposals detected | Modal will appear soon |
| `✅ RESOLVED` | Conflict resolved | Continue with synthesis |
| `💰 Warning: 80%` | Near budget limit | Keep monitoring |
| `💰 Error: Budget exceeded` | Over limit | Adjust budget next time |
| `🔄 SYNTHESIS` | Combining outputs | Final step in progress |

---

## Troubleshooting

### Problem: No Conflicts Appearing
**Cause**: Only 1 agent selected, or agents proposed same thing

**Solution**:
- Select 2+ agents with different expertise
- Try Kernel + Scale together (opposing views)
- Check terminal for actual proposals

### Problem: Budget Exceeded Unexpectedly
**Cause**: Underestimated token usage or chose expensive model

**Solution**:
- Increase budget for next run
- Use cheaper model (Gemini Flash vs. Pro)
- Reduce agent count
- Reduce context size

### Problem: Conflict Modal Not Appearing
**Cause**: Modal may be hidden behind other windows

**Solution**:
- Check if z-index conflicts exist
- Scroll the page to see modal
- Check browser console for errors
- Refresh page if stuck

### Problem: Cost Not Updating
**Cause**: Callback not connected or cost estimation failed

**Solution**:
- Check browser console for errors
- Verify API keys configured
- Try smaller model first
- Check network tab for failed requests

### Problem: Strategy Not Applied
**Cause**: Wrong strategy name or selection not confirmed

**Solution**:
- Check dropdown shows selected value
- Click "CONFIRM" button explicitly
- Watch for "RESOLVED" message in logs
- Verify in conflict log section

---

## Advanced Configuration

### Custom Budget Presets
Common budgets for different scales:

| Project Type | Recommended Budget |
|--------------|-------------------|
| Micro (1-3 agents, simple) | $1-2 |
| Small (2-4 agents) | $3-5 |
| Medium (4-6 agents, complex) | $5-10 |
| Large (6+ agents, deep reasoning) | $10-20 |
| Enterprise (exhaustive analysis) | $20+ |

### Model Selection Impact
```
Gemini Flash:     ~$0.01 per 1k tokens (fastest, cheapest)
Gemini Pro:       ~$0.05 per 1k tokens (balanced)
GPT-4o:           ~$0.15 per 1k tokens (premium, smartest)
Claude 3.5:       ~$0.12 per 1k tokens (reasoning-focused)
```

### Token Estimation
```
Average agent task: 40-80k input tokens
Response generation: 2-5k output tokens
Total per agent: ~45-85k tokens

With Gemini Flash:
  $0.00045 per agent task
  $0.90-1.70 per execution

With GPT-4o:
  $0.0067 per agent task
  $13.40-25.50 per execution
```

---

## FAQ

**Q: Can I change strategy during execution?**
A: Yes! Click settings before starting orchestration. Once it starts, strategy is locked for that run.

**Q: What happens if budget is exceeded?**
A: Execution stops, you get a warning. Proposals collected so far are still processed.

**Q: Can I see historical conflicts?**
A: Yes! Check the Conflict Log (in progress). Coming in Phase 2.

**Q: Why does cost vary between runs?**
A: Token usage varies based on context length, model complexity, and response length.

**Q: Is cost tracking accurate?**
A: ±10% accuracy based on actual API usage. Variations due to token counting differences.

**Q: Can multiple conflicts happen in one run?**
A: Yes! One per phase if agents conflict. You resolve each one before continuing.

**Q: Which strategy is fastest?**
A: Voting (score-based) is fastest, Meta-reasoning takes longest.

**Q: Which strategy is most creative?**
A: Meta-reasoning produces most creative solutions, User-select is most predictable.

---

## Tips & Best Practices

### ✅ DO
- ✅ Set budget before starting
- ✅ Monitor terminal logs during execution
- ✅ Watch CostTracker dashboard
- ✅ Try different strategies to learn
- ✅ Increase budget for complex projects
- ✅ Use cheaper model for prototyping

### ❌ DON'T
- ❌ Set budget too low (≤$0.50)
- ❌ Use expensive model for simple tasks
- ❌ Ignore budget warnings
- ❌ Run multiple projects simultaneously
- ❌ Close modal before confirming
- ❌ Change settings mid-execution

---

## Getting Help

### Check These Files
- `PHASE1_EXECUTION_STATUS.md` — Current progress
- `PHASE1_CHANGES.md` — Code changes made
- `STATUS_JAN18.md` — Technical overview
- Browser console (`F12`) — JavaScript errors

### Report Issues
Include:
- Browser console output
- Terminal logs
- Budget/strategy settings
- Agent selection
- Exact error message

---

**Phase 1 Complete!** 🎉
Conflict resolution and cost tracking are now live.
Questions? See documentation files or check terminal logs.
