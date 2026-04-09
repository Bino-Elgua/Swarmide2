/**
 * LLM Adapter — provider-agnostic, fetch-only
 * Works in Node.js (terminal server) and the browser (React app) without
 * requiring any vendor SDKs. Add a new provider by adding one case below.
 *
 * Supported providers (maps to SwarmIDE2 AIProvider + extras):
 *   google / gemini   → Google Generative Language REST API
 *   anthropic / claude → Anthropic Messages API
 *   openai / gpt      → OpenAI Chat Completions (also works for Azure)
 *   groq              → Groq Chat Completions (OpenAI-compatible)
 *   mistral           → Mistral Chat Completions (OpenAI-compatible)
 *   deepseek          → DeepSeek Chat Completions (OpenAI-compatible)
 *   perplexity        → Perplexity Chat Completions (OpenAI-compatible)
 *   ollama            → Ollama local API
 */

export type LLMProvider =
  | 'google' | 'gemini'
  | 'anthropic' | 'claude'
  | 'openai' | 'gpt'
  | 'groq'
  | 'mistral'
  | 'deepseek'
  | 'perplexity'
  | 'ollama';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;   // override endpoint (e.g. Azure, local proxies)
  maxTokens?: number;
  temperature?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResult {
  text: string;
  provider: LLMProvider;
  model: string;
}

// ─── Default models per provider ─────────────────────────────────────────────
const DEFAULT_MODELS: Record<LLMProvider, string> = {
  google:     'gemini-2.0-flash',
  gemini:     'gemini-2.0-flash',
  anthropic:  'claude-haiku-4-5-20251001',
  claude:     'claude-haiku-4-5-20251001',
  openai:     'gpt-4o-mini',
  gpt:        'gpt-4o-mini',
  groq:       'llama3-8b-8192',
  mistral:    'mistral-small-latest',
  deepseek:   'deepseek-chat',
  perplexity: 'llama-3.1-sonar-small-128k-online',
  ollama:     'llama3',
};

// ─── OpenAI-compatible base URLs ─────────────────────────────────────────────
const OPENAI_COMPAT_URLS: Partial<Record<LLMProvider, string>> = {
  openai:     'https://api.openai.com/v1',
  gpt:        'https://api.openai.com/v1',
  groq:       'https://api.groq.com/openai/v1',
  mistral:    'https://api.mistral.ai/v1',
  deepseek:   'https://api.deepseek.com/v1',
  perplexity: 'https://api.perplexity.ai',
};

/**
 * Call any configured LLM with a list of messages.
 * Returns the text response.
 */
export async function callLLM(config: LLMConfig, messages: LLMMessage[]): Promise<LLMResult> {
  const provider = config.provider;
  const model = config.model || DEFAULT_MODELS[provider];
  const maxTokens = config.maxTokens ?? 512;
  const temperature = config.temperature ?? 0.2;

  // ── Google Gemini ──────────────────────────────────────────────────────────
  if (provider === 'google' || provider === 'gemini') {
    const apiKey = config.apiKey
      ?? (typeof process !== 'undefined'
          ? (process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY ?? process.env.API_KEY)
          : undefined);

    if (!apiKey) return fallbackPassthrough(provider, model);

    // Convert to Gemini content format
    const systemMsg = messages.find(m => m.role === 'system')?.content;
    const userMessages = messages.filter(m => m.role !== 'system');
    const contents = userMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = { contents, generationConfig: { maxOutputTokens: maxTokens, temperature } };
    if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg }] };

    const url = `${config.baseUrl ?? 'https://generativelanguage.googleapis.com'}/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const resp = await fetchJSON(url, body);
    const text = resp?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return { text, provider, model };
  }

  // ── Anthropic Claude ───────────────────────────────────────────────────────
  if (provider === 'anthropic' || provider === 'claude') {
    const apiKey = config.apiKey
      ?? (typeof process !== 'undefined'
          ? (process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY ?? process.env.VITE_ANTHROPIC_API_KEY)
          : undefined);

    if (!apiKey) return fallbackPassthrough(provider, model);

    const systemMsg = messages.find(m => m.role === 'system')?.content;
    const chatMessages = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = { model, max_tokens: maxTokens, temperature, messages: chatMessages };
    if (systemMsg) body.system = systemMsg;

    const resp = await fetchJSON(
      `${config.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`,
      body,
      { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    );
    const text = resp?.content?.[0]?.text ?? '';
    return { text, provider, model };
  }

  // ── Ollama (local) ─────────────────────────────────────────────────────────
  if (provider === 'ollama') {
    const baseUrl = config.baseUrl
      ?? (typeof process !== 'undefined' ? (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434') : 'http://localhost:11434');

    const systemMsg = messages.find(m => m.role === 'system')?.content;
    const chatMessages = messages.filter(m => m.role !== 'system');
    const prompt = (systemMsg ? `${systemMsg}\n\n` : '') + chatMessages.map(m => m.content).join('\n');

    const resp = await fetchJSON(`${baseUrl}/api/generate`, { model, prompt, stream: false });
    const text = resp?.response ?? '';
    return { text, provider, model };
  }

  // ── OpenAI-compatible (openai, gpt, groq, mistral, deepseek, perplexity) ───
  const openaiBase = config.baseUrl ?? OPENAI_COMPAT_URLS[provider] ?? 'https://api.openai.com/v1';
  const apiKey = config.apiKey
    ?? (typeof process !== 'undefined'
        ? resolveEnvKey(provider)
        : undefined);

  if (!apiKey) return fallbackPassthrough(provider, model);

  const resp = await fetchJSON(
    `${openaiBase}/chat/completions`,
    { model, messages, max_tokens: maxTokens, temperature },
    { Authorization: `Bearer ${apiKey}` },
  );
  const text = resp?.choices?.[0]?.message?.content ?? '';
  return { text, provider, model };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJSON(
  url: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`LLM API error ${resp.status}: ${errText.slice(0, 200)}`);
  }
  return resp.json() as Promise<Record<string, unknown>>;
}

function resolveEnvKey(provider: LLMProvider): string | undefined {
  if (typeof process === 'undefined') return undefined;
  const map: Partial<Record<LLMProvider, string[]>> = {
    openai:     ['OPENAI_API_KEY', 'VITE_OPENAI_API_KEY'],
    gpt:        ['OPENAI_API_KEY', 'VITE_OPENAI_API_KEY'],
    groq:       ['GROQ_API_KEY', 'VITE_GROQ_API_KEY'],
    mistral:    ['MISTRAL_API_KEY', 'VITE_MISTRAL_API_KEY'],
    deepseek:   ['DEEPSEEK_API_KEY', 'VITE_DEEPSEEK_API_KEY'],
    perplexity: ['PERPLEXITY_API_KEY', 'VITE_PERPLEXITY_API_KEY'],
  };
  const keys = map[provider] ?? [];
  for (const k of keys) {
    const v = process.env[k];
    if (v) return v;
  }
  return undefined;
}

function fallbackPassthrough(provider: LLMProvider, model: string): LLMResult {
  return { text: '__NO_API_KEY__', provider, model };
}

/**
 * Detect whether an API key is available for a given provider.
 * Useful for graceful degradation in UI.
 */
export function hasApiKey(provider: LLMProvider, explicitKey?: string): boolean {
  if (explicitKey) return true;
  if (typeof process === 'undefined') return false;
  try {
    return !!resolveEnvKey(provider)
      || !!(process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY)
      || !!(process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY);
  } catch {
    return false;
  }
}
