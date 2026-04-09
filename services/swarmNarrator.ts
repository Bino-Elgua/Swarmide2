/**
 * Swarm Narrator
 * Generates live human-readable narrations of what agents are doing,
 * tuned to different audiences using the configured LLM provider.
 *
 * Audiences:
 *   technical   — precise, implementation-focused commentary
 *   executive   — business-value framing, no jargon
 *   educational — step-by-step explanations for learners
 *   debug       — raw decision trace for troubleshooting
 *
 * Uses llmProviderRouter for resilient multi-provider fallback.
 * Emits NarrationEvent objects consumed by SwarmNarratorPanel.
 */

import type { Agent, NarrationEvent, NarrationAudience, ToneStyle } from '../types';
import { routeWithAdapter, type TaskComplexity } from './llmProviderRouter';
import { emitSwarmEvent } from './webSocketService';
import type { ProviderType } from './multiProviderService';

// ─── Audience system-prompt fragments ─────────────────────────────────────────

const AUDIENCE_FRAGMENTS: Record<NarrationAudience, string> = {
  technical: `You narrate for senior engineers. Use precise technical language.
Reference design patterns, data structures, and algorithmic trade-offs.
Be specific about what the agent is doing and why it chose this approach.`,

  executive: `You narrate for business stakeholders. No code or jargon.
Frame everything in terms of value delivered, risk mitigated, or cost saved.
Keep it to 1-2 sentences. Lead with the business outcome.`,

  educational: `You narrate for developers learning AI orchestration.
Explain what the agent is doing AND why it's doing it that way.
Use analogies. Connect the action to the broader orchestration goal.
Keep it encouraging and demystifying.`,

  debug: `You are a debug narrator. Enumerate the agent's decision path:
what input it received, what it inferred, what options it considered,
and what it chose. Be exhaustive. This is for troubleshooting.`,
};

// ─── Narration cache — deduplicates near-identical events ─────────────────────
const recentNarrations = new Map<string, number>(); // key → timestamp
const DEDUP_WINDOW_MS = 3000;

function isDuplicate(key: string): boolean {
  const last = recentNarrations.get(key);
  if (last && Date.now() - last < DEDUP_WINDOW_MS) return true;
  recentNarrations.set(key, Date.now());
  return false;
}

// ─── Event emitter ────────────────────────────────────────────────────────────

type NarrationHandler = (event: NarrationEvent) => void;
const handlers: NarrationHandler[] = [];

export function onNarration(handler: NarrationHandler): () => void {
  handlers.push(handler);
  return () => {
    const idx = handlers.indexOf(handler);
    if (idx !== -1) handlers.splice(idx, 1);
  };
}

function emit(event: NarrationEvent): void {
  handlers.forEach(h => {
    try { h(event); } catch { /* isolate handler errors */ }
  });
}

// ─── Core narration function ──────────────────────────────────────────────────

export interface NarrateOptions {
  audience?: NarrationAudience;
  tone?: ToneStyle;
  preferredProvider?: ProviderType;
  /** Skip LLM and use template-based narration for low-value events. */
  fastPath?: boolean;
}

/**
 * Narrate a single agent action.
 * Returns a NarrationEvent and emits it to all registered handlers.
 */
export async function narrateAgentAction(
  agent: Agent,
  action: string,
  context: string,
  opts: NarrateOptions = {},
): Promise<NarrationEvent> {
  const audience = opts.audience ?? 'technical';
  const tone     = opts.tone ?? agent.toneStyle ?? 'concise';

  const dupKey = `${agent.id}:${action.slice(0, 40)}`;
  if (isDuplicate(dupKey)) {
    // Return a silent no-op event rather than spamming
    return buildEvent(agent, action, '[duplicate suppressed]', audience, tone);
  }

  let narration: string;

  if (opts.fastPath) {
    narration = buildTemplateLine(agent, action, audience);
  } else {
    const complexity: TaskComplexity = audience === 'debug' ? 'complex' : 'simple';
    const systemPrompt = buildNarratorSystem(audience, tone);
    const userPrompt = [
      `Agent: ${agent.name} (${agent.role})`,
      `Action: ${action}`,
      `Context: ${context.slice(0, 500)}`,
      `Respond in 1-2 sentences only.`,
    ].join('\n');

    try {
      const result = await routeWithAdapter(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
        { complexity, preferredProvider: opts.preferredProvider, maxTokens: 150 },
      );
      narration = result.text.trim();
    } catch {
      // Graceful degradation: use template
      narration = buildTemplateLine(agent, action, audience);
    }
  }

  const event = buildEvent(agent, action, narration, audience, tone);
  emit(event);
  // Push to swarm-server broadcast so all connected clients receive it
  emitSwarmEvent('swarm:narration', { ...event, timestamp: event.timestamp.toISOString() }).catch(() => {});
  return event;
}

