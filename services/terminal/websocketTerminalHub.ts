/**
 * WebSocket Terminal Hub
 * Bridges Socket.io WebSocket connections to PTY sessions.
 * Handles multiplexing: one Socket.io namespace, many sessions.
 *
 * Events emitted to client:
 *   terminal:data      { sessionId, data }        — PTY output chunk
 *   terminal:created   { session }                — new session descriptor
 *   terminal:destroyed { sessionId }              — session ended
 *   terminal:sessions  { sessions }               — list of active sessions
 *   terminal:error     { sessionId?, message }    — error notification
 *   git:result         { sessionId, result }      — git operation result
 *   nl:parsed          { sessionId, command }     — NL→command parse result
 *
 * Events received from client:
 *   terminal:create    { cwd?, cols?, rows? }     — create new session
 *   terminal:input     { sessionId, data }        — send input to PTY
 *   terminal:resize    { sessionId, cols, rows }  — resize terminal
 *   terminal:destroy   { sessionId }              — kill session
 *   terminal:list      {}                         — list sessions
 *   git:operation      { sessionId, op, args }    — run a git operation
 *   nl:execute         { sessionId, prompt }      — parse & execute NL command
 */

import type { Server as HttpServer } from 'http';
import type { Server as SocketServer, Socket } from 'socket.io';

import {
  createSession,
  writeToSession,
  resizeSession,
  destroySession,
  listSessions,
  onData,
  onExit,
} from './terminalProcessManager.js';

import { executeGitOperation } from './gitWorkflowService.js';
import { parseAndExecuteNL } from './naturalLanguageParser.js';

let io: SocketServer | null = null;

/**
 * Attach the WebSocket Terminal Hub to an existing HTTP server.
 * Call this once from the terminal backend server.
 */
export function attachTerminalHub(httpServer: HttpServer): SocketServer {
  // Lazy import to keep this module usable in tests without socket.io installed
  const { Server } = require('socket.io') as typeof import('socket.io');

  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    namespace: '/terminal',
  });

  // Forward PTY output to all sockets subscribed to that session
  onData((sessionId, data) => {
    io?.emit('terminal:data', { sessionId, data });
  });

  // Notify when a PTY session ends
  onExit((sessionId, exitCode) => {
    io?.emit('terminal:destroyed', { sessionId, exitCode });
  });

  io.on('connection', (socket: Socket) => {
    handleConnection(socket);
  });

  return io;
}

function handleConnection(socket: Socket): void {
  // ── Create ────────────────────────────────────────────────────────────────
  socket.on('terminal:create', async (payload: { cwd?: string; cols?: number; rows?: number }) => {
    try {
      const session = await createSession({
        cwd: payload.cwd,
        cols: payload.cols ?? 120,
        rows: payload.rows ?? 30,
      });
      socket.emit('terminal:created', { session });
    } catch (err) {
      socket.emit('terminal:error', { message: String(err) });
    }
  });

  // ── Input ─────────────────────────────────────────────────────────────────
  socket.on('terminal:input', (payload: { sessionId: string; data: string }) => {
    try {
      writeToSession(payload.sessionId, payload.data);
    } catch (err) {
      socket.emit('terminal:error', { sessionId: payload.sessionId, message: String(err) });
    }
  });

  // ── Resize ────────────────────────────────────────────────────────────────
  socket.on('terminal:resize', (payload: { sessionId: string; cols: number; rows: number }) => {
    try {
      resizeSession(payload.sessionId, payload.cols, payload.rows);
    } catch (err) {
      socket.emit('terminal:error', { sessionId: payload.sessionId, message: String(err) });
    }
  });

  // ── Destroy ───────────────────────────────────────────────────────────────
  socket.on('terminal:destroy', (payload: { sessionId: string }) => {
    destroySession(payload.sessionId);
    socket.emit('terminal:destroyed', { sessionId: payload.sessionId });
  });

  // ── List ──────────────────────────────────────────────────────────────────
  socket.on('terminal:list', () => {
    socket.emit('terminal:sessions', { sessions: listSessions() });
  });

  // ── Git operations ────────────────────────────────────────────────────────
  socket.on(
    'git:operation',
    async (payload: { sessionId: string; op: string; args?: Record<string, unknown> }) => {
      try {
        const result = await executeGitOperation(payload.op, payload.args ?? {});
        socket.emit('git:result', { sessionId: payload.sessionId, result });
      } catch (err) {
        socket.emit('terminal:error', { sessionId: payload.sessionId, message: String(err) });
      }
    },
  );

  // ── Natural Language → Command ────────────────────────────────────────────
  socket.on('nl:execute', async (payload: { sessionId: string; prompt: string }) => {
    try {
      const command = await parseAndExecuteNL(payload.prompt, payload.sessionId);
      socket.emit('nl:parsed', { sessionId: payload.sessionId, command });
    } catch (err) {
      socket.emit('terminal:error', { sessionId: payload.sessionId, message: String(err) });
    }
  });
}

/**
 * Broadcast a message to all connected clients (used by phase integrations).
 */
export function broadcastPhaseEvent(event: string, data: unknown): void {
  io?.emit(event, data);
}

/**
 * Broadcast a terminal output line from within a phase execution.
 * Appears in the SwarmIDE2 terminal as a system message.
 */
export function broadcastPhaseLog(phase: number, message: string): void {
  broadcastPhaseEvent('terminal:data', {
    sessionId: 'system',
    data: `\r\n\x1b[36m[Phase ${phase}]\x1b[0m ${message}\r\n`,
  });
}
