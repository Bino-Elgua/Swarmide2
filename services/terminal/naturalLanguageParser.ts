/**
 * Natural Language Parser
 * Translates natural language instructions into terminal commands or
 * SwarmIDE2 phase triggers using whichever LLM the user has configured.
 * Zero hardcoded provider — uses llmAdapter which routes to any provider.
 *
 * Examples:
 *  "Show me all TypeScript files"      → find . -name "*.ts"
 *  "Commit my changes with a message"  → git commit -am "..."
 *  "Run the tests"                     → npm test
 *  "Analyze the codebase"              → trigger Phase 3 (CCA)
 *  "Start ralph loop with these items" → trigger Phase 4 (Ralph Loop)
 */

import { callLLM, type LLMConfig } from './llmAdapter.js';
import { writeToSession } from './terminalProcessManager.js';

export interface ParsedCommand {
  type: 'shell' | 'git' | 'phase' | 'system';
  command: string;
  phase?: number;
  explanation: string;
  confidence: number;
}

// ─── Static rules (zero-latency, no LLM required) ────────────────────────────
const STATIC_RULES: Array<{
  pattern: RegExp;
  type: ParsedCommand['type'];
  transform: (match: RegExpMatchArray) => Partial<ParsedCommand>;
}> = [
  { pattern: /^(run|execute|start)\s+tests?$/i,     type: 'shell',  transform: () => ({ command: 'npm test',          explanation: 'Run the test suite' }) },
  { pattern: /^(install|npm install|yarn)$/i,        type: 'shell',  transform: () => ({ command: 'npm install',       explanation: 'Install dependencies' }) },
  { pattern: /^(build|npm build)$/i,                 type: 'shell',  transform: () => ({ command: 'npm run build',     explanation: 'Build the project' }) },
  { pattern: /^git\s+status$/i,                      type: 'git',    transform: () => ({ command: 'git status',        explanation: 'Show git status' }) },
  { pattern: /^git\s+log$/i,                         type: 'git',    transform: () => ({ command: 'git log --oneline -20', explanation: 'Show git log' }) },
  { pattern: /^(list|show|ls)\s+files?$/i,           type: 'shell',  transform: () => ({ command: 'ls -la',            explanation: 'List files in current directory' }) },
  { pattern: /^(pwd|where am i|current directory)$/i,type: 'shell',  transform: () => ({ command: 'pwd',               explanation: 'Show current directory' }) },
  { pattern: /^clear$/i,                             type: 'system', transform: () => ({ command: 'clear',             explanation: 'Clear the terminal' }) },
  // Phase triggers
  { pattern: /^(analyze|analyse|cca|code analysis)/i,  type: 'phase',  transform: () => ({ command: 'TRIGGER_PHASE_3', phase: 3, explanation: 'Trigger Phase 3 CCA code analysis' }) },
  { pattern: /^(ralph|prd|iterate)/i,                  type: 'phase',  transform: () => ({ command: 'TRIGGER_PHASE_4', phase: 4, explanation: 'Trigger Phase 4 Ralph Loop' }) },
  { pattern: /^(health|monitor)\b/i,                   type: 'phase',  transform: () => ({ command: 'TRIGGER_PHASE_6', phase: 6, explanation: 'Show Phase 6 health monitoring' }) },
  { pattern: /^(compress|rlm|context compression)/i,   type: 'phase',  transform: () => ({ command: 'TRIGGER_PHASE_2', phase: 2, explanation: 'Trigger Phase 2 RLM compression' }) },
  { pattern: /^(conflict|resolve|vote)/i,              type: 'phase',  transform: () => ({ command: 'TRIGGER_PHASE_1', phase: 1, explanation: 'Trigger Phase 1 conflict resolution' }) },
  { pattern: /^(synthesis|multi.?model)/i,             type: 'phase',  transform: () => ({ command: 'TRIGGER_PHASE_5', phase: 5, explanation: 'Trigger Phase 5 multi-model synthesis' }) },
];

