/**
 * Claude Code Bridge
 * Integrates Claude Code CLI with SwarmIDE2's orchestration phases.
 * Spawns Claude Code sessions and routes their output to the SwarmIDE2 pipeline.
 */

import { createSession, writeToSession, destroySession, onData, type TerminalSession } from './terminalProcessManager.js';

export interface ClaudeSession {
  sessionId: string;
  projectPath: string;
  startedAt: Date;
  isActive: boolean;
}

export interface ClaudeTaskResult {
  sessionId: string;
  output: string[];
  exitCode: number;
  durationMs: number;
  phase?: number;
}

export type ClaudeOutputHandler = (sessionId: string, chunk: string) => void;

// Active Claude Code sessions keyed by sessionId
const claudeSessions = new Map<string, ClaudeSession & { outputBuffer: string[] }>();
const outputHandlers: ClaudeOutputHandler[] = [];

// Register global data handler once
onData((sessionId, data) => {
  const session = claudeSessions.get(sessionId);
  if (!session) return;
  session.outputBuffer.push(data);
  outputHandlers.forEach(h => h(sessionId, data));
});

/**
 * Check whether Claude Code CLI is installed and accessible.
 */
export async function checkClaudeCodeAvailable(): Promise<boolean> {
  return new Promise(resolve => {
    const { spawn } = require('child_process');
    const proc = spawn('claude', ['--version'], { shell: true });
    proc.on('error', () => resolve(false));
    proc.on('close', (code: number) => resolve(code === 0));
  });
}

/**
 * Spawn a Claude Code interactive session in a given project directory.
 * Returns the session descriptor.
 */
export async function spawnClaudeSession(projectPath: string): Promise<ClaudeSession> {
  const termSession: TerminalSession = await createSession({
    cwd: projectPath,
    cols: 220,
    rows: 50,
    env: {
      CLAUDE_CODE_INTEGRATION: 'swarmide2',
      NO_COLOR: '0',
    },
  });

  const claudeSession: ClaudeSession & { outputBuffer: string[] } = {
    sessionId: termSession.id,
    projectPath,
    startedAt: new Date(),
    isActive: true,
    outputBuffer: [],
  };

  claudeSessions.set(termSession.id, claudeSession);

  // Launch Claude Code in the PTY
  writeToSession(termSession.id, 'claude\r');

  return claudeSession;
}

/**
 * Send a natural-language command to an active Claude Code session.
 */
export function sendClaudeCommand(sessionId: string, command: string): void {
  const session = claudeSessions.get(sessionId);
  if (!session?.isActive) throw new Error(`Claude session ${sessionId} is not active`);
  writeToSession(sessionId, command + '\r');
}

/**
 * Execute a one-shot Claude Code task (non-interactive) and return the result.
 * Uses `claude --print "<prompt>"` to capture output without interactive mode.
 */
export async function executeClaudeTask(
  projectPath: string,
  prompt: string,
  phase?: number,
  timeoutMs = 120_000,
): Promise<ClaudeTaskResult> {
  const startedAt = Date.now();
  const outputLines: string[] = [];

  const termSession = await createSession({
    cwd: projectPath,
    cols: 220,
    rows: 50,
    env: { CLAUDE_CODE_INTEGRATION: 'swarmide2' },
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      destroySession(termSession.id);
      reject(new Error(`Claude task timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Capture output for this specific session
    const cleanup = registerOutputHandler((sid, chunk) => {
      if (sid === termSession.id) {
        outputLines.push(chunk);
        outputHandlers.forEach(h => h(sid, chunk));
      }
    });

    // Use --print for non-interactive execution
    const escaped = prompt.replace(/"/g, '\\"');
    writeToSession(termSession.id, `claude --print "${escaped}"\r`);

    // Poll for completion (look for shell prompt reappearance)
    const pollInterval = setInterval(() => {
      const combined = outputLines.join('');
      // Shell is ready again when we see a $ prompt after the command output
      if (combined.includes('$ ') && outputLines.length > 2) {
        clearInterval(pollInterval);
        clearTimeout(timeout);
        cleanup();
        destroySession(termSession.id);
        resolve({
          sessionId: termSession.id,
          output: outputLines,
          exitCode: 0,
          durationMs: Date.now() - startedAt,
          phase,
        });
      }
    }, 500);
  });
}

/**
 * Close and clean up a Claude Code session.
 */
export function closeClaudeSession(sessionId: string): void {
  const session = claudeSessions.get(sessionId);
  if (session) {
    session.isActive = false;
    claudeSessions.delete(sessionId);
  }
  destroySession(sessionId);
}

/**
 * Register a handler for real-time Claude Code output.
 * Returns an unsubscribe function.
 */
export function onClaudeOutput(handler: ClaudeOutputHandler): () => void {
  outputHandlers.push(handler);
  return () => {
    const idx = outputHandlers.indexOf(handler);
    if (idx !== -1) outputHandlers.splice(idx, 1);
  };
}

/** Internal helper — register a one-shot data handler and return cleanup fn. */
function registerOutputHandler(handler: ClaudeOutputHandler): () => void {
  outputHandlers.push(handler);
  return () => {
    const idx = outputHandlers.indexOf(handler);
    if (idx !== -1) outputHandlers.splice(idx, 1);
  };
}

/**
 * Get all active Claude sessions.
 */
export function listClaudeSessions(): ClaudeSession[] {
  return Array.from(claudeSessions.values()).map(({ outputBuffer: _buf, ...session }) => session);
}

/**
 * Integration point: execute a Claude Code task as part of a SwarmIDE2 phase.
 * Returns the output as a proposal string for Phase 1 conflict resolution.
 */
export async function runClaudePhaseTask(
  projectPath: string,
  phasePrompt: string,
  phase: number,
): Promise<string> {
  const result = await executeClaudeTask(projectPath, phasePrompt, phase);
  return result.output
    .join('')
    .replace(/\x1b\[[0-9;]*m/g, '') // strip ANSI colour codes
    .trim();
}
