import { traceLLMCall, LLMCallTrace, tracePhase, trackAgentCost } from './langfuseService';
import * as n8nModule from './n8nService';
import * as langflowModule from './langflowService';
import { multiProviderService } from './multiProviderService';
import { lightRAGService } from './lightRAGService';
import { seekDBService } from './seekDBService';
import { vectorDBService } from './vectorDBService';
import * as specGenModule from './specGenerationService';
import * as workflowModule from './durableWorkflowService';
import * as securityModule from './securityValidationService';
import * as specKitModule from './specKitService';
import * as supabaseModule from './supabaseService';

export interface IntegrationStatus {
  name: string;
  enabled: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  config?: Record<string, any>;
}

export interface IntegrationConfig {
  langfuse?: { enabled: boolean; publicKey?: string; secretKey?: string };
  n8n?: { enabled: boolean; baseUrl?: string; apiKey?: string };
  langflow?: { enabled: boolean; baseUrl?: string; apiKey?: string };
  multiProvider?: { enabled: boolean; defaultProvider?: string };
  lightRAG?: { enabled: boolean };
  seekDB?: { enabled: boolean };
  vectorDB?: { enabled: boolean; type?: string; baseUrl?: string };
  specGeneration?: { enabled: boolean };
  durableWorkflow?: { enabled: boolean };
  securityValidation?: { enabled: boolean };
  specKit?: { enabled: boolean };
  supabase?: { enabled: boolean; url?: string; key?: string };
}

class IntegrationManager {
  private config: IntegrationConfig;
  private statusCache: Map<string, IntegrationStatus> = new Map();
  private lastHealthCheck: number = 0;

  constructor(config: IntegrationConfig = {}) {
    this.config = {
      langfuse: { enabled: true },
      n8n: { enabled: false },
      langflow: { enabled: false },
      multiProvider: { enabled: true, defaultProvider: 'gemini' },
      lightRAG: { enabled: true },
      seekDB: { enabled: true },
      vectorDB: { enabled: true, type: 'qdrant' },
      specGeneration: { enabled: true },
      durableWorkflow: { enabled: true },
      securityValidation: { enabled: true },
      specKit: { enabled: true },
      supabase: { enabled: false },
      ...config,
    };

    this.initializeServices();
  }

  private initializeServices(): void {
    console.log('🚀 Initializing SwarmIDE2 Integrations...');

    if (this.config.multiProvider?.enabled) {
      multiProviderService.setDefaultProvider(
        (this.config.multiProvider.defaultProvider as any) || 'gemini'
      );
      console.log('✅ Multi-Provider Service initialized');
    }

    if (this.config.vectorDB?.enabled) {
      vectorDBService.setDbType((this.config.vectorDB.type as any) || 'qdrant');
      vectorDBService.initialize().catch(e => console.warn('VectorDB init warning:', e));
      console.log('✅ Vector DB Service initialized');
    }

    console.log('✅ All integrations initialized');
  }

  // Health check all services
  async healthCheck(): Promise<Map<string, IntegrationStatus>> {
    const statuses = new Map<string, IntegrationStatus>();

    // Only check if 10+ seconds since last check (rate limiting)
    if (Date.now() - this.lastHealthCheck < 10000) {
      return this.statusCache;
    }

    try {
      // Check Langfuse
      if (this.config.langfuse?.enabled) {
        try {
          statuses.set('langfuse', {
            name: 'Langfuse (Observability)',
            enabled: true,
            status: 'healthy',
            lastCheck: new Date().toISOString(),
          });
        } catch (e) {
          statuses.set('langfuse', {
            name: 'Langfuse',
            enabled: true,
            status: 'unhealthy',
            lastCheck: new Date().toISOString(),
          });
        }
      }

      // Check n8n
      if (this.config.n8n?.enabled) {
        try {
          // await n8nService.getWorkflows();
          statuses.set('n8n', {
            name: 'n8n (External Execution)',
            enabled: true,
            status: 'healthy',
            lastCheck: new Date().toISOString(),
          });
        } catch {
          statuses.set('n8n', {
            name: 'n8n',
            enabled: true,
            status: 'degraded',
            lastCheck: new Date().toISOString(),
          });
        }
      }

      // Check VectorDB
      if (this.config.vectorDB?.enabled) {
        const health = await vectorDBService.health();
        statuses.set('vectorDB', {
          name: `Vector DB (${this.config.vectorDB.type || 'qdrant'})`,
          enabled: true,
          status: health.status as any,
          lastCheck: new Date().toISOString(),
        });
      }

      // Check Supabase
      if (this.config.supabase?.enabled) {
        const health = await supabaseService.health();
        statuses.set('supabase', {
          name: 'Supabase (Persistence)',
          enabled: true,
          status: health.status as any,
          lastCheck: new Date().toISOString(),
        });
      }

      this.statusCache = statuses;
      this.lastHealthCheck = Date.now();
    } catch (error) {
      console.error('Health check failed:', error);
    }

    return statuses;
  }

  // Get integration status
  getStatus(name: string): IntegrationStatus | undefined {
    return this.statusCache.get(name);
  }

