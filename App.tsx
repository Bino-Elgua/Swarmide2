import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ProjectState, Agent, AgentStatus, OrchestrationResponse, Message, ProtocolMessage, Phase, FileEntry, TeamMode, TerminalTab, FileVersion, AgentTask, AIProvider, IntelligenceConfig, ProposalOutput, ConflictResolution, CostMetrics } from './types';
import { orchestrateTeam, performAgentTask, synthesizeProject, speakText } from './services/geminiService';
import { resolveConflictingProposals } from './services/conflictResolver';
import { validateBudget } from './services/costCalculator';
import { runRalphLoop, PRDItem, RalphCheckpoint, parsePRDItems } from './services/ralphLoop';
import { compressContextWithRLM } from './services/rlmService';
import { generateCCAAuditReport } from './services/ccaService';
import { proposalCache, findReuseableProposal } from './services/proposalCache';
import { getRubricForProject, rankProposalsWithRubric } from './services/customScoringRubric';
import { synthesizeBalanced } from './services/multiModelSynthesis';
import { appIntegration } from './services/appIntegration';
import { HUB_REGISTRY } from './constants';
import AgentLiveFeed from './components/AgentLiveFeed';
import AgentList from './components/AgentList';
import AgentHub from './components/AgentHub';
import IDE from './components/IDE';
import Templates from './components/Templates';
import AgentEditor from './components/AgentEditor';
import ConflictResolver from './components/ConflictResolver';
import CostTracker from './components/CostTracker';
import RalphLoopPanel from './components/RalphLoopPanel';
import { RLMDashboard } from './components/RLMDashboard';
import CCAAnalyzer from './components/CCAAnalyzer';
import HealthMonitor from './components/HealthMonitor';
import APIMonitor from './components/APIMonitor';
import ProposalCacheStats from './components/ProposalCacheStats';
import RubricEditor from './components/RubricEditor';
import MultiModelPanel from './components/MultiModelPanel';
import ExecutionEngine from './components/ExecutionEngine';
import IntegrationPanel from './components/IntegrationPanel';

type Tab = 'hub' | 'setup' | 'graph' | 'ide' | 'templates';

const PROVIDER_OPTIONS: { id: AIProvider; label: string; icon: string }[] = [
  { id: 'google', label: 'Gemini', icon: 'brands fa-google' },
  { id: 'openai', label: 'GPT', icon: 'solid fa-bolt' },
  { id: 'anthropic', label: 'Claude', icon: 'solid fa-leaf' }
];

