// Service unit tests
import { describe, it, expect, beforeEach } from 'vitest';
import { specKitService } from '../services/specKitService';
import { lightRAGService } from '../services/lightRAGService';
import { securityValidationService } from '../services/securityValidationService';
import { seekDBService } from '../services/seekDBService';
import { durableWorkflowService } from '../services/durableWorkflowService';
import { mockExecutionContext, mockProposal } from './setup';

describe('SpecKit Service', () => {
  it('should normalize user input', async () => {
    const input = 'Build a React app with Node.js backend';
    const result = await specKitService.normalizeInput(input);

    expect(result).toBeDefined();
    expect(result.title).toBeTruthy();
    expect(result.type).toMatch(/software|general/);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should detect project type correctly', async () => {
    const softwareInput = 'Build a REST API with TypeScript';
    const result = await specKitService.normalizeInput(softwareInput);
    expect(result.type).toBe('software');
  });

  it('should estimate effort hours', async () => {
    const input = 'Complex microservices architecture';
    const result = await specKitService.normalizeInput(input);
    expect(result.estimatedHours).toBeGreaterThan(0);
  });

  it('should validate normalized spec', async () => {
    const input = 'Build an app';
    const normalized = await specKitService.normalizeInput(input);
    const validation = specKitService.validate(normalized);
    expect(validation.valid).toBe(true);
  });
});

describe('LightRAG Service', () => {
  beforeEach(() => {
    lightRAGService.clear();
  });

  it('should store proposals', () => {
    lightRAGService.storeProposal('prop-1', 'agent-1', 1, mockProposal);
    const stats = lightRAGService.getStats();
    expect(stats.totalDocuments).toBeGreaterThan(0);
  });

  it('should query proposals by phase', async () => {
    lightRAGService.storeProposal('prop-1', 'agent-1', 1, mockProposal);
    const proposals = await lightRAGService.getPhaseProposals(1);
    expect(proposals.length).toBeGreaterThan(0);
  });

  it('should compress context', async () => {
    lightRAGService.storeProposal('prop-1', 'agent-1', 1, mockProposal);
    const compressed = await lightRAGService.compressContext(1);
    expect(compressed).toBeTruthy();
    expect(compressed).toContain('proposal');
  });
});

describe('Security Validation Service', () => {
  it('should scan code for vulnerabilities', async () => {
    const safCode = 'const x = 5;';
    const scan = await securityValidationService.scanCode(safCode);
    expect(scan).toBeDefined();
    expect(scan.score).toBeGreaterThanOrEqual(0);
  });

  it('should detect SQL injection', async () => {
    const userId = '123'; // Fixed: was undefined
    const vulnCode = "SELECT * FROM users WHERE id = " + userId;
    const scan = await securityValidationService.scanCode(vulnCode);
    expect(scan.vulnerabilities.length).toBeGreaterThan(0);
  });

  it('should validate code for deployment', async () => {
    const code = 'const app = require("express")();';
    const validation = await securityValidationService.validateAgentCode(code);
    expect(validation.valid).toBeDefined();
    expect(validation.canDeploy).toBeDefined();
  });
});

describe('SeekDB Service', () => {
  beforeEach(() => {
    seekDBService.clear();
  });

  it('should store and retrieve documents', async () => {
    await seekDBService.addDocument({
      id: 'doc-1',
      text: 'This is a test document',
      metadata: { topic: 'test' },
    });

    const results = await seekDBService.search({
      query: 'test document',
      limit: 5,
    });

    expect(results.documents.length).toBeGreaterThan(0);
  });

  it('should support metadata filtering', async () => {
    await seekDBService.addDocument({
      id: 'doc-1',
      text: 'Agent knowledge',
      metadata: { agentId: 'agent-1' },
    });

    const results = await seekDBService.search({
      query: 'knowledge',
      limit: 5,
      filters: { agentId: 'agent-1' },
    });

    expect(results.documents.length).toBeGreaterThan(0);
  });
});

describe('Durable Workflow Service', () => {
  it('should register and execute workflows', async () => {
    const workflow = {
      id: 'test-workflow',
      name: 'Test Workflow',
      description: 'Test',
      steps: [
        {
          id: 'step-1',
          name: 'Test Step',
          type: 'task' as const,
          handler: 'testHandler',
          inputs: {},
          dependencies: [],
        },
      ],
      retryPolicy: { maxRetries: 3, backoffMultiplier: 2 },
      timeout: 60000,
    };

    durableWorkflowService.registerWorkflow(workflow);
    durableWorkflowService.registerHandler('testHandler', async () => ({
      status: 'success',
    }));

    const execution = await durableWorkflowService.startExecution(
      'test-workflow',
      {}
    );

    expect(execution).toBeDefined();
    expect(execution.id).toBeTruthy();
  });

  it('should track execution metrics', () => {
    const metrics = durableWorkflowService.getMetrics();
    expect(metrics.totalExecutions).toBeDefined();
    expect(metrics.successCount).toBeDefined();
    expect(metrics.failureCount).toBeDefined();
  });
});
