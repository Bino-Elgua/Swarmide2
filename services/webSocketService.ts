/**
 * WebSocket Service — Frontend
 * React hook + singleton that connects the SwarmIDE2 React app to the
 * existing api/websocket.ts server, plus the new swarm-specific events:
 *
 *   swarm:thought       — agent emits a reasoning step
 *   swarm:narration     — SwarmNarrator emits a narration line
 *   swarm:cost          — live cost tick
 *   swarm:phase         — phase transition
 *   swarm:conflict      — conflict detected
 *   swarm:resolved      — conflict resolved
 *   swarm:agent_status  — agent status change
 *
 * The singleton pattern means multiple React components can subscribe
 * without creating redundant connections.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { NarrationEvent, NarrationAudience, SwarmSocketEvent } from '../types';

const SWARM_WS_URL = 'http://localhost:3002'; // separate port from terminal server (3001)
const RECONNECT_DELAY_MS = 4000;

// ─── Event payload types ──────────────────────────────────────────────────────

export interface SwarmThoughtPayload {
  agentId: string;
  agentName: string;
  agentColor: string;
  thought: string;
  phase?: number;
  timestamp: string;
}

export interface SwarmCostPayload {
  agentId: string;
  agentName: string;
  deltaUSD: number;
  totalUSD: number;
  tokens: number;
  provider: string;
  timestamp: string;
}

export interface SwarmPhasePayload {
  fromPhase: number;
  toPhase: number;
  phaseName: string;
  narration?: string;
  timestamp: string;
}

export interface SwarmConflictPayload {
  agentAId: string;
  agentAName: string;
  agentBId: string;
  agentBName: string;
  topic: string;
  narration?: string;
  timestamp: string;
}

export interface SwarmAgentStatusPayload {
  agentId: string;
  agentName: string;
  agentColor: string;
  agentIcon: string;
  status: string;
  timestamp: string;
}

// ─── Hook state / actions ─────────────────────────────────────────────────────

export interface SwarmSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  /** Live feed of agent thoughts (capped at 200). */
  thoughts: SwarmThoughtPayload[];
  /** Live narration feed (capped at 100). */
  narrations: NarrationEvent[];
  /** Live cost ticks. */
  costTicks: SwarmCostPayload[];
  /** Phase transitions. */
  phaseEvents: SwarmPhasePayload[];
  /** Active conflicts. */
  conflicts: SwarmConflictPayload[];
}

export interface SwarmSocketActions {
  clearThoughts: () => void;
  clearNarrations: () => void;
  /** Emit a manual thought from the app side (for server-side broadcast). */
  emitThought: (payload: Omit<SwarmThoughtPayload, 'timestamp'>) => void;
  /** Request a narration for a given agent action. */
  requestNarration: (agentId: string, action: string, context: string, audience: NarrationAudience) => void;
  setAudience: (audience: NarrationAudience) => void;
  currentAudience: NarrationAudience;
}

