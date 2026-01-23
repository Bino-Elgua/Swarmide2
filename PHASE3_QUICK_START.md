# Phase 3 CCA - Quick Start Guide

## What is Phase 3 CCA?

**CCA = Confucius Code Agent** - Large-scale code analysis system that automatically identifies:
- ✅ Module dependencies and relationships
- ✅ Circular dependencies (architectural anti-patterns)
- ✅ Dead code (unreferenced modules)
- ✅ Refactoring opportunities
- ✅ Modular tool extraction suggestions

---

## How to Use Phase 3

### Step 1: Generate Code
```
1. Go to "Mission Control" tab
2. Enter project prompt (e.g., "Build a React dashboard")
3. Select agents
4. Click "Orchestrate"
5. Wait for code generation to complete
```

### Step 2: Run CCA Analysis
```
1. Click "Terminal Settings" (bottom of screen)
2. Find "Phase 3: CCA Code Auditor" section
3. Click "Run CCA Audit" button
4. Button will show "🔄 Analyzing..." while running
5. Results display below button automatically
```

### Step 3: View Results
The analysis shows 4 key metrics:
- **✓ Modules:** Number of detected code modules/files
- **⚠️ Circular Deps:** Problematic circular dependencies found
- **💀 Dead Code:** Unreferenced modules and unused code
- **🎯 Refactor Ops:** Suggested improvements and fixes

### Step 4: View Full Report
Click the metrics section to open the full CCA Analyzer modal showing:
- **Overview Tab:** Summary statistics and health score
- **Graph Tab:** Visual dependency graph
- **Refactoring Tab:** Detailed refactoring opportunities with effort/risk assessment
- **Tools Tab:** Module extraction suggestions

---

## When to Use Phase 3

✅ **Use CCA when:**
- You've generated significant code (50+ files)
- You want to assess code quality
- You're planning refactoring
- You need to identify technical debt
- You want architecture recommendations

❌ **Skip CCA when:**
- You have very small codebases (<10 files)
- Running analysis repeatedly on unchanged code
- In time-critical workflows (analysis takes 30-60 sec for large projects)

---

## Interpreting Results

### Modules (✓)
**What it means:** Number of distinct code files/modules detected
- 10-20 modules: Small, well-organized project
- 50-100 modules: Medium-sized architecture
- 200+ modules: Large, distributed system

**Action:** More modules = more opportunities for refactoring

### Circular Dependencies (⚠️)
**What it means:** Files that depend on each other (anti-pattern)
- 0: Perfect! No architectural issues
- 1-2: Minor issue, can usually ignore
- 3+: Significant problem, should fix

**Action:** Recommended for breaking via Phase 4 (Ralph Loop)

### Dead Code (💀)
**What it means:** Code that's never imported/used
- 0 files: Excellent code hygiene
- 1-5 files: Normal, minor cleanup needed
- 10+: Significant technical debt

**Action:** Remove or refactor via Phase 4

### Refactoring Opportunities (🎯)
**What it means:** Number of suggested improvements
- 5-10: Few improvements, code is clean
- 15-30: Normal level of technical debt
- 50+: Major refactoring needed

**Action:** Prioritize high-impact opportunities in Phase 4

---

## Full Analyzer Modal Features

### Tabs Overview

**Overview Tab**
- Health score (0-100%)
- Codebase statistics
- Most critical issues
- Quick recommendations

**Graph Tab**
- Visual dependency graph
- Module relationships
- Circular dependency highlights
- Critical path visualization

**Refactoring Tab**
- Detailed opportunities with:
  - Type (circular break, dead code, extract module, etc.)
  - Modules involved
  - Estimated effort (low/medium/high)
  - Risk assessment
  - Estimated savings (LOC)

**Tools Tab**
- Extract module suggestions
- Scope categorization
  - Utility (generic, reusable)
  - Core Feature (business logic)
  - Integration (external connections)
  - Shared Infrastructure (common code)
- Tool extraction effort

---

## Common Workflows

### Workflow 1: Quality Assessment
```
1. Generate code
2. Run CCA Audit
3. Check health metrics
4. Review top 3 refactoring opportunities
5. Decide if code is production-ready
```

### Workflow 2: Refactoring Planning
```
1. Generate code
2. Run CCA Audit
3. Open full analyzer modal
4. Go to "Refactoring" tab
5. Sort by effort (low → high)
6. Export opportunities
7. Use Phase 4 to implement fixes
```

### Workflow 3: Architecture Review
```
1. Generate code
2. Run CCA Audit
3. Open "Graph" tab
4. Review dependency structure
5. Identify anti-patterns
6. Plan module reorganization
7. Execute via Phase 4
```

---

## Troubleshooting

### "CCA: No files to analyze"
**Problem:** No code generated yet
**Solution:** Generate code first (orchestrate a mission)

### Button shows disabled
**Problem:** Analysis already running or no files
**Solution:** Wait for current analysis to complete

### Analysis takes too long
**Problem:** Large codebase (200+ files)
**Solution:** Expected behavior. Analysis typically takes 30-60 seconds for large projects.

### No results shown
**Problem:** Analysis may have failed
**Solution:** Check output log for error messages, try smaller codebase

### Empty modal
**Problem:** Component didn't render
**Solution:** Try closing and re-opening, or refresh page

---

## Tips & Tricks

1. **Progressive Analysis:** Analyze after each major generation
2. **Compare Results:** Track improvements between runs
3. **Effort-Based Planning:** Start with "low effort" refactoring opportunities
4. **Export Reports:** Save reports for documentation/reviews
5. **Phase Integration:** Use Phase 4 (Ralph Loop) to implement suggested refactoring

---

## Next Steps

- **Phase 1:** Conflict resolution & cost tracking (in progress)
- **Phase 2:** RLM context compression (coming Jan 27)
- **Phase 4:** Ralph Loop for automated refactoring (coming Feb 3)
- **Phase 5:** Advanced features like caching & custom rubrics

---

## Architecture Details

**Service Location:** `services/ccaService.ts`
**Component Location:** `components/CCAAnalyzer.tsx`
**Handler Location:** `App.tsx` (lines 371-432)
**UI Location:** `App.tsx` Settings Tab (lines 1263-1283)

**State Management:**
- `ccaEnabled`: Feature enabled/disabled
- `ccaAnalyzing`: Loading indicator
- `ccaResult`: Analysis report data
- `showCCAAnalyzer`: Modal visibility

---

## Performance Expectations

| Project Size | Analysis Time | Bundle Impact |
|-------------|---------------|---------------|
| <10 files | 2-5 sec | Minimal |
| 10-50 files | 5-10 sec | Low |
| 50-200 files | 10-30 sec | Medium |
| 200+ files | 30-60 sec | High |

---

**Phase 3 is now ready to use!**

Start analyzing your generated code today and identify improvement opportunities.

Questions? Check `PHASE3_INTEGRATION_COMPLETE.md` for technical details.
