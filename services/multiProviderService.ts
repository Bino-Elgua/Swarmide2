import { GoogleGenAI } from '@google/genai';

export type ProviderType = 'gemini' | 'claude' | 'openai' | 'groq' | 'mistral' | 'perplexity' | 'deepseek' | 'ollama';

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMRequest {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: ProviderType;
  tokensUsed: {
    input: number;
    output: number;
  };
  cost: number;
}

class MultiProviderService {
  private configs: Map<ProviderType, ProviderConfig>;
  private defaultProvider: ProviderType = 'gemini';

  constructor() {
    this.configs = new Map();
    this.initializeProviders();
  }

  private initializeProviders() {
    // Gemini (default)
    this.configs.set('gemini', {
      type: 'gemini',
      apiKey: process.env.GOOGLE_API_KEY || process.env.API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    });

    // Claude
    this.configs.set('claude', {
      type: 'claude',
      apiKey: process.env.CLAUDE_API_KEY,
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    });

    // OpenAI
    this.configs.set('openai', {
      type: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1',
    });

    // Groq
    this.configs.set('groq', {
      type: 'groq',
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
      baseUrl: 'https://api.groq.com',
    });

    // Mistral
    this.configs.set('mistral', {
      type: 'mistral',
      apiKey: process.env.MISTRAL_API_KEY,
      model: process.env.MISTRAL_MODEL || 'mistral-large-latest',
      baseUrl: 'https://api.mistral.ai/v1',
    });

    // Perplexity
    this.configs.set('perplexity', {
      type: 'perplexity',
      apiKey: process.env.PERPLEXITY_API_KEY,
      model: process.env.PERPLEXITY_MODEL || 'pplx-7b-online',
      baseUrl: 'https://api.perplexity.ai',
    });

    // DeepSeek
    this.configs.set('deepseek', {
      type: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com',
    });

    // Ollama (local)
    this.configs.set('ollama', {
      type: 'ollama',
      model: process.env.OLLAMA_MODEL || 'llama2',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    });
  }

  setDefaultProvider(provider: ProviderType) {
    if (this.configs.has(provider)) {
      this.defaultProvider = provider;
    }
  }

  async callProvider(
    provider: ProviderType = this.defaultProvider,
    request: LLMRequest
  ): Promise<LLMResponse> {
    const config = this.configs.get(provider);
    if (!config) {
      throw new Error(`Provider ${provider} not configured`);
    }

    switch (provider) {
      case 'gemini':
        return this.callGemini(config, request);
      case 'claude':
        return this.callClaude(config, request);
      case 'openai':
        return this.callOpenAI(config, request);
      case 'groq':
        return this.callGroq(config, request);
      case 'mistral':
        return this.callMistral(config, request);
      case 'perplexity':
        return this.callPerplexity(config, request);
      case 'deepseek':
        return this.callDeepSeek(config, request);
      case 'ollama':
        return this.callOllama(config, request);
      default:
        throw new Error(`Provider ${provider} not implemented`);
    }
  }

  private async callGemini(config: ProviderConfig, request: LLMRequest): Promise<LLMResponse> {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    
    const prompt = request.messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const response = await ai.models.generateContent({
      model: config.model as any,
      contents: prompt,
      config: {
        systemInstruction: request.systemPrompt,
        temperature: request.temperature,
        responseSchema: request.responseFormat === 'json' ? { type: 'object' } : undefined,
      },
    });

    const content = response.text();
    
    return {
      content,
      model: config.model,
      provider: 'gemini',
      tokensUsed: { input: 0, output: 0 },
      cost: 0,
    };
  }

  private async callClaude(config: ProviderConfig, request: LLMRequest): Promise<LLMResponse> {
    // Claude implementation - requires @anthropic-ai/sdk
    throw new Error('Claude provider requires additional setup');
  }

  private async callOpenAI(config: ProviderConfig, request: LLMRequest): Promise<LLMResponse> {
    // OpenAI implementation - requires openai SDK
    throw new Error('OpenAI provider requires additional setup');
  }

  private async callGroq(config: ProviderConfig, request: LLMRequest): Promise<LLMResponse> {
    // Groq implementation
    throw new Error('Groq provider requires additional setup');
  }

  private async callMistral(config: ProviderConfig, request: LLMRequest): Promise<LLMResponse> {
    // Mistral implementation
    throw new Error('Mistral provider requires additional setup');
  }

  private async callPerplexity(config: ProviderConfig, request: LLMRequest): Promise<LLMResponse> {
    // Perplexity implementation
    throw new Error('Perplexity provider requires additional setup');
  }

  private async callDeepSeek(config: ProviderConfig, request: LLMRequest): Promise<LLMResponse> {
    // DeepSeek implementation
    throw new Error('DeepSeek provider requires additional setup');
  }

  private async callOllama(config: ProviderConfig, request: LLMRequest): Promise<LLMResponse> {
    // Ollama implementation
    const prompt = request.messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
      }),
    });

    const data: any = await response.json();

    return {
      content: data.response,
      model: config.model,
      provider: 'ollama',
      tokensUsed: { input: 0, output: 0 },
      cost: 0,
    };
  }

  // Ensemble voting across multiple providers
  async ensembleVote(
    providers: ProviderType[],
    request: LLMRequest
  ): Promise<{ winner: LLMResponse; votes: Map<ProviderType, LLMResponse> }> {
    const votes = new Map<ProviderType, LLMResponse>();

    for (const provider of providers) {
      try {
        const response = await this.callProvider(provider, request);
        votes.set(provider, response);
      } catch (error) {
        console.error(`Provider ${provider} failed:`, error);
      }
    }

    // Select response with highest confidence (first successful)
    const winner = votes.entries().next().value?.[1];
    if (!winner) {
      throw new Error('All providers failed');
    }

    return { winner, votes };
  }

  // Cost-optimized routing
  getOptimalProvider(projectType: 'budget' | 'quality' | 'speed' | 'reasoning'): ProviderType {
    switch (projectType) {
      case 'budget':
        return 'ollama'; // Local, free
      case 'speed':
        return 'groq'; // Fastest inference
      case 'reasoning':
        return 'openai'; // Best reasoning
      case 'quality':
      default:
        return 'gemini'; // Best overall
    }
  }

  getProviderConfig(provider: ProviderType): ProviderConfig | undefined {
    return this.configs.get(provider);
  }

  listProviders(): ProviderType[] {
    return Array.from(this.configs.keys());
  }
}

export const multiProviderService = new MultiProviderService();

export default multiProviderService;
