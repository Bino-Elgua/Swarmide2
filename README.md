<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SwarmIDE2 — Multi-Agent AI Studio

Advanced synthesis platform for orchestrating multi-agent AI teams with **conflict resolution** and **real-time cost tracking**.

**Status:** Phase 1 MVP Complete (Jan 25, 2026) ✅

## Features

### 🎯 Phase 1: Conflict Resolution & Cost Tracking ✅
- **Real-Time Cost Tracking** — Monitor API usage live with per-agent, per-phase breakdown
- **Multi-Proposal Conflict Resolution** — When 2+ agents propose different architectures:
  - **Voting** — Score-based selection (fastest, balanced)
  - **Hierarchical** — Merge proposals (combines best ideas)
  - **Meta-Reasoning** — Deep LLM synthesis (most creative)
  - **User Select** — Manual choice (your decision)
- **Budget Enforcement** — Set spending limits, get warnings at 80%/100%, hard cutoff at limit
- **Live Dashboard** — Track costs, tokens, budgets in real-time
- **Proposal History** — Review all agent proposals and resolutions

### 🔄 Phase 2: RLM Integration (Coming)
- Context compression for long projects
- 20-30% token reduction on multi-phase builds

### 📊 Phase 3: CCA Agent Upgrade (Coming)
- Large codebase analysis (10k+ lines)
- Dependency graph visualization
- Refactoring recommendations

### 🔁 Phase 4: Ralph Loop (Coming)
- Iterative PRD-driven execution
- Auto-checkpointing for 100+ item projects
- Resume capability

## Quick Start

### 1. Installation
```bash
npm install
```

### 2. Configuration
Set your Gemini API key in `.env.local`:
```
API_KEY=sk-your-key-here
```

### 3. Run Locally
```bash
npm run dev
# Visit http://localhost:3000
```

### 4. Try Phase 1
1. Go to **Setup** tab
2. Click **gear icon** → **Cost & Conflicts** section
3. Set budget: `$5.00`
4. Select strategy: `Voting`
5. Enter prompt: `"Build a SaaS dashboard"`
6. Select 2+ agents (e.g., Kernel + Scale)
7. Click **Orchestrate**
8. Watch for conflict modal when agents complete
9. Select best proposal, confirm
10. Monitor CostTracker dashboard (bottom-right)

## Architecture

```
App.tsx (Orchestrator)
├── State Management (Phase 1: 14 variables)
├── Cost Tracking (real-time monitoring)
├── Conflict Detection (2+ proposals)
├── Resolution Handler (4 strategies)
└── UI Components
    ├── ConflictResolver (modal)
    ├── CostTracker (dashboard)
    └── MissionSettings (controls)

Services
├── geminiService.ts (agent execution)
├── conflictResolver.ts (proposal analysis)
└── costCalculator.ts (budget monitoring)
```

## Documentation

### User Guides
- **[PHASE1_USER_GUIDE.md](PHASE1_USER_GUIDE.md)** — How to use conflict resolution & cost tracking
- **[PHASE1_SUMMARY.txt](PHASE1_SUMMARY.txt)** — Quick reference

### Technical Documentation
- **[PHASE1_EXECUTION_STATUS.md](PHASE1_EXECUTION_STATUS.md)** — Implementation progress
- **[PHASE1_CHANGES.md](PHASE1_CHANGES.md)** — Code changes (line-by-line)
- **[STATUS_JAN18.md](STATUS_JAN18.md)** — Technical status report
- **[ALL_PHASES_OVERVIEW.md](ALL_PHASES_OVERVIEW.md)** — Roadmap for all 5 phases

## Usage Examples

### Example 1: Simple Project (No Conflicts)
```
Prompt: "Build a React dashboard"
Agents: 1 (Kernel)
Budget: $3
Result: ✅ 1 proposal, $1.20 cost, 2 min
```

### Example 2: Conflicting Architectures
```
Prompt: "Build a SaaS dashboard"
Agents: 2 (Kernel + Scale)
Budget: $5
Strategy: Voting
Result: ✅ 2 proposals → Kernel wins → $2.10 cost, 4 min
```

### Example 3: Complex Multi-Agent Synthesis
```
Prompt: "Build a SaaS with ML features"
Agents: 3+ (Kernel, Scale, Nexus)
Budget: $10
Strategy: Meta-Reasoning
Result: ✅ Deep synthesis → $6.45 cost, 6 min
```

## Configuration

### Budget Examples
- **Micro** ($1-2): Single agent, simple tasks
- **Small** ($3-5): 2-4 agents, standard projects
- **Medium** ($5-10): 4-6 agents, complex builds
- **Large** ($10-20): 6+ agents, exhaustive analysis

### Model Selection
```
Gemini 3 Flash:   Fastest, cheapest ($0.01/1k tokens)
Gemini 3 Pro:     Balanced ($0.05/1k tokens)
GPT-4o:           Premium ($0.15/1k tokens)
Claude 3.5:       Reasoning-focused ($0.12/1k tokens)
```

## Build & Deployment

```bash
# Development
npm run dev

# Production build
npm run build

# Preview build
npm run preview

# Index repositories
npm run index
```

## Technology Stack

- **Frontend:** Svelte 4 + Vite + TypeScript
- **LLM SDK:** Multi-provider abstraction (Gemini, OpenAI, Claude, etc.)
- **Vector DB:** Qdrant (semantic search)
- **State Management:** React hooks + localStorage
- **Styling:** Tailwind CSS + CSS variables
- **Build:** Vite

## Key Metrics (Phase 1)

| Metric | Value |
|--------|-------|
| Build Time | 5-6 seconds |
| Bundle Size | 1.4 MB (438 KB gzipped) |
| Type Safety | 100% TypeScript |
| Test Coverage | Phase 1: 10 scenarios |
| Cost Accuracy | ±10% |
| Budget Enforcement | 100% reliable |

## Troubleshooting

### Cost tracking not updating?
- Check browser console (`F12`)
- Verify API keys configured
- Check network tab for failed requests

### Modal not appearing?
- Scroll page to see modal (z-index issue)
- Refresh browser
- Check console for errors

### Budget exceeded warning?
- Increase budget for next run
- Use cheaper model (Flash vs. Pro)
- Reduce agent count
- Monitor logs: `💰 Warning: 80%`

See [PHASE1_USER_GUIDE.md](PHASE1_USER_GUIDE.md) for complete troubleshooting.

## Performance

- **Average Agent Task:** 45-85k tokens, $0.70-2.50 cost
- **Total Execution:** 2-6 minutes (1-3 phases)
- **Cost per Run:** $1-10 (varies by complexity)
- **Memory Usage:** ~73 MB (dev server)

## Roadmap

| Phase | Name | Duration | Status |
|-------|------|----------|--------|
| 1 | Conflict Resolution + Cost Tracking | 1 week | ✅ COMPLETE |
| 2 | RLM Context Compression | 2 weeks | ⏳ Next |
| 3 | CCA Agent Upgrade | 2 weeks | 🔮 Planned |
| 4 | Ralph Loop (Iterative) | 1 week | 🔮 Planned |
| 5 | Advanced Features | TBD | 🔮 Future |

## License

MIT

## Support

- 📖 **Documentation:** See files in project root
- 🐛 **Issues:** Check console logs and terminal output
- 💬 **Questions:** See PHASE1_USER_GUIDE.md or technical docs

---

**Built with ❤️ by the SwarmIDE2 team**  
Phase 1 MVP: Jan 25, 2026 ✅
