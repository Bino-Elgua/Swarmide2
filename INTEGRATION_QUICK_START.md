# SwarmIDE2 Integrations - Quick Start Guide

## 🚀 What Was Just Implemented

**All 12 integration services from SWARMIDE2_INTEGRATION_OPPORTUNITIES.md** are now available in TypeScript as production-ready modules.

---

## 📦 New Services (12 Total)

### Foundation Layer (Month 1)
1. **Langfuse** - LLM observability & cost tracking
2. **n8n** - External workflow automation  
3. **Langflow** - Visual orchestration UI
4. **Multi-Provider** - Unified LLM abstraction (8 models)

### Memory Layer (Month 2)
5. **LightRAG** - Persistent memory with compression
6. **SeekDB** - Hybrid semantic search
7. **Vector DB** - Embeddings storage (Qdrant/Milvus/Pinecone)
8. **Spec Generation** - PRD → Design → Tasks

### Automation Layer (Month 3)
9. **Durable Workflows** - Execution with checkpoints
10. **Security Validation** - Code vulnerability scanning
11. **SpecKit** - Input normalization & confidence scoring
12. **Supabase** - Cloud persistence (with fallback)

---

## 🔌 File Locations

All services are in `services/` directory:

```bash
services/
├── langfuseService.ts              # Observability
├── n8nService.ts                   # External execution
├── langflowService.ts              # Visual flows
├── multiProviderService.ts         # Multi-model LLM
├── lightRAGService.ts              # Memory
├── seekDBService.ts                # Semantic search
├── vectorDBService.ts              # Vector DB
├── specGenerationService.ts        # Spec generation
├── durableWorkflowService.ts       # Durable execution
├── securityValidationService.ts    # Security audit
├── specKitService.ts               # Input normalization
├── supabaseService.ts              # Cloud storage
└── integrationManager.ts           # Orchestration
```

---

## ⚡ Quick Examples

### 1. Execute Full Pipeline
```typescript
import { integrationManager } from './services/integrationManager';

const result = await integrationManager.executeFullPipeline(
  "Build a real-time chat app with React and Node.js",
  "user-123"
);

console.log('Spec ID:', result.specId);
console.log('Session ID:', result.sessionId);
console.log('Execution ID:', result.executionId);
```

### 2. Normalize User Input
```typescript
import { specKitService } from './services/specKitService';

const normalized = await specKitService.normalizeInput(
  "I need to build a mobile app for fitness tracking"
);

console.log('Title:', normalized.title);
console.log('Type:', normalized.type);
console.log('Scale:', normalized.scale);
console.log('Confidence:', normalized.confidence);
console.log('Estimated Hours:', normalized.estimatedHours);
```

### 3. Generate Specification
```typescript
import { specGenerationService } from './services/specGenerationService';

const spec = await specGenerationService.generateSpec(
  "Build a real-time chat app"
);

console.log('Objectives:', spec.objectives);
console.log('Requirements:', spec.requirements);
console.log('Timeline:', spec.timeline);
```

### 4. Store Session Data
```typescript
import { supabaseService } from './services/supabaseService';

const session = await supabaseService.createSession(
  "Chat App Project",
  "user-123",
  { startedAt: new Date() }
);

// Add phase data
await supabaseService.addPhase(session.id, {
  phase: 1,
  name: "Requirements & Design",
  agentOutputs: [],
  proposals: []
});

// Get stats
const stats = await supabaseService.getSessionStats(session.id);
console.log('Stats:', stats);
```

### 5. Create Durable Workflow
```typescript
import { durableWorkflowService } from './services/durableWorkflowService';

// Define workflow
durableWorkflowService.registerWorkflow({
  id: 'build-app',
  name: 'Build Application',
  steps: [
    { id: 'req', name: 'Requirements', handler: 'handleRequirements', dependencies: [] },
    { id: 'design', name: 'Design', handler: 'handleDesign', dependencies: ['req'] },
    { id: 'build', name: 'Build', handler: 'handleBuild', dependencies: ['design'] }
  ],
  retryPolicy: { maxRetries: 3, backoffMultiplier: 2 },
  timeout: 3600000
});

// Register handlers
durableWorkflowService.registerHandler('handleRequirements', async (inputs) => {
  return { status: 'requirements gathered' };
});

// Start execution
const execution = await durableWorkflowService.startExecution(
  'build-app',
  { userId: 'user-123' }
);

// Auto-resumes from checkpoint if interrupted
// Pause/resume as needed
durableWorkflowService.pauseExecution(execution.id);
durableWorkflowService.resumeExecution(execution.id);
```

### 6. Security Scan Code
```typescript
import { securityValidationService } from './services/securityValidationService';

const code = `
const password = "my-secret-password";
const sql = "SELECT * FROM users WHERE id = " + userId;
`;

const scan = await securityValidationService.scanCode(code);

console.log('Score:', scan.score);
console.log('Vulnerabilities:', scan.vulnerabilities);

const report = securityValidationService.generateReport(scan);
console.log(report);
```

### 7. Multi-Provider LLM Calls
```typescript
import { multiProviderService } from './services/multiProviderService';

// Single provider
const response = await multiProviderService.callProvider('gemini', {
  messages: [{ role: 'user', content: 'Hello' }],
  maxTokens: 100
});

// Ensemble voting
const ensemble = await multiProviderService.ensembleVote(
  ['gemini', 'claude', 'openai'],
  { messages: [...], systemPrompt: '...' }
);

// Cost-optimized routing
const optimal = multiProviderService.getOptimalProvider('budget');
```

