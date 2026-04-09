/**
 * Natural Language Parser
 * Translates natural language instructions into terminal commands or
 * SwarmIDE2 phase triggers. Integrates with the Anthropic Claude API.
 *
 * Examples:
 *  "Show me all TypeScript files"      → find . -name "*.ts"
 *  "Commit my changes with a message"  → git commit -am "..."
 *  "Run the tests"                     → npm test
 *  "Analyze the codebase"              → trigger Phase 3 (CCA)
 *  "Start ralph loop with these items" → trigger Phase 4 (Ralph Loop)
 */

import { writeToSession } from './terminalProcessManager.js';

export interface ParsedCommand {
  type: 'shell' | 'git' | 'phase' | 'system';
  command: string;
  phase?: number;
  explanation: string;
  confidence: number;
}

// Static rule set for common patterns (no API call needed)
const STATIC_RULES: Array<{
  pattern: RegExp;
  type: ParsedCommand['type'];
  transform: (match: RegExpMatchArray) => Partial<ParsedCommand>;
}> = [
  {
    pattern: /^(run|execute|start)\s+tests?$/i,
    type: 'shell',
    transform: () => ({ command: 'npm test', explanation: 'Run the test suite' }),
  },
  {
    pattern: /^(install|npm install|yarn)$/i,
    type: 'shell',
    transform: () => ({ command: 'npm install', explanation: 'Install dependencies' }),
  },
  {
    pattern: /^(build|npm build)$/i,
    type: 'shell',
    transform: () => ({ command: 'npm run build', explanation: 'Build the project' }),
  },
  {
    pattern: /^git\s+status$/i,
    type: 'git',
    transform: () => ({ command: 'git status', explanation: 'Show git status' }),
  },
  {
    pattern: /^(list|show|ls)\s+files?$/i,
    type: 'shell',
    transform: () => ({ command: 'ls -la', explanation: 'List files in current directory' }),
  },
  {
    pattern: /^(analyze|analyse|cca|code analysis)/i,
    type: 'phase',
    transform: () => ({
      command: 'TRIGGER_PHASE_3',
      phase: 3,
      explanation: 'Trigger Phase 3 CCA code analysis',
    }),
  },
  {
    pattern: /^(ralph|prd|iterate)/i,
    type: 'phase',
    transform: () => ({
      command: 'TRIGGER_PHASE_4',
      phase: 4,
      explanation: 'Trigger Phase 4 Ralph Loop',
    }),
  },
  {
    pattern: /^(health|status|monitor)/i,
    type: 'phase',
    transform: () => ({
      command: 'TRIGGER_PHASE_6',
      phase: 6,
      explanation: 'Show Phase 6 health monitoring',
    }),
  },
  {
    pattern: /^(compress|rlm|context)/i,
    type: 'phase',
    transform: () => ({
      command: 'TRIGGER_PHASE_2',
      phase: 2,
      explanation: 'Trigger Phase 2 RLM context compression',
    }),
  },
  {
    pattern: /^clear$/i,
    type: 'system',
    transform: () => ({ command: 'clear', explanation: 'Clear the terminal' }),
  },
  {
    pattern: /^(pwd|where am i|current directory)/i,
    type: 'shell',
    transform: () => ({ command: 'pwd', explanation: 'Show current directory' }),
  },
];

/**
 * Try matching against static rules first (zero latency).
 */
function tryStaticParse(prompt: string): ParsedCommand | null {
  for (const rule of STATIC_RULES) {
    const match = prompt.match(rule.pattern);
    if (match) {
      return {
        type: rule.type,
        command: '',
        explanation: '',
        confidence: 0.95,
        ...rule.transform(match),
      };
    }
  }
  return null;
}

/**
 * Use Claude API to parse a natural language prompt into a shell command.
 * Falls back gracefully if API key is not set.
 */
async function aiParse(prompt: string): Promise<ParsedCommand> {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    // No API key: best-effort passthrough as raw shell command
    return {
      type: 'shell',
      command: prompt,
      explanation: 'Passed through as raw shell command (no AI key configured)',
      confidence: 0.4,
    };
  }

  try {
    const body = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            'You are a terminal command translator. Convert the user\'s natural language into a single shell command.',
            'Rules:',
            '1. Return ONLY valid JSON with keys: type ("shell"|"git"|"phase"|"system"), command (string), explanation (string), confidence (0-1), phase? (number if type=phase)',
            '2. For phase triggers use commands: TRIGGER_PHASE_1 through TRIGGER_PHASE_7',
            '3. Keep commands safe — no rm -rf or destructive operations',
            '',
            `User request: "${prompt}"`,
          ].join('\n'),
        },
      ],
    };

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) throw new Error(`Anthropic API error: ${resp.status}`);
    const data = (await resp.json()) as { content: Array<{ text: string }> };
    const text = data.content[0]?.text ?? '{}';
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');

    return {
      type: parsed.type ?? 'shell',
      command: parsed.command ?? prompt,
      explanation: parsed.explanation ?? 'AI-translated command',
      confidence: parsed.confidence ?? 0.7,
      phase: parsed.phase,
    };
  } catch {
    // Fallback to raw passthrough
    return {
      type: 'shell',
      command: prompt,
      explanation: 'AI parse failed — passed through as raw command',
      confidence: 0.3,
    };
  }
}

/**
 * Parse a natural language prompt and optionally execute it in a terminal session.
 * Returns the parsed command descriptor.
 */
export async function parseAndExecuteNL(
  prompt: string,
  sessionId?: string,
): Promise<ParsedCommand> {
  const trimmed = prompt.trim();

  // 1. Try static rules (instant)
  const staticResult = tryStaticParse(trimmed);
  const result = staticResult ?? (await aiParse(trimmed));

  // 2. Execute if we have a session and it's a shell/git command
  if (sessionId && (result.type === 'shell' || result.type === 'git')) {
    writeToSession(sessionId, result.command + '\r');
  }

  return result;
}

/**
 * Parse without executing (for preview mode).
 */
export async function previewCommand(prompt: string): Promise<ParsedCommand> {
  const trimmed = prompt.trim();
  return tryStaticParse(trimmed) ?? (await aiParse(trimmed));
}

/**
 * Determine if a parsed command would trigger a SwarmIDE2 phase.
 */
export function isPhaseCommand(cmd: ParsedCommand): cmd is ParsedCommand & { phase: number } {
  return cmd.type === 'phase' && typeof cmd.phase === 'number';
}

/**
 * Extract phase number from a TRIGGER_PHASE_N command string.
 */
export function extractPhaseNumber(command: string): number | null {
  const m = command.match(/TRIGGER_PHASE_(\d)/);
  return m ? parseInt(m[1]) : null;
}
