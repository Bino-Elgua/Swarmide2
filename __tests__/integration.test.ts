// Integration tests for full pipelines
import { describe, it, expect } from '@jest/globals';
import { appIntegration } from '../services/appIntegration';
import { mockAgent } from './setup';

describe('Full Pipeline Integration', () => {
  it('should execute complete project pipeline', async () => {
    const prompt = 'Build a simple todo application';
    const result = await appIntegration.executeProject(prompt, 'test-user', [
      mockAgent,
    ]);

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.context).toBeDefined();
    expect(result.spec).toBeDefined();
    expect(result.proposals).toBeDefined();
    expect(result.cost).toBeDefined();
  });

  it('should handle pipeline errors gracefully', async () => {
    const result = await appIntegration.executeProject(
      '',
      'test-user',
      []
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('should validate code generation', async () => {
    const code = 'const x = 5;';
    const validation = await appIntegration.validateCode(code, 'test-project');

    expect(validation).toBeDefined();
    expect(validation.valid).toBeDefined();
    expect(validation.scan).toBeDefined();
  });

  it('should get execution status', async () => {
    const status = await appIntegration.getStatus('test-project');

    expect(status).toBeDefined();
    expect(status.status).toBeTruthy();
    expect(status.progress).toBeGreaterThanOrEqual(0);
    expect(status.progress).toBeLessThanOrEqual(100);
  });

  it('should track services', () => {
    const services = appIntegration.getServices();
    expect(services).toBeDefined();
    expect(services.length).toBeGreaterThan(0);
  });
});