### 8. Semantic Search
```typescript
import { seekDBService } from './services/seekDBService';

// Store agent knowledge
await seekDBService.storeAgentKnowledge(
  'agent-123',
  'authentication',
  'JWT tokens are validated using HS256 algorithm'
);

// Query
const results = await seekDBService.search({
  query: 'how to validate tokens',
  limit: 5
});

console.log('Results:', results.documents);
```

### 9. Memory & Context
```typescript
import { lightRAGService } from './services/lightRAGService';

// Store proposal
lightRAGService.storeProposal(
  'prop-1',
  'agent-123',
  1,
  { ...proposal }
);

// Query phase proposals
const proposals = await lightRAGService.getPhaseProposals(1);

// Compress context for next phase
const compressed = await lightRAGService.compressContext(1);
```

### 10. Health Check
```typescript
import { integrationManager } from './services/integrationManager';

const statuses = await integrationManager.healthCheck();

statuses.forEach((status, name) => {
  console.log(`${name}: ${status.status}`);
});

const report = integrationManager.getReport();
console.log('Enabled integrations:', report.status.enabled);
console.log('Recommendations:', report.recommendations);
```

---

## 🔧 Configuration

Create `.env.local` in project root:

```env
# Google (Gemini)
GOOGLE_API_KEY=your-key-here
API_KEY=your-key-here

# Multi-model LLMs
OPENAI_API_KEY=your-key
CLAUDE_API_KEY=your-key
GROQ_API_KEY=your-key
MISTRAL_API_KEY=your-key
PERPLEXITY_API_KEY=your-key
DEEPSEEK_API_KEY=your-key

# Observability
LANGFUSE_PUBLIC_KEY=pk_...
LANGFUSE_SECRET_KEY=sk_...
LANGFUSE_URL=https://cloud.langfuse.com

# External Execution
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your-key

LANGFLOW_BASE_URL=http://localhost:7860
LANGFLOW_API_KEY=your-key

# Storage
SUPABASE_URL=https://project.supabase.co
SUPABASE_KEY=your-key

# Vector DB
QDRANT_URL=http://localhost:6333
VECTOR_DB_API_KEY=optional

# Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

---

## 🎯 Integration Roadmap Status

### ✅ Month 1: Foundation
- [x] Langfuse observability
- [x] n8n external execution
- [x] Langflow visual orchestration
- [x] Multi-provider LLM abstraction

### ✅ Month 2: Memory & Context
- [x] LightRAG persistent memory
- [x] SeekDB semantic search
- [x] Vector DB (Qdrant/Milvus/Pinecone)
- [x] Spec generation (MetaGPT-like)

### ✅ Month 3: Scale & Automation
- [x] Durable workflows (Temporal-like)
- [x] Security validation (Agentic Radar-like)
- [x] SpecKit input normalization
- [x] Supabase cloud persistence

### 📋 Month 4+: Advanced (Optional)
- [ ] Deploy to production (Docker/K8s)
- [ ] Enable cloud services (Supabase, Qdrant, Langfuse dashboards)
- [ ] Configure Ollama for offline mode
- [ ] Phoenix observability
- [ ] Advanced monitoring dashboards

---

## 🔌 Wiring into React Components

To use these services in React components:

```typescript
// In a Svelte/React component
import { integrationManager } from '../services/integrationManager';
import { specKitService } from '../services/specKitService';

export async function handleUserInput(prompt: string) {
  try {
    // Normalize input
    const normalized = await specKitService.normalizeInput(prompt);
    
    // Execute full pipeline
    const result = await integrationManager.executeFullPipeline(
      prompt,
      currentUserId
    );
    
    // Update UI with results
    updateSessionUI(result.sessionId);
  } catch (error) {
    console.error('Execution failed:', error);
  }
}
```

---

## 📊 Dependencies Added

```bash
npm install langfuse axios dotenv @supabase/supabase-js
```

Run: `npm install` to get the latest versions

---

## 🧪 Testing Services

```typescript
// Quick validation
import { integrationManager } from './services/integrationManager';

async function testIntegrations() {
  const statuses = await integrationManager.healthCheck();
  const enabled = integrationManager.getEnabledIntegrations();
  const report = integrationManager.getReport();
  
  console.log('Enabled:', enabled);
  console.log('Health:', statuses);
  console.log('Recommendations:', report.recommendations);
}

testIntegrations();
```

---

## 📚 See Also

- `INTEGRATION_EXECUTION_SUMMARY.md` - Detailed implementation details
- `SWARMIDE2_INTEGRATION_OPPORTUNITIES.md` - Original roadmap

---

## 🎓 Learning Path

1. Start with `specKitService` - normalize user input
2. Move to `specGenerationService` - create formal specs
3. Use `supabaseService` - store sessions
4. Execute with `durableWorkflowService` - run tasks
5. Monitor with `integrationManager` - health & metrics
6. Add `securityValidationService` - validate output
7. Scale with `multiProviderService` - use best LLM
8. Search with `seekDBService` - find relevant info
9. Store with `vectorDBService` - embeddings
10. Automate with `n8n` / `langflow` - external tasks

---

## ✨ Key Capabilities Unlocked

✅ **Observability** - See what agents are doing (Langfuse)
✅ **Real Execution** - Agents can trigger external workflows (n8n)
✅ **Memory** - Agents remember past decisions (LightRAG)
✅ **Search** - Find relevant context semantically (SeekDB, Vector DB)
✅ **Durability** - Recover from failures, handle 100+ items (Durable Workflows)
✅ **Security** - Validate code before deployment (Security Validation)
✅ **Specs** - Structure messy requirements (SpecKit, Spec Generation)
✅ **Storage** - Persist across sessions (Supabase)

---

## 🚀 Next: Wire into UI

The services are ready to integrate. Next step is to connect them to the React UI components for end-to-end execution.

**Estimated effort:** 2-3 weeks to fully wire all services into the UI and enable complete execution pipeline.