export type SwarmSocketHook = SwarmSocketState & SwarmSocketActions;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSwarmWebSocket(): SwarmSocketHook {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [thoughts, setThoughts] = useState<SwarmThoughtPayload[]>([]);
  const [narrations, setNarrations] = useState<NarrationEvent[]>([]);
  const [costTicks, setCostTicks] = useState<SwarmCostPayload[]>([]);
  const [phaseEvents, setPhaseEvents] = useState<SwarmPhasePayload[]>([]);
  const [conflicts, setConflicts] = useState<SwarmConflictPayload[]>([]);
  const [currentAudience, setAudienceState] = useState<NarrationAudience>('technical');

  const socketRef = useRef<ReturnType<typeof import('socket.io-client').io> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) return;
    setIsConnecting(true);
    try {
      const { io } = await import('socket.io-client');
      const socket = io(SWARM_WS_URL, {
        path: '/swarm-ws',
        transports: ['websocket', 'polling'],
        reconnection: false,
        timeout: 5000,
      });

      socket.on('connect', () => { setIsConnected(true); setIsConnecting(false); });
      socket.on('disconnect', () => { setIsConnected(false); scheduleReconnect(); });
      socket.on('connect_error', () => { setIsConnected(false); setIsConnecting(false); scheduleReconnect(); });

      // Hydrate on initial connect — server sends buffered history
      socket.on('swarm:hydrate', (state: {
        thoughts: SwarmThoughtPayload[];
        narrations: NarrationEvent[];
        costTicks: SwarmCostPayload[];
        phases: SwarmPhasePayload[];
        conflicts: SwarmConflictPayload[];
      }) => {
        if (state.thoughts?.length)   setThoughts(state.thoughts.slice(-200));
        if (state.narrations?.length) setNarrations(state.narrations.map(n => ({ ...n, timestamp: new Date(n.timestamp) })));
        if (state.costTicks?.length)  setCostTicks(state.costTicks.slice(-50));
        if (state.phases?.length)     setPhaseEvents(state.phases);
        if (state.conflicts?.length)  setConflicts(state.conflicts);
      });

      socket.on('swarm:thought', (p: SwarmThoughtPayload) => {
        setThoughts(prev => [...prev.slice(-199), p]);
      });

      socket.on('swarm:narration', (p: NarrationEvent) => {
        setNarrations(prev => [...prev.slice(-99), { ...p, timestamp: new Date(p.timestamp) }]);
      });

      socket.on('swarm:cost', (p: SwarmCostPayload) => {
        setCostTicks(prev => [...prev.slice(-49), p]);
      });

      socket.on('swarm:phase', (p: SwarmPhasePayload) => {
        setPhaseEvents(prev => [...prev, p]);
      });

      socket.on('swarm:conflict', (p: SwarmConflictPayload) => {
        setConflicts(prev => [...prev, p]);
      });

      socket.on('swarm:resolved', (p: { agentAId: string; agentBId: string }) => {
        setConflicts(prev => prev.filter(c => !(c.agentAId === p.agentAId && c.agentBId === p.agentBId)));
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

  const clearThoughts   = useCallback(() => setThoughts([]),   []);
  const clearNarrations = useCallback(() => setNarrations([]), []);

  const emitThought = useCallback((payload: Omit<SwarmThoughtPayload, 'timestamp'>) => {
    socketRef.current?.emit('swarm:thought', { ...payload, timestamp: new Date().toISOString() });
    // Optimistic local add so the UI updates immediately even if offline
    setThoughts(prev => [...prev.slice(-199), { ...payload, timestamp: new Date().toISOString() }]);
  }, []);

  const requestNarration = useCallback((
    agentId: string,
    action: string,
    context: string,
    audience: NarrationAudience,
  ) => {
    socketRef.current?.emit('swarm:request_narration', { agentId, action, context, audience });
  }, []);

  const setAudience = useCallback((audience: NarrationAudience) => {
    setAudienceState(audience);
    socketRef.current?.emit('swarm:set_audience', { audience });
  }, []);

  return {
    isConnected, isConnecting,
    thoughts, narrations, costTicks, phaseEvents, conflicts,
    clearThoughts, clearNarrations,
    emitThought, requestNarration,
    setAudience, currentAudience,
  };
}

// ─── Standalone emitter for use in services (outside React) ──────────────────

// Map from SwarmSocketEvent to REST broadcast path suffix
const EVENT_BROADCAST_PATH: Partial<Record<SwarmSocketEvent, string>> = {
  'swarm:thought':       'thought',
  'swarm:narration':     'narration',
  'swarm:cost':          'cost',
  'swarm:phase':         'phase',
  'swarm:conflict':      'conflict',
  'swarm:resolved':      'resolved',
  'swarm:agent_status':  'agent_status',
};

/**
 * Emit a swarm event directly from a service without going through the hook.
 * Uses the swarm-server's HTTP broadcast REST API — no transient socket needed.
 * Falls back silently if the server is not running.
 */
export async function emitSwarmEvent(
  event: SwarmSocketEvent,
  payload: unknown,
): Promise<void> {
  const suffix = EVENT_BROADCAST_PATH[event];
  if (!suffix) return;
  try {
    await fetch(`${SWARM_WS_URL}/broadcast/${suffix}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Swarm server not running — silently ignore
  }
}
