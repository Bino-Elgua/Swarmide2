/**
 * useTerminalBridge
 * React hook that connects the SwarmIDE2 terminal UI to the real PTY backend
 * via Socket.io WebSocket. Falls back gracefully when the backend is offline.
 *
 * Usage:
 *   const {
 *     isConnected, sessions, activeSessionId,
 *     createSession, sendInput, resizeSession, destroySession,
 *     terminalOutput, gitStatus, runGitOp, executeNL,
 *   } = useTerminalBridge();
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const TERMINAL_SERVER_URL = 'http://localhost:3001';
const RECONNECT_DELAY_MS = 3000;

export interface TerminalSession {
  id: string;
  pid: number;
  cwd: string;
  shell: string;
  cols: number;
  rows: number;
  createdAt: string;
  lastActivity: string;
}

export interface TerminalOutputLine {
  sessionId: string;
  data: string;
  timestamp: number;
}

export interface GitStatusInfo {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  conflicted: string[];
}

export interface ParsedNLCommand {
  type: 'shell' | 'git' | 'phase' | 'system';
  command: string;
  explanation: string;
  confidence: number;
  phase?: number;
}

/**
 * Subset of LLMConfig passed from App.tsx to the terminal backend.
 * Maps directly to SwarmIDE2's AIProvider values and the orchestrator config.
 * The apiKey is transmitted over localhost only — never to a third party.
 */
