// WebSocket server for real-time updates
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { appIntegration } from '../services/appIntegration';
import { durableWorkflowService } from '../services/durableWorkflowService';

export class SwarmIDE2WebSocketServer {
  private io: SocketIOServer;
  private userProjectMap: Map<string, Set<string>> = new Map();
  private projectStatusMap: Map<string, any> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🔗 Client connected: ${socket.id}`);

      // User joins project room
      socket.on('join-project', (projectId: string, userId: string) => {
        socket.join(`project:${projectId}`);
        socket.join(`user:${userId}`);

        // Track user-project mapping
        if (!this.userProjectMap.has(userId)) {
          this.userProjectMap.set(userId, new Set());
        }
        this.userProjectMap.get(userId)!.add(projectId);

        socket.emit('joined', { projectId, userId });
        this.io.to(`project:${projectId}`).emit('user-joined', {
          userId,
          timestamp: new Date().toISOString(),
        });
      });

      // User leaves project
      socket.on('leave-project', (projectId: string, userId: string) => {
        socket.leave(`project:${projectId}`);
        const projects = this.userProjectMap.get(userId);
        if (projects) {
          projects.delete(projectId);
        }

        this.io.to(`project:${projectId}`).emit('user-left', { userId });
      });

      // Start execution with real-time updates
      socket.on(
        'execute-project',
        async (data: { prompt: string; userId: string; projectId: string; registry: any[] }) => {
          try {
            socket.emit('execution-started', { projectId: data.projectId });

            const result = await appIntegration.executeProject(
              data.prompt,
              data.userId,
              data.registry
            );

            // Emit phase updates
            socket.emit('execution-phase', {
              projectId: data.projectId,
              phase: 'normalization',
              progress: 20,
            });

            socket.emit('execution-phase', {
              projectId: data.projectId,
              phase: 'specification',
              progress: 40,
            });

            socket.emit('execution-phase', {
              projectId: data.projectId,
              phase: 'generation',
              progress: 60,
            });

            socket.emit('execution-phase', {
              projectId: data.projectId,
              phase: 'validation',
              progress: 80,
            });

            // Emit cost update
            socket.emit('cost-update', {
              projectId: data.projectId,
              cost: result.cost,
            });

            // Emit final result
            socket.emit('execution-complete', {
              projectId: data.projectId,
              result,
            });

            // Broadcast to all users in project
            this.io.to(`project:${data.projectId}`).emit('project-update', {
              projectId: data.projectId,
              result,
              timestamp: new Date().toISOString(),
            });
          } catch (error: any) {
            socket.emit('execution-error', {
              projectId: data.projectId,
              error: error.message,
            });
          }
        }
      );

      // Subscribe to status updates
      socket.on('subscribe-status', async (projectId: string) => {
        // Send initial status
        const status = await appIntegration.getStatus(projectId);
        socket.emit('status-update', status);

        // Set up polling for status updates
        const interval = setInterval(async () => {
          if (!socket.connected) {
            clearInterval(interval);
            return;
          }

          const updatedStatus = await appIntegration.getStatus(projectId);
          socket.emit('status-update', updatedStatus);
        }, 1000); // Update every 1 second

        socket.on('disconnect', () => clearInterval(interval));
      });

      // Request status on demand
      socket.on('get-status', async (projectId: string) => {
        const status = await appIntegration.getStatus(projectId);
        socket.emit('status-response', status);
      });

      // Subscribe to cost tracking
      socket.on('subscribe-cost', (projectId: string) => {
        socket.on('cost-query', async () => {
          const result = appIntegration.getResult(projectId);
          if (result?.cost) {
            socket.emit('cost-response', result.cost);
          }
        });
      });

      // Subscribe to logs
      socket.on('subscribe-logs', (projectId: string) => {
        const logRoom = `logs:${projectId}`;
        socket.join(logRoom);
      });

      // Emit log from server
      socket.on('emit-log', (projectId: string, message: string) => {
        const logRoom = `logs:${projectId}`;
        this.io.to(logRoom).emit('log-message', {
          projectId,
          message,
          timestamp: new Date().toISOString(),
        });
      });

      // Disconnect handler
      socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
      });

      // Error handler
      socket.on('error', (error: any) => {
        console.error(`WebSocket error on ${socket.id}:`, error);
      });
    });
  }

  // Emit status update to all clients in project
  emitStatusUpdate(projectId: string, status: any): void {
    this.io.to(`project:${projectId}`).emit('status-update', status);
  }

  // Emit cost update
  emitCostUpdate(projectId: string, cost: any): void {
    this.io.to(`project:${projectId}`).emit('cost-update', {
      projectId,
      cost,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit phase update
  emitPhaseUpdate(projectId: string, phase: string, progress: number): void {
    this.io.to(`project:${projectId}`).emit('phase-update', {
      projectId,
      phase,
      progress,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit log message
  emitLog(projectId: string, message: string, level = 'info'): void {
    this.io.to(`logs:${projectId}`).emit('log-message', {
      projectId,
      message,
      level,
      timestamp: new Date().toISOString(),
    });
  }

  // Broadcast to all clients
  broadcast(event: string, data: any): void {
    this.io.emit(event, data);
  }

  // Get connected clients count
  getClientCount(): number {
    return this.io.engine.clientsCount || 0;
  }

  // Get clients in project
  getProjectClients(projectId: string): number {
    return this.io.sockets.adapter.rooms.get(`project:${projectId}`)?.size || 0;
  }
}

export default SwarmIDE2WebSocketServer;
