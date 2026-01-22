
export enum AgentStatus {
  IDLE = 'IDLE',
  THINKING = 'THINKING',
  WORKING = 'WORKING',
  VERIFYING = 'VERIFYING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export type AgentTool = 'webSearch' | 'codeInterpreter' | 'vision' | 'logicEngine' | 'fileSystem' | 'mcp' | 'webhook' | 'restApi' | 'mediaSynth' | 'databaseQuery' | 'knowledgeBase';
export type TeamMode = 'ai' | 'manual';
export type TerminalTab = 'terminal' | 'output' | 'history' | 'snippets' | 'settings';
export type AIProvider = 'google' | 'openai' | 'anthropic' | 'groq' | 'mistral' | 'perplex';
export type AgentArchetype = 'expert' | 'assistant' | 'rebel' | 'critic' | 'philosopher';

export interface FileEntry {
  path: string;
  content: string;
  language: string;
}

export interface FileVersion {
  content: string;
  timestamp: Date;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderIcon: string;
  senderColor: string;
  text: string;
  timestamp: Date;
  type: 'system' | 'agent-work' | 'synthesis' | 'thought' | 'review';
}

export interface ProtocolMessage {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceIcon: string;
  sourceColor: string;
  action: 'HANDSHAKE' | 'BROADCAST' | 'COMMIT' | 'ANALYZE' | 'SIGNAL' | 'WEBHOOK_TRIGGER' | 'MCP_QUERY' | 'SYNTHESIZE_MEDIA';
  targetName?: string;
  text: string;
  timestamp: Date;
}

export interface ElevenLabsConfig {
  voiceId: string;
  stability: number;
  similarityBoost: number;
  styleExaggeration?: number;
  useSpeakerBoost?: boolean;
  apiKey?: string;
  modelId?: string;
  outputFormat?: string;
}

export interface IntelligenceConfig {
  provider: AIProvider;
  model: string;
  imageModel?: string;
  videoModel?: string;
  maxTokens: number;
  topP: number;
  topK?: number;
  seed?: number;
  recursiveRefinement?: boolean;
  refinementPasses?: number;
  reasoningDepth?: 'standard' | 'deep' | 'exhaustive';
  reasoningPath?: 'cot' | 'direct';
  safetyLevel?: 'none' | 'moderate' | 'strict';
  thinkingBudget?: number;
  modalityPreference?: 'text' | 'visual' | 'audio';
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface ToolConfigs {
  webSearch?: { 
    domains?: string[]; 
    searchDepth?: 'fast' | 'thorough'; 
    region?: string;
    grounding?: boolean;
    knowledgeAssetIds?: string[];
    blacklist?: string[];
  };
  codeInterpreter?: { 
    libraries?: string[]; 
    timeout?: number;
    sandboxMode?: boolean;
    selfCorrection?: boolean; 
    knowledgeAssetIds?: string[];
    securityLevel?: 'low' | 'medium' | 'high';
  };
  fileSystem?: { 
    permissions?: ('read' | 'write' | 'delete' | 'create')[]; 
    rootDir?: string;
    knowledgeAssetIds?: string[];
    allowedExtensions?: string[];
  };
  logicEngine?: { 
    strictMode?: boolean; 
    recursionDepth?: number;
    wisdomRefinement?: boolean;
    knowledgeAssetIds?: string[];
  };
  vision?: { 
    highRes?: boolean; 
    ocrEnabled?: boolean;
    analysisType?: 'general' | 'technical';
    knowledgeAssetIds?: string[];
  };
  mcp?: {
    serverUrl: string;
    capabilities: string[];
    authToken?: string;
    knowledgeAssetIds?: string[];
    envVars?: Record<string, string>;
  };
  webhook?: {
    endpointUrl: string;
    secretKey?: string;
    events: string[];
    knowledgeAssetIds?: string[];
  };
  restApi?: {
    baseUrl: string;
    headers: Record<string, string>;
    authType: 'none' | 'bearer' | 'apiKey';
    knowledgeAssetIds?: string[];
  };
  mediaSynth?: {
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3';
    quality: 'standard' | 'hd';
    generateVideo: boolean;
    stylePrompt?: string;
    samplingSteps?: number;
    cfgScale?: number;
    knowledgeAssetIds?: string[];
  };
  databaseQuery?: {
    dialect: 'sql' | 'nosql' | 'vector';
    mockData: boolean;
    readOnly: boolean;
    knowledgeAssetIds?: string[];
  };
  knowledgeBase?: {
    indexType: 'vector' | 'fulltext' | 'hybrid';
    chunkSize: number;
    chunkOverlap?: number;
    simulatedDocs: string[];
    knowledgeAssetIds?: string[];
    retrievalStrategy?: 'vector' | 'keyword' | 'hybrid';
  };
}

export interface AgentTask {
  id: string;
  label: string;
  dependencyIds?: string[];
  priority?: 'low' | 'medium' | 'high';
  successCriteria?: string;
  retryLimit?: number;
  timeout?: number;
  costEstimation?: number;
}

export interface MediaAsset {
  id: string;
  type: 'image' | 'video';
  url: string;
  prompt: string;
  timestamp: Date;
}

export interface KnowledgeAsset {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string; // Base64 or text data
  lastModified: number;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  mantra?: string;
  motivation?: string;
  limitations?: string[];
  expertise?: string[];
  archetype?: AgentArchetype;
  status: AgentStatus;
  output?: string;
  mediaAssets: MediaAsset[];
  knowledgeAssets: KnowledgeAsset[];
  activatedKnowledgeIds: string[]; 
  thoughtLog: string[];
  tasks: AgentTask[];
  color: string;
  secondaryColor?: string;
  icon: string;
  phase: number;
  category: 'engineering' | 'discovery' | 'creative' | 'tactical' | 'security' | 'ethics' | 'custom' | 'imaging' | 'motion';
  personality: string;
  humorLevel?: number;
  empathyLevel?: number;
  formalismLevel?: number;
  slangLevel?: number;
  jargonLevel?: number;
  directnessLevel?: number;
  emojiUsage?: boolean;
  temperingLevel?: number;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  voiceSpeed: number;
  voicePitch: number;
  elevenLabs?: ElevenLabsConfig;
  intelligenceConfig: IntelligenceConfig;
  enabledTools: AgentTool[];
  toolConfigs: ToolConfigs;
  temperature: number;
  toolConfidence: number;
  verbosity: number;
  riskAversion: number;
  selectionReason?: string;
  isDefault: boolean;
  apiKeys?: Record<string, string>; // service: apiKey mapping
  modelParams?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxTokens?: number;
    recursiveRefinement?: boolean;
  };
  executionParams?: {
    timeoutMs?: number;
    retries?: number;
    priority?: number;
    parallelizable?: boolean;
  };
  phaseDependencies?: string[];
  specialization?: string[];
}

export interface Phase {
  id: number;
  name: string;
  description: string;
  agentRolesRequired: string[];
}

export interface ProjectState {
  prompt: string;
  type: 'software' | 'science' | 'story' | 'general';
  teamMode: TeamMode;
  agents: Agent[];
  phases: Phase[];
  currentPhase: number;
  orchestratorLog: string[];
  conversation: Message[];
  protocolHistory: ProtocolMessage[];
  isOrchestrating: boolean;
  isSynthesizing: boolean;
  enableMediaAssets: boolean;
  files: FileEntry[];
  elevenLabsGlobalKey?: string;
  orchestratorConfig: IntelligenceConfig;
  synthesisConfig: IntelligenceConfig;
}

export interface OrchestrationResponse {
  projectType: 'software' | 'science' | 'story' | 'general';
  phases: Phase[];
  initialTeam: Array<{
    name: string;
    role: string;
    description: string;
    icon: string;
    color: string;
    tasks: string[]; 
    phase: number;
    personality?: string;
    voiceName?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
    voiceSpeed?: number;
    voicePitch?: number;
    verbosity?: number;
    riskAversion?: number;
    selectionReason?: string;
    registryId?: string;
    toolConfigs?: ToolConfigs;
    intelligenceConfig?: Partial<IntelligenceConfig>;
  }>;
}

export interface SynthesisResponse {
  files: FileEntry[];
}

// Phase 1: Conflict Resolution Types
export interface ProposalOutput {
  id: string;
  agentId: string;
  agentName: string;
  architecture: string;
  rationale: string;
  tradeoffs: {
    pro: string[];
    con: string[];
  };
  confidence: number;
  dependencies: string[];
  risks: string[];
  costEstimate?: number;
}

export interface ConflictResolution {
  strategy: 'voting' | 'hierarchical' | 'debate' | 'meta_reasoning' | 'user_select';
  selectedProposal: ProposalOutput;
  alternates: ProposalOutput[];
  reasoning: string;
  mergedArchitecture: string;
}

// Phase 2: Cost Tracking Types
export interface CostMetrics {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  timestamp: Date;
  agentName?: string;
  phaseNumber?: number;
}

// Phase 2: RLM Context Compression Types
export interface ContextSnapshot {
  id: string;
  phaseNumber: number;
  timestamp: Date;
  architectureDecisions: string;
  implementationPatterns: string;
  constraints: string[];
  openIssues: string[];
  originalTokenCount: number;
  compressedTokenCount: number;
  stateSummary: string;
  queryIndex: Map<string, string>;
  topicalIndex: Map<string, string[]>;
  costBreakdown: Record<string, number>;
}

export interface RLMQuery {
  topic: string;
  keywords: string[];
  maxTokens?: number;
}

export interface RLMQueryResult {
  relevant_context: string;
  confidence: number;
  source_phase: number;
  tokens_used: number;
}

export interface CompressionMetrics {
  originalTokens: number;
  compressedTokens: number;
  reductionPercent: number;
  tokensSaved: number;
  estimatedCostSaved: number;
  compressionRatio: number;
}

// Extended ProjectState
export interface ProjectStateExtended extends ProjectState {
  proposalHistory: ProposalOutput[];
  conflictLog: ConflictResolution[];
  costMetrics: CostMetrics[];
  costBudgetUSD?: number;
  costActualUSD?: number;
  synthesisStrategy: 'voting' | 'hierarchical' | 'debate' | 'meta_reasoning' | 'user_select';
  rlmEnabled?: boolean;
  currentSnapshot?: ContextSnapshot;
  compressionMetrics?: CompressionMetrics;
}
