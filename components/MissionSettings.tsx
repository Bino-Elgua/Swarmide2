import React, { useState } from 'react';

interface MissionSettingsProps {
  strategy: string;
  intensity: number;
  targetPlatform: string;
  logicHubApiKey: string;
  logicHubModel: string;
  synthesisApiKey: string;
  synthesisModel: string;
  costBudgetUSD?: number;
  synthesisStrategy?: string;
  apiKeys?: Record<string, string>;
  onStrategyChange: (strategy: string) => void;
  onIntensityChange: (intensity: number) => void;
  onTargetPlatformChange: (platform: string) => void;
  onLogicHubKeyChange: (key: string) => void;
  onLogicHubModelChange: (model: string) => void;
  onSynthesisKeyChange: (key: string) => void;
  onSynthesisModelChange: (model: string) => void;
  onCostBudgetChange?: (budget: number) => void;
  onSynthesisStrategyChange?: (strategy: string) => void;
  onApiKeysChange?: (keys: Record<string, string>) => void;
}

const API_SERVICES = [
  { id: 'openai', label: 'OpenAI', icon: 'fa-robot' },
  { id: 'anthropic', label: 'Anthropic', icon: 'fa-leaf' },
  { id: 'google', label: 'Google', icon: 'fa-google' },
  { id: 'groq', label: 'Groq', icon: 'fa-bolt' },
  { id: 'mistral', label: 'Mistral', icon: 'fa-wind' },
  { id: 'cohere', label: 'Cohere', icon: 'fa-hexagon' },
];

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

