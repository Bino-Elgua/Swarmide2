// REST API Gateway for SwarmIDE2
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { appIntegration } from '../services/appIntegration';
import { durableWorkflowService } from '../services/durableWorkflowService';
import { securityValidationService } from '../services/securityValidationService';
import { specKitService } from '../services/specKitService';
import { supabaseService } from '../services/supabaseService';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════════════
// EXECUTION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

// POST /api/execute - Start execution
app.post('/api/execute', async (req: Request, res: Response) => {
  try {
    const { prompt, userId, registry = [] } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await appIntegration.executeProject(
      prompt,
      userId || 'anonymous',
      registry
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/status/:projectId - Get execution status
app.get('/api/status/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const status = await appIntegration.getStatus(projectId);

    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/resume/:projectId - Resume from checkpoint
app.post('/api/resume/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const result = await appIntegration.resumeExecution(projectId);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/result/:projectId - Get execution result
app.get('/api/result/:projectId', (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const result = appIntegration.getResult(projectId);

    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// VALIDATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

// POST /api/validate/code - Security validation
app.post('/api/validate/code', async (req: Request, res: Response) => {
  try {
    const { code, projectId } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const validation = await appIntegration.validateCode(
      code,
      projectId || 'default'
    );

    res.json(validation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/validate/spec - Validate specification
app.post('/api/validate/spec', async (req: Request, res: Response) => {
  try {
    const { input } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const normalized = await specKitService.normalizeInput(input);
    const validation = specKitService.validate(normalized);

    res.json({ normalized, validation });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// SESSION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

// GET /api/sessions/:userId - List user sessions
app.get('/api/sessions/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const sessions = await supabaseService.listUserSessions(userId);

    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sessions/:userId/:sessionId - Get session details
app.get(
  '/api/sessions/:userId/:sessionId',
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = await supabaseService.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/sessions/:userId/:sessionId/export - Export session
app.get(
  '/api/sessions/:userId/:sessionId/export',
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const exported = await supabaseService.exportSession(sessionId);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="session-${sessionId}.json"`
      );
      res.send(exported);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════
// INTEGRATION ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

// GET /api/integrations - Get enabled integrations
app.get('/api/integrations', (req: Request, res: Response) => {
  try {
    const services = appIntegration.getServices();
    const report = appIntegration.getReport();

    res.json({ services, report });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// WORKFLOW ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

// GET /api/workflows - Get workflow metrics
app.get('/api/workflows', (req: Request, res: Response) => {
  try {
    const metrics = durableWorkflowService.getMetrics();

    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/workflows/:executionId - Get execution details
app.get('/api/workflows/:executionId', (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const execution = durableWorkflowService.getExecution(executionId);

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    res.json(execution);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err: any, req: Request, res: Response) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 SwarmIDE2 API running on http://localhost:${PORT}`);
    console.log(`📚 API docs: http://localhost:${PORT}/api-docs`);
  });
}

export default app;
