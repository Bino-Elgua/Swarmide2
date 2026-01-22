# Ralph Loop: Quick Start Guide

## 🚀 60-Second Setup

### Step 1: Enable Ralph Mode
```
Click the green "Ralph" button in Mission Control (bottom left)
```

### Step 2: Enter Your Mission
```
Example: "Build a full-stack SaaS platform with 50 features"
```

### Step 3: Start Ralph Loop
```
Option A: Auto-parse from prompt
  → Click "Ralph Loop" button (auto-generates PRD items)

Option B: Manual PRD entry
  → Click "+ Add PRD Items"
  → Paste your list (one per line or numbered)
  → Click "🚀 Start Ralph Loop"
```

### Step 4: Watch Progress
```
Real-time updates:
  • Progress bar (0-100%)
  • Completed items ✓
  • Remaining items ⏳
  • Iteration counter [N/5]
  • Checkpoints saved automatically
```

## 📋 PRD Format (Any of These Work)

### Format 1: Numbered List
```
1. Build REST API endpoints
2. Setup PostgreSQL database
3. Create React UI components
4. Implement user authentication
5. Deploy to production
```

### Format 2: Bullet List
```
- Build REST API endpoints
- Setup PostgreSQL database
- Create React UI components
- Implement user authentication
- Deploy to production
```

### Format 3: Simple Text
```
Build REST API endpoints
Setup PostgreSQL database
Create React UI components
Implement user authentication
Deploy to production
```

## 🎯 Categories (Auto-Detected)

Your items are automatically categorized:

| Category | Keywords |
|----------|----------|
| **API** | api, backend, rest, endpoint, service |
| **Database** | database, db, schema, migration |
| **Frontend** | frontend, ui, react, component |
| **Auth** | auth, login, jwt, security |
| **Deployment** | deploy, docker, ci/cd, devops |
| **Testing** | test, unit, e2e, jest |
| **Docs** | doc, readme, guide, api-docs |

## 💡 Smart Mode Selection

### **Use Ralph Loop for:**
- ✅ 50+ item projects
- ✅ Long-running missions (>1 hour)
- ✅ Budget-conscious teams
- ✅ Work that needs resuming

### **Use Linear Mode for:**
- ✅ Simple projects (<20 items)
- ✅ Quick prototypes
- ✅ Real-time collaboration
- ✅ When context doesn't matter

## ⚙️ Configuration Profiles

### **Balanced** (Default)
```
Iterations: 5
Speed: Medium
Cost: Moderate ($0.25-0.50)
Quality: High
→ Good for most projects
```

### **Fast** (Budget-Friendly)
```
Iterations: 3
Speed: Very Fast
Cost: Low ($0.10-0.20)
Quality: Moderate
→ Quick prototyping
→ Cost-sensitive
```

### **Thorough** (High Quality)
```
Iterations: 8-10
Speed: Slow
Cost: Higher ($0.50-1.00)
Quality: Very High
→ Complex systems
→ Quality-critical
```

## 🔌 Common Use Cases

### Use Case 1: Full-Stack App (50 items)
```
Mission: "Build a collaboration tool like Figma"
Items:
  1. Authentication & user management
  2. Real-time database sync
  3. React UI components library
  4. WebSocket server setup
  5. File storage integration
  ... (40+ more)

Config: Balanced (5 iterations)
Estimated Time: 2-3 hours
Estimated Cost: $0.25
```

### Use Case 2: Data Pipeline (100+ items)
```
Mission: "ETL pipeline for multi-source data warehouse"
Items:
  1. Extract from API source #1
  2. Extract from API source #2
  ... (25+ API sources)
  26. Transform raw data
  27. Load to data warehouse
  28. Setup monitoring
  ... (70+ more)

Config: Thorough (8 iterations)
Estimated Time: 4-5 hours
Estimated Cost: $0.75
```

### Use Case 3: Mobile App (80 items)
```
Mission: "iOS + Android fitness tracker with cloud sync"
Items:
  1. User authentication
  2. Workout logging UI
  3. Analytics dashboard
  4. Push notifications
  5. Cloud synchronization
  ... (75+ more)

Config: Balanced (5-6 iterations)
Estimated Time: 3-4 hours
Estimated Cost: $0.30
```