const MissionSettings: React.FC<MissionSettingsProps> = ({
  strategy,
  intensity,
  targetPlatform,
  logicHubApiKey,
  logicHubModel,
  synthesisApiKey,
  synthesisModel,
  costBudgetUSD,
  synthesisStrategy,
  apiKeys = {},
  onStrategyChange,
  onIntensityChange,
  onTargetPlatformChange,
  onLogicHubKeyChange,
  onLogicHubModelChange,
  onSynthesisKeyChange,
  onSynthesisModelChange,
  onCostBudgetChange,
  onSynthesisStrategyChange,
  onApiKeysChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [newApiService, setNewApiService] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [showApiKeyValues, setShowApiKeyValues] = useState<Set<string>>(new Set());

  return (
    <>
      {/* Backdrop blur when open - blur effect on background only */}
      {isOpen && (
        <div 
          className="fixed inset-0 cursor-pointer" 
          onClick={() => setIsOpen(false)}
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 40,
            pointerEvents: 'auto'
          }}
        />
      )}

      {/* Settings Panel Container - higher z-index to avoid blur */}
      <div className="fixed bottom-6 right-6 z-50 max-w-sm pointer-events-none">
        {/* Settings Panel - No glassmorphism, solid background */}
        <div
          className={`transition-all duration-300 ease-out transform pointer-events-auto ${
            isOpen 
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
              : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
          } rounded-2xl border shadow-2xl overflow-hidden`}
          style={{
            borderColor: 'var(--border)',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
          }}
        >
        {/* Header */}
        <div 
          className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-indigo-600/10 to-transparent"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center space-x-2">
            <i className="fa-solid fa-sliders text-indigo-400 text-xs" />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-white">Mission Settings</h3>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-0">
          {/* Strategy Section */}
          <div className="border-b" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setExpandedSection(expandedSection === 'strategy' ? null : 'strategy')}
              className="w-full px-6 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <i className="fa-solid fa-chess text-indigo-400 text-xs" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Strategy Preset</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[8px] opacity-60 transition-transform ${expandedSection === 'strategy' ? '' : '-rotate-90'}`} />
            </button>
            {expandedSection === 'strategy' && (
              <div className="px-6 py-3 space-y-2 bg-black/20">
                {STRATEGY_PRESETS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onStrategyChange(p.id);
                      setExpandedSection(null);
                    }}
                    className={`w-full p-2 rounded-lg border text-left transition-all flex items-center space-x-3 ${
                      strategy === p.id
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                        : 'bg-black/20 border-white/5 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <i className={`fa-solid fa-${p.icon} text-[10px]`} />
                    <div className="overflow-hidden">
                      <div className="text-[9px] font-black uppercase">{p.label}</div>
                      <div className="text-[8px] opacity-70">{p.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fleet Intensity Section */}
          <div className="border-b" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setExpandedSection(expandedSection === 'intensity' ? null : 'intensity')}
              className="w-full px-6 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <i className="fa-solid fa-fire text-orange-400 text-xs" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Fleet Intensity</span>
              </div>
              <div className="text-[9px] font-bold text-indigo-400">{intensity}</div>
            </button>
            {expandedSection === 'intensity' && (
              <div className="px-6 py-3 space-y-3 bg-black/20">
                <p className="text-[8px] text-slate-400 leading-relaxed">
                  Controls the number of parallel agent clusters and computational intensity. Higher values deploy more resources but increase token consumption and latency.
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-[8px]">
                    <span className="font-bold text-slate-300">Minimal (1)</span>
                    <span className="font-bold text-slate-300">Maximum (3)</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="1"
                    value={intensity}
                    onChange={(e) => onIntensityChange(parseInt(e.target.value))}
                    className="w-full accent-orange-500"
                  />
                  <p className="text-[8px] text-indigo-400 font-bold">Current: Level {intensity}</p>
                </div>
              </div>
            )}
          </div>

          {/* Intelligence Section - API Keys & Model Configuration */}
          <div className="border-b" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setExpandedSection(expandedSection === 'intelligence' ? null : 'intelligence')}
              className="w-full px-6 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <i className="fa-solid fa-brain text-cyan-400 text-xs" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Intelligence</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[8px] opacity-60 transition-transform ${expandedSection === 'intelligence' ? '' : '-rotate-90'}`} />
            </button>
            {expandedSection === 'intelligence' && (
              <div className="px-6 py-3 space-y-4 bg-black/20">
                <div>
                  <p className="text-[8px] text-cyan-300 leading-relaxed mb-3 font-bold">
                    🔑 API KEYS CONFIGURATION
                  </p>
                  <p className="text-[8px] text-slate-400 leading-relaxed mb-3">
                    Configure your LLM provider API keys below. The Logic Hub orchestrates agent reasoning, while Synthesis Pass refines outputs. All keys are stored securely in your browser.
                  </p>
                </div>
                <div className="space-y-3 border-t border-cyan-500/20 pt-3">
                  {!logicHubApiKey && (
                    <div className="p-2 rounded-lg bg-red-950/20 border border-red-500/30">
                      <p className="text-[7px] text-red-400 font-bold">⚠️ API KEY REQUIRED</p>
                      <p className="text-[7px] text-red-300">Enter your API key below to enable orchestrator</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-cyan-300 uppercase">🔑 Logic Hub API Key (Orchestrator)</label>
                    <input
                      type="password"
                      value={logicHubApiKey}
                      onChange={(e) => onLogicHubKeyChange(e.target.value)}
                      placeholder="sk-... (get from OpenAI/Google/Anthropic)"
                      className="w-full bg-slate-900 border-2 rounded-lg px-3 py-2 text-[10px] outline-none focus:border-cyan-500 transition-all"
                      style={{ borderColor: logicHubApiKey ? 'rgb(34, 211, 238)' : 'rgb(100, 116, 139)' }}
                    />
                    <select
                      value={logicHubModel}
                      onChange={(e) => onLogicHubModelChange(e.target.value)}
                      className="w-full bg-slate-900 border rounded-lg px-3 py-2 text-[10px] outline-none focus:border-indigo-500 transition-colors"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                      <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                    </select>
                    {logicHubApiKey && <p className="text-[8px] text-green-500 font-bold">✓ Key configured</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-cyan-300 uppercase">🔑 Synthesis Pass API Key (Refinement)</label>
                    <input
                      type="password"
                      value={synthesisApiKey}
                      onChange={(e) => onSynthesisKeyChange(e.target.value)}
                      placeholder="sk-... (optional, use same provider or different)"
                      className="w-full bg-slate-900 border-2 rounded-lg px-3 py-2 text-[10px] outline-none focus:border-cyan-500 transition-all"
                      style={{ borderColor: synthesisApiKey ? 'rgb(34, 211, 238)' : 'rgb(100, 116, 139)' }}
                    />
                    <select
                      value={synthesisModel}
                      onChange={(e) => onSynthesisModelChange(e.target.value)}
                      className="w-full bg-slate-900 border rounded-lg px-3 py-2 text-[10px] outline-none focus:border-indigo-500 transition-colors"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                      <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                    </select>
                    {synthesisApiKey && <p className="text-[8px] text-green-500 font-bold">✓ Key configured</p>}
                    </div>
                    </div>
                    
                    {/* Help Section */}
                    <div className="border-t border-cyan-500/20 pt-3 space-y-2">
                    <p className="text-[8px] font-bold text-cyan-300">📚 HOW TO GET API KEYS:</p>
                    <div className="space-y-1 text-[7px] text-slate-400">
                    <p>• <span className="text-indigo-300 font-bold">Gemini</span> → go.dev/genai → Get API Key</p>
                    <p>• <span className="text-red-300 font-bold">OpenAI</span> → platform.openai.com → API Keys</p>
                    <p>• <span className="text-orange-300 font-bold">Claude</span> → console.anthropic.com → API Keys</p>
                    <p>• <span className="text-yellow-300 font-bold">Groq</span> → console.groq.com → API Keys</p>
                    </div>
                    </div>
                    </div>
                    )}
                    </div>

          {/* Intelligence: API Keys Section */}
          <div className="border-b" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setExpandedSection(expandedSection === 'apikeys' ? null : 'apikeys')}
              className="w-full px-6 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <i className="fa-solid fa-key text-emerald-400 text-xs" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Intelligence: API Keys</span>
                <span className="text-[9px] bg-emerald-600/50 text-emerald-200 px-2 py-0.5 rounded-full">{Object.keys(apiKeys).length}</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[8px] opacity-60 transition-transform ${expandedSection === 'apikeys' ? '' : '-rotate-90'}`} />
            </button>
            {expandedSection === 'apikeys' && (
              <div className="px-6 py-3 space-y-3 bg-black/20 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-[8px] text-slate-400 leading-relaxed">
                  Configure API keys for LLM providers and external services. Keys are encrypted in browser storage and used for agent execution.
                </p>

                {/* Add New Key Form */}
                <div className="space-y-2 border-t pt-2 border-white/10">
                  <p className="text-[8px] font-bold text-slate-300">Add New Key</p>
                  <div className="flex gap-1 flex-wrap">
                    {API_SERVICES.map((service) => (
                      <button
                        key={service.id}
                        onClick={() => setNewApiService(newApiService === service.id ? '' : service.id)}
                        className={`text-[8px] px-2 py-1 rounded border transition ${
                          newApiService === service.id
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <i className={`fa-solid ${service.icon} mr-1`} />
                        {service.label}
                      </button>
                    ))}
                  </div>
                  
                  {newApiService && (
                    <div className="space-y-2 mt-2">
                      <input
                        type="password"
                        value={newApiKey}
                        onChange={(e) => setNewApiKey(e.target.value)}
                        placeholder={`${newApiService.toUpperCase()} API Key...`}
                        className="w-full bg-slate-900 border rounded-lg px-3 py-2 text-[10px] outline-none focus:border-emerald-500 transition-colors"
                        style={{ borderColor: 'var(--border)' }}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (newApiKey.trim()) {
                              const updated = { ...apiKeys, [newApiService]: newApiKey };
                              onApiKeysChange?.(updated);
                              setNewApiKey('');
                              setNewApiService('');
                            }
                          }}
                          className="flex-1 text-[8px] px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition"
                        >
                          Add Key
                        </button>
                        <button
                          onClick={() => {
                            setNewApiKey('');
                            setNewApiService('');
                          }}
                          className="flex-1 text-[8px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* List Keys */}
                {Object.keys(apiKeys).length > 0 && (
                  <div className="space-y-2 border-t pt-2 border-white/10">
                    <p className="text-[8px] font-bold text-slate-300">Configured Keys</p>
                    {Object.entries(apiKeys).map(([service, key]) => {
                      const keyStr = String(key);
                      return (
                      <div key={service} className="flex items-center justify-between bg-slate-800/50 p-2 rounded border border-slate-700 text-[8px]">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <i className="fa-solid fa-key text-emerald-500" />
                          <span className="font-bold capitalize truncate">{service}</span>
                          <span className="text-slate-500">
                            {showApiKeyValues.has(service) ? 
                              `${keyStr.substring(0, 4)}...${keyStr.substring(keyStr.length - 4)}` : 
                              '••••••••'
                            }
                          </span>
                        </div>
                        <div className="flex gap-1 ml-2 flex-shrink-0">
                          <button
                            onClick={() => {
                              const updated = new Set(showApiKeyValues);
                              if (updated.has(service)) updated.delete(service);
                              else updated.add(service);
                              setShowApiKeyValues(updated);
                            }}
                            className="p-1 hover:bg-slate-700 rounded transition text-slate-500 hover:text-white"
                            title="Toggle visibility"
                          >
                            <i className={`fa-solid ${showApiKeyValues.has(service) ? 'fa-eye-slash' : 'fa-eye'}`} />
                          </button>
                          <button
                            onClick={() => {
                              const updated = { ...apiKeys };
                              delete updated[service];
                              onApiKeysChange?.(updated);
                            }}
                            className="p-1 hover:bg-red-900/50 rounded transition text-red-500"
                            title="Delete key"
                          >
                            <i className="fa-solid fa-trash text-[7px]" />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Deployment Platform Section */}
          <div>
            <button
              onClick={() => setExpandedSection(expandedSection === 'platform' ? null : 'platform')}
              className="w-full px-6 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <i className="fa-solid fa-rocket text-pink-400 text-xs" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Deployment Platform</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[8px] opacity-60 transition-transform ${expandedSection === 'platform' ? '' : '-rotate-90'}`} />
            </button>
            {expandedSection === 'platform' && (
              <div className="px-6 py-3 space-y-3 bg-black/20">
                <p className="text-[8px] text-slate-400 leading-relaxed">
                  Specifies the target deployment architecture for synthesized projects. Web Applications deploy as responsive React/Svelte frontends, Mobile generates React Native/Kotlin code, Scientific Models produce Python/NumPy implementations, and Creative Fiction generates multimedia narratives.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORMS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onTargetPlatformChange(p.id);
                        setExpandedSection(null);
                      }}
                      className={`p-3 rounded-lg border flex flex-col items-center space-y-2 transition-all ${
                        targetPlatform === p.id
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                          : 'bg-black/20 border-white/5 opacity-40 hover:opacity-100'
                      }`}
                    >
                      <i className={`fa-solid fa-${p.icon} text-[11px]`} />
                      <span className="text-[7px] font-black uppercase text-center leading-tight">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              )}
              </div>

              {/* Phase 1: Conflict Resolution & Cost Tracking */}
              <div className="border-t" style={{ borderColor: 'var(--border)' }}>
              <button
              onClick={() => setExpandedSection(expandedSection === 'phase1' ? null : 'phase1')}
              className="w-full px-6 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
              <div className="flex items-center space-x-2">
               <i className="fa-solid fa-coins text-yellow-400 text-xs" />
               <span className="text-[10px] font-black uppercase tracking-widest text-white">Cost & Conflicts</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[8px] opacity-60 transition-transform ${expandedSection === 'phase1' ? '' : '-rotate-90'}`} />
              </button>
              {expandedSection === 'phase1' && (
              <div className="px-6 py-3 space-y-3 bg-black/20 border-t" style={{ borderColor: 'var(--border)' }}>
               <p className="text-[8px] text-slate-400 leading-relaxed">
                 Phase 1 features: Real-time cost tracking with budget enforcement, multi-proposal conflict resolution via voting, hierarchical merging, or meta-reasoning synthesis.
               </p>
               <div className="space-y-2">
                 <label className="text-[8px] font-black text-slate-400 uppercase">Budget (USD)</label>
                 <input
                   type="number"
                   value={costBudgetUSD || ''}
                   onChange={(e) => onCostBudgetChange?.(parseFloat(e.target.value))}
                   placeholder="10.00"
                   className="w-full bg-slate-900 border rounded-lg px-3 py-2 text-[10px] outline-none focus:border-yellow-500 transition-colors"
                   style={{ borderColor: 'var(--border)' }}
                 />
                 <p className="text-[7px] text-slate-500">Default: $10 USD</p>
               </div>
               <div className="space-y-2">
                 <label className="text-[8px] font-black text-slate-400 uppercase">Conflict Resolution Strategy</label>
                 <select
                   value={synthesisStrategy || 'voting'}
                   onChange={(e) => onSynthesisStrategyChange?.(e.target.value)}
                   className="w-full bg-slate-900 border rounded-lg px-3 py-2 text-[10px] outline-none focus:border-yellow-500 transition-colors"
                   style={{ borderColor: 'var(--border)' }}
                 >
                   <option value="voting">Voting (Score-based)</option>
                   <option value="hierarchical">Hierarchical (Base + Improvements)</option>
                   <option value="meta_reasoning">Meta-Reasoning (Deep Synthesis)</option>
                   <option value="user_select">User Select (Manual Choice)</option>
                 </select>
               </div>
              </div>
              )}
              </div>
              </div>
              </div>

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative group"
        style={{
          transform: isOpen ? 'scale(0.8)' : 'scale(1)',
          transition: 'all 300ms ease-out',
          pointerEvents: isOpen ? 'none' : 'auto',
          opacity: isOpen ? '0' : '1'
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shadow-2xl border text-white text-lg transition-all hover:shadow-indigo-500/50 active:scale-95 cursor-pointer"
          style={{
            backgroundColor: 'var(--accent)',
            borderColor: 'var(--border)',
            boxShadow: '0 0 24px var(--accent)40'
          }}
        >
          <i className="fa-solid fa-sliders" />
        </div>
      </button>
      </div>
    </>
  );
};

export default MissionSettings;