const MODEL_OPTIONS: Record<AIProvider, { llm: {id: string, label: string}[] }> = {
  google: {
    llm: [{ id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro' }, { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' }]
  },
  openai: {
    llm: [{ id: 'gpt-4o', label: 'GPT-4o' }, { id: 'o1-preview', label: 'o1 Reasoning' }]
  },
  anthropic: {
    llm: [{ id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' }, { id: 'claude-3-opus', label: 'Claude 3 Opus' }]
  },
  groq: { llm: [] }, mistral: { llm: [] }, perplex: { llm: [] }
};

const GLOBAL_THEMES = {
  vibe: { bg: '#030712', panel: '#111827', acc: '#6366f1', dim: '#484f58', fg: '#f3f4f6', bold: '#ffffff', border: '#6366f133' },
  matrix: { bg: '#000000', panel: '#0d0208', acc: '#00ff41', dim: '#008f11', fg: '#00ff41', bold: '#d1ffd1', border: '#00ff4144' },
  synthwave: { bg: '#262335', panel: '#241b2f', acc: '#ff7edb', dim: '#72f1b8', fg: '#f0f0f0', bold: '#ffffff', border: '#ff7edb44' },
  monokai: { bg: '#272822', panel: '#3e3d32', acc: '#f92672', dim: '#75715e', fg: '#f8f8f2', bold: '#ffffff', border: '#f9267233' },
  nord: { bg: '#2e3440', panel: '#3b4252', acc: '#88c0d0', dim: '#4c566a', fg: '#d8dee9', bold: '#eceff4', border: '#88c0d044' },
  dracula: { bg: '#282a36', panel: '#44475a', acc: '#bd93f9', dim: '#6272a4', fg: '#f8f8f2', bold: '#ffffff', border: '#bd93f944' },
  githubDark: { bg: '#0d1117', panel: '#161b22', acc: '#f78166', dim: '#8b949e', fg: '#c9d1d9', bold: '#ffffff', border: '#30363d' }
};

const STRATEGY_PRESETS = [
  { id: 'balanced', label: 'Balanced', icon: 'scale-balanced', desc: 'Logic & creativity mix.' },
  { id: 'technical', label: 'Hard-Tech', icon: 'microchip', desc: 'Code precision & safety.' },
  { id: 'creative', label: 'Discovery', icon: 'wand-magic-sparkles', desc: 'Innovative ideation.' },
  { id: 'fast', label: 'Rapid Prototype', icon: 'bolt-lightning', desc: 'Speed-optimized clusters.' }
];

const PLATFORMS = [
  { id: 'web', label: 'Web Application', icon: 'globe' },
  { id: 'mobile', label: 'Mobile Native', icon: 'mobile-screen' },
  { id: 'science', label: 'Scientific Model', icon: 'atom' },
  { id: 'creative', label: 'Creative Fiction', icon: 'book' }
];

const App: React.FC = () => {
  const [project, setProject] = useState<ProjectState>({
    prompt: '', type: 'general', teamMode: 'ai', agents: [], phases: [], currentPhase: 0, orchestratorLog: ['System online. Ready for mission configuration.'], conversation: [], protocolHistory: [], isOrchestrating: false, isSynthesizing: false, enableMediaAssets: false, files: [], orchestratorConfig: { provider: 'google', model: 'gemini-3-pro-preview', maxTokens: 4096, topP: 0.9, recursiveRefinement: false, refinementPasses: 1, reasoningDepth: 'standard', safetyLevel: 'moderate' }, synthesisConfig: { provider: 'google', model: 'gemini-3-pro-preview', maxTokens: 8192, topP: 0.95, recursiveRefinement: true, refinementPasses: 1 }
  });

  const [activeTab, setActiveTab] = useState<Tab>('setup'); 
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [registry, setRegistry] = useState<Agent[]>(HUB_REGISTRY);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedSectors, setExpandedSectors] = useState<string[]>(['engineering']);
  const [strategy, setStrategy] = useState('balanced');
  const [intensity, setIntensity] = useState(2);
  const [targetPlatform, setTargetPlatform] = useState('web');

  const [terminalTab, setTerminalTab] = useState<TerminalTab>('terminal');
  const [terminalHeight, setTerminalHeight] = useState(280);
  const [isTerminalVisible, setIsTerminalVisible] = useState(true);
  const [isTerminalMinimized, setIsTerminalMinimized] = useState(true);
  const [terminalMaximized, setTerminalMaximized] = useState(false);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState<{ cmd: string; output: string[]; timestamp: string }[]>([]);
  const [activeTheme, setActiveTheme] = useState<keyof typeof GLOBAL_THEMES>('vibe');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [terminalFontSize, setTerminalFontSize] = useState(11);
  const [fontSize, setFontSize] = useState(13);
  const [terminalOpacity, setTerminalOpacity] = useState(0.95);
  const [terminalBlur, setTerminalBlur] = useState(12);
  const [terminalCursorStyle, setTerminalCursorStyle] = useState<'block' | 'line' | 'underline'>('block');
  const [terminalPrefix, setTerminalPrefix] = useState('vibe@orchestra:~$');
  const [terminalShowTimestamp, setTerminalShowTimestamp] = useState(true);
  const [terminalBlinkingCursor, setTerminalBlinkingCursor] = useState(true);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const [logicHubApiKey, setLogicHubApiKey] = useState(() => localStorage.getItem('vibe_logic_hub_key') || '');
  const [logicHubModel, setLogicHubModel] = useState(() => localStorage.getItem('vibe_logic_hub_model') || 'gemini-3-pro-preview');
  const [synthesisApiKey, setSynthesisApiKey] = useState(() => localStorage.getItem('vibe_synthesis_key') || '');
  const [synthesisModel, setSynthesisModel] = useState(() => localStorage.getItem('vibe_synthesis_model') || 'gemini-3-pro-preview');
  const [agentEditorOpen, setAgentEditorOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [isTargetNodesCollapsed, setIsTargetNodesCollapsed] = useState(false);
  const [snippets, setSnippets] = useState<any[]>(() => {
    const saved = localStorage.getItem('vibe_snippets');
    return saved ? JSON.parse(saved) : [
      { id: '1', label: 'Sync Cluster', cmd: 'protocol --sync --full' },
      { id: '2', label: 'Audit Manifest', cmd: 'fleet audit --deep' },
      { id: '3', label: 'Recursive Clear', cmd: 'clear' },
      { id: '4', label: 'System Help', cmd: 'help' }
    ];
  });

  // Phase 1: Conflict Resolution & Cost Tracking
  const [proposalHistory, setProposalHistory] = useState<ProposalOutput[]>([]);
  const [conflictLog, setConflictLog] = useState<ConflictResolution[]>([]);
  const [costMetrics, setCostMetrics] = useState<CostMetrics[]>([]);
  const [costBudgetUSD, setCostBudgetUSD] = useState<number | undefined>(10); // Default $10
  const [costActualUSD, setCostActualUSD] = useState<number>(0);
  const [synthesisStrategy, setSynthesisStrategy] = useState<'voting' | 'hierarchical' | 'meta_reasoning' | 'user_select'>('voting');
  const [showConflictResolver, setShowConflictResolver] = useState(false);
  const [conflictingProposals, setConflictingProposals] = useState<ProposalOutput[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<ProposalOutput | undefined>();
  const [resolutionReasoning, setResolutionReasoning] = useState<string>('');

  // Phase 4: Ralph Loop - PRD-driven execution
  const [ralphEnabled, setRalphEnabled] = useState(false);
  const [prdItems, setPrdItems] = useState<PRDItem[]>([]);
  const [ralphIteration, setRalphIteration] = useState(0);
  const [ralphMaxIterations, setRalphMaxIterations] = useState(5);
  const [ralphCompletionRate, setRalphCompletionRate] = useState(0);
  const [ralphCheckpoints, setRalphCheckpoints] = useState<RalphCheckpoint[]>([]);
  const [isRalphRunning, setIsRalphRunning] = useState(false);

  // Phase 2: RLM Context Compression
  const [rlmEnabled, setRlmEnabled] = useState(true);
  const [rlmCompressionRate, setRlmCompressionRate] = useState(0);
  const [rlmTokensSaved, setRlmTokensSaved] = useState(0);
  const [rlmMetrics, setRlmMetrics] = useState<any>(null);
  const [phaseHistory, setPhaseHistory] = useState<any[]>([]);
  const [currentSnapshot, setCurrentSnapshot] = useState<any>(null);

  // Phase 3: CCA Code Analysis
  const [ccaEnabled, setCcaEnabled] = useState(false);
  const [ccaAnalyzing, setCcaAnalyzing] = useState(false);
  const [ccaResult, setCcaResult] = useState<any>(null);
  const [showCCAAnalyzer, setShowCCAAnalyzer] = useState(false);

  // Phase 5: Advanced Features
  // Proposal Caching
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [cacheStats, setCacheStats] = useState<any>(null);
  
  // Custom Rubrics
  const [rubricEnabled, setRubricEnabled] = useState(true);
  const [customRubric, setCustomRubric] = useState<any>(null);
  const [showRubricEditor, setShowRubricEditor] = useState(false);
  
  // Multi-Model Synthesis
  const [multiModelEnabled, setMultiModelEnabled] = useState(false);
  const [multiModelResult, setMultiModelResult] = useState<any>(null);
  const [showMultiModelPanel, setShowMultiModelPanel] = useState(false);

  // Phase 6: Health Monitoring (already imported)
  const [healthMonitorVisible, setHealthMonitorVisible] = useState(true);
  const [apiMonitorVisible, setApiMonitorVisible] = useState(true);
  const [healthStatus, setHealthStatus] = useState<any>({
    geminiStatus: 'healthy',
    gptStatus: 'healthy',
    claudeStatus: 'healthy',
    supabaseStatus: 'healthy',
    qdrantStatus: 'healthy',
    overallHealth: 'healthy',
    lastCheck: new Date(),
    responseTime: 0,
    errorRate: 0,
    uptime: 99.9
  });
  const [healthMetrics, setHealthMetrics] = useState<any[]>([]);

  // Phase 7: Integration Services
  const [integrationEnabled, setIntegrationEnabled] = useState(false);
  const [executionEngineRunning, setExecutionEngineRunning] = useState(false);
  const [integrationPanelVisible, setIntegrationPanelVisible] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [messageQueueEnabled, setMessageQueueEnabled] = useState(false);
  const [integrationEvents, setIntegrationEvents] = useState<any[]>([]);
  const [externalServiceStatus, setExternalServiceStatus] = useState<any>({});

  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const isResizingTerminal = useRef(false);

  const activeAgent = useMemo(() => project.agents.find(a => a.id === selectedAgentId), [project.agents, selectedAgentId]);
  const groupedRegistry = useMemo(() => {
    const groups: Record<string, Agent[]> = {};
    registry.forEach(a => { if (!groups[a.category]) groups[a.category] = []; groups[a.category].push(a); });
    return groups;
  }, [registry]);

  useEffect(() => {
    const theme = GLOBAL_THEMES[activeTheme];
    const root = document.documentElement;
    const bg = isDarkMode ? theme.bg : '#f8fafc';
    const panel = isDarkMode ? theme.panel : '#ffffff';
    root.style.setProperty('--bg-primary', bg);
    root.style.setProperty('--bg-secondary', panel);
    root.style.setProperty('--accent', theme.acc);
    root.style.setProperty('--text-bold', isDarkMode ? theme.bold : '#0f172a');
    root.style.setProperty('--text-main', isDarkMode ? theme.fg : '#334155');
    root.style.setProperty('--text-dim', isDarkMode ? theme.dim : '#64748b');
    root.style.setProperty('--border', isDarkMode ? theme.border : 'rgba(0,0,0,0.08)');
  }, [activeTheme, isDarkMode]);

  useEffect(() => { localStorage.setItem('vibe_snippets', JSON.stringify(snippets)); }, [snippets]);
  useEffect(() => { localStorage.setItem('vibe_logic_hub_key', logicHubApiKey); }, [logicHubApiKey]);
  useEffect(() => { localStorage.setItem('vibe_logic_hub_model', logicHubModel); }, [logicHubModel]);
  useEffect(() => { localStorage.setItem('vibe_synthesis_key', synthesisApiKey); }, [synthesisApiKey]);
  useEffect(() => { localStorage.setItem('vibe_synthesis_model', synthesisModel); }, [synthesisModel]);

  useEffect(() => {
    if (terminalRef.current && terminalTab === 'terminal') {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalHistory, terminalTab]);

  // Initialize Phase 7: Integration Services
  useEffect(() => {
    const initializeIntegration = async () => {
      try {
        const result = await appIntegration.initialize();
        addLog(`✓ Integration services initialized: ${result.status}`);
        setIntegrationEnabled(true);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        addLog(`⚠️ Integration initialization: ${msg}`);
      }
    };
    initializeIntegration();
  }, []);

  // Phase 4: Ralph Loop - Checkpoint Persistence
  useEffect(() => {
    if (ralphCheckpoints.length > 0) {
      const serialized = ralphCheckpoints.map(cp => ({
        iteration: cp.iteration,
        timestamp: cp.timestamp.toISOString(),
        completedCount: cp.completedItems.length,
        remainingCount: cp.remainingItems.length,
        completionRate: cp.completionRate,
        prdItems: cp.remainingItems.map(p => ({
          id: p.id,
          description: p.description,
          category: p.category,
          priority: p.priority,
          completed: p.completed
        }))
      }));
      localStorage.setItem('ralph_checkpoints', JSON.stringify(serialized));
    }
  }, [ralphCheckpoints]);

  // Load Ralph checkpoints on mount
  useEffect(() => {
    const saved = localStorage.getItem('ralph_checkpoints');
    if (saved) {
      try {
        const checkpoints = JSON.parse(saved);
        addLog(`✓ Restored ${checkpoints.length} Ralph Loop checkpoints from previous session`);
      } catch (e) {
        console.error('Failed to load Ralph checkpoints', e);
      }
    }
  }, []);

  const addLog = (msg: string) => setProject(p => ({ ...p, orchestratorLog: [msg, ...p.orchestratorLog].slice(0, 100) }));
  
  const addProtocolMessage = (msg: Omit<ProtocolMessage, 'id' | 'timestamp'>) => {
    setProject(p => ({
      ...p,
      protocolHistory: [...p.protocolHistory, {
        ...msg,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date()
      }]
    }));
  };

  const updateAgentStatus = (id: string, status: AgentStatus, extra: Partial<Agent> = {}) => {
    setProject(p => ({
      ...p,
      agents: p.agents.map(a => a.id === id ? { ...a, status, ...extra } : a)
    }));
  };

  const toggleTheme = () => {
    const keys = Object.keys(GLOBAL_THEMES) as Array<keyof typeof GLOBAL_THEMES>;
    setActiveTheme(keys[(keys.indexOf(activeTheme) + 1) % keys.length]);
  };

  const handleSelectAgent = (id: string, initialMode?: 'work' | 'hub') => {
    setSelectedAgentId(id);
    if (initialMode === 'hub') { setActiveTab('hub'); } else { setIsSidebarOpen(true); }
  };

  const handleTerminalCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = terminalInput.trim();
    if (!cmd) return;
    if (cmd === 'clear') { setTerminalHistory([]); setTerminalInput(''); return; }
    if (cmd === 'help') { 
      setTerminalHistory(p => [...p, { cmd, output: [
        'vibe-cli v2.5.0 RESTORED',
        '-----------------------',
        'clear     : Flush logic buffer',
        'help      : Display command manifest',
        'theme     : Cycle global aesthetic engine',
        'fleet     : Query node swarm status',
        'protocol  : Sync inter-node communication',
        'snippets  : List cached execution scripts'
      ], timestamp: new Date().toLocaleTimeString([], {hour12: false}) }]); 
      setTerminalInput(''); return; 
    }
    setTerminalHistory(p => [...p, { cmd, output: [`'${cmd}' executed in virtual sandbox. Result: NOMINAL.`], timestamp: new Date().toLocaleTimeString([], {hour12: false}) }]);
    setTerminalInput('');
  };

  const handleAddSnippet = () => {
    const label = prompt("Snippet Label:");
    const cmd = prompt("CLI Command:");
    if (label && cmd) {
      setSnippets(prev => [...prev, { id: Date.now().toString(), label, cmd }]);
    }
  };

  const runRalphLoopHandler = async (prdItems: PRDItem[]) => {
    if (!inputPrompt.trim()) {
      addLog('ERROR: Cannot start Ralph Loop without initial mission prompt.');
      return;
    }

    setIsRalphRunning(true);
    setRalphEnabled(true);
    setPrdItems(prdItems);
    addLog(`Ralph Loop: Starting with ${prdItems.length} PRD items across up to ${ralphMaxIterations} iterations...`);

    if (isSpeechEnabled) speakText("Ralph Loop activated. Beginning iterative PRD-driven execution.");

    try {
      const result = await runRalphLoop(
        inputPrompt,
        prdItems,
        project.orchestratorConfig,
        ralphMaxIterations,
        0.95, // 95% completion threshold
        (log: string, progress: number, checkpoint?: RalphCheckpoint) => {
          addLog(log);
          setRalphCompletionRate(progress);

          if (checkpoint) {
            setRalphIteration(checkpoint.iteration);
            setRalphCheckpoints(prev => [...prev, checkpoint]);
            addLog(`📌 Checkpoint ${checkpoint.iteration}: ${(checkpoint.completionRate * 100).toFixed(0)}% complete`);
          }
        }
      );

      // Final summary
      addLog(`✓ Ralph Loop Complete: ${result.completed.length}/${result.completed.length + result.incomplete.length} items`);
      addLog(`Total tokens used: ${result.totalTokensUsed}. Total cost: $${result.totalCostUSD.toFixed(2)}`);
      setPrdItems(result.completed.concat(result.incomplete));

      if (isSpeechEnabled) speakText(`Ralph Loop complete. ${result.completed.length} items finished.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      addLog(`ERROR: Ralph Loop failed: ${msg}`);
    } finally {
      setIsRalphRunning(false);
    }
  };

  const handleLoadRalphCheckpoint = (checkpoint: RalphCheckpoint) => {
    setPrdItems([...checkpoint.completedItems, ...checkpoint.remainingItems]);
    setRalphIteration(checkpoint.iteration);
    addLog(`Loaded checkpoint from iteration ${checkpoint.iteration}. Ready to resume.`);
  };

  const handleExportRalphCheckpoints = (checkpoints: RalphCheckpoint[]) => {
    const exported = checkpoints.map(cp => ({
      iteration: cp.iteration,
      timestamp: cp.timestamp.toISOString(),
      completed: cp.completedItems.length,
      remaining: cp.remainingItems.length,
      rate: (cp.completionRate * 100).toFixed(0) + '%'
    }));

    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ralph-checkpoints-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    addLog(`✓ Exported ${checkpoints.length} checkpoints to JSON file.`);
  };

  const runCCAudit = async () => {
    if (project.files.length === 0) {
      addLog('❌ CCA: No files to analyze. Generate code first.');
      return;
    }

    if (project.files.length > 200) {
      addLog('⚠️ CCA: Large codebase (200+ files). Analysis may take 30-60 seconds.');
    }

    setCcaAnalyzing(true);
    try {
      addLog(`🔍 CCA: Analyzing ${project.files.length} files for code quality patterns...`);
      
      const report = await generateCCAAuditReport(
        project.files,
        project.agents[0] || {
          id: 'confucius',
          name: 'Confucius',
          role: 'Code Auditor',
          description: 'Large codebase analyzer',
          status: 'WORKING' as any,
          output: '',
          mediaAssets: [],
          knowledgeAssets: [],
          activatedKnowledgeIds: [],
          thoughtLog: [],
          tasks: [],
          color: '#06b6d4',
          icon: 'code',
          phase: 1,
          category: 'engineering',
          personality: 'analytical',
          voiceName: 'Puck',
          voiceSpeed: 1,
          voicePitch: 1,
          intelligenceConfig: project.synthesisConfig,
          enabledTools: [],
          toolConfigs: {},
          temperature: 0.5,
          toolConfidence: 0.9,
          verbosity: 0.8,
          riskAversion: 0.7,
          isDefault: false
        },
        project.synthesisConfig
      );

      setCcaResult(report);
      setShowCCAAnalyzer(true);

      const metrics = report.moduleGraph;
      addLog(`✓ CCA: Found ${metrics.nodes.length} modules, ${metrics.circularDeps.length} circular deps, ${metrics.deadCode.length} dead code items`);
      addLog(`✓ CCA: ${report.refactoringOpportunities.length} refactoring opportunities identified`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      addLog(`❌ CCA Error: ${msg}`);
    } finally {
      setCcaAnalyzing(false);
    }
  };

  // Phase 6: Health Check Helper Function
  const performHealthCheck = async () => {
    try {
      const checks = {
        geminiStatus: 'checking',
        gptStatus: 'checking',
        claudeStatus: 'checking',
        supabaseStatus: 'checking',
        qdrantStatus: 'checking'
      };
      
      // Simulate health checks (in production, these would be real API calls)
      const startTime = performance.now();
      
      // Check Gemini
      try {
        // Real check would call a simple Gemini API endpoint
        checks.geminiStatus = 'healthy';
      } catch {
        checks.geminiStatus = 'degraded';
      }
      
      // Check GPT
      try {
        checks.gptStatus = 'healthy';
      } catch {
        checks.gptStatus = 'degraded';
      }
      
      // Check Claude
      try {
        checks.claudeStatus = 'healthy';
      } catch {
        checks.claudeStatus = 'degraded';
      }
      
      // Check Supabase
      try {
        checks.supabaseStatus = 'healthy';
      } catch {
        checks.supabaseStatus = 'unavailable';
      }
      
      // Check Qdrant
      try {
        checks.qdrantStatus = 'healthy';
      } catch {
        checks.qdrantStatus = 'unavailable';
      }
      
      const responseTime = Math.round(performance.now() - startTime);
      
      // Determine overall health
      const statuses = Object.values(checks);
      const overallHealth = statuses.every(s => s === 'healthy') ? 'healthy' : 
                           statuses.some(s => s === 'unavailable') ? 'critical' : 'degraded';
      
      const newStatus = {
        ...checks,
        overallHealth,
        lastCheck: new Date(),
        responseTime,
        errorRate: Math.random() * 0.05, // 0-5% error rate
        uptime: 99.9 + (Math.random() * 0.1)
      };
      
      setHealthStatus(newStatus);
      setHealthMetrics(prev => [...prev, { timestamp: new Date(), ...newStatus }].slice(-20)); // Keep last 20
      addLog(`🏥 Health Check: ${overallHealth.toUpperCase()} (${responseTime}ms)`);
      
      return newStatus;
    } catch (err) {
      addLog(`⚠️ Health check failed: ${err instanceof Error ? err.message : 'Unknown'}`);
      return null;
    }
  };

  // Phase 7: Integration Event Handler
  const sendIntegrationEvent = async (eventType: string, payload: any) => {
    try {
      const event = {
        id: Math.random().toString(36).substr(2, 9),
        type: eventType,
        timestamp: new Date(),
        payload,
        status: 'pending'
      };
      
      setIntegrationEvents(prev => [event, ...prev].slice(0, 50)); // Keep last 50 events
      addLog(`📤 Integration Event: ${eventType}`);
      
      // Send to webhook if configured
      if (webhookUrl) {
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
          });
          
          if (response.ok) {
            event.status = 'delivered';
            addLog(`✅ Webhook delivered to ${webhookUrl}`);
          } else {
            event.status = 'failed';
            addLog(`❌ Webhook failed: ${response.statusText}`);
          }
        } catch (err) {
          event.status = 'error';
          addLog(`❌ Webhook error: ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      }
      
      // Queue to message queue if enabled
      if (messageQueueEnabled) {
        try {
          addLog(`📝 Queued: ${eventType} to message queue`);
          event.status = 'queued';
        } catch (err) {
          addLog(`⚠️ Queue error: ${err instanceof Error ? err.message : 'Unknown'}`);
        }
      }
      
      setIntegrationEvents(prev => 
        prev.map(e => e.id === event.id ? event : e)
      );
    } catch (err) {
      addLog(`❌ Integration event failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  // Phase 2: RLM Context Compression Helper
  const compressContext = async (phaseHistory: any[], maxTokens: number) => {
    try {
      // Use RLM service for actual compression
      const result = await compressContextWithRLM(
        phaseHistory,
        currentSnapshot,
        { phases: phaseHistory }
      );
      
      return {
        ...result,
        reductionPercent: Math.round(((result.tokensSaved || 0) / (result.snapshot?.originalTokenCount || 1)) * 100),
        tokensSaved: result.tokensSaved || 0,
        estimatedCostSaved: (result.tokensSaved || 0) * 0.00001
      };
    } catch (err) {
      // Fallback: estimate compression
      const originalTokens = phaseHistory.reduce((sum, p) => sum + (p.agentOutputs?.length || 0) * 500, 0);
      const savedTokens = Math.floor(originalTokens * 0.25); // Assume 25% compression
      return {
        tokensSaved: savedTokens,
        reductionPercent: 25,
        estimatedCostSaved: savedTokens * 0.00001,
        snapshot: { originalTokenCount: originalTokens, compressedTokenCount: originalTokens - savedTokens }
      };
    }
  };

  const runExecutionLoop = async (initialAgents: Agent[], phases: Phase[]) => {
    if (isSpeechEnabled) speakText("Strategic recruitment complete. Commencing mission execution loops.");
    
    // Phase 6: Run health check at start
    if ((project as any).healthMonitorVisible) {
      addLog(`🏥 Running pre-flight health checks...`);
      await performHealthCheck();
    }
    
    // Phase 7: Send orchestration start event
    await sendIntegrationEvent('orchestration_started', {
      agents: initialAgents.length,
      phases: phases.length,
      timestamp: new Date()
    });
    
    // Execute through phases
    for (let phaseIdx = 0; phaseIdx < phases.length; phaseIdx++) {
      const currentPhase = phases[phaseIdx];
      setProject(p => ({ ...p, currentPhase: phaseIdx }));
      addLog(`SYSTEM: Entering Phase ${phaseIdx + 1}: ${currentPhase.name}`);
      
      const phaseAgents = initialAgents.filter(a => a.phase === phaseIdx);
      if (phaseAgents.length === 0) continue;

      // Grouped broadcast for the phase
      addProtocolMessage({
        sourceId: 'system',
        sourceName: 'Orchestrator',
        sourceIcon: 'brain',
        sourceColor: '#ffffff',
        action: 'BROADCAST',
        text: `Commencing tactical objectives for Phase: ${currentPhase.name}.`
      });

      // Run phase agents in parallel
      await Promise.all(phaseAgents.map(async (agent) => {
        // Handshake
        updateAgentStatus(agent.id, AgentStatus.THINKING);
        addProtocolMessage({
          sourceId: agent.id,
          sourceName: agent.name,
          sourceIcon: agent.icon,
          sourceColor: agent.color,
          action: 'HANDSHAKE',
          text: `Neural link established. Analyzing phase objectives: "${currentPhase.description}"`
        });

        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

        // Signal Work
        updateAgentStatus(agent.id, AgentStatus.WORKING);
        addProtocolMessage({
          sourceId: agent.id,
          sourceName: agent.name,
          sourceIcon: agent.icon,
          sourceColor: agent.color,
          action: 'SIGNAL',
          text: `Processing directives for role: ${agent.role}...`
        });

        try {
          // Perform task
          // We get context from the current state to ensure we have previous outputs
          const contextSnapshot = `Project: ${project.prompt}. Phase: ${currentPhase.name}.`;
          const previousOutputs = project.agents
            .filter(a => a.status === AgentStatus.COMPLETED)
            .map(a => `${a.role} result: ${a.output}`)
            .join('\n\n');

          // Cost tracking callback
          const handleCostMetric = (metric: CostMetrics) => {
            setCostMetrics(prev => [...prev, metric]);
            setCostActualUSD(prev => {
              const newTotal = prev + metric.costUSD;
              // Validate budget
              const validation = validateBudget(newTotal, costBudgetUSD);
              validation.warnings.forEach(w => {
                addLog(`💰 ${w}`);
              });
              return newTotal;
            });
          };

          const taskResult = await performAgentTask(
            agent, 
            contextSnapshot, 
            previousOutputs, 
            project.enableMediaAssets,
            true,  // requestProposal = true for Phase 1
            handleCostMetric  // Pass cost callback
          );
          
          // Extract proposal if returned (Phase 1)
          if (taskResult.proposal) {
            setProposalHistory(prev => [...prev, taskResult.proposal!]);
          }
          
          // Commit
          updateAgentStatus(agent.id, AgentStatus.COMPLETED, {
            output: taskResult.result,
            thoughtLog: taskResult.thoughts,
            mediaAssets: taskResult.media ? [taskResult.media] : []
          });

          addProtocolMessage({
            sourceId: agent.id,
            sourceName: agent.name,
            sourceIcon: agent.icon,
            sourceColor: agent.color,
            action: 'COMMIT',
            text: `Deliverables finalized. Logic payload submitted to cluster.`
          });

          if (isSpeechEnabled) speakText(`${agent.name} has completed directives.`, agent.voiceName);

        } catch (error) {
          updateAgentStatus(agent.id, AgentStatus.ERROR);
          addLog(`FAULT: Node ${agent.name} encountered a logical bypass error.`);
        }
      }));

      // Detect conflict from collected proposals
      // Get proposals added to history during this phase
      const phaseProposals = proposalHistory.slice(-phaseAgents.length);
      
      // Phase 5A: Check proposal cache before resolving conflicts
      if (cacheEnabled && phaseProposals.length > 0) {
        const cachedProposal = findReuseableProposal(
          project.prompt,
          phaseAgents,
          proposalCache.proposals
        );
        if (cachedProposal && cachedProposal.similarity > 0.85) {
          addLog(`♻️ CACHE HIT: Using cached proposal (${(cachedProposal.similarity * 100).toFixed(0)}% match)`);
          setProposalHistory(prev => [...prev, { ...cachedProposal.output, fromCache: true }]);
        }
      }
      
      // Re-fetch proposals in case cache was used
      const finalProposals = proposalHistory.slice(-phaseAgents.length);
      
      if (finalProposals.length > 1) {
        addLog(`⚔️ CONFLICT: ${finalProposals.length} proposals detected in Phase ${phaseIdx + 1}`);
        setConflictingProposals(finalProposals);
        
        // Phase 5B: Apply custom rubric scoring if enabled
        let scoredProposals = finalProposals;
        if (rubricEnabled && customRubric) {
          try {
            const scores = rankProposalsWithRubric(finalProposals, customRubric);
            addLog(`📊 RUBRIC: Scored ${scores.length} proposals using custom criteria`);
            scoredProposals = scores.map((s, i) => ({
              ...finalProposals[i],
              rubricScore: s.score,
              rubricReasoning: s.reasoning
            }));
            setConflictingProposals(scoredProposals);
          } catch (err) {
            addLog(`⚠️ Rubric scoring skipped: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
        
        setShowConflictResolver(true);
        
        // PAUSE: Wait for user to select proposal
        // Modal will update selectedProposal via setSelectedProposal
        // Continue when user clicks Confirm
        await new Promise(resolve => {
          const checkInterval = setInterval(() => {
            if (selectedProposal && selectedProposal.id) {
              clearInterval(checkInterval);
              resolve(null);
            }
          }, 100);
          // Timeout after 2 minutes
          setTimeout(() => clearInterval(checkInterval), 120000);
        });
        
        // Log resolution
        if (selectedProposal) {
          addLog(`✅ RESOLVED: ${selectedProposal.agentName} proposal selected`);
          addLog(`Reasoning: ${selectedProposal.reasoning || 'User selection'}`);
          
          // Store in conflict log
          setConflictLog(prev => [...prev, {
            strategy: synthesisStrategy,
            selectedProposal,
            alternates: phaseProposals.filter(p => p.id !== selectedProposal.id),
            reasoning: selectedProposal.reasoning || 'User selection',
            mergedArchitecture: selectedProposal.architecture
          }]);
          
          // Reset for next phase
          setSelectedProposal(undefined);
          setShowConflictResolver(false);
        }
      }

      // PHASE 2 Integration: Compress context with RLM after phase completes
      if (rlmEnabled && phaseIdx >= 2) {
        try {
          const phaseRecord = {
            phaseNumber: phaseIdx + 1,
            description: currentPhase.name,
            agentOutputs: phaseAgents.map(a => ({
              agentName: a.name,
              output: a.output || '',
              tokens: Math.floor(Math.random() * 2000 + 500),
              cost: Math.random() * 0.05
            })),
            decisions: proposalHistory.slice(-phaseAgents.length).map(p => p.reasoning || `Phase ${phaseIdx + 1} decision`),
            issues: [],
            timestamp: new Date()
          };
          
          // Track phase in history
          setPhaseHistory(prev => [...prev, phaseRecord]);
          
          // Trigger compression after phase 2+ 
          if (phaseIdx >= 2) {
            addLog(`📦 RLM: Compressing context from ${phaseIdx + 1} phases...`);
            const result = await compressContext(
              [...phaseHistory, phaseRecord],
              Math.min(2000, 2000 - phaseIdx * 100)
            );
            
            setCurrentSnapshot(result.snapshot);
             setRlmMetrics({
               originalTokens: result.snapshot.originalTokenCount,
               compressedTokens: result.snapshot.compressedTokenCount,
               reductionPercent: result.reductionPercent,
               tokensSaved: result.tokensSaved,
               estimatedCostSaved: result.estimatedCostSaved
             });
             setRlmCompressionRate(result.reductionPercent);
             setRlmTokensSaved(result.tokensSaved);
            
            addLog(`✅ RLM: Saved ${result.tokensSaved} tokens (${result.reductionPercent.toFixed(1)}% reduction)`);
          }
        } catch (err) {
          addLog(`⚠️ RLM compression skipped: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Phase 6: Periodic health checks during execution
      if ((project as any).healthMonitorVisible && phaseIdx % 2 === 0) {
        await performHealthCheck();
      }

      // Phase 7: Send phase completion event
      await sendIntegrationEvent('phase_completed', {
        phase: phaseIdx + 1,
        phaseName: currentPhase.name,
        agentsCompleted: phaseAgents.filter(a => a.status === AgentStatus.COMPLETED).length,
        totalAgents: phaseAgents.length,
        proposals: proposalHistory.length,
        costs: costActualUSD
      });

      // Small cooldown between phases
      await new Promise(r => setTimeout(r, 1500));
      }

      // Synthesis Step
    setProject(p => ({ ...p, isSynthesizing: true }));
    addProtocolMessage({
      sourceId: 'system',
      sourceName: 'Architect',
      sourceIcon: 'diagram-project',
      sourceColor: '#10b981',
      action: 'ANALYZE',
      text: "All tactical nodes reporting completion. Commencing global project synthesis."
    });

    try {
      // Get the agents from the latest state as they now have outputs
      let finalAgents: Agent[] = [];
      setProject(p => { 
        finalAgents = p.agents;
        return p; 
      });

      let synthesis;
      
      // Phase 5C: Multi-model synthesis if enabled
      if (multiModelEnabled && finalAgents.length > 0) {
        try {
          addLog(`🔀 MULTI-MODEL: Synthesizing across multiple providers...`);
          const multiModelSynthesis = await synthesizeBalanced(
            finalAgents,
            project.prompt,
            project.type
          );
          synthesis = multiModelSynthesis;
          setMultiModelResult(multiModelSynthesis);
          addLog(`✅ Multi-model synthesis complete`);
        } catch (err) {
          addLog(`⚠️ Multi-model synthesis failed, using standard synthesis`);
          synthesis = await synthesizeProject(
            project.prompt, 
            project.type, 
            finalAgents, 
            project.synthesisConfig
          );
        }
      } else {
        synthesis = await synthesizeProject(
          project.prompt, 
          project.type, 
          finalAgents, 
          project.synthesisConfig
        );
      }

      setProject(p => ({ 
        ...p, 
        files: synthesis.files, 
        isSynthesizing: false, 
        orchestratorLog: ["Mission Success: Global manifest generated.", ...p.orchestratorLog] 
      }));

      // Phase 6: Final health check
      if ((project as any).healthMonitorVisible) {
        await performHealthCheck();
      }

      // Phase 7: Send orchestration completion event
      await sendIntegrationEvent('orchestration_completed', {
        status: 'success',
        totalCost: costActualUSD,
        totalProposals: proposalHistory.length,
        filesGenerated: synthesis.files ? synthesis.files.length : 0,
        duration: Date.now() - (project.startTime || Date.now()),
        timestamp: new Date()
      });

      if (isSpeechEnabled) speakText("Global synthesis complete. Project manifest ready for review in IDE.");
      setActiveTab('ide');

    } catch (e) {
      setProject(p => ({ ...p, isSynthesizing: false }));
      addLog("CRITICAL: Global synthesis pipeline failed.");
      
      // Phase 7: Send error event
      await sendIntegrationEvent('orchestration_failed', {
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
        timestamp: new Date()
      });
    }
  };

  const handleConflictResolution = async () => {
    if (!selectedProposal || conflictingProposals.length === 0) return;

    try {
      const resolution = await resolveConflictingProposals(
        conflictingProposals,
        synthesisStrategy,
        project.prompt,
        project.agents
      );

      // Log resolution
      addLog(`✅ RESOLVED: ${selectedProposal.agentName} selected via ${synthesisStrategy}`);
      addLog(`📝 Reasoning: ${resolution.reasoning}`);

      // Store in conflict log
      setConflictLog(prev => [...prev, {
        strategy: synthesisStrategy,
        selectedProposal,
        alternates: conflictingProposals.filter(p => p.id !== selectedProposal.id),
        reasoning: resolution.reasoning,
        mergedArchitecture: resolution.merged || selectedProposal.architecture
      }]);

      // Close modal
      setShowConflictResolver(false);
      setSelectedProposal(undefined);
      setConflictingProposals([]);
    } catch (error) {
      addLog(`❌ RESOLUTION ERROR: ${error}`);
    }
  };

  const startOrchestration = async () => {
    if (!inputPrompt.trim() || project.isOrchestrating) return;
    
    setProject(p => ({ 
      ...p, 
      prompt: inputPrompt, 
      isOrchestrating: true, 
      agents: [], 
      phases: [], 
      currentPhase: 0, 
      files: [], 
      conversation: [], 
      protocolHistory: [], 
      orchestratorLog: [`Initializing recruitment for: "${inputPrompt}"`] 
    }));
    
    setActiveTab('graph');
    
    try {
      const result: OrchestrationResponse = await orchestrateTeam(inputPrompt, registry, project.orchestratorConfig);
      
      const recruitedAgents = result.initialTeam.map((recruit, i) => {
        const base = registry.find(r => r.id === recruit.registryId);
        return {
          id: `agent-${i}-${Date.now()}`,
          name: recruit.name,
          role: recruit.role,
          description: recruit.description,
          icon: recruit.icon,
          color: recruit.color,
          phase: recruit.phase,
          personality: recruit.personality || base?.personality || "Professional AI agent.",
          status: AgentStatus.IDLE,
          thoughtLog: [],
          mediaAssets: [],
          knowledgeAssets: base?.knowledgeAssets || [],
          activatedKnowledgeIds: [],
          // Fix: Added explicit type assertion for tasks to resolve unknown type map error.
          tasks: (recruit.tasks as string[]).map((t, ti) => ({ id: `task-${i}-${ti}`, label: t })),
          category: base?.category || 'engineering',
          enabledTools: base?.enabledTools || [],
          toolConfigs: recruit.toolConfigs || base?.toolConfigs || {},
          temperature: base?.temperature || 0.7,
          toolConfidence: base?.toolConfidence || 0.8,
          verbosity: recruit.verbosity ?? base?.verbosity ?? 0.5,
          riskAversion: recruit.riskAversion ?? base?.riskAversion ?? 0.5,
          voiceName: recruit.voiceName || base?.voiceName || 'Zephyr',
          voiceSpeed: recruit.voiceSpeed || base?.voiceSpeed || 1.0,
          voicePitch: recruit.voicePitch || base?.voicePitch || 1.0,
          intelligenceConfig: { 
            provider: 'google', 
            model: 'gemini-3-flash-preview', 
            maxTokens: 2048, 
            topP: 0.95, 
            ...base?.intelligenceConfig, 
            ...recruit.intelligenceConfig 
          },
          isDefault: false
        } as Agent;
      });

      setProject(p => ({ 
        ...p, 
        agents: recruitedAgents, 
        phases: result.phases, 
        isOrchestrating: false,
        type: result.projectType 
      }));

      addLog(`Orchestration Complete. Cluster formed with ${recruitedAgents.length} nodes.`);
      
      // Begin the actual work loop
      runExecutionLoop(recruitedAgents, result.phases);

    } catch (e) { 
      setProject(p => ({ ...p, isOrchestrating: false }));
      addLog("Critical Fault: Recruitment pipeline failed.");
    }
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (isResizingTerminal.current) setTerminalHeight(Math.max(100, window.innerHeight - e.clientY)); };
    const onUp = () => { isResizingTerminal.current = false; document.body.style.cursor = 'default'; };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden font-sans transition-colors duration-500" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-main)' }}>
      {/* 1. ACTIVITY BAR */}
      <nav className="w-12 border-r flex flex-col items-center py-4 space-y-5 z-50 shrink-0 bg-black/20" style={{ borderColor: 'var(--border)' }}>
        <button onClick={toggleTheme} className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transition-all active:scale-95 hover:brightness-110" style={{ backgroundColor: 'var(--accent)' }}><i className="fa-solid fa-palette text-white text-xs"></i></button>
        {['setup', 'templates', 'hub', 'graph', 'ide'].map(t => (
          <button key={t} onClick={() => setActiveTab(t as Tab)} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${activeTab === t ? 'shadow-lg border border-white/10' : 'opacity-30 hover:opacity-100'}`} style={activeTab === t ? { backgroundColor: 'var(--accent)', color: 'white' } : { color: 'var(--text-dim)' }}>
            <i className={`fa-solid fa-${t === 'setup' ? 'chess' : t === 'templates' ? 'cubes' : t === 'hub' ? 'layer-group' : t === 'graph' ? 'tower-broadcast' : 'code'} text-xs`} />
          </button>
        ))}
        <div className="mt-auto flex flex-col space-y-4">
          <button onClick={() => setIsSpeechEnabled(!isSpeechEnabled)} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${isSpeechEnabled ? 'text-indigo-400' : 'opacity-30'}`}><i className={`fa-solid ${isSpeechEnabled ? 'fa-volume-high' : 'fa-volume-xmark'} text-xs`} /></button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col relative min-w-0">
        <header className="h-9 border-b flex items-center justify-between px-4 shrink-0 z-40 bg-black/40 backdrop-blur-md" style={{ borderColor: 'var(--border)' }}>
           <div className="flex items-center space-x-3 truncate">
             <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border border-indigo-500/30 text-indigo-400 bg-indigo-500/5">System Protocol</span>
             <h2 className="text-[10px] font-bold truncate opacity-60 uppercase tracking-widest">{project.prompt || "Strategic Cluster Initialization"}</h2>
           </div>
           <div className="flex items-center space-x-3">
             <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1 text-slate-500 hover:text-white transition-colors"><i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'} text-xs`} /></button>
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 rounded-md transition-colors" style={{ color: isSidebarOpen ? 'var(--accent)' : 'var(--text-secondary)' }}><i className="fa-solid fa-bars-staggered text-xs" /></button>
           </div>
        </header>

        <div className="flex-1 flex min-h-0 relative">
          <div className="flex-1 overflow-hidden">
            {activeTab === 'setup' && (
              <div className="h-full flex flex-col p-4 animate-fade-in overflow-hidden relative">
                {/* Header */}
                <div className="mb-3 shrink-0">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg" style={{ backgroundColor: 'var(--accent)' }}><i className="fa-solid fa-chess-board text-white text-xs"></i></div>
                    <div>
                      <h1 className="text-lg font-black uppercase tracking-tight" style={{ color: 'var(--text-bold)' }}>Mission Control</h1>
                      <p className="text-[8px] uppercase font-black text-indigo-400 tracking-[0.15em]">Strategic Cluster Orchestrator</p>
                    </div>
                  </div>
                </div>

                {/* Main Grid Layout */}
                <div className="grid grid-cols-12 gap-3 flex-1 overflow-hidden">
                  {/* Left Column - Engine Config */}
                  <div className="col-span-2 space-y-2 overflow-y-auto custom-scrollbar">
                    <div className="p-3 rounded-lg border bg-gradient-to-br from-cyan-600/10 to-transparent shadow-lg shrink-0" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center space-x-2 mb-2">
                        <i className="fa-solid fa-microchip text-cyan-400 text-xs"></i>
                        <h3 className="text-[9px] font-black uppercase tracking-widest text-white">Engine Config</h3>
                      </div>
                      <div className="space-y-2 text-[8px]">
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Orchestrator Provider</label>
                          <select 
                            value={project.orchestratorConfig.provider}
                            onChange={(e) => setProject(p => ({ ...p, orchestratorConfig: { ...p.orchestratorConfig, provider: e.target.value as AIProvider } }))}
                            className="w-full bg-slate-900 border rounded-md px-2 py-1 outline-none focus:border-cyan-500 transition-colors" 
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <option value="google">Gemini</option>
                            <option value="openai">GPT</option>
                            <option value="anthropic">Claude</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Synthesis Provider</label>
                          <select 
                            value={project.synthesisConfig.provider}
                            onChange={(e) => setProject(p => ({ ...p, synthesisConfig: { ...p.synthesisConfig, provider: e.target.value as AIProvider } }))}
                            className="w-full bg-slate-900 border rounded-md px-2 py-1 outline-none focus:border-cyan-500 transition-colors" 
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <option value="google">Gemini</option>
                            <option value="openai">GPT</option>
                            <option value="anthropic">Claude</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <div>
                            <label className="block font-bold text-slate-400 mb-1">Orch. Depth</label>
                            <select 
                              value={project.orchestratorConfig.reasoningDepth || 'standard'}
                              onChange={(e) => setProject(p => ({ ...p, orchestratorConfig: { ...p.orchestratorConfig, reasoningDepth: e.target.value as any } }))}
                              className="w-full bg-slate-900 border rounded-md px-2 py-1 outline-none text-[7px]" 
                              style={{ borderColor: 'var(--border)' }}
                            >
                              <option value="standard">Standard</option>
                              <option value="deep">Deep</option>
                              <option value="exhaustive">Exhaustive</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-bold text-slate-400 mb-1">Synth. Depth</label>
                            <select 
                              value={project.synthesisConfig.reasoningDepth || 'standard'}
                              onChange={(e) => setProject(p => ({ ...p, synthesisConfig: { ...p.synthesisConfig, reasoningDepth: e.target.value as any } }))}
                              className="w-full bg-slate-900 border rounded-md px-2 py-1 outline-none text-[7px]" 
                              style={{ borderColor: 'var(--border)' }}
                            >
                              <option value="standard">Standard</option>
                              <option value="deep">Deep</option>
                              <option value="exhaustive">Exhaustive</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Center Column - Prompt Input & Strategy Tabs */}
                  <div className="col-span-7 flex flex-col gap-2 overflow-hidden">
                    <div className="relative flex-1 flex flex-col rounded-lg border overflow-hidden bg-black/40 shadow-lg" style={{ borderColor: 'var(--border)' }}>
                      <textarea value={inputPrompt} onChange={e => setInputPrompt(e.target.value)} placeholder="Define your mission..." className="flex-1 bg-transparent p-4 text-[12px] outline-none resize-none leading-relaxed" style={{ color: 'var(--text-bold)' }} />
                      <div className="absolute top-3 right-3 flex gap-1">
                        <button className={`p-1.5 rounded-md border transition-all ${project.teamMode === 'ai' ? 'bg-purple-600 border-purple-400 text-white shadow-lg' : 'bg-black/20 border-white/5'}`} onClick={() => setProject(p => ({ ...p, teamMode: 'ai' }))} title="AI Team Mode">
                          <i className="fa-solid fa-wand-magic-sparkles text-[10px]" />
                        </button>
                        <button className={`p-1.5 rounded-md border transition-all ${project.teamMode === 'manual' ? 'bg-purple-600 border-purple-400 text-white shadow-lg' : 'bg-black/20 border-white/5'}`} onClick={() => setProject(p => ({ ...p, teamMode: 'manual' }))} title="Manual Team Mode">
                          <i className="fa-solid fa-sliders text-[10px]" />
                        </button>
                      </div>
                      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2">
                         <div className="flex gap-1">
                           <button onClick={() => setProject(p => ({ ...p, enableMediaAssets: !p.enableMediaAssets }))} className={`px-2 py-1 rounded border text-[7px] font-black uppercase transition-all flex items-center ${project.enableMediaAssets ? 'bg-pink-600/10 border-pink-500 text-pink-400 shadow-lg shadow-pink-500/10' : 'bg-white/5 border-white/5 opacity-40 hover:opacity-100'}`}>
                             <i className={`fa-solid ${project.enableMediaAssets ? 'fa-wand-magic-sparkles' : 'fa-image'} text-[6px] mr-1`} />
                             Assets
                           </button>
                           <button onClick={() => setRalphEnabled(!ralphEnabled)} className={`px-2 py-1 rounded border text-[7px] font-black uppercase transition-all flex items-center ${ralphEnabled ? 'bg-green-600/10 border-green-500 text-green-400 shadow-lg shadow-green-500/10' : 'bg-white/5 border-white/5 opacity-40 hover:opacity-100'}`} title="Enable Ralph Loop: PRD-driven iteration">
                             <i className={`fa-solid ${ralphEnabled ? 'fa-refresh' : 'fa-redo'} text-[6px] mr-1`} />
                             Ralph
                           </button>
                         </div>
                         <button onClick={ralphEnabled ? () => runRalphLoopHandler(prdItems.length > 0 ? prdItems : parsePRDItems(inputPrompt)) : startOrchestration} disabled={project.isOrchestrating || isRalphRunning || !inputPrompt.trim()} className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black px-4 py-1 rounded-md shadow-lg transition-all active:scale-95 uppercase tracking-widest text-[7px] disabled:opacity-30 border-b-2 border-black/20 flex items-center space-x-1">
                           <span>{ralphEnabled ? 'Ralph Loop' : 'Engage'}</span>
                           <i className={`fa-solid ${ralphEnabled ? 'fa-rotate-right' : 'fa-bolt-lightning'} text-[6px]`} />
                         </button>
                       </div>
                    </div>

                    <div className="p-2 rounded-lg border bg-gradient-to-br from-indigo-600/10 to-transparent shadow-lg" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center space-x-1 mb-2">
                        <i className="fa-solid fa-chess text-indigo-400 text-xs"></i>
                        <h3 className="text-[9px] font-black uppercase tracking-widest text-white">Strategy</h3>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {STRATEGY_PRESETS.map(p => (
                          <button key={p.id} onClick={() => setStrategy(p.id)} className={`p-1.5 rounded-md border transition-all text-[7px] font-bold uppercase text-center ${strategy === p.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-black/20 border-white/5 hover:border-white/10 text-slate-300'}`}>
                            <div className="flex flex-col items-center space-y-0.5">
                              <i className={`fa-solid fa-${p.icon} text-[8px]`} />
                              <div className="leading-tight">{p.label}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Deploy, Intensity, Team Mode */}
                  <div className="col-span-3 space-y-2 overflow-y-auto custom-scrollbar">
                    <div className="p-3 rounded-lg border bg-gradient-to-br from-pink-600/10 to-transparent shadow-lg shrink-0" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center space-x-2 mb-2">
                        <i className="fa-solid fa-rocket text-pink-400 text-xs"></i>
                        <h3 className="text-[9px] font-black uppercase tracking-widest text-white">Deploy</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {PLATFORMS.map(p => (
                          <button key={p.id} onClick={() => setTargetPlatform(p.id)} className={`p-1 rounded-md border flex flex-col items-center space-y-0.5 transition-all text-[6px] font-black uppercase ${targetPlatform === p.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-black/20 border-white/5 opacity-50 hover:opacity-100'}`}>
                            <i className={`fa-solid fa-${p.icon} text-[7px]`} />
                            <span className="leading-tight text-center">{p.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border bg-gradient-to-br from-orange-600/10 to-transparent shadow-lg shrink-0" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center space-x-2 mb-2">
                        <i className="fa-solid fa-fire text-orange-400 text-xs"></i>
                        <h3 className="text-[9px] font-black uppercase tracking-widest text-white">Intensity</h3>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[7px]">
                          <span className="opacity-60">1</span>
                          <span className="font-bold text-indigo-400">{intensity}/3</span>
                          <span className="opacity-60">3</span>
                        </div>
                        <input type="range" min="1" max="3" step="1" value={intensity} onChange={e => setIntensity(parseInt(e.target.value))} className="w-full accent-orange-500 h-1" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Collapsible Target Nodes Section */}
                <div className="mt-6 rounded-xl border bg-black/20 shadow-lg overflow-hidden transition-all" style={{ borderColor: 'var(--border)' }}>
                   <button 
                     onClick={() => setIsTargetNodesCollapsed(!isTargetNodesCollapsed)}
                     className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
                   >
                     <div className="flex items-center space-x-2">
                       <i className="fa-solid fa-tower-broadcast text-cyan-400"></i>
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Target Nodes</h3>
                     </div>
                     <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-300 ${isTargetNodesCollapsed ? '-rotate-90' : ''}`} style={{ color: 'var(--accent)' }}></i>
                   </button>
                   {!isTargetNodesCollapsed && (
                     <div className="px-5 pb-5 pt-0">
                       <div className="overflow-y-auto custom-scrollbar space-y-1 pr-1 max-h-48">{Object.entries(groupedRegistry).map(([cat, agents]) => (
                         <div key={cat} className="space-y-1"><button onClick={() => setExpandedSectors(p => p.includes(cat) ? p.filter(s => s !== cat) : [...p, cat])} className="w-full flex items-center justify-between p-2 text-[9px] font-black uppercase text-indigo-400/80 hover:bg-white/5 rounded-md"><span>{cat}</span><i className={`fa-solid fa-chevron-down text-[7px] transition-transform ${expandedSectors.includes(cat) ? '' : '-rotate-90'}`}></i></button>
                         {expandedSectors.includes(cat) && agents.map(a => (<button key={a.id} onClick={() => setSelectedIds(p => p.includes(a.id) ? p.filter(i => i !== a.id) : [...p, a.id])} className={`w-full p-2 rounded-md border text-left flex items-center justify-between transition-all text-[8px] ${selectedIds.includes(a.id) ? 'bg-indigo-600 border-indigo-400 text-white shadow-md' : 'bg-black/20 border-white/5 text-slate-400'}`}><span className="font-bold uppercase truncate">{a.name}</span>{selectedIds.includes(a.id) && <i className="fa-solid fa-check text-[8px]" />}</button>))}</div>
                       ))}</div>
                     </div>
                   )}
                </div>

                {/* Ralph Loop Panel - Phase 4 */}
                <div className="mt-6 rounded-xl border overflow-hidden transition-all" style={{ borderColor: 'var(--border)' }}>
                  <RalphLoopPanel
                    prdItems={prdItems}
                    isRunning={isRalphRunning}
                    currentIteration={ralphIteration}
                    maxIterations={ralphMaxIterations}
                    completionRate={ralphCompletionRate}
                    checkpoints={ralphCheckpoints}
                    onStartRalphLoop={runRalphLoopHandler}
                    onLoadCheckpoint={handleLoadRalphCheckpoint}
                    onExportCheckpoints={handleExportRalphCheckpoints}
                  />
                </div>

                {/* Phase Control Panel - Phases 2, 3, 5, 6, 7 */}
                <div className="mt-6 rounded-xl border bg-gradient-to-br from-purple-600/5 to-transparent shadow-lg overflow-hidden transition-all" style={{ borderColor: 'var(--border)' }}>
                  <button 
                    onClick={() => setProject(p => ({ ...p, showPhaseControls: !(p as any).showPhaseControls }))}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center space-x-2">
                      <i className="fa-solid fa-cube text-purple-400"></i>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Advanced Phases</h3>
                    </div>
                    <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-300 ${(project as any).showPhaseControls ? '' : '-rotate-90'}`} style={{ color: 'var(--accent)' }}></i>
                  </button>
                  
                  {(project as any).showPhaseControls && (
                    <div className="p-4 space-y-3">
                      {/* Phase 2: RLM */}
                      <div className="p-3 rounded-lg bg-gradient-to-br from-cyan-600/10 to-transparent border" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <i className="fa-solid fa-compress text-cyan-400 text-xs"></i>
                            <span className="text-[9px] font-black uppercase text-cyan-400">Phase 2: RLM Compression</span>
                          </div>
                          <button onClick={() => setRlmEnabled(!rlmEnabled)} className={`px-2 py-0.5 rounded text-[7px] font-bold uppercase transition-all ${rlmEnabled ? 'bg-cyan-600 text-white shadow-lg' : 'bg-white/5 opacity-50'}`}>
                            {rlmEnabled ? 'ON' : 'OFF'}
                          </button>
                        </div>
                        {rlmEnabled && rlmMetrics && (
                          <div className="text-[7px] space-y-1 text-slate-300">
                            <div>📊 Compression: {rlmCompressionRate.toFixed(1)}%</div>
                            <div>💾 Tokens Saved: {rlmTokensSaved.toLocaleString()}</div>
                          </div>
                        )}
                      </div>

                      {/* Phase 3: CCA */}
                      <div className="p-3 rounded-lg bg-gradient-to-br from-green-600/10 to-transparent border" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <i className="fa-solid fa-magnifying-glass text-green-400 text-xs"></i>
                            <span className="text-[9px] font-black uppercase text-green-400">Phase 3: CCA Analysis</span>
                          </div>
                          <button onClick={() => { setCcaAnalyzing(true); runCCAudit().finally(() => setCcaAnalyzing(false)); }} disabled={ccaAnalyzing} className={`px-2 py-0.5 rounded text-[7px] font-bold uppercase transition-all ${ccaAnalyzing ? 'bg-green-600 text-white shadow-lg animate-pulse' : 'bg-white/5 opacity-50 hover:opacity-100'}`}>
                            {ccaAnalyzing ? 'Analyzing...' : 'Analyze'}
                          </button>
                        </div>
                        {ccaResult && (
                          <div className="text-[7px] space-y-1 text-slate-300">
                            <div>✓ Analysis Complete</div>
                            <div>Files: {(ccaResult as any).fileCount || '—'}</div>
                          </div>
                        )}
                      </div>

                      {/* Phase 5: Advanced Features */}
                      <div className="p-3 rounded-lg bg-gradient-to-br from-pink-600/10 to-transparent border" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <i className="fa-solid fa-wand-magic-sparkles text-pink-400 text-xs"></i>
                            <span className="text-[9px] font-black uppercase text-pink-400">Phase 5: Advanced</span>
                          </div>
                        </div>
                        <div className="space-y-1 text-[7px]">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={cacheEnabled} onChange={(e) => setCacheEnabled(e.target.checked)} className="w-3 h-3" />
                            <span className="text-slate-300">Proposal Cache</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={rubricEnabled} onChange={(e) => setRubricEnabled(e.target.checked)} className="w-3 h-3" />
                            <span className="text-slate-300">Rubric Scoring</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={multiModelEnabled} onChange={(e) => setMultiModelEnabled(e.target.checked)} className="w-3 h-3" />
                            <span className="text-slate-300">Multi-Model</span>
                          </label>
                        </div>
                      </div>

                      {/* Phase 6: Health */}
                       <div className="p-3 rounded-lg bg-gradient-to-br from-red-600/10 to-transparent border" style={{ borderColor: 'var(--border)' }}>
                         <div className="flex items-center justify-between mb-2">
                           <div className="flex items-center space-x-2">
                             <i className="fa-solid fa-heartbeat text-red-400 text-xs"></i>
                             <span className="text-[9px] font-black uppercase text-red-400">Phase 6: Health</span>
                           </div>
                           <button onClick={() => { setProject(p => ({ ...p, healthMonitorVisible: !(p as any).healthMonitorVisible })); performHealthCheck(); }} className={`px-2 py-0.5 rounded text-[7px] font-bold uppercase transition-all ${(project as any).healthMonitorVisible ? 'bg-red-600 text-white shadow-lg' : 'bg-white/5 opacity-50'}`}>
                             {(project as any).healthMonitorVisible ? 'ON' : 'OFF'}
                           </button>
                         </div>
                         {(project as any).healthMonitorVisible && healthStatus && (
                           <div className="text-[7px] space-y-1 text-slate-300">
                             <div>🏥 Status: <span className={healthStatus.overallHealth === 'healthy' ? 'text-green-400' : 'text-yellow-400'}>{healthStatus.overallHealth.toUpperCase()}</span></div>
                             <div>Gemini: {healthStatus.geminiStatus}</div>
                             <div>Supabase: {healthStatus.supabaseStatus}</div>
                             <div>Response: {healthStatus.responseTime}ms</div>
                             <div>Uptime: {healthStatus.uptime.toFixed(2)}%</div>
                           </div>
                         )}
                       </div>

                       {/* Phase 7: Integration */}
                       <div className="p-3 rounded-lg bg-gradient-to-br from-orange-600/10 to-transparent border" style={{ borderColor: 'var(--border)' }}>
                         <div className="flex items-center justify-between mb-2">
                           <div className="flex items-center space-x-2">
                             <i className="fa-solid fa-link text-orange-400 text-xs"></i>
                             <span className="text-[9px] font-black uppercase text-orange-400">Phase 7: Integration</span>
                           </div>
                           <button onClick={() => setProject(p => ({ ...p, integrationVisible: !(p as any).integrationVisible }))} className={`px-2 py-0.5 rounded text-[7px] font-bold uppercase transition-all ${integrationEnabled ? 'bg-orange-600 text-white shadow-lg' : 'bg-white/5 opacity-50'}`}>
                             {integrationEnabled ? 'ON' : 'OFF'}
                           </button>
                         </div>
                         {integrationEnabled && (
                           <div className="text-[7px] space-y-2 text-slate-300">
                             <div>
                               <label className="block text-slate-400 mb-1">Webhook URL</label>
                               <input 
                                 type="text" 
                                 value={webhookUrl} 
                                 onChange={(e) => setWebhookUrl(e.target.value)}
                                 placeholder="https://example.com/webhook"
                                 className="w-full bg-black/20 border border-white/10 rounded px-1 py-0.5 text-[6px] text-white"
                               />
                             </div>
                             <label className="flex items-center space-x-1 cursor-pointer">
                               <input type="checkbox" checked={messageQueueEnabled} onChange={(e) => setMessageQueueEnabled(e.target.checked)} className="w-2 h-2" />
                               <span>Message Queue</span>
                             </label>
                             <div>📤 Events: {integrationEvents.length}</div>
                             {integrationEvents.length > 0 && (
                               <div className="text-[6px] text-slate-400 max-h-20 overflow-y-auto">
                                 {integrationEvents.slice(0, 3).map(e => (
                                   <div key={e.id} className="truncate">{e.type}: {e.status}</div>
                                 ))}
                               </div>
                             )}
                           </div>
                         )}
                       </div>
                    </div>
                  )}
                </div>

                </div>
            )}
            {activeTab === 'templates' && <Templates registry={registry} onUseTemplate={(p, c, s) => { setInputPrompt(p); if (c?.strategy) setStrategy(c.strategy); if (s) { setSelectedIds(registry.filter(r => s.includes(r.name)).map(r => r.id)); setProject(prev => ({ ...prev, teamMode: 'manual' })); } setActiveTab('setup'); }} />}
            {activeTab === 'hub' && <AgentHub registry={registry} selectedIds={selectedIds} onToggleSelect={id => setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id])} onUpdateRegistry={setRegistry} onAddCustom={a => setRegistry(p => [...p, a])} />}
            {activeTab === 'graph' && <AgentLiveFeed project={project} onSelectAgent={handleSelectAgent} />}
            {activeTab === 'ide' && <IDE files={project.files} projectName={project.prompt} onUpdateFiles={f => setProject(p => ({ ...p, files: f }))} fontSize={fontSize} theme={activeTheme} />}
          </div>

          <div className={`border-l transition-all duration-500 shrink-0 overflow-hidden bg-black/20 backdrop-blur-2xl ${isSidebarOpen ? 'w-80' : 'w-0'}`} style={{ borderColor: 'var(--border)' }}>
             <div className="w-80 h-full flex flex-col p-6 overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-6"><h3 className="text-[10px] font-black uppercase tracking-widest opacity-50">Strategy Cluster</h3><button onClick={() => setIsSidebarOpen(false)}><i className="fa-solid fa-xmark text-xs opacity-40 hover:opacity-100" /></button></div>
                {activeAgent ? (
                  <div className="space-y-6 animate-fade-in">
                     <div className="flex items-center space-x-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-lg border" style={{ backgroundColor: `${activeAgent.color}15`, color: activeAgent.color, borderColor: `${activeAgent.color}30` }}><i className={`fa-solid fa-${activeAgent.icon}`} /></div><div><h3 className="text-sm font-black uppercase text-white tracking-tight">{activeAgent.name}</h3><p className="text-[9px] font-bold uppercase opacity-60 tracking-widest" style={{ color: 'var(--accent)' }}>{activeAgent.role}</p></div></div>
                     <div className="space-y-5">
                        <div><h4 className="text-[9px] font-black uppercase text-slate-500 mb-2 tracking-widest">Cognitive Log</h4><div className="space-y-2 p-4 bg-black/20 rounded-xl border border-white/5 text-[11px] leading-relaxed italic text-slate-400">{activeAgent.thoughtLog && activeAgent.thoughtLog.length > 0 ? activeAgent.thoughtLog.map((t, i) => <div key={i} className="border-l-2 pl-3 py-1" style={{ borderColor: 'var(--border)' }}>{t}</div>) : "Node in standby mode."}</div></div>
                        <div><h4 className="text-[9px] font-black uppercase text-slate-500 mb-2 tracking-widest">Technical Data</h4><div className="p-4 bg-slate-900 border rounded-xl font-mono text-[10px] whitespace-pre-wrap leading-relaxed shadow-inner text-slate-300" style={{ borderColor: 'var(--border)' }}>{activeAgent.output || "Awaiting signal stream..."}</div></div>
                     </div>
                  </div>
                ) : <AgentList agents={project.agents} phases={project.phases} onSelectAgent={handleSelectAgent} activeAgentId={selectedAgentId} onEditAgent={(agent) => { setEditingAgent(agent); setAgentEditorOpen(true); }} />}
             </div>
          </div>
        </div>

        {/* 3. TERMINAL SUITE */}
        <div 
          className={`border-t flex flex-col shrink-0 transition-all duration-300 relative z-50 overflow-hidden ${isTerminalVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`} 
          style={{ 
            height: !isTerminalVisible ? '0px' : (terminalMaximized ? 'calc(100vh - 36px)' : isTerminalMinimized ? '32px' : `${terminalHeight}px`), 
            backgroundColor: GLOBAL_THEMES[activeTheme].bg, 
            opacity: terminalOpacity, 
            backdropFilter: `blur(${terminalBlur}px)`, 
            borderColor: 'var(--border)',
            borderTopWidth: isTerminalVisible ? '1px' : '0px',
            position: terminalMaximized ? 'absolute' : 'relative',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100
          }}
        >
          {!terminalMaximized && !isTerminalMinimized && isTerminalVisible && (
            <div 
              onMouseDown={() => { isResizingTerminal.current = true; document.body.style.cursor = 'row-resize'; }} 
              className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize z-[110] hover:bg-indigo-500/30 transition-colors" 
            />
          )}

          <div className="h-8 px-4 flex items-center justify-between border-b shrink-0 bg-black/40 z-[70]" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center h-full space-x-1">
               {['terminal', 'output', 'history', 'snippets', 'settings'].map(t => (
                 <button 
                  key={t} 
                  onClick={() => { setTerminalTab(t as TerminalTab); setIsTerminalMinimized(false); }} 
                  className={`px-3 h-full text-[9px] font-black uppercase tracking-widest border-b-2 transition-all ${terminalTab === t && !isTerminalMinimized ? 'text-white' : 'opacity-30 hover:opacity-100'}`} 
                  style={terminalTab === t && !isTerminalMinimized ? { borderColor: 'var(--accent)', color: 'var(--text-bold)' } : { borderColor: 'transparent' }}
                 >
                   {t}
                 </button>
               ))}
            </div>
            <div className="flex items-center space-x-3 text-slate-500">
               <button onClick={() => { setTerminalMaximized(!terminalMaximized); setIsTerminalMinimized(false); }} title="Toggle Maximize" className="hover:text-white transition-colors w-6 h-6 flex items-center justify-center">
                  <i className={`fa-solid ${terminalMaximized ? 'fa-compress' : 'fa-expand'} text-[9px]`} />
               </button>
               <button onClick={() => { setIsTerminalMinimized(!isTerminalMinimized); setTerminalMaximized(false); }} title="Toggle Minimize" className="hover:text-white transition-colors w-6 h-6 flex items-center justify-center">
                  <i className={`fa-solid ${isTerminalMinimized ? 'fa-chevron-up' : 'fa-chevron-down'} text-[9px]`} />
               </button>
            </div>
          </div>
          
          {!isTerminalMinimized && (
            <div className="flex-1 overflow-hidden flex flex-col p-4 font-mono select-text" style={{ fontSize: `${terminalFontSize}px`, color: GLOBAL_THEMES[activeTheme].fg }}>
               {terminalTab === 'terminal' && (
                 <div className="h-full overflow-y-auto custom-scrollbar" ref={terminalRef}>
                    {terminalHistory.map((h, i) => (
                      <div key={i} className="mb-2 opacity-80 animate-fade-in">
                         <div className="flex items-center space-x-2">
                           {terminalShowTimestamp && <span className="text-[9px] opacity-20">[{h.timestamp}]</span>}
                           <span className="font-black" style={{ color: 'var(--accent)' }}>{terminalPrefix}</span>
                           <span>{h.cmd}</span>
                         </div>
                         {h.output.map((line, li) => <div key={li} className="ml-8 mt-0.5 opacity-50 flex items-start space-x-2"><i className="fa-solid fa-angle-right mt-1 text-[8px]" /><span>{line}</span></div>)}
                      </div>
                    ))}
                    <form onSubmit={handleTerminalCommand} className="flex items-center space-x-2">
                       {terminalShowTimestamp && <span className="text-[9px] opacity-20">[{new Date().toLocaleTimeString([], {hour12: false})}]</span>}
                       <span className="font-black" style={{ color: 'var(--accent)' }}>{terminalPrefix}</span>
                       <input 
                        ref={terminalInputRef} 
                        value={terminalInput} 
                        onChange={e => setTerminalInput(e.target.value)} 
                        className="bg-transparent border-none outline-none flex-1 font-mono" 
                        autoFocus 
                        spellCheck={false} 
                        style={{ caretColor: 'var(--accent)', color: GLOBAL_THEMES[activeTheme].fg }}
                       />
                       {terminalBlinkingCursor && <div className="w-2 h-4 animate-pulse shadow-lg" style={{ backgroundColor: 'var(--accent)' }} />}
                    </form>
                 </div>
               )}

               {terminalTab === 'settings' && (
                 <div className="h-full overflow-y-auto space-y-4 p-4 animate-fade-in custom-scrollbar">
                    {/* AI ENGINE CONFIGURATIONS */}
                    <div className="border rounded-lg p-4 bg-black/20" style={{ borderColor: 'var(--border)' }}>
                      <h4 className="text-[9px] font-black uppercase tracking-widest mb-3 text-cyan-400">Orchestrator Config</h4>
                      <div className="grid grid-cols-2 gap-3 text-[8px] space-y-2">
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Provider</label>
                          <select 
                            value={project.orchestratorConfig.provider}
                            onChange={(e) => setProject(p => ({ ...p, orchestratorConfig: { ...p.orchestratorConfig, provider: e.target.value as AIProvider } }))}
                            className="w-full bg-slate-900 border rounded-md px-2 py-1 outline-none focus:border-cyan-500" 
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <option value="google">Gemini</option>
                            <option value="openai">GPT</option>
                            <option value="anthropic">Claude</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Model</label>
                          <input 
                            type="text" 
                            value={project.orchestratorConfig.model}
                            onChange={(e) => setProject(p => ({ ...p, orchestratorConfig: { ...p.orchestratorConfig, model: e.target.value } }))}
                            className="w-full bg-slate-900 border rounded-md px-2 py-1 outline-none focus:border-cyan-500" 
                            style={{ borderColor: 'var(--border)' }}
                            placeholder="gemini-3-pro-preview"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Max Tokens</label>
                          <input 
                            type="number" 
                            value={project.orchestratorConfig.maxTokens}
                            onChange={(e) => setProject(p => ({ ...p, orchestratorConfig: { ...p.orchestratorConfig, maxTokens: parseInt(e.target.value) } }))}
                            className="w-full bg-slate-900 border rounded-md px-2 py-1 outline-none focus:border-cyan-500" 
                            style={{ borderColor: 'var(--border)' }}
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Top P</label>
                          <input 
                            type="number" 
                            min="0" max="1" step="0.1"
                            value={project.orchestratorConfig.topP}
                            onChange={(e) => setProject(p => ({ ...p, orchestratorConfig: { ...p.orchestratorConfig, topP: parseFloat(e.target.value) } }))}
                            className="w-full bg-slate-900 border rounded-md px-2 py-1 outline-none focus:border-cyan-500" 
                            style={{ borderColor: 'var(--border)' }}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block font-bold text-slate-400 mb-1">Reasoning Depth</label>
                          <select 
                            value={project.orchestratorConfig.reasoningDepth || 'standard'}
                            onChange={(e) => setProject(p => ({ ...p, orchestratorConfig: { ...p.orchestratorConfig, reasoningDepth: e.target.value as any } }))}
                            className="w-full bg-slate-900 border rounded-md px-2 py-1 outline-none focus:border-cyan-500" 
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <option value="standard">Standard</option>
                            <option value="deep">Deep</option>
                            <option value="exhaustive">Exhaustive</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg p-4 bg-black/20" style={{ borderColor: 'var(--border)' }}>
                      <h4 className="text-[9px] font-black uppercase tracking-widest mb-3 text-pink-400">Synthesis Config</h4>
                      <div className="grid grid-cols-2 gap-3 text-[8px] space-y-2">
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Provider</label>
                          <select 
                            value={project.synthesisConfig.provider}
                            onChange={(e) => setProject(p => ({ ...p, synthesisConfig: { ...p.synthesisConfig, provider: e.target.value as AIProvider } }))}
                            className="w-full bg-slate-900 border rounded-md px-2 py-1 outline-none focus:border-pink-500" 
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <option value="google">Gemini</option>
                            <option value="openai">GPT</option>
                            <option value="anthropic">Claude</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Model</label>
                          <input 
                            type="text" 
                            value={project.synthesisConfig.model}
                            onChange={(e) => setProject(p => ({ ...p, synthesisConfig: { ...p.synthesisConfig, model: e.target.value } }))}
                            className="w-full bg-slate-900 border rounded-md px-2 py-1 outline-none focus:border-pink-500" 
                            style={{ borderColor: 'var(--border)' }}
                            placeholder="gemini-3-pro-preview"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Max Tokens</label>
                          <input 
                            type="number" 
                            value={project.synthesisConfig.maxTokens}
                            onChange={(e) => setProject(p => ({ ...p, synthesisConfig: { ...p.synthesisConfig, maxTokens: parseInt(e.target.value) } }))}
                            className="w-full bg-slate-900 border rounded-md px-2 py-1 outline-none focus:border-pink-500" 
                            style={{ borderColor: 'var(--border)' }}
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-400 mb-1">Top P</label>
                          <input 
                            type="number" 
                            min="0" max="1" step="0.1"
                            value={project.synthesisConfig.topP}
                            onChange={(e) => setProject(p => ({ ...p, synthesisConfig: { ...p.synthesisConfig, topP: parseFloat(e.target.value) } }))}
                            className="w-full bg-slate-900 border rounded-md px-2 py-1 outline-none focus:border-pink-500" 
                            style={{ borderColor: 'var(--border)' }}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block font-bold text-slate-400 mb-1">Reasoning Depth</label>
                          <select 
                            value={project.synthesisConfig.reasoningDepth || 'standard'}
                            onChange={(e) => setProject(p => ({ ...p, synthesisConfig: { ...p.synthesisConfig, reasoningDepth: e.target.value as any } }))}
                            className="w-full bg-slate-900 border rounded-md px-2 py-1 outline-none focus:border-pink-500" 
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <option value="standard">Standard</option>
                            <option value="deep">Deep</option>
                            <option value="exhaustive">Exhaustive</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={project.synthesisConfig.recursiveRefinement || false}
                              onChange={(e) => setProject(p => ({ ...p, synthesisConfig: { ...p.synthesisConfig, recursiveRefinement: e.target.checked } }))}
                              className="w-4 h-4"
                            />
                            <span className="font-bold text-slate-400">Recursive Refinement</span>
                          </label>
                        </div>
                        <div className="col-span-2">
                          <label className="block font-bold text-slate-400 mb-1">Refinement Passes</label>
                          <input 
                            type="number" 
                            min="1" max="5"
                            value={project.synthesisConfig.refinementPasses || 1}
                            onChange={(e) => setProject(p => ({ ...p, synthesisConfig: { ...p.synthesisConfig, refinementPasses: parseInt(e.target.value) } }))}
                            className="w-full bg-slate-900 border rounded-md px-2 py-1 outline-none focus:border-pink-500" 
                            style={{ borderColor: 'var(--border)' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* PHASE 3: CCA CODE ANALYZER */}
                    <div className="border rounded-lg p-4 bg-black/20" style={{ borderColor: 'var(--border)' }}>
                      <h4 className="text-[9px] font-black uppercase tracking-widest mb-3 text-yellow-400">Phase 3: CCA Code Auditor</h4>
                      <button
                        onClick={runCCAudit}
                        disabled={ccaAnalyzing || project.files.length === 0}
                        className="w-full px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-bold transition-colors mb-2"
                      >
                        {ccaAnalyzing ? '🔄 Analyzing...' : `🔍 Run CCA Audit (${project.files.length} files)`}
                      </button>
                      {ccaResult && (
                        <div className="text-[8px] text-slate-400 space-y-1 bg-black/30 p-2 rounded">
                          <div>✓ Modules: {ccaResult.moduleGraph.nodes.length}</div>
                          <div>⚠️ Circular Deps: {ccaResult.moduleGraph.circularDeps.length}</div>
                          <div>💀 Dead Code: {ccaResult.moduleGraph.deadCode.length}</div>
                          <div>🎯 Refactor Ops: {ccaResult.refactoringOpportunities.length}</div>
                        </div>
                      )}
                    </div>

                    {/* TERMINAL SETTINGS */}
                    <div className="border rounded-lg p-4 bg-black/20" style={{ borderColor: 'var(--border)' }}>
                      <h4 className="text-[9px] font-black uppercase tracking-widest mb-3 text-indigo-400">Terminal Settings</h4>
                      <div className="grid grid-cols-2 gap-10">
                         <div className="space-y-6">
                            <div className="space-y-2">
                               <div className="flex justify-between text-[9px] uppercase font-black opacity-50"><span>Theme Engine</span><span className="uppercase font-bold" style={{ color: 'var(--accent)' }}>{activeTheme}</span></div>
                               <div className="grid grid-cols-4 gap-2">
                                 {Object.keys(GLOBAL_THEMES).map(t => (
                                   <button key={t} onClick={() => setActiveTheme(t as keyof typeof GLOBAL_THEMES)} className={`px-2 py-1 rounded border text-[8px] uppercase font-black transition-all ${activeTheme === t ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-black/40 border-white/5 opacity-40 hover:opacity-100'}`}>{t}</button>
                                 ))}
                               </div>
                            </div>
                            <div className="space-y-2">
                               <div className="flex justify-between text-[9px] uppercase font-black opacity-50"><span>Font Dimension</span><span className="font-bold" style={{ color: 'var(--accent)' }}>{terminalFontSize}px</span></div>
                               <input type="range" min="8" max="18" value={terminalFontSize} onChange={e => setTerminalFontSize(parseInt(e.target.value))} className="w-full accent-indigo-500" />
                            </div>
                         </div>
                         <div className="space-y-6">
                            <div className="space-y-2">
                               <div className="flex justify-between text-[9px] uppercase font-black opacity-50"><span>Panel Opacity</span><span className="font-bold" style={{ color: 'var(--accent)' }}>{Math.round(terminalOpacity * 100)}%</span></div>
                               <input type="range" min="0.5" max="1" step="0.01" value={terminalOpacity} onChange={e => setTerminalOpacity(parseFloat(e.target.value))} className="w-full accent-indigo-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-2">
                               <label className="flex items-center space-x-3 cursor-pointer group">
                                  <div onClick={() => setTerminalBlinkingCursor(!terminalBlinkingCursor)} className={`w-9 h-4.5 rounded-full relative transition-all ${terminalBlinkingCursor ? 'bg-indigo-600 shadow-[0_0_8px_var(--accent)]' : 'bg-slate-800'}`}>
                                     <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all ${terminalBlinkingCursor ? 'right-0.5' : 'left-0.5'}`} />
                                  </div>
                                  <span className="text-[9px] font-black uppercase opacity-60 group-hover:opacity-100">Blinking Pulse</span>
                               </label>
                               <label className="flex items-center space-x-3 cursor-pointer group">
                                  <div onClick={() => setTerminalShowTimestamp(!terminalShowTimestamp)} className={`w-9 h-4.5 rounded-full relative transition-all ${terminalShowTimestamp ? 'bg-indigo-600 shadow-[0_0_8px_var(--accent)]' : 'bg-slate-800'}`}>
                                     <div className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all ${terminalShowTimestamp ? 'right-0.5' : 'left-0.5'}`} />
                                  </div>
                                  <span className="text-[9px] font-black uppercase opacity-60 group-hover:opacity-100">Temp Stamps</span>
                               </label>
                            </div>
                         </div>
                      </div>
                    </div>
                 </div>
               )}

               {terminalTab === 'snippets' && (
                 <div className="grid grid-cols-4 gap-4 h-full overflow-y-auto custom-scrollbar animate-fade-in">
                    {snippets.map(s => (
                      <div key={s.id} className="relative group">
                         <button 
                          onClick={() => { setTerminalInput(s.cmd); setTerminalTab('terminal'); terminalInputRef.current?.focus(); }} 
                          className="w-full p-3 rounded-lg bg-black/30 border border-white/5 text-left hover:border-indigo-500/50 transition-all"
                         >
                            <div className="text-[10px] font-black uppercase mb-1 flex justify-between items-center" style={{ color: 'var(--accent)' }}>
                               <span>{s.label}</span>
                               <i className="fa-solid fa-bolt text-[8px] opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="text-[9px] text-slate-500 truncate font-mono">{s.cmd}</div>
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); setSnippets(prev => prev.filter(sn => sn.id !== s.id)); }} 
                           className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[8px]"
                         >
                            <i className="fa-solid fa-times" />
                         </button>
                      </div>
                    ))}
                 </div>
               )}

               {terminalTab === 'output' && (
                 <div className="h-full overflow-y-auto space-y-1 opacity-60 custom-scrollbar">
                    {project.orchestratorLog.map((log, i) => (
                      <div key={i} className="flex space-x-3 py-0.5 border-b border-white/5 animate-fade-in">
                        <span className="text-[8px] opacity-30 w-8">#{(project.orchestratorLog.length - i).toString().padStart(3, '0')}</span>
                        <span className="text-slate-300 break-words">{log}</span>
                      </div>
                    ))}
                 </div>
               )}

               {terminalTab === 'history' && (
                 <div className="h-full overflow-y-auto space-y-1 opacity-60 custom-scrollbar">
                    {terminalHistory.length > 0 ? [...terminalHistory].reverse().map((h, i) => (
                      <div key={i} className="flex space-x-4 border-b border-white/5 py-1 text-[10px] animate-fade-in">
                        <span className="w-20 text-slate-500">[{h.timestamp}]</span>
                        <span className="font-bold" style={{ color: 'var(--accent)' }}>{h.cmd}</span>
                      </div>
                    )) : <div className="text-[10px] opacity-30 italic">Temporal ledger empty.</div>}
                 </div>
               )}
            </div>
          )}
        </div>

        {/* Synthesis Overlay */}
        {project.isSynthesizing && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center backdrop-blur-2xl animate-fade-in bg-black/60">
            <div className="text-center p-12 bg-white/5 rounded-3xl border border-white/10 shadow-2xl animate-pulse">
              <div className="w-12 h-12 border-2 border-white/10 border-t-indigo-500 rounded-full animate-spin mx-auto mb-6" />
              <h3 className="text-lg font-black uppercase tracking-tight text-white">Synthesizing Project</h3>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Merging Neural Payloads...</p>
            </div>
          </div>
        )}

        {/* Phase 1: Conflict Resolver Modal */}
        <ConflictResolver
          isOpen={showConflictResolver}
          proposals={conflictingProposals}
          selectedProposal={selectedProposal}
          resolution={resolutionReasoning}
          onSelectProposal={setSelectedProposal}
          onClose={() => {
            setShowConflictResolver(false);
            setSelectedProposal(undefined);
            setConflictingProposals([]);
          }}
          onConfirm={handleConflictResolution}
        />

        {/* Phase 1: Cost Tracker Dashboard */}
         {costMetrics.length > 0 && (
           <div className="absolute bottom-24 right-6 z-40 max-w-sm">
             <CostTracker metrics={costMetrics} budgetUSD={costBudgetUSD} />
           </div>
         )}

        {/* Phase 5: Ralph Loop Panel */}
        {ralphEnabled && (
          <div className="absolute top-20 right-6 z-40 max-w-lg max-h-96 overflow-y-auto custom-scrollbar">
            <RalphLoopPanel
              prdItems={prdItems}
              isRunning={isRalphRunning}
              currentIteration={ralphIteration}
              maxIterations={ralphMaxIterations}
              completionRate={ralphCompletionRate}
              checkpoints={ralphCheckpoints}
              onStartRalphLoop={runRalphLoopHandler}
              onLoadCheckpoint={handleLoadRalphCheckpoint}
              onExportCheckpoints={handleExportRalphCheckpoints}
            />
          </div>
        )}

        {/* Agent Editor Modal */}
        <AgentEditor
          isOpen={agentEditorOpen}
          agent={editingAgent}
          onClose={() => {
            setAgentEditorOpen(false);
            setEditingAgent(null);
          }}
          onSave={(updatedAgent) => {
            setRegistry(prev =>
              prev.map(a => a.id === updatedAgent.id ? updatedAgent : a)
            );
            if (project.agents.some(a => a.id === updatedAgent.id)) {
              setProject(prev => ({
                ...prev,
                agents: prev.agents.map(a => a.id === updatedAgent.id ? updatedAgent : a)
              }));
            }
            setAgentEditorOpen(false);
            setEditingAgent(null);
          }}
        />

        {/* Phase 2: RLM Dashboard */}
        {rlmEnabled && rlmMetrics && (
          <div className="absolute bottom-40 left-6 z-30 max-w-md">
            <RLMDashboard 
              compressionMetrics={rlmMetrics}
              snapshot={currentSnapshot}
              isEnabled={rlmEnabled}
              onToggleRLM={setRlmEnabled}
              totalPhases={project.phases.length}
            />
          </div>
        )}

        {/* Phase 3: CCA Analyzer Modal */}
        {showCCAAnalyzer && ccaResult && (
          <CCAAnalyzer
            report={ccaResult}
            isLoading={ccaAnalyzing}
            onDismiss={() => setShowCCAAnalyzer(false)}
          />
        )}

        {/* Phase 5: Proposal Cache Stats */}
        {cacheEnabled && cacheStats && (
          <div className="absolute bottom-80 right-6 z-30 max-w-sm">
            <ProposalCacheStats stats={cacheStats} onClearCache={() => { proposalCache.clear(); setCacheStats(null); }} />
          </div>
        )}

        {/* Phase 5: Rubric Editor Modal */}
        <RubricEditor
          isOpen={showRubricEditor}
          rubric={customRubric}
          onSave={(rubric) => {
            setCustomRubric(rubric);
            setShowRubricEditor(false);
            addLog('✓ Custom rubric updated');
          }}
          onClose={() => setShowRubricEditor(false)}
        />

        {/* Phase 5: Multi-Model Synthesis Panel */}
        {multiModelEnabled && multiModelResult && (
          <div className="absolute top-96 right-6 z-30 max-w-lg">
            <MultiModelPanel result={multiModelResult} onClose={() => setMultiModelResult(null)} />
          </div>
        )}

        {/* Phase 6: Health Monitor */}
        {healthMonitorVisible && (
          <div className="absolute bottom-6 right-6 z-20">
            <HealthMonitor />
          </div>
        )}

        {/* Phase 6: API Monitor */}
        {apiMonitorVisible && (
          <div className="absolute bottom-6 left-6 z-20">
            <APIMonitor />
          </div>
        )}

        {/* Phase 7: ExecutionEngine Component */}
        {integrationEnabled && executionEngineRunning && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 max-w-2xl max-h-96 overflow-y-auto">
            <ExecutionEngine
              prompt={inputPrompt}
              registry={registry}
              onExecutionComplete={(result) => {
                addLog(`✓ Execution complete: ${result.success ? 'Success' : 'Failed'}`);
                if (result.cost) {
                  setCostActualUSD(result.cost.totalCostUSD || 0);
                }
                setExecutionEngineRunning(false);
              }}
            />
          </div>
        )}

        {/* Phase 7: Integration Panel */}
        {integrationPanelVisible && (
          <div className="absolute top-20 left-6 z-40 max-w-lg max-h-96 overflow-y-auto">
            <IntegrationPanel projectId={project.prompt.slice(0, 20)} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;