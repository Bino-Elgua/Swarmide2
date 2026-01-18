import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Agent, AgentTool, AgentStatus, ToolConfigs, ElevenLabsConfig, IntelligenceConfig, AIProvider, AgentTask, KnowledgeAsset, AgentArchetype } from '../types';
// @ts-ignore
import JSZip from 'jszip';

interface AgentHubProps {
  registry: Agent[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onUpdateRegistry: (agents: Agent[]) => void;
  onAddCustom: (agent: Agent) => void;
}

type CreatorSection = 'general' | 'intelligence' | 'personality' | 'tools' | 'tasks' | 'knowledge' | 'identity';

const CATEGORIES = [
  { id: 'engineering', label: 'Engineering', icon: 'microchip' },
  { id: 'discovery', label: 'Discovery', icon: 'microscope' },
  { id: 'creative', label: 'Creative', icon: 'pen-fancy' },
  { id: 'tactical', label: 'Tactical', icon: 'chess-knight' },
  { id: 'imaging', label: 'Imaging Labs', icon: 'camera' },
  { id: 'motion', label: 'Motion Studios', icon: 'clapperboard' },
  { id: 'security', label: 'Security', icon: 'shield-halved' },
  { id: 'ethics', label: 'Ethics', icon: 'gavel' },
  { id: 'custom', label: 'User Custom', icon: 'user-gear' }
];

const TOOL_LABELS: Record<AgentTool, { label: string; icon: string; description: string }> = {
  webSearch: { label: 'Web Nexus', icon: 'earth-americas', description: 'Real-time indexing and search grounding.' },
  codeInterpreter: { label: 'Logic Kernel', icon: 'code-branch', description: 'Python/JS sandbox for complex logic.' },
  vision: { label: 'Optic Core', icon: 'eye', description: 'Image analysis, OCR, and spatial intelligence.' },
  logicEngine: { label: 'Reasoning Path', icon: 'brain', description: 'Chain-of-thought and logical verification.' },
  fileSystem: { label: 'FS Gateway', icon: 'folder-open', description: 'Persistent file access and gen-access.' },
  mcp: { label: 'MCP Bridge', icon: 'link', description: 'Model Context Protocol for external clusters.' },
  webhook: { label: 'Event Relay', icon: 'paper-plane', description: 'Trigger hooks based on task milestones.' },
  restApi: { label: 'API Terminal', icon: 'cloud', description: 'Direct interface with third-party JSON APIs.' },
  mediaSynth: { label: 'Media Synth', icon: 'wand-magic-sparkles', description: 'Image and video generation engine.' },
  databaseQuery: { label: 'Neural DB', icon: 'database', description: 'Query layer for SQL and Vector storage.' },
  knowledgeBase: { label: 'Library RAG', icon: 'book-atlas', description: 'Retrieval Augmented Generation over docs.' }
};

const ARCHETYPE_OPTIONS: { id: AgentArchetype; label: string; desc: string }[] = [
  { id: 'expert', label: 'Technical Expert', desc: 'Precision-first, zero-fluff engineering.' },
  { id: 'assistant', label: 'Helpful Assistant', desc: 'Proactive and supportive workflow.' },
  { id: 'rebel', label: 'Creative Rebel', desc: 'Challenges norms, prioritizes disruption.' },
  { id: 'critic', label: 'Rigor Critic', desc: 'Identifies flaws, audits logic gates.' },
  { id: 'philosopher', label: 'Recursive Sage', desc: 'Deep contextual reasoning loops.' }
];

const ICON_GROUPS = {
  Technical: ['microchip', 'server', 'terminal', 'code', 'database', 'key', 'gear', 'bolt', 'bug', 'dna', 'microscope'],
  Creative: ['palette', 'wand-magic-sparkles', 'clapperboard', 'pen-fancy', 'music', 'camera', 'brain', 'feather', 'icons', 'shapes'],
  Strategic: ['chess-knight', 'shield-halved', 'map', 'gavel', 'bullhorn', 'scroll', 'landmark', 'users-viewfinder', 'globe', 'compass']
};

const COLOR_SPECTRUM = [ '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef' ];

const MODEL_MAP = {
  llm: ['gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-flash-lite-latest'],
  image: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'],
  video: ['veo-3.1-fast-generate-preview', 'veo-3.1-generate-preview']
};

const AgentHub: React.FC<AgentHubProps> = ({ registry, selectedIds, onToggleSelect, onUpdateRegistry, onAddCustom }) => {
  const [activeCategory, setActiveCategory] = useState<string>('engineering');
  const [stackIndex, setStackIndex] = useState(0);
  const [showCreator, setShowCreator] = useState(false);
  const [activeSection, setActiveSection] = useState<CreatorSection>('general');
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false, initialX: 0, initialY: 0 });
  const [swipingOut, setSwipingOut] = useState<{ dir: 'left' | 'right' | null }>({ dir: null });

  const [expandedTool, setExpandedTool] = useState<AgentTool | null>(null);
  const [viewingAsset, setViewingAsset] = useState<KnowledgeAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formAgent, setFormAgent] = useState<Partial<Agent>>({
    name: '', role: '', description: '', mantra: '', category: 'custom', archetype: 'expert', personality: 'Professional AI Node.',
    humorLevel: 0.2, empathyLevel: 0.5, formalismLevel: 0.8, slangLevel: 0.1, jargonLevel: 0.7, directnessLevel: 0.9, emojiUsage: false, temperingLevel: 0.5,
    color: '#6366f1', secondaryColor: '#4f46e5', icon: 'robot', voiceName: 'Zephyr', voiceSpeed: 1.0, voicePitch: 1.0,
    enabledTools: [], toolConfigs: {}, temperature: 0.7, toolConfidence: 0.8, verbosity: 0.5, riskAversion: 0.5,
    intelligenceConfig: { provider: 'google', model: 'gemini-3-flash-preview', imageModel: 'gemini-2.5-flash-image', videoModel: 'veo-3.1-fast-generate-preview', maxTokens: 2048, topP: 0.95 },
    tasks: [{ id: 't1', label: 'Analyze project requirements' }], mediaAssets: [], knowledgeAssets: [], activatedKnowledgeIds: [], isDefault: false
  });

  const filteredAgents = useMemo(() => {
    let pool = registry.filter(a => activeCategory === 'custom' ? (!a.isDefault || a.category === 'custom') : a.category === activeCategory);
    return pool.filter(a => !selectedIds.includes(a.id));
  }, [registry, activeCategory, selectedIds]);

  useEffect(() => { setStackIndex(0); }, [activeCategory]);

  const capabilityScore = useMemo(() => {
    let score = 0; if (formAgent.name) score += 10; if (formAgent.role) score += 10; if (formAgent.enabledTools?.length) score += 30; if (formAgent.tasks?.length) score += 20; if (formAgent.knowledgeAssets?.length) score += 10; if (formAgent.humorLevel !== undefined) score += 20;
    return Math.min(100, score);
  }, [formAgent]);

  const handleSwipe = (dir: 'left' | 'right') => {
    if (filteredAgents.length === 0) return;
    const currentAgent = filteredAgents[stackIndex];
    if (dir === 'right' && currentAgent) {
      onToggleSelect(currentAgent.id);
    }
    setSwipingOut({ dir });
    setTimeout(() => {
      setStackIndex(prev => (prev + 1) % filteredAgents.length);
      setSwipingOut({ dir: null });
      setDrag({ x: 0, y: 0, active: false, initialX: 0, initialY: 0 });
    }, 300);
  };

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (filteredAgents.length === 0) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setDrag({ x: 0, y: 0, active: true, initialX: clientX, initialY: clientY });
  };
  
  const onDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drag.active) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setDrag(prev => ({ ...prev, x: clientX - prev.initialX, y: clientY - prev.initialY }));
  };
  
  const onDragEnd = () => {
    if (!drag.active) return;
    if (drag.x > 100) handleSwipe('right'); 
    else if (drag.x < -100) handleSwipe('left'); 
    else setDrag({ x: 0, y: 0, active: false, initialX: 0, initialY: 0 });
  };

  const handleOpenCreator = (agent?: Agent) => {
    if (agent) { setFormAgent({ ...agent }); setEditingAgentId(agent.id); } 
    else { 
      setFormAgent({ 
        name: '', role: '', description: '', mantra: '', category: 'custom', archetype: 'expert', personality: 'Professional AI Node.',
        humorLevel: 0.2, empathyLevel: 0.5, formalismLevel: 0.8, slangLevel: 0.1, jargonLevel: 0.7, directnessLevel: 0.9, emojiUsage: false, temperingLevel: 0.5,
        color: '#6366f1', secondaryColor: '#4f46e5', icon: 'robot', voiceName: 'Zephyr', voiceSpeed: 1.0, voicePitch: 1.0,
        enabledTools: [], toolConfigs: {}, temperature: 0.7, toolConfidence: 0.8, verbosity: 0.5, riskAversion: 0.5,
        intelligenceConfig: { provider: 'google', model: 'gemini-3-flash-preview', imageModel: 'gemini-2.5-flash-image', videoModel: 'veo-3.1-fast-generate-preview', maxTokens: 2048, topP: 0.95 },
        tasks: [{ id: 't1', label: 'Analyze project requirements' }], mediaAssets: [], knowledgeAssets: [], activatedKnowledgeIds: [], isDefault: false
      }); 
      setEditingAgentId(null); 
    }
    setActiveSection('general'); setShowCreator(true);
  };

  const handleSaveAgent = () => {
    if (!formAgent.name || !formAgent.role) return;
    if (editingAgentId) { onUpdateRegistry(registry.map(a => a.id === editingAgentId ? { ...a, ...formAgent } as Agent : a)); } 
    else { onAddCustom({ ...formAgent as Agent, id: `custom-${Date.now()}`, status: AgentStatus.IDLE, thoughtLog: [], mediaAssets: [], phase: 0 }); }
    setShowCreator(false);
  };

  const updateToolConfig = (tool: AgentTool, config: any) => {
    setFormAgent(prev => ({ ...prev, toolConfigs: { ...prev.toolConfigs, [tool]: { ...(prev.toolConfigs as any)?.[tool], ...config } } }));
  };

  const toggleToolKnowledge = (tool: AgentTool, knowledgeId: string) => {
    const currentConfig = (formAgent.toolConfigs as any)?.[tool] || {};
    const currentIds = currentConfig.knowledgeAssetIds || [];
    const newIds = currentIds.includes(knowledgeId) ? currentIds.filter((id: string) => id !== knowledgeId) : [...currentIds, knowledgeId];
    updateToolConfig(tool, { knowledgeAssetIds: newIds });
  };

  const addTask = () => {
    const label = prompt("Task Label:");
    if (label) {
      setFormAgent(p => ({ ...p, tasks: [...(p.tasks || []), { id: `task-${Date.now()}`, label }] }));
    }
  };

  const removeTask = (id: string) => {
    setFormAgent(p => ({ ...p, tasks: p.tasks?.filter(t => t.id !== id) }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setIsUploading(true);
    const newAssets: KnowledgeAsset[] = [];

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      if (file.name.toLowerCase().endsWith('.zip')) {
        try {
          const zip = await JSZip.loadAsync(file);
          const entries = Object.entries(zip.files);
          for (const [path, zipEntry] of entries) {
            const entry = zipEntry as any;
            if (!entry.dir) {
              const content = await entry.async('string');
              newAssets.push({
                id: `asset-${Math.random().toString(36).substr(2, 9)}`,
                name: path.split('/').pop() || path,
                type: path.split('.').pop()?.toUpperCase() || 'UNKNOWN',
                size: content.length,
                content: btoa(unescape(encodeURIComponent(content))),
                lastModified: Date.now()
              });
            }
          }
        } catch (err) {
          console.error("ZIP unarchive error:", err);
        }
      } else {
        try {
          const text = await file.text();
          newAssets.push({
            id: `asset-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            type: file.name.split('.').pop()?.toUpperCase() || 'UNKNOWN',
            size: file.size,
            content: btoa(unescape(encodeURIComponent(text))),
            lastModified: file.lastModified
          });
        } catch (err) {
          console.error("File read error:", err);
          // Fallback for binary files if text() fails
          const reader = new FileReader();
          reader.onload = (event) => {
            const binary = event.target?.result;
            if (typeof binary === 'string') {
              // Note: base64 encoding handled differently here if needed, but btoa is fine for strings
              setFormAgent(p => ({
                ...p,
                knowledgeAssets: [...(p.knowledgeAssets || []), {
                  id: `asset-${Math.random().toString(36).substr(2, 9)}`,
                  name: file.name,
                  type: file.name.split('.').pop()?.toUpperCase() || 'UNKNOWN',
                  size: file.size,
                  content: btoa(binary),
                  lastModified: file.lastModified
                }]
              }));
            }
          };
          reader.readAsBinaryString(file);
        }
      }
    }

    setFormAgent(p => ({ ...p, knowledgeAssets: [...(p.knowledgeAssets || []), ...newAssets] }));
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeKnowledge = (id: string) => {
    setFormAgent(p => ({
      ...p,
      knowledgeAssets: p.knowledgeAssets?.filter(a => a.id !== id),
      toolConfigs: Object.entries(p.toolConfigs || {}).reduce((acc: any, [tool, cfg]) => {
        const anyCfg = cfg as any;
        if (anyCfg && anyCfg.knowledgeAssetIds) {
          acc[tool as AgentTool] = { ...anyCfg, knowledgeAssetIds: anyCfg.knowledgeAssetIds.filter((aid: string) => aid !== id) };
        } else {
          acc[tool as AgentTool] = cfg;
        }
        return acc;
      }, {} as any)
    }));
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-6 animate-fade-in overflow-y-auto no-scrollbar relative">
      {viewingAsset && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-6">
           <div className="w-full max-w-4xl h-full flex flex-col bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#161b22]">
                 <div className="flex items-center space-x-3"><div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400"><i className="fa-solid fa-file-shield text-xs" /></div><span className="text-[11px] font-black uppercase text-white">{viewingAsset.name}</span></div>
                 <button onClick={() => setViewingAsset(null)} className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"><i className="fa-solid fa-times" /></button>
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar p-6 font-mono text-[11px] leading-relaxed text-slate-300 bg-black/40 select-text">
                 {(() => { try { return decodeURIComponent(escape(atob(viewingAsset.content))) || "[NULL DATA STREAM]"; } catch (e) { return `[BINARY DATA]: ${viewingAsset.content.substring(0, 5000)}...`; } })()}
              </div>
           </div>
        </div>
      )}

      <div className="flex items-end justify-between shrink-0">
        <div className="space-y-1">
          <h1 className="text-xl font-black text-white uppercase tracking-tighter">Node Pool</h1>
          <p className="text-[11px] font-medium opacity-50 italic">"Swipe nodes into active recruitment queue."</p>
        </div>
        <button onClick={() => { setActiveCategory('custom'); handleOpenCreator(); }} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[9px] uppercase tracking-widest rounded-xl shadow-lg active:scale-95 flex items-center space-x-3">
          <i className="fa-solid fa-plus text-[10px]"></i>
          <span>Forge Specialist</span>
        </button>
      </div>

      <div className="flex space-x-2 shrink-0 overflow-x-auto pb-2 no-scrollbar relative z-10">
        {CATEGORIES.map(cat => (<button key={cat.id} onClick={() => { setActiveCategory(cat.id); setStackIndex(0); }} className={`flex items-center space-x-2 px-4 py-2 rounded-xl border transition-all shrink-0 ${activeCategory === cat.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-md' : 'bg-black/20 border-white/5 opacity-40 hover:opacity-100'}`} style={activeCategory === cat.id ? { backgroundColor: 'var(--accent)', color: 'white' } : { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-dim)' }}>
          <i className={`fa-solid fa-${cat.icon} text-[10px]`} />
          <span className="text-[9px] font-black uppercase tracking-widest">{cat.label}</span>
        </button>))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative min-h-[450px] pb-20">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
           <i className={`fa-solid fa-${CATEGORIES.find(s => s.id === activeCategory)?.icon || 'users'} text-[20rem]`} />
        </div>

        {filteredAgents.length === 0 ? (
          <div className="p-12 text-center bg-white/5 border border-dashed border-white/10 rounded-3xl opacity-20">
            <i className="fa-solid fa-users-slash text-4xl mb-4"></i>
            <p className="text-sm font-black uppercase tracking-widest">Sector Empty</p>
          </div>
        ) : (
          <div className="relative w-full max-w-sm h-[400px] flex items-center justify-center touch-none select-none" 
               onMouseDown={onDragStart} onMouseMove={onDragMove} onMouseUp={onDragEnd} onMouseLeave={onDragEnd} 
               onTouchStart={onDragStart} onTouchMove={onDragMove} onTouchEnd={onDragEnd}>
            {filteredAgents.map((agent, idx) => {
              const diff = (idx - stackIndex + filteredAgents.length) % filteredAgents.length;
              if (diff > 3) return null;
              const isTop = diff === 0;
              const scale = 1 - (diff * 0.05);
              const dragRotate = isTop ? (drag.x / 20) : 0;
              const dragTranslateX = isTop ? drag.x : 0;
              const isSwipingOut = swipingOut.dir !== null && isTop;
              const finalTranslateX = isSwipingOut ? (swipingOut.dir === 'right' ? 1000 : -1000) : dragTranslateX;

              const archetype = ARCHETYPE_OPTIONS.find(a => a.id === agent.archetype) || ARCHETYPE_OPTIONS[0];

              return (
                <div key={agent.id} className={`absolute inset-0 p-6 rounded-3xl border flex flex-col h-[420px] overflow-hidden transition-all shadow-2xl ${isTop ? 'cursor-grab active:cursor-grabbing border-indigo-500/20' : 'pointer-events-none'}`} 
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    borderColor: 'var(--border)', 
                    transform: `translate(${finalTranslateX}px, ${isTop ? drag.y : diff * -15}px) rotate(${isSwipingOut ? (swipingOut.dir === 'right' ? 45 : -45) : dragRotate}deg) scale(${isTop ? 1 : scale})`, 
                    zIndex: filteredAgents.length - diff,
                    opacity: isSwipingOut ? 0 : 1 - (diff * 0.2),
                    filter: `blur(${isTop ? 0 : diff * 2}px)`,
                    transition: drag.active ? 'none' : 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)'
                  }}>
                  
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-indigo-500/30 text-indigo-400 bg-indigo-500/5">
                      v{agent.id.split('-').pop()?.substring(0, 4) || '1.0'}
                    </span>
                    <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Linked</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-inner border relative overflow-hidden group" style={{ backgroundColor: `${agent.color}15`, color: agent.color, borderColor: `${agent.color}30` }}>
                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <i className={`fa-solid fa-${agent.icon} transition-transform group-hover:scale-110`}></i>
                    </div>
                    <div>
                      <h3 className="text-base font-black uppercase tracking-tight text-white mb-0.5">{agent.name}</h3>
                      <p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">{agent.role}</p>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4 overflow-hidden">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                         <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Cognitive Archetype</span>
                         <span className="text-[8px] font-black text-indigo-500 uppercase">{archetype.label}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed font-bold italic opacity-80 text-slate-300">"{agent.description}"</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 py-3 border-y border-white/5">
                       <div className="space-y-1">
                          <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Skill Manifest</span>
                          <div className="flex flex-wrap gap-1">
                            {agent.enabledTools.slice(0, 4).map(t => (
                              <div key={t} className="w-5 h-5 rounded-md bg-black/40 border border-white/5 flex items-center justify-center" title={TOOL_LABELS[t].label}>
                                <i className={`fa-solid fa-${TOOL_LABELS[t].icon} text-[8px] text-indigo-400`} />
                              </div>
                            ))}
                            {agent.enabledTools.length > 4 && <span className="text-[8px] font-black text-slate-600">+{agent.enabledTools.length - 4}</span>}
                          </div>
                       </div>
                       <div className="space-y-1 text-right">
                          <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Intelligence Parameters</span>
                          <div className="flex flex-col items-end space-y-0.5">
                             <div className="flex items-center space-x-1.5"><span className="text-[8px] font-bold text-slate-500 uppercase">Verbosity</span><div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${agent.verbosity * 100}%` }} /></div></div>
                             <div className="flex items-center space-x-1.5"><span className="text-[8px] font-bold text-slate-500 uppercase">Risk</span><div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${(1 - agent.riskAversion) * 100}%` }} /></div></div>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-2 bg-black/40 rounded-2xl p-4 border border-white/5 shadow-inner flex-1 overflow-y-auto no-scrollbar">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em]">Neural Directives</h4>
                        <i className="fa-solid fa-list-check text-[8px] text-slate-600" />
                      </div>
                      <div className="space-y-1.5">
                        {agent.tasks.map((t, i) => (
                          <div key={i} className="flex items-start space-x-2 text-[9px] text-slate-400 font-bold uppercase leading-tight group/task">
                            <span className="opacity-30 w-3">{i+1}.</span>
                            <span className="group-hover/task:text-slate-200 transition-colors">{t.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {isTop && (
                    <div className="mt-5 flex space-x-2 shrink-0 animate-fade-in">
                       <button onClick={() => handleSwipe('left')} className="flex-1 py-3 rounded-xl border border-white/5 bg-black/20 hover:bg-red-500/10 hover:border-red-500/30 text-slate-500 hover:text-red-400 transition-all font-black text-[9px] uppercase tracking-widest flex items-center justify-center space-x-2">
                         <i className="fa-solid fa-xmark text-[10px]" />
                         <span>Dismiss</span>
                       </button>
                       <button onClick={() => handleSwipe('right')} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all font-black text-[9px] uppercase tracking-widest flex items-center justify-center space-x-2">
                         <i className="fa-solid fa-plus text-[10px]" />
                         <span>Recruit</span>
                       </button>
                       <button onClick={() => handleOpenCreator(agent)} className="w-11 py-3 rounded-xl border border-white/5 bg-slate-800 text-slate-400 hover:text-white transition-all flex items-center justify-center">
                         <i className="fa-solid fa-wrench text-[10px]" />
                       </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreator && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6">
          <div className="w-full max-w-5xl bg-[#0d1117] rounded-2xl border border-slate-800 shadow-2xl flex flex-col h-[85vh] animate-scale-in overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#161b22]">
              <div className="flex items-center space-x-3"><div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><i className="fa-solid fa-brain" /></div><div><h2 className="text-sm font-black text-white uppercase">Architect Studio</h2><p className="text-[8px] text-slate-500 uppercase font-black">Calibrating Neural Identity</p></div></div>
              <button onClick={() => setShowCreator(false)} className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all"><i className="fa-solid fa-times" /></button>
            </div>
            <div className="flex-1 overflow-hidden flex">
              <div className="w-48 border-r border-slate-800 p-4 space-y-1.5 bg-[#0d1117] overflow-y-auto no-scrollbar shrink-0">
                {['general', 'identity', 'intelligence', 'personality', 'tools', 'tasks', 'knowledge'].map(s => (<button key={s} onClick={() => setActiveSection(s as any)} className={`w-full text-left px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeSection === s ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800/50'}`}>{s}</button>))}
              </div>
              <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-900/30">
                {activeSection === 'general' && (
                  <div className="space-y-10 animate-fade-in">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Node Name</label><input type="text" value={formAgent.name} onChange={e => setFormAgent(p => ({ ...p, name: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-[12px] text-white outline-none focus:ring-1 focus:ring-indigo-500" placeholder="e.g. CORE_ENGINEER" /></div>
                      <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Functional Role</label><input type="text" value={formAgent.role} onChange={e => setFormAgent(p => ({ ...p, role: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-[12px] text-white outline-none focus:ring-1 focus:ring-indigo-500" placeholder="e.g. Lead Dev" /></div>
                    </div>
                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Comprehensive Bio</label><textarea value={formAgent.description} onChange={e => setFormAgent(p => ({ ...p, description: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-[12px] text-white h-32 resize-none outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed" placeholder="Define the agent's core purpose and expertise..." /></div>
                    <div className="space-y-4">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Technical Archetype</label>
                       <div className="grid grid-cols-3 gap-3">
                         {ARCHETYPE_OPTIONS.map(opt => (<button key={opt.id} onClick={() => setFormAgent(p => ({ ...p, archetype: opt.id }))} className={`p-4 rounded-xl border text-left transition-all ${formAgent.archetype === opt.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl' : 'bg-slate-950 border-white/5 text-slate-500 hover:border-slate-700'}`}><div className="text-[10px] font-black uppercase mb-1">{opt.label}</div><div className="text-[8px] opacity-60 leading-tight">{opt.desc}</div></button>))}
                       </div>
                    </div>
                  </div>
                )}
                {activeSection === 'identity' && (
                  <div className="space-y-10 animate-fade-in">
                    <div className="grid grid-cols-2 gap-10">
                       <div className="space-y-4">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Symbolic Identity</label>
                          <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 max-h-48 overflow-y-auto custom-scrollbar">
                             {Object.entries(ICON_GROUPS).map(([group, icons]) => (
                               <div key={group} className="mb-4">
                                  <div className="text-[8px] font-black text-indigo-400 uppercase mb-2 px-1">{group}</div>
                                  <div className="grid grid-cols-5 gap-2">
                                     {icons.map(icon => (
                                       <button key={icon} onClick={() => setFormAgent(p => ({ ...p, icon }))} className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${formAgent.icon === icon ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-black/40 border-slate-800 text-slate-700 hover:text-slate-400'}`}><i className={`fa-solid fa-${icon} text-sm`} /></button>
                                     ))}
                                  </div>
                               </div>
                             ))}
                          </div>
                       </div>
                       <div className="space-y-4">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Chromatic Profile</label>
                          <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 grid grid-cols-4 gap-3">
                             {COLOR_SPECTRUM.map(c => (
                               <button key={c} onClick={() => setFormAgent(p => ({ ...p, color: c }))} className={`w-full h-8 rounded-lg border-2 transition-all ${formAgent.color === c ? 'border-white scale-105 shadow-lg' : 'border-transparent opacity-40 hover:opacity-100'}`} style={{ backgroundColor: c }} />
                             ))}
                          </div>
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                       <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Execution Mantra</label><input type="text" value={formAgent.mantra} onChange={e => setFormAgent(p => ({ ...p, mantra: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-[12px] text-white outline-none focus:ring-1 focus:ring-indigo-500" placeholder="e.g. Precision through recursion." /></div>
                       <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Primary Motivation</label><input type="text" value={formAgent.motivation} onChange={e => setFormAgent(p => ({ ...p, motivation: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-[12px] text-white outline-none focus:ring-1 focus:ring-indigo-500" placeholder="e.g. Scalable efficiency." /></div>
                    </div>
                  </div>
                )}
                {activeSection === 'intelligence' && (
                   <div className="space-y-10 animate-fade-in">
                      <div className="grid grid-cols-2 gap-8">
                         <div className="space-y-4">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Primary Logic Model</label>
                            <select value={formAgent.intelligenceConfig?.model} onChange={e => setFormAgent(p => ({ ...p, intelligenceConfig: { ...p.intelligenceConfig!, model: e.target.value } }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-[12px] text-white outline-none">
                               {MODEL_MAP.llm.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                         </div>
                         <div className="space-y-4">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Response Density (Max Tokens)</label>
                            <div className="flex items-center space-x-4">
                               <input type="range" min="512" max="8192" step="256" value={formAgent.intelligenceConfig?.maxTokens} onChange={e => setFormAgent(p => ({ ...p, intelligenceConfig: { ...p.intelligenceConfig!, maxTokens: parseInt(e.target.value) } }))} className="flex-1 accent-indigo-500" />
                               <span className="text-[12px] font-black text-indigo-400 w-12">{formAgent.intelligenceConfig?.maxTokens}</span>
                            </div>
                         </div>
                      </div>
                      <div className="p-6 rounded-2xl bg-black/40 border border-white/5 space-y-6">
                         <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Advanced Neural Configuration</h4>
                         <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                            <div className="flex items-center justify-between"><div className="space-y-0.5"><div className="text-[11px] font-black text-white">Recursive Refinement</div><div className="text-[8px] text-slate-500 uppercase">Self-critique loop active</div></div><button onClick={() => setFormAgent(p => ({ ...p, intelligenceConfig: { ...p.intelligenceConfig!, recursiveRefinement: !p.intelligenceConfig?.recursiveRefinement } }))} className={`w-10 h-5 rounded-full relative transition-all ${formAgent.intelligenceConfig?.recursiveRefinement ? 'bg-indigo-600 shadow-lg' : 'bg-slate-800'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formAgent.intelligenceConfig?.recursiveRefinement ? 'right-1' : 'left-1'}`} /></button></div>
                            <div className="flex items-center justify-between"><div className="space-y-0.5"><div className="text-[11px] font-black text-white">Deep Reasoning</div><div className="text-[8px] text-slate-500 uppercase">Exhaustive Chain-of-Thought</div></div><button onClick={() => setFormAgent(p => ({ ...p, intelligenceConfig: { ...p.intelligenceConfig!, reasoningDepth: p.intelligenceConfig?.reasoningDepth === 'deep' ? 'standard' : 'deep' } }))} className={`w-10 h-5 rounded-full relative transition-all ${formAgent.intelligenceConfig?.reasoningDepth === 'deep' ? 'bg-emerald-600 shadow-lg' : 'bg-slate-800'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${formAgent.intelligenceConfig?.reasoningDepth === 'deep' ? 'right-1' : 'left-1'}`} /></button></div>
                         </div>
                      </div>
                   </div>
                )}
                {activeSection === 'personality' && (
                  <div className="space-y-8 animate-fade-in">
                    <h3 className="text-xs font-black uppercase text-indigo-400 tracking-widest">Behavioral Matrix</h3>
                    <div className="grid grid-cols-2 gap-6">
                       {[{ label: 'Humor Level', f: 'humorLevel' }, { label: 'Empathy Quotient', f: 'empathyLevel' }, { label: 'Slang Usage', f: 'slangLevel' }, { label: 'Technical Jargon', f: 'jargonLevel' }, { label: 'Linguistic Directness', f: 'directnessLevel' }, { label: 'Tempering Ratio', f: 'temperingLevel' }, { label: 'Formalism', f: 'formalismLevel' }, { label: 'Creativity (Temp)', f: 'temperature' }].map(s => (
                         <div key={s.f} className="space-y-2 p-5 bg-black/20 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all">
                            <div className="flex justify-between text-[9px] font-black uppercase text-slate-500"><span>{s.label}</span><span className="text-indigo-400 font-mono">{(formAgent as any)[s.f]?.toFixed(1)}</span></div>
                            <input type="range" min="0" max="1" step="0.1" value={(formAgent as any)[s.f]} onChange={e => setFormAgent(p => ({ ...p, [s.f]: parseFloat(e.target.value) }))} className="w-full accent-indigo-500" />
                         </div>
                       ))}
                    </div>
                  </div>
                )}
                {activeSection === 'tools' && (
                   <div className="space-y-4 animate-fade-in">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Functional Toolsets</div>
                      <div className="grid grid-cols-1 gap-3">
                        {Object.keys(TOOL_LABELS).map(t => {
                          const tool = t as AgentTool;
                          const enabled = formAgent.enabledTools?.includes(tool);
                          const isExpanded = expandedTool === tool;
                          const mounted = (formAgent.toolConfigs as any)?.[tool]?.knowledgeAssetIds || [];
                          return (
                            <div key={tool} className={`rounded-2xl border transition-all ${enabled ? 'border-indigo-500/50 bg-indigo-600/10' : 'border-white/5 opacity-50'}`}>
                               <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setFormAgent(p => ({ ...p, enabledTools: enabled ? p.enabledTools?.filter(ex => ex !== tool) : [...(p.enabledTools || []), tool] }))}>
                                  <div className="flex items-center space-x-4">
                                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${enabled ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-900 text-slate-600'}`}><i className={`fa-solid fa-${TOOL_LABELS[tool].icon}`} /></div>
                                     <div>
                                        <div className="text-[11px] font-black uppercase text-white">{TOOL_LABELS[tool].label}</div>
                                        <div className="text-[9px] text-slate-500 font-medium">{TOOL_LABELS[tool].description}</div>
                                     </div>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                     {enabled && <button onClick={e => { e.stopPropagation(); setExpandedTool(isExpanded ? null : tool); }} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isExpanded ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}><i className="fa-solid fa-cog text-xs" /></button>}
                                     <div className={`w-9 h-5 rounded-full relative transition-all ${enabled ? 'bg-indigo-600' : 'bg-slate-800'}`}><div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${enabled ? 'right-1' : 'left-1'}`} /></div>
                                  </div>
                               </div>
                               {enabled && isExpanded && (
                                  <div className="p-5 border-t border-white/5 space-y-6 animate-fade-in bg-black/20">
                                     {/* Tool Specific Configurations */}
                                     <div className="grid grid-cols-2 gap-4">
                                        {tool === 'webSearch' && (
                                          <>
                                            <div className="col-span-2 space-y-2">
                                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Preferred Domains (CSV)</label>
                                              <input type="text" value={(formAgent.toolConfigs as any)?.webSearch?.domains?.join(', ') || ''} onChange={e => updateToolConfig('webSearch', { domains: e.target.value.split(',').map((d: string) => d.trim()).filter(Boolean) })} className="w-full bg-slate-900 border border-white/5 rounded-lg p-2 text-[10px] text-white" placeholder="google.com, github.com" />
                                            </div>
                                            <div className="space-y-2">
                                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Search Intensity</label>
                                              <select value={(formAgent.toolConfigs as any)?.webSearch?.searchDepth || 'fast'} onChange={e => updateToolConfig('webSearch', { searchDepth: e.target.value })} className="w-full bg-slate-900 border border-white/5 rounded-lg p-2 text-[10px] text-white">
                                                <option value="fast">Fast (Latency Prioritized)</option>
                                                <option value="thorough">Thorough (Precision Prioritized)</option>
                                              </select>
                                            </div>
                                          </>
                                        )}
                                        {tool === 'codeInterpreter' && (
                                          <>
                                            <div className="col-span-2 space-y-2">
                                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Whitelisted Libraries (CSV)</label>
                                              <input type="text" value={(formAgent.toolConfigs as any)?.codeInterpreter?.libraries?.join(', ') || ''} onChange={e => updateToolConfig('codeInterpreter', { libraries: e.target.value.split(',').map((l: string) => l.trim()).filter(Boolean) })} className="w-full bg-slate-900 border border-white/5 rounded-lg p-2 text-[10px] text-white" placeholder="pandas, numpy, requests" />
                                            </div>
                                            <div className="flex items-center space-x-3">
                                              <button onClick={() => updateToolConfig('codeInterpreter', { sandboxMode: !(formAgent.toolConfigs as any)?.codeInterpreter?.sandboxMode })} className={`w-8 h-4 rounded-full relative transition-all ${(formAgent.toolConfigs as any)?.codeInterpreter?.sandboxMode ? 'bg-indigo-600' : 'bg-slate-800'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${(formAgent.toolConfigs as any)?.codeInterpreter?.sandboxMode ? 'right-0.5' : 'left-0.5'}`} /></button>
                                              <span className="text-[9px] font-black text-slate-500 uppercase">Sandbox Mode</span>
                                            </div>
                                          </>
                                        )}
                                        {tool === 'fileSystem' && (
                                          <div className="col-span-2 space-y-2">
                                              <label className="text-[9px] font-black text-slate-500 uppercase">Virtual Root Path</label>
                                              <input type="text" value={(formAgent.toolConfigs as any)?.fileSystem?.rootDir || ''} onChange={e => updateToolConfig('fileSystem', { rootDir: e.target.value })} className="w-full bg-slate-900 border border-white/5 rounded-lg p-2 text-[10px] text-white" placeholder="/mnt/node_storage" />
                                          </div>
                                        )}
                                        {tool === 'mcp' && (
                                           <div className="col-span-2 space-y-2">
                                              <label className="text-[9px] font-black text-slate-500 uppercase">Server Manifest URL</label>
                                              <input type="text" value={(formAgent.toolConfigs as any)?.mcp?.serverUrl || ''} onChange={e => updateToolConfig('mcp', { serverUrl: e.target.value })} className="w-full bg-slate-900 border border-white/5 rounded-lg p-2 text-[10px] text-white" placeholder="https://mcp-server.vibe.io/protocol" />
                                           </div>
                                        )}
                                        {tool === 'webhook' && (
                                           <div className="col-span-2 space-y-2">
                                              <label className="text-[9px] font-black text-slate-500 uppercase">Endpoint Relay</label>
                                              <input type="text" value={(formAgent.toolConfigs as any)?.webhook?.endpointUrl || ''} onChange={e => updateToolConfig('webhook', { endpointUrl: e.target.value })} className="w-full bg-slate-900 border border-white/5 rounded-lg p-2 text-[10px] text-white" placeholder="https://hooks.vibe.io/incoming" />
                                           </div>
                                        )}
                                        {tool === 'restApi' && (
                                           <div className="col-span-2 space-y-2">
                                              <label className="text-[9px] font-black text-slate-500 uppercase">Base API Interface</label>
                                              <input type="text" value={(formAgent.toolConfigs as any)?.restApi?.baseUrl || ''} onChange={e => updateToolConfig('restApi', { baseUrl: e.target.value })} className="w-full bg-slate-900 border border-white/5 rounded-lg p-2 text-[10px] text-white" placeholder="https://api.external-node.com/v1" />
                                           </div>
                                        )}
                                        {tool === 'mediaSynth' && (
                                           <>
                                              <div className="space-y-2">
                                                 <label className="text-[9px] font-black text-slate-500 uppercase">Aspect Ratio</label>
                                                 <select value={(formAgent.toolConfigs as any)?.mediaSynth?.aspectRatio || '1:1'} onChange={e => updateToolConfig('mediaSynth', { aspectRatio: e.target.value })} className="w-full bg-slate-900 border border-white/5 rounded-lg p-2 text-[10px] text-white">
                                                    <option value="1:1">1:1 Square</option>
                                                    <option value="16:9">16:9 Landscape</option>
                                                    <option value="9:16">9:16 Portrait</option>
                                                 </select>
                                              </div>
                                              <div className="flex items-center space-x-3 mt-4">
                                                 <button onClick={() => updateToolConfig('mediaSynth', { generateVideo: !(formAgent.toolConfigs as any)?.mediaSynth?.generateVideo })} className={`w-8 h-4 rounded-full relative transition-all ${(formAgent.toolConfigs as any)?.mediaSynth?.generateVideo ? 'bg-indigo-600' : 'bg-slate-800'}`}><div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${(formAgent.toolConfigs as any)?.mediaSynth?.generateVideo ? 'right-0.5' : 'left-0.5'}`} /></button>
                                                 <span className="text-[9px] font-black text-slate-500 uppercase">Motion Stream Enabled</span>
                                              </div>
                                           </>
                                        )}
                                     </div>

                                     <div className="space-y-3">
                                        <h5 className="text-[9px] font-black uppercase text-emerald-400 flex items-center"><i className="fa-solid fa-link mr-2" />Context Mounting</h5>
                                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto no-scrollbar">
                                           {(formAgent.knowledgeAssets || []).length > 0 ? (formAgent.knowledgeAssets || []).map(a => (
                                             <button key={a.id} onClick={() => toggleToolKnowledge(tool, a.id)} className={`p-2.5 rounded-xl bg-black/20 border flex justify-between items-center text-[10px] font-bold transition-all ${mounted.includes(a.id) ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/5' : 'border-white/5 text-slate-500 hover:border-white/10'}`}>
                                                <span className="truncate">{a.name}</span>
                                                <i className={`fa-solid ${mounted.includes(a.id) ? 'fa-check-circle' : 'fa-circle-notch opacity-20'}`} />
                                             </button>
                                           )) : <div className="col-span-2 text-[9px] text-slate-600 font-bold uppercase italic py-2">No knowledge assets available to mount.</div>}
                                        </div>
                                     </div>
                                  </div>
                               )}
                            </div>
                          );
                        })}
                      </div>
                   </div>
                )}
                {activeSection === 'tasks' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex justify-between items-center bg-indigo-500/5 p-5 rounded-2xl border border-indigo-500/20">
                      <div>
                        <h4 className="text-xs font-black uppercase text-indigo-400">Task Protocol</h4>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Defining node execution directives</p>
                      </div>
                      <button onClick={addTask} className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all">
                        <i className="fa-solid fa-plus mr-2" />Add Directive
                      </button>
                    </div>
                    <div className="space-y-2">
                       {formAgent.tasks?.map((t, i) => (
                         <div key={t.id} className="p-4 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                            <div className="flex items-center space-x-4">
                               <div className="w-6 h-6 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-center text-[10px] font-black text-slate-500">{i + 1}</div>
                               <span className="text-[12px] font-bold text-slate-300">{t.label}</span>
                            </div>
                            <button onClick={() => removeTask(t.id)} className="w-8 h-8 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"><i className="fa-solid fa-trash-can text-xs" /></button>
                         </div>
                       ))}
                       {formAgent.tasks?.length === 0 && <div className="p-12 text-center border border-dashed border-white/5 rounded-3xl opacity-20"><i className="fa-solid fa-list-check text-4xl mb-4" /><p className="text-[10px] font-black uppercase tracking-[0.3em]">No directives defined</p></div>}
                    </div>
                  </div>
                )}
                {activeSection === 'knowledge' && (
                  <div className="space-y-8 animate-fade-in">
                    <div className="flex justify-between items-center bg-black/40 p-6 rounded-2xl border border-white/5">
                       <div><h4 className="text-sm font-black uppercase text-white tracking-tight">Knowledge Cluster Inventory</h4><p className="text-[10px] text-slate-500 font-medium">Inject proprietary data streams into node intelligence.</p></div>
                       <div className="flex items-center space-x-3">
                          <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                          <button 
                            disabled={isUploading}
                            onClick={() => fileInputRef.current?.click()} 
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase shadow-xl transition-all disabled:opacity-50"
                          >
                             {isUploading ? 'Injecting...' : 'Upload Data Layer'}
                          </button>
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       {(formAgent.knowledgeAssets || []).length > 0 ? (formAgent.knowledgeAssets || []).map(a => (
                         <div key={a.id} className="p-4 rounded-2xl border border-white/5 bg-slate-950 flex flex-col space-y-4 shadow-lg group hover:border-indigo-500/30 transition-all">
                            <div className="flex items-center justify-between">
                               <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-400"><i className="fa-solid fa-file-shield" /></div>
                                  <div className="overflow-hidden">
                                     <div className="text-[11px] font-black text-white uppercase truncate">{a.name}</div>
                                     <div className="text-[8px] text-slate-600 font-black uppercase tracking-widest">{a.type}</div>
                                  </div>
                               </div>
                               <button onClick={() => removeKnowledge(a.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-700 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"><i className="fa-solid fa-trash text-[10px]" /></button>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-white/5">
                               <span className="text-[9px] font-black text-slate-600 uppercase">{(a.size / 1024).toFixed(1)} KB</span>
                               <button onClick={() => setViewingAsset(a)} className="text-[9px] font-black text-indigo-400 hover:text-white uppercase tracking-widest transition-colors">Audit Payload</button>
                            </div>
                         </div>
                       )) : <div className="col-span-2 p-20 text-center border border-dashed border-white/5 rounded-3xl opacity-20"><i className="fa-solid fa-database text-4xl mb-4" /><p className="text-[10px] font-black uppercase tracking-[0.3em]">Data Reservoir Empty</p></div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-slate-800 flex justify-between bg-[#161b22] items-center shrink-0">
               <div className="flex flex-col"><span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">Node Stability Profile</span><div className="w-56 h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden shadow-inner"><div className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${capabilityScore}%` }} /></div></div>
               <div className="flex space-x-3"><button onClick={() => setShowCreator(false)} className="px-8 py-3 border border-slate-800 rounded-xl text-slate-500 font-black uppercase text-[10px] hover:text-white transition-colors">Discard Architect</button><button onClick={handleSaveAgent} className="px-12 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-2xl shadow-indigo-500/20 active:scale-95 transition-all">Commit Neural Parameters</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentHub;