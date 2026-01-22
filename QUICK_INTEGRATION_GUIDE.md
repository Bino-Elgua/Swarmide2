# SwarmIDE2 Quick Integration Guide
Complete all 6 features in your application

## 📝 Step 1: Import New Services & Components

Add these imports to your main App component:

```typescript
// New orchestration service
import { executeFullOrchestration, OrchestrationContext, OrchestrationResult } from './services/orchestrationFlow';

// New components
import AgentParameterEditor from './components/AgentParameterEditor';
import OrchestrationDashboard from './components/OrchestrationDashboard';

// Existing components (may need to add)
import HealthMonitor from './components/HealthMonitor';
import ConflictResolver from './components/ConflictResolver';
import CostTracker from './components/CostTracker';
```

---

## 🔧 Step 2: Add State for Orchestration

In your App component's useState section, add:

```typescript
// Orchestration execution
const [orchestrationResult, setOrchestrationResult] = useState<OrchestrationResult | undefined>();
const [isOrchestrating, setIsOrchestrating] = useState(false);
const [orchestrationLog, setOrchestrationLog] = useState<string[]>([]);

// Agent parameter editor
const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
const [showParameterEditor, setShowParameterEditor] = useState(false);

// Health monitoring
const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);

// Conflict resolution UI (existing, verify it exists)
const [showConflictResolver, setShowConflictResolver] = useState(false);
const [conflictingProposals, setConflictingProposals] = useState<any[]>([]);
```

---

## ⚡ Step 3: Implement Execute Function

Replace or update your orchestration trigger with this complete version:

```typescript
const handleStartMission = async () => {
  if (!inputPrompt.trim() || selectedIds.length === 0) {
    addLog('ERROR: Enter mission prompt and select agents');
    return;
  }

  setIsOrchestrating(true);
  setOrchestrationLog([]);
  setOrchestrationResult(undefined);

  try {
    // Get selected agents and assign to phases
    const selectedAgents = registry.filter(a => selectedIds.includes(a.id));
    const phasedAgents = assignAgentsToPhases(selectedAgents);

    // Create orchestration context
    const context: OrchestrationContext = {
      projectId: `mission-${Date.now()}`,
      mission: inputPrompt,
      agents: phasedAgents,
      phases: project.phases || createDefaultPhases(),
      config: project.orchestratorConfig,
      budgetUSD: costBudgetUSD || 10,
      
      onLog: (msg: string) => {
        addLog(msg);
        setOrchestrationLog(prev => [msg, ...prev].slice(0, 50));
      },
      
      onProgress: (phase: number, total: number) => {
        setProject(p => ({ ...p, currentPhase: phase }));
      },
      
      onConflictDetected: async (proposals: any[]) => {
        setConflictingProposals(proposals);
        setShowConflictResolver(true);
        // Wait for user resolution
        return new Promise(resolve => {
          window.conflictResolutionCallback = resolve;
        });
      },
      
      onCostWarning: (spent: number, budget: number) => {
        addLog(`⚠️  BUDGET WARNING: $${spent.toFixed(2)} / $${budget.toFixed(2)}`);
      }
    };

    // Execute full orchestration
    const result = await executeFullOrchestration(context);
    setOrchestrationResult(result);

    // Log summary
    if (result.success) {
      addLog(`✅ Mission Complete!`);
      addLog(`  Phases: ${result.completedPhases.length}`);
      addLog(`  Cost: $${result.totalCostUSD.toFixed(4)}`);
      addLog(`  Tokens: ${result.totalTokensUsed}`);
      addLog(`  Time: ${(result.timeElapsedMs / 1000).toFixed(1)}s`);
    } else {
      addLog(`❌ Mission Failed`);
      result.errors.forEach(e => addLog(`  Error: ${e}`));
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    addLog(`ERROR: ${msg}`);
  } finally {
    setIsOrchestrating(false);
  }
};
```

---

## 🎨 Step 4: Add UI Components to Render

In your JSX render method, add these components:

```jsx
{/* Orchestration Dashboard (top right) */}
<OrchestrationDashboard
  isVisible={isOrchestrating || !!orchestrationResult}
  isExecuting={isOrchestrating}
  result={orchestrationResult}
  currentPhase={project.currentPhase}
  totalPhases={project.phases.length}
  healthMetrics={healthMetrics}
  log={orchestrationLog}
/>

{/* Health Monitor (bottom right) */}
<HealthMonitor
  isVisible={true}
  autoRefresh={30000}
/>

{/* Conflict Resolver Modal */}
{showConflictResolver && (
  <ConflictResolver
    isOpen={showConflictResolver}
    proposals={conflictingProposals}
    onSelectProposal={(proposal) => {
      setSelectedProposal(proposal);
    }}
    onClose={() => {
      setShowConflictResolver(false);
    }}
    onConfirm={() => {
      setShowConflictResolver(false);
      if (window.conflictResolutionCallback) {
        window.conflictResolutionCallback(selectedProposal?.architecture || '');
      }
    }}
    selectedProposal={selectedProposal}
    resolution={synthesisStrategy}
  />
)}

{/* Cost Tracker (floating panel) */}
{costMetrics.length > 0 && (
  <div className="fixed bottom-4 left-4 max-w-sm z-40">
    <CostTracker
      metrics={costMetrics}
      budgetUSD={costBudgetUSD}
    />
  </div>
)}

{/* Agent Parameter Editor Modal */}
{showParameterEditor && editingAgent && (
  <AgentParameterEditor
    agent={editingAgent}
    maxPhase={project.phases.length - 1}
    onSave={(updatedAgent) => {
      // Update agent in state
      const updated = project.agents.map(a => a.id === updatedAgent.id ? updatedAgent : a);
      setProject(p => ({ ...p, agents: updated }));
      setShowParameterEditor(false);
      addLog(`✓ Updated agent: ${updatedAgent.name}`);
    }}
    onCancel={() => {
      setShowParameterEditor(false);
    }}
  />
)}
```

