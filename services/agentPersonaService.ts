/**
 * Agent Persona Service
 * Maps each agent's existing personality fields (archetype, formalism/humor/empathy
 * levels, verbosity, etc.) to a structured AgentPersonaConfig with:
 *  - A resolved ToneStyle
 *  - A system-prompt fragment that shapes how the agent writes
 *  - UI display metadata (badge colour, icon, label)
 *
 * The tone styles are: academic | casual | playful | brutal | concise | poetic | socratic
 *
 * Prompt fragments are injected into LLM system prompts BEFORE the task description
 * so every response carries the agent's personality signature.
 */

import type { Agent, AgentPersonaConfig, ToneStyle, AgentArchetype } from '../types';

// ─── Tone definitions ──────────────────────────────────────────────────────────

interface ToneDef {
  label: string;
  badgeColor: string;
  icon: string;
  /** System-prompt fragment injected for this tone. */
  fragment: string;
}

const TONE_DEFS: Record<ToneStyle, ToneDef> = {
  academic: {
    label: 'Academic',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: 'fa-graduation-cap',
    fragment: `Communicate in a formal, academic register. Structure your responses with clear
logical hierarchy. Reference evidence and first principles. Use precise technical
vocabulary. Avoid colloquialisms. When uncertain, state confidence intervals.`,
  },
  casual: {
    label: 'Casual',
    badgeColor: 'bg-green-500/20 text-green-300 border-green-500/30',
    icon: 'fa-comments',
    fragment: `Write in a relaxed, conversational tone. Use contractions freely. Break complex
ideas into digestible chunks with everyday analogies. Be approachable and friendly.
Avoid jargon unless you immediately explain it.`,
  },
  playful: {
    label: 'Playful',
    badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    icon: 'fa-face-grin-wink',
    fragment: `Bring wit and levity to your responses. Use clever metaphors, light humour, and
occasional wordplay. Emoji usage is encouraged where it adds colour. Make even
dry technical topics feel fun and energetic.`,
  },
  brutal: {
    label: 'Brutal',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30',
    icon: 'fa-skull',
    fragment: `Be ruthlessly direct. No pleasantries, no hedging, no padding. State exactly what
is wrong and why. Skip praise for obvious work. Your job is signal, not comfort.
If something is bad, say so plainly. Brevity is a virtue.`,
  },
  concise: {
    label: 'Concise',
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    icon: 'fa-compress',
    fragment: `Maximise information density. Use bullet points and short sentences. Remove every
word that doesn't carry its weight. Prefer active voice. Target 50% fewer words
than you think you need while preserving all meaning.`,
  },
  poetic: {
    label: 'Poetic',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    icon: 'fa-feather-pointed',
    fragment: `Write in flowing, evocative prose. Use narrative structure to carry the reader
through ideas. Employ rich metaphors and imagery. Even technical decisions can
be framed as stories. Make the work feel meaningful, not mechanical.`,
  },
  socratic: {
    label: 'Socratic',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    icon: 'fa-circle-question',
    fragment: `Lead with questions before answers. Challenge assumptions by asking what the
questioner actually needs. Guide the user to discover solutions themselves.
When you give an answer, follow it with a question that deepens understanding.`,
  },
};

// ─── Archetype → default tone mapping ─────────────────────────────────────────

const ARCHETYPE_TONE: Record<AgentArchetype, ToneStyle> = {
  expert:      'academic',
  assistant:   'casual',
  rebel:       'brutal',
  critic:      'brutal',
  philosopher: 'socratic',
};

// ─── Tone inference from numeric personality fields ────────────────────────────

/**
 * Derive a tone style from an agent's numeric personality sliders when no
 * explicit toneStyle is set. Mirrors the NarratorIDE heuristic.
 */
function inferToneFromFields(agent: Agent): ToneStyle {
  const formalism  = agent.formalismLevel  ?? 0.5;
  const humor      = agent.humorLevel      ?? 0.2;
  const directness = agent.directnessLevel ?? 0.5;
  const verbosity  = agent.verbosity       ?? 0.5;

  if (formalism > 0.75)  return 'academic';
  if (humor > 0.65)      return 'playful';
  if (directness > 0.8 && verbosity < 0.4) return 'brutal';
  if (verbosity < 0.3)   return 'concise';
  if (formalism < 0.3 && humor < 0.3) return 'poetic';
  if (agent.archetype)   return ARCHETYPE_TONE[agent.archetype] ?? 'casual';
  return 'casual';
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a full AgentPersonaConfig for an agent.
 * If the agent already has a toneStyle set, that takes precedence.
 * Otherwise we infer from personality fields → archetype → default.
 */
export function buildPersonaConfig(agent: Agent): AgentPersonaConfig {
  const tone = agent.toneStyle ?? inferToneFromFields(agent);
  const def  = TONE_DEFS[tone];

  // Augment the fragment with agent-specific personality flavour
  const personalityClause = agent.personality
    ? `\n\nYour personality: ${agent.personality.slice(0, 300)}`
    : '';
  const mantraClause = agent.mantra
    ? `\nYour guiding mantra: "${agent.mantra}"`
    : '';

  return {
    toneStyle:      tone,
    systemFragment: def.fragment + personalityClause + mantraClause,
    label:          def.label,
    badgeColor:     def.badgeColor,
    icon:           def.icon,
  };
}

/**
 * Inject persona into a base system prompt.
 * Persona fragment is prepended so it shapes every subsequent instruction.
 */
export function injectPersona(baseSystemPrompt: string, agent: Agent): string {
  const config = agent.personaConfig ?? buildPersonaConfig(agent);
  return `${config.systemFragment}\n\n---\n\n${baseSystemPrompt}`;
}

/**
 * Build the persona-enhanced system prompt for a specific agent + task.
 * This is the main entry point for LLM callers.
 */
export function buildAgentSystemPrompt(
  agent: Agent,
  taskDescription: string,
  extraContext?: string,
): string {
  const persona = agent.personaConfig ?? buildPersonaConfig(agent);

  return [
    persona.systemFragment,
    '',
    '---',
    '',
    `You are ${agent.name}, a ${agent.role} agent in SwarmIDE2.`,
    `Role description: ${agent.description}`,
    agent.mantra    ? `Mantra: "${agent.mantra}"`     : null,
    agent.motivation ? `Motivation: ${agent.motivation}` : null,
    '',
    '## Your Task',
    taskDescription,
    extraContext ? `\n## Context\n${extraContext}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Apply persona config to a list of agents (mutates in place for efficiency).
 * Call this once after the orchestrator returns the initial team.
 */
export function hydrateTeamPersonas(agents: Agent[]): Agent[] {
  return agents.map(agent => ({
    ...agent,
    personaConfig: buildPersonaConfig(agent),
  }));
}

/**
 * Override an agent's tone style and rebuild its persona config.
 */
export function setAgentTone(agent: Agent, tone: ToneStyle): Agent {
  const updated = { ...agent, toneStyle: tone };
  updated.personaConfig = buildPersonaConfig(updated);
  return updated;
}

/**
 * Get all available tone options for UI rendering.
 */
export function getToneOptions(): Array<{ tone: ToneStyle } & ToneDef> {
  return (Object.keys(TONE_DEFS) as ToneStyle[]).map(tone => ({
    tone,
    ...TONE_DEFS[tone],
  }));
}

/** Get the display metadata for a single tone. */
export function getToneDef(tone: ToneStyle): ToneDef {
  return TONE_DEFS[tone];
}
