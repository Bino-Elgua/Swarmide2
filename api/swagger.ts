// OpenAPI/Swagger documentation for SwarmIDE2 API
export const openAPISpec = {
  openapi: '3.0.0',
  info: {
    title: 'SwarmIDE2 API',
    description: 'Multi-agent orchestration platform with full observability',
    version: '1.0.0',
    contact: {
      name: 'SwarmIDE2 Team',
      url: 'https://github.com/jbino85/SwarmIDE2',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development',
    },
    {
      url: 'https://api.swarmide2.dev',
      description: 'Production',
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['System'],
        responses: {
          200: {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    timestamp: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/execute': {
      post: {
        summary: 'Start project execution',
        tags: ['Execution'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prompt'],
                properties: {
                  prompt: {
                    type: 'string',
                    description: 'Project description',
                  },
                  userId: {
                    type: 'string',
                    description: 'User ID',
                  },
                  registry: {
                    type: 'array',
                    description: 'Agent registry',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Execution started',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ExecutionResult',
                },
              },
            },
          },
          400: {
            description: 'Invalid request',
          },
        },
      },
    },
    '/api/status/{projectId}': {
      get: {
        summary: 'Get execution status',
        tags: ['Execution'],
        parameters: [
          {
            name: 'projectId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Status retrieved',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ExecutionStatus',
                },
              },
            },
          },
        },
      },
    },
    '/api/resume/{projectId}': {
      post: {
        summary: 'Resume from checkpoint',
        tags: ['Execution'],
        parameters: [
          {
            name: 'projectId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Resumed',
          },
        },
      },
    },
    '/api/result/{projectId}': {
      get: {
        summary: 'Get execution result',
        tags: ['Execution'],
        parameters: [
          {
            name: 'projectId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Result',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ExecutionResult',
                },
              },
            },
          },
        },
      },
    },
    '/api/validate/code': {
      post: {
        summary: 'Validate code security',
        tags: ['Validation'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: {
                  code: {
                    type: 'string',
                    description: 'Code to validate',
                  },
                  projectId: {
                    type: 'string',
                    description: 'Project ID',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Validation results',
          },
        },
      },
    },
    '/api/sessions/{userId}': {
      get: {
        summary: 'List user sessions',
        tags: ['Sessions'],
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Sessions list',
          },
        },
      },
    },
    '/api/integrations': {
      get: {
        summary: 'Get enabled integrations',
        tags: ['System'],
        responses: {
          200: {
            description: 'Integration status',
          },
        },
      },
    },
    '/api/workflows': {
      get: {
        summary: 'Get workflow metrics',
        tags: ['Workflows'],
        responses: {
          200: {
            description: 'Workflow metrics',
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ExecutionResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          context: { type: 'object' },
          spec: { type: 'object' },
          proposals: {
            type: 'array',
            items: { $ref: '#/components/schemas/Proposal' },
          },
          cost: { $ref: '#/components/schemas/CostMetrics' },
          executionTime: { type: 'number' },
          error: { type: 'string' },
        },
      },
      ExecutionStatus: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          progress: { type: 'number' },
          currentPhase: { type: 'string' },
          estimates: { type: 'object' },
          metrics: { type: 'object' },
        },
      },
      Proposal: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          agentId: { type: 'string' },
          agentName: { type: 'string' },
          rationale: { type: 'string' },
          architecture: { type: 'string' },
          confidence: { type: 'number' },
          costEstimate: { type: 'number' },
        },
      },
      CostMetrics: {
        type: 'object',
        properties: {
          inputTokens: { type: 'number' },
          outputTokens: { type: 'number' },
          totalCost: { type: 'number' },
        },
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  tags: [
    {
      name: 'System',
      description: 'System health and status',
    },
    {
      name: 'Execution',
      description: 'Project execution',
    },
    {
      name: 'Validation',
      description: 'Code and spec validation',
    },
    {
      name: 'Sessions',
      description: 'User sessions',
    },
    {
      name: 'Workflows',
      description: 'Workflow management',
    },
  ],
};

export default openAPISpec;
