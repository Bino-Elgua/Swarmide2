# Phase 3 Integration Checklist

**Project:** SwarmIDE2 CCA Upgrade  
**Date Started:** Jan 18, 2026  
**Target Completion:** Jan 20-22, 2026  
**Estimated Time:** 2-3 hours

---

## Pre-Integration (Read These First)

- [ ] Read `PHASE3_QUICK_START.md` (5 min)
- [ ] Read `PHASE3_CCA_UPGRADE.md` (15 min)
- [ ] Understand the 3 main functions in `ccaService.ts`
- [ ] Verify npm dependencies are installed (`npm install`)
- [ ] Verify `.env` has valid Gemini API key

---

## Step 1: Update Confucius Agent Config (15 minutes)

**File:** `SwarmIDE2/constants.ts`  
**Lines:** ~30-45 (Confucius agent definition)

### Changes Required:

```diff
  intelligenceConfig: { 
    provider: 'google', 
    model: 'gemini-3-pro-preview',
-   maxTokens: 8192, 
+   maxTokens: 16384,
    topP: 0.9, 
    recursiveRefinement: true, 
-   refinementPasses: 3 
+   refinementPasses: 5,
+   reasoningDepth: 'exhaustive'
  },
```

Also update tasks:

```diff
  tasks: [
-   { id: 'cca1', label: 'Execute Wisdom Refinement pass on project architecture' },
-   { id: 'cca2', label: 'Audit logic against recursive invariants' },
-   { id: 'cca3', label: 'Map dependency graphs for circular reference detection' },
-   { id: 'cca4', label: 'Evaluate algorithmic complexity using Big O metrics' },
-   { id: 'cca5', label: 'Synthesize optimal design pattern recommendations' }
+   { id: 'cca1', label: 'Build cross-file dependency graph' },
+   { id: 'cca2', label: 'Identify circular deps, dead code, anti-patterns' },
+   { id: 'cca3', label: 'Propose refactoring modularization strategy' },
+   { id: 'cca4', label: 'Evaluate algorithmic complexity using Big O metrics' },
+   { id: 'cca5', label: 'Synthesize optimal design pattern recommendations' }
  ],
```

And add archetype:

```diff
+   archetype: 'expert',
    personality: 'Deeply philosophical...'
```

### Verification:
```bash
# Run these commands to verify changes
grep "maxTokens: 16384" SwarmIDE2/constants.ts
grep "reasoningDepth: 'exhaustive'" SwarmIDE2/constants.ts
grep "archetype: 'expert'" SwarmIDE2/constants.ts
```

**Checklist:**
- [ ] `maxTokens` changed to 16384
- [ ] `refinementPasses` changed to 5
- [ ] `reasoningDepth: 'exhaustive'` added
- [ ] `archetype: 'expert'` added
- [ ] Tasks updated (cca1-cca5)
- [ ] No TypeScript errors after save
- [ ] No duplicate properties

---

## Step 2: Import CCA Services in App.tsx (10 minutes)

**File:** `SwarmIDE2/App.tsx`  
**Location:** Top of file with other imports

### Add These Imports:

```typescript
import { 
  generateCCAAuditReport,
  type CCAAuditReport,
  type ModuleGraph,
  type RefactoringOpportunity,
  type ToolExtractionSuggestion
} from './services/ccaService';
import CCAAnalyzer from './components/CCAAnalyzer';
```

### Verification:
```bash
grep "import.*ccaService" SwarmIDE2/App.tsx
grep "import.*CCAAnalyzer" SwarmIDE2/App.tsx
```

**Checklist:**
- [ ] Imports added to top of App.tsx
- [ ] No "Cannot find module" errors
- [ ] TypeScript recognizes CCA types

---

## Step 3: Add State Variables in App.tsx (5 minutes)

**Location:** Where you define other state (e.g., near `const [agents, setAgents]`)

### Add These State Variables:

```typescript
const [ccaReport, setCcaReport] = useState<CCAAuditReport | null>(null);
const [ccaLoading, setCcaLoading] = useState(false);
const [ccaError, setCcaError] = useState<string | null>(null);
```

### Verification:
```bash
grep "const \[ccaReport" SwarmIDE2/App.tsx
grep "const \[ccaLoading" SwarmIDE2/App.tsx
```

**Checklist:**
- [ ] State variables added
- [ ] Proper TypeScript types used
- [ ] No duplicate state variable names
- [ ] Initial values are correct

---

## Step 4: Add CCA Audit Button to UI (20 minutes)

**Location:** In your render function, in the sidebar or agent control panel

### Add Button Code:

