# Phase 3: CCA Upgrade — Quick Start (5 min)

## What is Phase 3?

**CCA = Cross-Codebase Analysis**

Upgrades Confucius agent to audit large codebases (10k+ lines) and provide:
- Dependency graphs
- Circular dependency detection
- Dead code identification
- Refactoring suggestions
- Tool extraction recommendations

---

## Files Created

✅ **`services/ccaService.ts`** – 400+ lines
  - `buildDependencyGraph()` – Find all imports/exports
  - `identifyRefactoringOpportunities()` – Suggest optimizations
  - `synthesizeToolExtractionCandidates()` – Find reusable modules
  - `generateCCAAuditReport()` – Full audit

✅ **`components/CCAAnalyzer.tsx`** – 500+ lines
  - Beautiful modal UI
  - 4 tabs: Overview, Graph, Refactoring, Tools
  - Interactive recommendations

---

## Integration in 5 Steps

### 1. Update Confucius Config in `constants.ts`

```typescript
// Line ~36 in Confucius definition
intelligenceConfig: { 
  provider: 'google', 
  model: 'gemini-3-pro-preview',
  maxTokens: 16384,  // ← Change from 8192
  topP: 0.95, 
  recursiveRefinement: true, 
  refinementPasses: 5,  // ← Change from 3
  reasoningDepth: 'exhaustive'  // ← Add this line
},
```

### 2. Import in `App.tsx`

```typescript
import { generateCCAAuditReport } from './services/ccaService';
import CCAAnalyzer from './components/CCAAnalyzer';
```

### 3. Add State in `App.tsx`

```typescript
const [ccaReport, setCcaReport] = useState(null);
const [ccaLoading, setCcaLoading] = useState(false);
```

### 4. Add Button in UI

```typescript
<button onClick={async () => {
  const confucius = agents.find(a => a.id === 'reg-confucius');
  setCcaLoading(true);
  try {
    const report = await generateCCAAuditReport(files, confucius);
    setCcaReport(report);
  } finally {
    setCcaLoading(false);
  }
}} className="...">
  CCA Audit
</button>
```

### 5. Render Modal

```typescript
{ccaReport && <CCAAnalyzer report={ccaReport} onDismiss={() => setCcaReport(null)} />}
```

---

## Test It

1. Load a project with 10+ files
2. Click "CCA Audit" button
3. Wait 2-3 minutes
4. See dependency graph, refactoring suggestions, tool extraction ideas

---

## Result

Beautiful audit report showing:
- **Overview:** Files, LOC, complexity, maintainability score
- **Graph:** Dependency visualization, circular deps, dead code
- **Refactoring:** 5-10 actionable optimization opportunities
- **Tools:** 3-5 modules worth extracting as reusable tools

---

## Files Reference

```
SwarmIDE2/
├── services/ccaService.ts         (NEW)
├── components/CCAAnalyzer.tsx      (NEW)
├── PHASE3_CCA_UPGRADE.md          (Full guide - READ THIS)
├── PHASE3_QUICK_START.md          (This file)
├── constants.ts                    (MODIFY: Confucius config)
├── App.tsx                        (MODIFY: Add CCA integration)
└── types.ts                       (Already has all types)
```

---

## Time Estimate

- Read this: 5 min
- Read full guide: 15 min
- Integrate: 45 min
- Test: 1 hour
- **Total: ~2 hours**

---

## Next Steps

1. Read `PHASE3_CCA_UPGRADE.md` for detailed implementation
2. Follow the 5 integration steps above
3. Run the 4 test scenarios
4. Celebrate! 🎉

---

**Status:** Ready to implement  
**Difficulty:** Medium  
**Reward:** High-value architectural audits
