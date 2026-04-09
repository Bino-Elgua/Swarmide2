/**
 * Terminal Process Manager
 * Manages real PTY (pseudo-terminal) sessions using node-pty.
 * Each session gets its own shell process with full I/O streaming.
 */

export interface TerminalSession {
  id: string;
  pid: number;
  cwd: string;
  shell: string;
  createdAt: Date;
  lastActivity: Date;
  cols: number;
  rows: number;
}

export interface SessionCreateOptions {
  cwd?: string;
  shell?: string;
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
}

export type DataHandler = (sessionId: string, data: string) => void;
export type ExitHandler = (sessionId: string, exitCode: number) => void;

// Dynamic import guard — node-pty is a native module only available server-side
let pty: typeof import('node-pty') | null = null;
async function getPty() {
  if (!pty) {
    pty = await import('node-pty');
  }
  return pty;
}

// Map of sessionId → { ptyProcess, session }
const sessions = new Map<string, { process: import('node-pty').IPty; session: TerminalSession }>();
const dataHandlers: DataHandler[] = [];
const exitHandlers: ExitHandler[] = [];

function generateSessionId(): string {
  return `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a new PTY terminal session.
 */
export async function createSession(options: SessionCreateOptions = {}): Promise<TerminalSession> {
  const nodePty = await getPty();

  const id = generateSessionId();
  const shell = options.shell ?? (process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL ?? '/bin/bash'));
  const cwd = options.cwd ?? process.env.HOME ?? process.cwd();
  const cols = options.cols ?? 120;
  const rows = options.rows ?? 30;

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    ...(options.env ?? {}),
  };

  const ptyProcess = nodePty.spawn(shell, [], { name: 'xterm-256color', cols, rows, cwd, env });

  const session: TerminalSession = {
    id,
    pid: ptyProcess.pid,
    cwd,
    shell,
    createdAt: new Date(),
    lastActivity: new Date(),
    cols,
    rows,
  };

  ptyProcess.onData((data: string) => {
    session.lastActivity = new Date();
    dataHandlers.forEach(h => h(id, data));
  });

  ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
    sessions.delete(id);
    exitHandlers.forEach(h => h(id, exitCode));
  });

  sessions.set(id, { process: ptyProcess, session });
  return session;
}

/**
 * Write input to a running PTY session.
 */
export function writeToSession(sessionId: string, data: string): void {
  const entry = sessions.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} not found`);
  entry.session.lastActivity = new Date();
  entry.process.write(data);
}

/**
 * Resize a PTY session's terminal dimensions.
 */
export function resizeSession(sessionId: string, cols: number, rows: number): void {
  const entry = sessions.get(sessionId);
  if (!entry) throw new Error(`Session ${sessionId} not found`);
  entry.process.resize(cols, rows);
  entry.session.cols = cols;
  entry.session.rows = rows;
}

/**
 * Kill and remove a PTY session.
 */
export function destroySession(sessionId: string): void {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  try {
    entry.process.kill();
  } catch {
    // already dead
  }
  sessions.delete(sessionId);
}

/**
 * List all active sessions.
 */
export function listSessions(): TerminalSession[] {
  return Array.from(sessions.values()).map(e => ({ ...e.session }));
}

/**
 * Get a single session by ID.
 */
export function getSession(sessionId: string): TerminalSession | undefined {
  return sessions.get(sessionId)?.session;
}

/**
 * Register a handler for PTY data output.
 */
export function onData(handler: DataHandler): void {
  dataHandlers.push(handler);
}

/**
 * Register a handler for PTY process exit.
 */
export function onExit(handler: ExitHandler): void {
  exitHandlers.push(handler);
}

/**
 * Clean up idle sessions older than maxIdleMs (default 30 minutes).
 */
export function pruneIdleSessions(maxIdleMs = 30 * 60 * 1000): number {
  const now = Date.now();
  let pruned = 0;
  for (const [id, { session }] of sessions) {
    if (now - session.lastActivity.getTime() > maxIdleMs) {
      destroySession(id);
      pruned++;
    }
  }
  return pruned;
}