const NL_SYSTEM_PROMPT = `You are a terminal command translator for SwarmIDE2, a multi-agent AI platform.
Convert the user's natural language request into a JSON command object.

Rules:
1. Return ONLY valid JSON — no markdown, no code blocks, just raw JSON.
2. JSON shape: {"type":"shell"|"git"|"phase"|"system","command":"...","explanation":"...","confidence":0.0-1.0,"phase":1-7}
3. For SwarmIDE2 phase triggers use these exact commands:
   TRIGGER_PHASE_1 = Conflict Resolution
   TRIGGER_PHASE_2 = RLM Context Compression
   TRIGGER_PHASE_3 = CCA Code Analysis
   TRIGGER_PHASE_4 = Ralph Loop (PRD iteration)
   TRIGGER_PHASE_5 = Multi-Model Synthesis
   TRIGGER_PHASE_6 = Health Monitoring
   TRIGGER_PHASE_7 = Integration Services
4. For shell/git commands use real Unix shell syntax.
5. NEVER generate destructive commands (rm -rf, format, drop table, etc.).
6. If you are unsure, set confidence below 0.5 and use type "shell" with the raw prompt as command.`;

function tryStaticParse(prompt: string): ParsedCommand | null {
  for (const rule of STATIC_RULES) {
    const match = prompt.match(rule.pattern);
    if (match) {
      return { type: rule.type, command: '', explanation: '', confidence: 0.95, ...rule.transform(match) };
    }
  }
  return null;
}

/**
 * Call the configured LLM to parse a natural language prompt.
 * Uses whatever provider is passed in — no hardcoding.
 */
async function aiParse(prompt: string, llmConfig?: LLMConfig): Promise<ParsedCommand> {
  // Default config: prefer env vars, fall back gracefully
  const config: LLMConfig = llmConfig ?? inferConfigFromEnv();

  try {
    const result = await callLLM(config, [
      { role: 'system', content: NL_SYSTEM_PROMPT },
      { role: 'user',   content: `User request: "${prompt}"` },
    ]);

    if (result.text === '__NO_API_KEY__') {
      return passthrough(prompt, 'No API key configured for provider: ' + config.provider);
    }

    // Extract JSON from the response (handle cases where the model adds prose)
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return passthrough(prompt, 'LLM returned non-JSON response');
    const parsed = JSON.parse(jsonMatch[0]) as Partial<ParsedCommand>;

    return {
      type:        parsed.type        ?? 'shell',
      command:     parsed.command     ?? prompt,
      explanation: parsed.explanation ?? `${config.provider} translated command`,
      confidence:  parsed.confidence  ?? 0.7,
      phase:       parsed.phase,
    };
  } catch {
    return passthrough(prompt, 'AI parse failed — using raw input');
  }
}

/** Auto-detect the best available provider from environment variables. */
function inferConfigFromEnv(): LLMConfig {
  if (typeof process !== 'undefined') {
    if (process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY) {
      return { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' };
    }
    if (process.env.OPENAI_API_KEY) {
      return { provider: 'openai', model: 'gpt-4o-mini' };
    }
    if (process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? process.env.API_KEY) {
      return { provider: 'gemini', model: 'gemini-2.0-flash' };
    }
    if (process.env.GROQ_API_KEY) {
      return { provider: 'groq', model: 'llama3-8b-8192' };
    }
  }
  // Try Ollama as a no-key local fallback
  return { provider: 'ollama', model: 'llama3', baseUrl: 'http://localhost:11434' };
}

function passthrough(command: string, explanation: string): ParsedCommand {
  return { type: 'shell', command, explanation, confidence: 0.3 };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a natural language prompt and optionally execute it in a terminal session.
 * Pass an llmConfig to use a specific provider; omit to auto-detect from env.
 */
export async function parseAndExecuteNL(
  prompt: string,
  sessionId?: string,
  llmConfig?: LLMConfig,
): Promise<ParsedCommand> {
  const trimmed = prompt.trim();

  const result = tryStaticParse(trimmed) ?? (await aiParse(trimmed, llmConfig));

  // Execute if we have a live session and it resolved to a runnable command
  if (sessionId && (result.type === 'shell' || result.type === 'git')) {
    writeToSession(sessionId, result.command + '\r');
  }

  return result;
}

/**
 * Preview without executing. Useful for showing a command before running it.
 */
export async function previewCommand(prompt: string, llmConfig?: LLMConfig): Promise<ParsedCommand> {
  const trimmed = prompt.trim();
  return tryStaticParse(trimmed) ?? (await aiParse(trimmed, llmConfig));
}

export function isPhaseCommand(cmd: ParsedCommand): cmd is ParsedCommand & { phase: number } {
  return cmd.type === 'phase' && typeof cmd.phase === 'number';
}

export function extractPhaseNumber(command: string): number | null {
  const m = command.match(/TRIGGER_PHASE_(\d)/);
  return m ? parseInt(m[1]) : null;
}