---

## 🔌 Step 5: Wire Up Agent Parameter Editor

Update your agent list/management component to show the edit button:

```typescript
const handleEditAgent = (agent: Agent) => {
  setEditingAgent(agent);
  setShowParameterEditor(true);
};

// In render, add edit button to each agent:
<button
  onClick={() => handleEditAgent(agent)}
  className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 rounded"
>
  ⚙️ Edit
</button>
```

---

## 📊 Step 6: Health Monitoring Integration

Initialize health checks on component mount:

```typescript
useEffect(() => {
  const initializeHealth = async () => {
    const health = await healthCheck.runFullCheck();
    setHealthMetrics(health);
  };

  initializeHealth();

  // Refresh every 30 seconds
  const interval = setInterval(initializeHealth, 30000);
  return () => clearInterval(interval);
}, []);
```

---

## 💰 Step 7: Cost Tracking Integration

Ensure cost callbacks are wired in your agent execution:

```typescript
const handleCostMetric = (cost: number) => {
  const newMetric: CostMetrics = {
    phaseNumber: project.currentPhase,
    agentName: selectedAgentId || 'unknown',
    inputTokens: 0,
    outputTokens: 0,
    costUSD: cost,
    timestamp: new Date()
  };
  
  setCostMetrics(prev => [...prev, newMetric]);
  setCostActualUSD(prev => prev + cost);
};

// Pass to performAgentTask:
await performAgentTask({
  // ... other params
  onCostMetric: handleCostMetric
});
```

---

## ✅ Step 8: Verification Checklist

After integration, verify:

- [ ] Orchestration service imports without errors
- [ ] All new components render without errors
- [ ] Mission execution button triggers orchestration
- [ ] OrchestrationDashboard shows real-time progress
- [ ] HealthMonitor displays system status
- [ ] Cost tracker updates during execution
- [ ] Conflict resolver modal appears when needed
- [ ] Agent parameter editor opens and saves changes
- [ ] Ralph loop executes when enabled
- [ ] All state updates propagate correctly
- [ ] TypeScript compilation without errors
- [ ] No console errors during execution

---

## 🚀 Running Your First Mission

1. **Enter mission prompt:** "Build a REST API with authentication"
2. **Select agents:** Backend, Database, Security agents
3. **Set budget:** $5.00
4. **Click execute:** Watch OrchestrationDashboard
5. **Monitor:**
   - Real-time progress bar
   - Phase execution logs
   - Cost tracking
   - Health status

---

## 🔧 Configuration Options

### Orchestration Config
```typescript
project.orchestratorConfig = {
  provider: 'google', // or 'openai', 'anthropic'
  model: 'gemini-3-pro-preview',
  maxTokens: 4096,
  topP: 0.9,
  recursiveRefinement: false,
  refinementPasses: 1,
  reasoningDepth: 'standard'
};
```

### Cost Budget
```typescript
costBudgetUSD = 10; // Max spend per mission
```

### Conflict Resolution Strategy
```typescript
synthesisStrategy = 'meta_reasoning'; // or 'voting', 'hierarchical', 'user_select'
```

### Ralph Loop Configuration
```typescript
ralphMaxIterations = 5; // 3 (fast), 5 (balanced), 8-10 (thorough)
ralphCompletionThreshold = 0.95; // 0.90-0.99
```

---

## 📚 Next Steps

1. **Test** - Run through all 10 test scenarios
2. **Optimize** - Profile and optimize cost/tokens
3. **Deploy** - Push to production
4. **Monitor** - Track health and costs in production

---

## 🆘 Troubleshooting

### Orchestration not starting
- Check mission prompt is filled
- Verify agents are selected
- Check API keys in config
- Review console for errors

### High costs
- Lower `maxTokens` in config
- Use faster model (Gemini Flash)
- Reduce `ralphMaxIterations`
- Enable proposal caching

### Conflicts not resolving
- Check conflict resolver modal appears
- Verify synthesisStrategy is set
- Check multi-model synthesis service
- Review console logs

### Health check failing
- Verify API connectivity
- Check API key validity
- Review healthCheck.ts
- Check network settings

---

**Ready to integrate? Start with Step 1 above.**