/**
 * Narrate the completion of an entire phase.
 */
export async function narratePhaseCompletion(
  phase: number,
  phaseName: string,
  summary: string,
  audience: NarrationAudience = 'executive',
  preferredProvider?: ProviderType,
): Promise<string> {
  const systemPrompt = `${AUDIENCE_FRAGMENTS[audience]}
Write a concise phase-completion announcement (2-3 sentences max).`;

  const userPrompt = `Phase ${phase} "${phaseName}" just completed.
Summary: ${summary.slice(0, 600)}`;

  try {
    const result = await routeWithAdapter(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { complexity: 'simple', preferredProvider, maxTokens: 200 },
    );
    return result.text.trim();
  } catch {
    return `Phase ${phase} (${phaseName}) completed successfully.`;
  }
}

/**
 * Generate an executive summary of the entire orchestration run.
 */
export async function generateExecutiveSummary(
  prompt: string,
  agentNames: string[],
  phaseCount: number,
  costUSD: number,
  preferredProvider?: ProviderType,
): Promise<string> {
  const systemPrompt = `${AUDIENCE_FRAGMENTS.executive}
Write a 3-4 sentence executive summary of this AI orchestration session.`;

  const userPrompt = [
    `Mission: ${prompt.slice(0, 300)}`,
    `Agents deployed: ${agentNames.slice(0, 8).join(', ')}`,
    `Phases completed: ${phaseCount}`,
    `Total cost: $${costUSD.toFixed(4)}`,
  ].join('\n');

  try {
    const result = await routeWithAdapter(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { complexity: 'moderate', preferredProvider, maxTokens: 300 },
    );
    return result.text.trim();
  } catch {
    return `The swarm completed ${phaseCount} phases using ${agentNames.length} agents at a cost of $${costUSD.toFixed(4)}.`;
  }
}

/**
 * Generate a "Live Conflict Theater" narration — narrate two agents debating.
 */
export async function narrateConflict(
  agentA: Agent,
  agentB: Agent,
  topicSummary: string,
  audience: NarrationAudience = 'technical',
  preferredProvider?: ProviderType,
): Promise<string> {
  const systemPrompt = `${AUDIENCE_FRAGMENTS[audience]}
Narrate the conflict between two agents as if you are a sports commentator calling
a live match. Be vivid and specific. 2-4 sentences.`;

  const userPrompt = [
    `Agent A: ${agentA.name} (${agentA.role}) — tone: ${agentA.toneStyle ?? 'moderate'}`,
    `Agent B: ${agentB.name} (${agentB.role}) — tone: ${agentB.toneStyle ?? 'moderate'}`,
    `Disputed topic: ${topicSummary.slice(0, 400)}`,
  ].join('\n');

  try {
    const result = await routeWithAdapter(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { complexity: 'moderate', preferredProvider, maxTokens: 250 },
    );
    return result.text.trim();
  } catch {
    return `${agentA.name} and ${agentB.name} are in conflict over: ${topicSummary.slice(0, 100)}`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildNarratorSystem(audience: NarrationAudience, tone: ToneStyle): string {
  const toneHints: Record<ToneStyle, string> = {
    academic:  'Write in formal, precise language.',
    casual:    'Write casually and accessibly.',
    playful:   'Add wit and lightness.',
    brutal:    'Be completely direct, no fluff.',
    concise:   'Use the fewest words possible.',
    poetic:    'Use evocative, narrative prose.',
    socratic:  'Frame the narration as a question that reveals an insight.',
  };
  return `You are the SwarmIDE2 Swarm Narrator. ${AUDIENCE_FRAGMENTS[audience]}
${toneHints[tone]}
NEVER invent facts. Only narrate what the context says.`;
}

function buildEvent(
  agent: Agent,
  action: string,
  narration: string,
  audience: NarrationAudience,
  toneStyle: ToneStyle,
  phase?: number,
): NarrationEvent {
  return {
    id:          `nar_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    agentId:     agent.id,
    agentName:   agent.name,
    agentIcon:   agent.icon,
    agentColor:  agent.color,
    action,
    narration,
    audience,
    toneStyle,
    timestamp:   new Date(),
    phase,
  };
}

function buildTemplateLine(agent: Agent, action: string, audience: NarrationAudience): string {
  const templates: Record<NarrationAudience, (a: string, n: string) => string> = {
    technical:   (a, n) => `${n} is executing ${a}.`,
    executive:   (a, n) => `${n} is making progress on the task.`,
    educational: (a, n) => `${n} is now ${a.toLowerCase()} — this step helps the swarm move forward.`,
    debug:       (a, n) => `[TRACE] agent=${n} action=${a} ts=${Date.now()}`,
  };
  return templates[audience](action, agent.name);
}