## 📊 Progress Tracking

### What You See in Real-Time

```
┌─────────────────────────────┐
│ Ralph Loop Panel (Top-Right)│
├─────────────────────────────┤
│ 🔄 Ralph Loop               │ ← Mode indicator
│ [2/5 iterations]            │ ← Progress
│                             │
│ Completion: 45%             │
│ ████░░░░░░░░░░░░░░░░░░░░  │ ← Progress bar
│ 9 completed | 11 remaining  │
│                             │
│ ✓ Completed:                │
│ • Build REST API            │
│ • Setup PostgreSQL          │
│ +7 more                     │
│                             │
│ ⏳ Remaining:                │
│ • Create React UI           │
│ • Auth system               │
│ +9 more                     │
│                             │
│ 📌 Checkpoints:             │
│ [Iter 1: 40%]               │
│ [Iter 2: 45%]               │
│ 💾 Export All               │
│                             │
│ + Add PRD Items             │
└─────────────────────────────┘
```

## 🛑 Resume from Checkpoint

If you need to pause/resume:

### Save Progress
```
During execution:
1. Checkpoints auto-save each iteration
2. Click "💾 Export All Checkpoints"
3. File downloads: ralph-checkpoints-2025-01-18.json
```

### Resume Later
```
1. Enable Ralph Loop again
2. Click on the checkpoint you want
   Example: [Iter 2: 45%]
3. Click "Ralph Loop" to continue
4. System resumes with remaining items
```

## 🐛 Troubleshooting

### "Ralph Loop not starting"
```
✓ Check: Mission prompt is filled
✓ Check: Ralph button is green (enabled)
✓ Check: No orchestration already running
✓ Fix: Refresh page if stuck
```

### "Items not completing"
```
✓ Reason: Item description too vague
✓ Fix: Split into smaller items
  ❌ "Fix authentication"
  ✅ "Implement JWT validation"
  ✅ "Add password reset flow"
```

### "Progress stuck at X%"
```
✓ Wait: Let iteration finish
✓ Check: Logs for errors
✓ Try: Lower threshold (90% instead of 95%)
✓ Skip: Manually mark as complete if needed
```

### "Cost too high"
```
✓ Solution 1: Use Flash model
  orchestratorConfig.model = 'gemini-3-flash-preview'
  
✓ Solution 2: Fewer iterations
  maxIterations = 3 (instead of 5)
  
✓ Solution 3: Lower threshold
  completionThreshold = 0.90 (instead of 0.95)
```

## 💰 Cost Estimates

### Quick Cost Calculator

**50-item project:**
- Balanced mode (5 iters): ~$0.25 (Gemini) or $0.50 (Claude)
- Cost per item: $0.005 (Gemini) or $0.01 (Claude)

**100-item project:**
- Balanced mode (8 iters): ~$0.40 (Gemini) or $0.80 (Claude)
- Cost per item: $0.004 (Gemini) or $0.008 (Claude)

**vs. Linear mode (no checkpointing):**
- 50 items: $0.75+ (context overflow risk)
- 100 items: $1.50+ (often fails)
- Ralph Loop saves 60-70% ✓

## 📚 Need More Help?

- **Full Guide:** `PHASE_4_5_RALPH_LOOP.md`
- **Checklist:** `PHASE_4_5_IMPLEMENTATION_CHECKLIST.md`
- **Summary:** `PHASE_4_5_SUMMARY.txt`
- **API Docs:** Section 7 of full guide

## ✅ You're Ready!

```
1. ✓ Understand what Ralph Loop does
2. ✓ Know how to enable it
3. ✓ Know PRD format
4. ✓ Know categories
5. ✓ Know cost estimates

→ Click green "Ralph" button now!
→ Try with a 5-item test project
→ Graduate to 50+ items
→ Enjoy 60-70% cost savings!
```

---

**Remember:** Ralph Loop is perfect for large projects. For small projects, use regular mode.

**Pro Tip:** Export checkpoints regularly to avoid losing progress!

Happy building! 🚀