export interface TerminalLLMConfig {
  provider: string;   // 'google'|'anthropic'|'openai'|'groq'|'mistral'|'deepseek'|'ollama'
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface TerminalBridgeState {
  isConnected: boolean;
  isConnecting: boolean;
  sessions: TerminalSession[];
  activeSessionId: string | null;
  terminalOutput: TerminalOutputLine[];
  gitStatus: GitStatusInfo | null;
  lastNLCommand: ParsedNLCommand | null;
}

export interface TerminalBridgeActions {
  createSession: (opts?: { cwd?: string; cols?: number; rows?: number }) => void;
  sendInput: (data: string, sessionId?: string) => void;
  resizeSession: (cols: number, rows: number, sessionId?: string) => void;
  destroySession: (sessionId?: string) => void;
  setActiveSession: (sessionId: string) => void;
  runGitOp: (op: string, args?: Record<string, unknown>) => void;
  /** Execute a natural language command using the configured LLM provider. */
  executeNL: (prompt: string, llmConfig?: TerminalLLMConfig) => void;
  clearOutput: () => void;
}

export type TerminalBridgeHook = TerminalBridgeState & TerminalBridgeActions;

export function useTerminalBridge(): TerminalBridgeHook {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<TerminalOutputLine[]>([]);
  const [gitStatus, setGitStatus] = useState<GitStatusInfo | null>(null);
  const [lastNLCommand, setLastNLCommand] = useState<ParsedNLCommand | null>(null);

  const socketRef = useRef<ReturnType<typeof import('socket.io-client').io> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Connection management ──────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (socketRef.current?.connected) return;

    setIsConnecting(true);

    try {
      // Lazy-load socket.io-client (only available in browser)
      const { io } = await import('socket.io-client');
      const socket = io(TERMINAL_SERVER_URL, {
        path: '/terminal-ws',
        transports: ['websocket', 'polling'],
        reconnection: false, // we manage reconnect manually
        timeout: 5000,
      });

      socket.on('connect', () => {
        setIsConnected(true);
        setIsConnecting(false);
        // Request current session list
        socket.emit('terminal:list', {});
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
        scheduleReconnect();
      });

      socket.on('connect_error', () => {
        setIsConnected(false);
        setIsConnecting(false);
        scheduleReconnect();
      });

      // Terminal events
      socket.on('terminal:data', (payload: { sessionId: string; data: string }) => {
        setTerminalOutput(prev => [
          ...prev.slice(-2000), // keep last 2000 lines
          { sessionId: payload.sessionId, data: payload.data, timestamp: Date.now() },
        ]);
      });

      socket.on('terminal:created', (payload: { session: TerminalSession }) => {
        setSessions(prev => [...prev.filter(s => s.id !== payload.session.id), payload.session]);
        setActiveSessionId(payload.session.id);
      });

      socket.on('terminal:destroyed', (payload: { sessionId: string }) => {
        setSessions(prev => prev.filter(s => s.id !== payload.sessionId));
        setActiveSessionId(prev => (prev === payload.sessionId ? null : prev));
      });

      socket.on('terminal:sessions', (payload: { sessions: TerminalSession[] }) => {
        setSessions(payload.sessions);
        if (payload.sessions.length > 0 && !activeSessionId) {
          setActiveSessionId(payload.sessions[0].id);
        }
      });

      // Git events
      socket.on('git:result', (payload: { sessionId: string; result: unknown; success: boolean }) => {
        if (payload.success && payload.result && typeof payload.result === 'object') {
          const r = payload.result as Record<string, unknown>;
          if ('current' in r) {
            // It's a git status result
            setGitStatus({
              branch: (r.current as string) ?? 'HEAD',
              ahead: (r.ahead as number) ?? 0,
              behind: (r.behind as number) ?? 0,
              staged: (r.staged as string[]) ?? [],
              unstaged: (r.modified as string[]) ?? [],
              untracked: (r.not_added as string[]) ?? [],
              conflicted: (r.conflicted as string[]) ?? [],
            });
          }
        }
      });

      // NL parse results
      socket.on('nl:parsed', (payload: { sessionId: string; command: ParsedNLCommand }) => {
        setLastNLCommand(payload.command);
      });

      socketRef.current = socket;
    } catch {
      setIsConnecting(false);
      scheduleReconnect();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleReconnect() {
    if (reconnectTimer.current) return;
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      connect();
    }, RECONNECT_DELAY_MS);
  }

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socketRef.current?.disconnect();
    };
  }, [connect]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const createSession = useCallback((opts?: { cwd?: string; cols?: number; rows?: number }) => {
    socketRef.current?.emit('terminal:create', opts ?? {});
  }, []);

  const sendInput = useCallback((data: string, sessionId?: string) => {
    const sid = sessionId ?? activeSessionId;
    if (!sid) return;
    socketRef.current?.emit('terminal:input', { sessionId: sid, data });
  }, [activeSessionId]);

  const resizeSession = useCallback((cols: number, rows: number, sessionId?: string) => {
    const sid = sessionId ?? activeSessionId;
    if (!sid) return;
    socketRef.current?.emit('terminal:resize', { sessionId: sid, cols, rows });
  }, [activeSessionId]);

  const destroySession = useCallback((sessionId?: string) => {
    const sid = sessionId ?? activeSessionId;
    if (!sid) return;
    socketRef.current?.emit('terminal:destroy', { sessionId: sid });
  }, [activeSessionId]);

  const runGitOp = useCallback((op: string, args: Record<string, unknown> = {}) => {
    socketRef.current?.emit('git:operation', {
      op,
      args,
      sessionId: activeSessionId,
    });
  }, [activeSessionId]);

  const executeNL = useCallback((prompt: string, llmConfig?: TerminalLLMConfig) => {
    socketRef.current?.emit('nl:execute', {
      prompt,
      sessionId: activeSessionId,
      // Forward the configured provider so the server uses the right LLM.
      // undefined = server infers from its own env vars.
      llmConfig: llmConfig ?? undefined,
    });
  }, [activeSessionId]);

  const clearOutput = useCallback(() => {
    setTerminalOutput([]);
  }, []);

  return {
    isConnected,
    isConnecting,
    sessions,
    activeSessionId,
    terminalOutput,
    gitStatus,
    lastNLCommand,
    createSession,
    sendInput,
    resizeSession,
    destroySession,
    setActiveSession: setActiveSessionId,
    runGitOp,
    executeNL,
    clearOutput,
  };
}