```typescript
{/* CCA Audit Button */}
<button
  onClick={async () => {
    const confucius = agents.find(a => a.id === 'reg-confucius');
    
    if (!confucius) {
      setCcaError('Confucius agent not found');
      return;
    }
    
    if (files.length === 0) {
      setCcaError('No files loaded. Upload a project first.');
      return;
    }
    
    setCcaLoading(true);
    setCcaError(null);
    
    try {
      const report = await generateCCAAuditReport(files, confucius);
      setCcaReport(report);
    } catch (err) {
      console.error('CCA audit failed:', err);
      setCcaError(`Audit failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setCcaLoading(false);
    }
  }}
  disabled={ccaLoading || files.length === 0}
  className={`
    px-4 py-2 rounded-lg font-black transition flex items-center gap-2
    ${ccaLoading || files.length === 0
      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
      : 'bg-amber-600 hover:bg-amber-500 text-white'
    }
  `}
  title={files.length === 0 ? 'Load files first' : 'Analyze codebase dependencies'}
>
  <i className="fa-solid fa-microscope" />
  {ccaLoading ? 'Analyzing...' : 'CCA Audit'}
</button>
```

### Optional: Error Display

```typescript
{ccaError && (
  <div className="mt-2 p-3 bg-red-900/30 border border-red-600 rounded-lg text-red-300 text-sm">
    {ccaError}
  </div>
)}
```

### Verification:
- [ ] Button appears in UI
- [ ] Button is disabled when no files loaded
- [ ] Button shows "Analyzing..." during audit
- [ ] Error messages display correctly
- [ ] TypeScript errors resolved

---

## Step 5: Render CCA Modal Component (10 minutes)

**Location:** At the end of your render function (before closing fragment/container)

### Add Modal Code:

```typescript
{/* CCA Analyzer Modal */}
{ccaReport && (
  <CCAAnalyzer 
    report={ccaReport}
    isLoading={ccaLoading}
    onDismiss={() => {
      setCcaReport(null);
      setCcaError(null);
    }}
  />
)}
```

### Verification:
- [ ] Modal appears when `ccaReport` is set
- [ ] Modal disappears when dismissed
- [ ] No z-index conflicts with other modals
- [ ] Close button works

---

## Step 6: Test Basic Integration (15 minutes)

### Quick Test:

1. **Compile Check**
   ```bash
   npm run build
   ```
   - [ ] Build succeeds without errors
   - [ ] No TypeScript errors
   - [ ] No warnings about missing imports

2. **Dev Server Test**
   ```bash
   npm run dev
   ```
   - [ ] Server starts without errors
   - [ ] App loads in browser
   - [ ] No console errors on page load

3. **UI Test**
   - [ ] CCA Audit button visible
   - [ ] Button is disabled (no files loaded)
   - [ ] No console warnings

---

## Step 7: Run Test Scenarios (90 minutes)

See `PHASE3_CCA_UPGRADE.md` Sections "Step 5: Test CCA Audit" for detailed scenarios

### Scenario 1: Small Codebase (15 min)
- [ ] Create 3-5 simple files with imports
- [ ] Click CCA Audit button
- [ ] Audit completes in <30 seconds
- [ ] Report shows Overview tab correctly
- [ ] All 4 tabs clickable and functional

### Scenario 2: Medium Codebase (20 min)
- [ ] Load SwarmIDE2 services directory (~1000 lines)
- [ ] Click CCA Audit
- [ ] Audit completes in <2 minutes
- [ ] Shows actual dependencies (ccaService imports geminiService, etc.)
- [ ] Refactoring tab has suggestions
- [ ] Tools tab identifies candidates

### Scenario 3: Large Codebase (30 min)
- [ ] Load entire SwarmIDE2 source (~5000 lines)
- [ ] Click CCA Audit
- [ ] Audit completes in 2-3 minutes
- [ ] Complexity shows "medium" or "high"
- [ ] Multiple refactoring opportunities
- [ ] Tool extraction shows 3+ candidates
- [ ] All stats and scores reasonable

### Scenario 4: Edge Cases (15 min)
- [ ] Empty project (no files):
  - [ ] Button disabled
  - [ ] Shows helpful message
  - [ ] Doesn't crash
  
- [ ] Single file:
  - [ ] Completes quickly
  - [ ] Shows minimal dependencies
  - [ ] No false positives
  
- [ ] Files with syntax errors:
  - [ ] Doesn't crash
  - [ ] Still produces report (with note)

---

## Step 8: Performance Validation (15 minutes)

### Performance Checklist:

| Test Case | Expected | Actual | ✓/✗ |
|-----------|----------|--------|-----|
| Small (<500 LOC) | <30s | | |
| Medium (1k-5k) | <2 min | | |
| Large (10k+) | <3 min | | |
| Refactoring ops | 5+ | | |
| Tool candidates | 3+ | | |

Record times and compare to targets.

**Checklist:**
- [ ] Small projects: <30 seconds
- [ ] Medium projects: <2 minutes
- [ ] Large projects: <3 minutes
- [ ] All reports have 5+ refactoring opportunities
- [ ] All reports have 3+ tool candidates
- [ ] No memory leaks (monitor browser memory)
- [ ] No duplicate API calls

---

## Step 9: Final Validation (15 minutes)

### Code Quality:
- [ ] No TypeScript errors (`npm run build`)
- [ ] No console errors when running
- [ ] No console warnings
- [ ] All imports resolved
- [ ] Proper error handling (try/catch)

### Functionality:
- [ ] CCA button appears and works
- [ ] Modal renders correctly
- [ ] All 4 tabs functional
- [ ] Dismiss/close works
- [ ] Error messages display

### UI/UX:
- [ ] Button styling matches theme
- [ ] Modal styling is professional
- [ ] Icons display correctly
- [ ] Colors readable (dark theme)
- [ ] Responsive on different screen sizes

### Documentation:
- [ ] Code has comments explaining complex logic
- [ ] Error messages are user-friendly
- [ ] No hardcoded values in UI strings

**Checklist:**
- [ ] All code quality checks pass
- [ ] All functionality tests pass
- [ ] UI/UX is polished
- [ ] Documentation complete

---

## Sign-Off Checklist

### Before Marking Complete:

**Code Quality:**
- [ ] 0 TypeScript errors
- [ ] 0 console errors on load
- [ ] 0 console warnings
- [ ] All imports working
- [ ] Proper error handling

**Features:**
- [ ] CCA button functional
- [ ] Modal displays correctly
- [ ] All 4 tabs work
- [ ] Can dismiss/close
- [ ] Confucius config updated
- [ ] App.tsx integration complete

**Performance:**
- [ ] <30s for small codebases
- [ ] <2 min for medium codebases
- [ ] <3 min for large codebases
- [ ] No memory leaks
- [ ] Responsive UI (no freezes)

**Testing:**
- [ ] Scenario 1 (small) ✓
- [ ] Scenario 2 (medium) ✓
- [ ] Scenario 3 (large) ✓
- [ ] Scenario 4 (edge cases) ✓
- [ ] Performance targets met ✓

**Documentation:**
- [ ] PHASE3_CCA_UPGRADE.md reviewed
- [ ] PHASE3_QUICK_START.md reviewed
- [ ] Inline code comments added
- [ ] Error messages clear

---

## Go-Live Decision

### Ready to Go Live? 

**YES** - All items above checked ✓

**NO** - Address remaining items before release

### Known Limitations (Document These):

1. **Circular Dependency Detection:**
   - May not detect indirect cycles >3 levels deep
   - Workaround: Use `reasoningDepth: 'exhaustive'` for deeper analysis

2. **Dead Code Detection:**
   - Based on import analysis; may miss reflection/dynamic imports
   - Workaround: Manual review of suggested dead code

3. **Performance:**
   - Large projects (50k+ lines) may take 5+ minutes
   - Workaround: Split into smaller modules

4. **Tool Extraction:**
   - Reusability scores are heuristic-based
   - Workaround: Manual validation of suggestions

---

## Next Steps After Go-Live

1. **Monitor:**
   - Track audit errors in logs
   - Collect user feedback
   - Monitor API usage/costs

2. **Optimize:**
   - Improve circular dep detection
   - Refine tool extraction heuristics
   - Add visualization options

3. **Expand:**
   - Add GitHub integration
   - Generate PRs for refactoring
   - ML-based predictions

---

## Support & Troubleshooting

**See:** `PHASE3_CCA_UPGRADE.md` Section "Troubleshooting"

**Common Issues:**
- API errors → Check `.env` key and quota
- Slow analysis → Use smaller projects for testing
- Parse errors → Check agent output in console
- UI glitches → Clear browser cache, restart dev server

---

## Completion Confirmation

**Phase 3 Integration Complete:** [ ] YES / [ ] NO

**Date Completed:** _______________

**Integration Time Actual:** _______________

**Known Issues:** _________________________________________

**Ready for Production:** [ ] YES / [ ] NO

**Sign-Off:** _________________________ (Developer)

**Reviewer:** _________________________ (Code Reviewer)

---

**Version:** 1.0  
**Last Updated:** Jan 18, 2026  
**Status:** Ready for Integration

Good luck! 🚀
