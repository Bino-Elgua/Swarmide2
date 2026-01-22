// Test setup and configuration
import { config } from 'dotenv';

config({ path: '.env.local.example' });

// Mock environment variables for testing
process.env.GOOGLE_API_KEY = 'test-key-google';
process.env.OPENAI_API_KEY = 'test-key-openai';
process.env.CLAUDE_API_KEY = 'test-key-claude';

export const mockExecutionContext = {
  userId: 'test-user',
  projectId: 'test-project-123',
  sessionId: 'test-session-456',
  projectName: 'Test Project',
  userPrompt: 'Build a test app',
};

export const mockAgent = {
  id: 'test-agent-1',
  name: 'Test Agent',
  role: 'Tester',
  description: 'Test agent',
  icon: 'robot',
  color: '#0066ff',
  tasks: [],
  phase: 1,
  personality: 'analytical',
  voiceName: 'Puck' as const,
  enabledTools: [],
};

export const mockProposal = {
  id: 'proposal-1',
  agentId: 'agent-1',
  agentName: 'Test Agent',
  rationale: 'This is a test proposal',
  architecture: 'Microservices',
  confidence: 0.85,
  tradeoffs: {
    pro: ['Scalable', 'Maintainable'],
    con: ['Complex'],
  },
  risks: [],
  dependencies: [],
  costEstimate: 5000,
};
