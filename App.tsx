import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ProjectState, Agent, AgentStatus, OrchestrationResponse, Message, ProtocolMessage, Phase, FileEntry, TeamMode, TerminalTab, FileVersion, AgentTask, AIProvider, IntelligenceConfig } from './types';
import { orchestrateTeam, performAgentTask, synthesizeProject, speakText } from './services/geminiService';
import { HUB_REGISTRY } from './constants';
import AgentLiveFeed from './components/AgentLiveFeed';
import AgentList from './components/AgentList';
import AgentHub from './components/AgentHub';
import IDE from './components/IDE';
import Templates from './components/Templates';
import MissionSettings from './components/MissionSettings';

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
  const [snippets, setSnippets] = useState<any[]>(() => {
    const saved = localStorage.getItem('vibe_snippets');
    return saved ? JSON.parse(saved) : [
      { id: '1', label: 'Sync Cluster', cmd: 'protocol --sync --full' },
      { id: '2', label: 'Audit Manifest', cmd: 'fleet audit --deep' },
      { id: '3', label: 'Recursive Clear', cmd: 'clear' },
      { id: '4', label: 'System Help', cmd: 'help' }
    ];
  });

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

  const runExecutionLoop = async (initialAgents: Agent[], phases: Phase[]) => {
    if (isSpeechEnabled) speakText("Strategic recruitment complete. Commencing mission execution loops.");
    
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

          const taskResult = await performAgentTask(agent, contextSnapshot, previousOutputs, project.enableMediaAssets);
          
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

      const synthesis = await synthesizeProject(
        project.prompt, 
        project.type, 
        finalAgents, 
        project.synthesisConfig
      );

      setProject(p => ({ 
        ...p, 
        files: synthesis.files, 
        isSynthesizing: false, 
        orchestratorLog: ["Mission Success: Global manifest generated.", ...p.orchestratorLog] 
      }));

      if (isSpeechEnabled) speakText("Global synthesis complete. Project manifest ready for review in IDE.");
      setActiveTab('ide');

    } catch (e) {
      setProject(p => ({ ...p, isSynthesizing: false }));
      addLog("CRITICAL: Global synthesis pipeline failed.");
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
              <div className="h-full flex flex-col p-6 animate-fade-in overflow-y-auto no-scrollbar pb-32 relative">
                {/* Header */}
                <div className="mb-8 shrink-0">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg" style={{ backgroundColor: 'var(--accent)' }}><i className="fa-solid fa-chess-board text-white text-sm"></i></div>
                    <div>
                      <h1 className="text-2xl font-black uppercase tracking-tight" style={{ color: 'var(--text-bold)' }}>Mission Control</h1>
                      <p className="text-[9px] uppercase font-black text-indigo-400 tracking-[0.15em]">Strategic Cluster Orchestrator</p>
                    </div>
                  </div>
                </div>

                {/* Main Grid Layout */}
                <div className="grid grid-cols-12 gap-6 flex-1">
                  {/* Left Column - Strategy & Intensity */}
                  <div className="col-span-3 space-y-4">
                    <div className="p-5 rounded-xl border bg-gradient-to-br from-indigo-600/10 to-transparent shadow-lg" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center space-x-2 mb-4">
                        <i className="fa-solid fa-chess text-indigo-400"></i>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Strategy</h3>
                      </div>
                      <div className="space-y-2">
                        {STRATEGY_PRESETS.map(p => (
                          <button key={p.id} onClick={() => setStrategy(p.id)} className={`w-full p-2.5 rounded-lg border text-left transition-all ${strategy === p.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-black/20 border-white/5 hover:border-white/10'}`}>
                            <div className="flex items-center space-x-2">
                              <i className={`fa-solid fa-${p.icon} text-[9px]`} />
                              <div className="overflow-hidden flex-1">
                                <div className="text-[9px] font-bold uppercase">{p.label}</div>
                                <div className="text-[7px] opacity-60">{p.desc}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-5 rounded-xl border bg-gradient-to-br from-orange-600/10 to-transparent shadow-lg" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center space-x-2 mb-4">
                        <i className="fa-solid fa-fire text-orange-400"></i>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Fleet Intensity</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between text-[8px]">
                          <span className="opacity-60">Level 1</span>
                          <span className="font-bold text-indigo-400">{intensity}/3</span>
                          <span className="opacity-60">Level 3</span>
                        </div>
                        <input type="range" min="1" max="3" step="1" value={intensity} onChange={e => setIntensity(parseInt(e.target.value))} className="w-full accent-orange-500" />
                        <p className="text-[7px] text-slate-400 italic">Controls parallel agent deployment and computational resources.</p>
                      </div>
                    </div>
                  </div>

                  {/* Center Column - Prompt Input */}
                  <div className="col-span-6">
                    <div className="relative h-full flex flex-col rounded-2xl border overflow-hidden bg-black/40 shadow-2xl" style={{ borderColor: 'var(--border)' }}>
                      <textarea value={inputPrompt} onChange={e => setInputPrompt(e.target.value)} placeholder="📋 Define your complex technical mission here..." className="flex-1 bg-transparent p-6 text-[13px] outline-none resize-none leading-relaxed" style={{ color: 'var(--text-bold)' }} />
                      <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between">
                        <button onClick={() => setProject(p => ({ ...p, enableMediaAssets: !p.enableMediaAssets }))} className={`px-3 py-1.5 rounded-lg border text-[8px] font-black uppercase transition-all flex items-center ${project.enableMediaAssets ? 'bg-pink-600/10 border-pink-500 text-pink-400 shadow-lg shadow-pink-500/10' : 'bg-white/5 border-white/5 opacity-40 hover:opacity-100'}`}>
                          <i className={`fa-solid ${project.enableMediaAssets ? 'fa-wand-magic-sparkles' : 'fa-image'} mr-2`} />
                          {project.enableMediaAssets ? 'Assets' : 'Assets'}
                        </button>
                        <button onClick={startOrchestration} disabled={project.isOrchestrating || !inputPrompt.trim()} className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-black px-6 py-2 rounded-lg shadow-xl transition-all active:scale-95 uppercase tracking-widest text-[9px] disabled:opacity-30 border-b-2 border-black/20 flex items-center space-x-2">
                          <span>Engage Fleet</span>
                          <i className="fa-solid fa-bolt-lightning" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Team Mode & Presets */}
                  <div className="col-span-3 space-y-4">
                    <div className="p-5 rounded-xl border bg-gradient-to-br from-purple-600/10 to-transparent shadow-lg" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center space-x-2 mb-4">
                        <i className="fa-solid fa-layer-group text-purple-400"></i>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Team Mode</h3>
                      </div>
                      <div className="flex gap-2">
                        {['ai', 'manual'].map(m => (
                          <button key={m} onClick={() => setProject(p => ({ ...p, teamMode: m as TeamMode }))} className={`flex-1 px-3 py-2 rounded-lg border text-[8px] font-black uppercase transition-all ${project.teamMode === m ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-black/20 border-white/5'}`}>
                            {m === 'ai' ? 'Autonomous' : 'Architected'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-5 rounded-xl border bg-gradient-to-br from-pink-600/10 to-transparent shadow-lg" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center space-x-2 mb-4">
                        <i className="fa-solid fa-rocket text-pink-400"></i>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Deployment</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {PLATFORMS.map(p => (
                          <button key={p.id} onClick={() => setTargetPlatform(p.id)} className={`p-2 rounded-lg border flex flex-col items-center space-y-1 transition-all text-[7px] font-black uppercase ${targetPlatform === p.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-black/20 border-white/5 opacity-50 hover:opacity-100'}`}>
                            <i className={`fa-solid fa-${p.icon}`} />
                            <span className="text-[6px] leading-tight text-center">{p.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Manual Team Selection */}
                {project.teamMode === 'manual' && (
                  <div className="mt-6 p-5 rounded-xl border bg-black/20 shadow-lg" style={{ borderColor: 'var(--border)' }}>
                     <div className="flex items-center space-x-2 mb-4">
                       <i className="fa-solid fa-tower-broadcast text-cyan-400"></i>
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Target Nodes</h3>
                     </div>
                     <div className="overflow-y-auto custom-scrollbar space-y-1 pr-1 max-h-48">{Object.entries(groupedRegistry).map(([cat, agents]) => (
                       <div key={cat} className="space-y-1"><button onClick={() => setExpandedSectors(p => p.includes(cat) ? p.filter(s => s !== cat) : [...p, cat])} className="w-full flex items-center justify-between p-2 text-[9px] font-black uppercase text-indigo-400/80 hover:bg-white/5 rounded-md"><span>{cat}</span><i className={`fa-solid fa-chevron-down text-[7px] transition-transform ${expandedSectors.includes(cat) ? '' : '-rotate-90'}`}></i></button>
                       {expandedSectors.includes(cat) && agents.map(a => (<button key={a.id} onClick={() => setSelectedIds(p => p.includes(a.id) ? p.filter(i => i !== a.id) : [...p, a.id])} className={`w-full p-2 rounded-md border text-left flex items-center justify-between transition-all text-[8px] ${selectedIds.includes(a.id) ? 'bg-indigo-600 border-indigo-400 text-white shadow-md' : 'bg-black/20 border-white/5 text-slate-400'}`}><span className="font-bold uppercase truncate">{a.name}</span>{selectedIds.includes(a.id) && <i className="fa-solid fa-check text-[8px]" />}</button>))}</div>
                     ))}</div>
                  </div>
               )}

               {/* Floating Mission Settings Panel */}
               <MissionSettings
                 strategy={strategy}
                 intensity={intensity}
                 targetPlatform={targetPlatform}
                 logicHubApiKey={logicHubApiKey}
                 logicHubModel={logicHubModel}
                 synthesisApiKey={synthesisApiKey}
                 synthesisModel={synthesisModel}
                 onStrategyChange={setStrategy}
                 onIntensityChange={setIntensity}
                 onTargetPlatformChange={setTargetPlatform}
                 onLogicHubKeyChange={setLogicHubApiKey}
                 onLogicHubModelChange={setLogicHubModel}
                 onSynthesisKeyChange={setSynthesisApiKey}
                 onSynthesisModelChange={setSynthesisModel}
               />
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
                ) : <AgentList agents={project.agents} phases={project.phases} onSelectAgent={handleSelectAgent} activeAgentId={selectedAgentId} />}
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
                 <div className="h-full overflow-y-auto space-y-8 p-2 animate-fade-in custom-scrollbar">
                    <div className="grid grid-cols-2 gap-10">
                       <div className="space-y-6">
                          <div className="space-y-2">
                             <div className="flex justify-between text-[9px] uppercase font-black opacity-50"><span>Terminal Theme Engine</span><span className="uppercase font-bold" style={{ color: 'var(--accent)' }}>{activeTheme}</span></div>
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
      </main>
    </div>
  );
};

export default App;