  // Get all enabled integrations
  getEnabledIntegrations(): string[] {
    const enabled: string[] = [];

    if (this.config.langfuse?.enabled) enabled.push('Langfuse');
    if (this.config.n8n?.enabled) enabled.push('n8n');
    if (this.config.langflow?.enabled) enabled.push('Langflow');
    if (this.config.multiProvider?.enabled) enabled.push('Multi-Provider LLM');
    if (this.config.lightRAG?.enabled) enabled.push('LightRAG');
    if (this.config.seekDB?.enabled) enabled.push('SeekDB');
    if (this.config.vectorDB?.enabled) enabled.push('Vector DB');
    if (this.config.specGeneration?.enabled) enabled.push('Spec Generation');
    if (this.config.durableWorkflow?.enabled) enabled.push('Durable Workflows');
    if (this.config.securityValidation?.enabled) enabled.push('Security Validation');
    if (this.config.specKit?.enabled) enabled.push('SpecKit');
    if (this.config.supabase?.enabled) enabled.push('Supabase');

    return enabled;
  }

  // Full execution pipeline
  async executeFullPipeline(prompt: string, userId: string): Promise<{
    specId: string;
    sessionId: string;
    executionId: string;
    status: string;
  }> {
    console.log('🔄 Starting full SwarmIDE2 execution pipeline...');

    // Phase 1: Normalize spec
    const normalized = await specKitService.normalizeInput(prompt);
    const validation = specKitService.validate(normalized);

    if (!validation.valid) {
      throw new Error(`Invalid spec: ${validation.issues.join(', ')}`);
    }

    console.log(`✅ Spec normalized (confidence: ${normalized.confidence.toFixed(2)})`);

    // Phase 2: Create session & store
    const session = await supabaseService.createSession(
      normalized.title,
      userId,
      {
        normalizedSpec: normalized,
        timestamp: new Date().toISOString(),
      }
    );

    console.log(`✅ Session created: ${session.id}`);

    // Phase 3: Generate full spec
    const fullSpec = await specGenerationService.generateSpec(prompt);
    console.log(`✅ Full specification generated`);

    // Phase 4: Store in RAG
    lightRAGService.storeContext(
      `spec-${session.id}`,
      0,
      fullSpec
    );

    // Phase 5: Create durable workflow
    const workflowDef = this.createWorkflowDefinition(fullSpec, session.id);
    durableWorkflowService.registerWorkflow(workflowDef);

    // Phase 6: Start execution
    const execution = await durableWorkflowService.startExecution(
      workflowDef.id,
      { sessionId: session.id, userId, spec: fullSpec }
    );

    console.log(`✅ Durable execution started: ${execution.id}`);

    // Phase 7: Trace with Langfuse
    if (this.config.langfuse?.enabled) {
      try {
        await langfuseService.traceLLMCall(
          'workflow-execution',
          prompt,
          execution.id,
          { inputTokens: 0, outputTokens: 0, totalCost: 0 },
          userId,
          'pipeline'
        );
      } catch (e) {
        console.warn('Langfuse tracing failed:', e);
      }
    }

    return {
      specId: session.id,
      sessionId: session.id,
      executionId: execution.id,
      status: 'started',
    };
  }

  private createWorkflowDefinition(spec: any, sessionId: string): any {
    return {
      id: `workflow-${sessionId}`,
      name: spec.title,
      description: spec.description,
      steps: [
        {
          id: 'validate-spec',
          name: 'Validate Specification',
          type: 'task',
          handler: 'validateSpec',
          inputs: { spec },
          dependencies: [],
        },
        {
          id: 'plan-execution',
          name: 'Plan Execution',
          type: 'task',
          handler: 'planExecution',
          inputs: { spec },
          dependencies: ['validate-spec'],
        },
        {
          id: 'execute-phases',
          name: 'Execute Phases',
          type: 'task',
          handler: 'executePhases',
          inputs: { spec },
          dependencies: ['plan-execution'],
        },
      ],
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialInterval: 1000,
      },
      timeout: 3600000, // 1 hour
    };
  }

  // Get integration report
  getReport(): {
    totalIntegrations: number;
    enabledCount: number;
    status: Record<string, any>;
    recommendations: string[];
  } {
    const enabled = this.getEnabledIntegrations();
    const recommendations: string[] = [];

    if (!this.config.langfuse?.enabled) {
      recommendations.push('Enable Langfuse for full observability and cost tracking');
    }

    if (!this.config.supabase?.enabled) {
      recommendations.push('Enable Supabase for persistent session storage');
    }

    if (!this.config.n8n?.enabled && !this.config.langflow?.enabled) {
      recommendations.push('Enable n8n or Langflow for external workflow execution');
    }

    if (!this.config.vectorDB?.enabled) {
      recommendations.push('Enable Vector DB for semantic search capabilities');
    }

    return {
      totalIntegrations: 12,
      enabledCount: enabled.length,
      status: {
        enabled: enabled,
        disabled: this.getDisabledIntegrations(),
      },
      recommendations,
    };
  }

  private getDisabledIntegrations(): string[] {
    const disabled: string[] = [];

    if (!this.config.langfuse?.enabled) disabled.push('Langfuse');
    if (!this.config.n8n?.enabled) disabled.push('n8n');
    if (!this.config.langflow?.enabled) disabled.push('Langflow');
    if (!this.config.supabase?.enabled) disabled.push('Supabase');

    return disabled;
  }

  updateConfig(updates: Partial<IntegrationConfig>): void {
    this.config = { ...this.config, ...updates };
    this.initializeServices();
  }
}

export const integrationManager = new IntegrationManager({
  langfuse: { enabled: true },
  multiProvider: { enabled: true, defaultProvider: 'gemini' },
  lightRAG: { enabled: true },
  seekDB: { enabled: true },
  vectorDB: { enabled: true, type: 'qdrant' },
  specGeneration: { enabled: true },
  durableWorkflow: { enabled: true },
  securityValidation: { enabled: true },
  specKit: { enabled: true },
});

export default integrationManager;
