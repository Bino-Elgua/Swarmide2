import React, { useState } from 'react';

interface MissionSettingsProps {
  strategy: string;
  intensity: number;
  targetPlatform: string;
  logicHubApiKey: string;
  logicHubModel: string;
  synthesisApiKey: string;
  synthesisModel: string;
  onStrategyChange: (strategy: string) => void;
  onIntensityChange: (intensity: number) => void;
  onTargetPlatformChange: (platform: string) => void;
  onLogicHubKeyChange: (key: string) => void;
  onLogicHubModelChange: (model: string) => void;
  onSynthesisKeyChange: (key: string) => void;
  onSynthesisModelChange: (model: string) => void;
}

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
  onStrategyChange,
  onIntensityChange,
  onTargetPlatformChange,
  onLogicHubKeyChange,
  onLogicHubModelChange,
  onSynthesisKeyChange,
  onSynthesisModelChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-sm">
      {/* Backdrop blur when open */}
      {isOpen && (
        <div 
          className="fixed inset-0 backdrop-blur-sm z-30 cursor-pointer" 
          onClick={() => setIsOpen(false)}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
        />
      )}

      {/* Settings Panel - Glassmorphism */}
      <div
        className={`transition-all duration-300 ease-out transform ${
          isOpen 
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
        } rounded-2xl border shadow-2xl overflow-hidden`}
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
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

          {/* System Engine Section */}
          <div className="border-b" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setExpandedSection(expandedSection === 'engine' ? null : 'engine')}
              className="w-full px-6 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <i className="fa-solid fa-microchip text-purple-400 text-xs" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">System Engine</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[8px] opacity-60 transition-transform ${expandedSection === 'engine' ? '' : '-rotate-90'}`} />
            </button>
            {expandedSection === 'engine' && (
              <div className="px-6 py-3 space-y-4 bg-black/20">
                <div>
                  <p className="text-[8px] text-slate-400 leading-relaxed mb-3">
                    Manages the orchestrator's cognitive pipeline. The Logic Hub handles recursive reasoning, while Synthesis Pass refines outputs through multi-pass refinement. Configure LLM providers and models for each phase.
                  </p>
                </div>
                <div className="space-y-3 border-t border-white/10 pt-3">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-400 uppercase">Logic Hub (Orchestrator)</label>
                    <input
                      type="password"
                      value={logicHubApiKey}
                      onChange={(e) => onLogicHubKeyChange(e.target.value)}
                      placeholder="API Key (sk-...)"
                      className="w-full bg-slate-900 border rounded-lg px-3 py-2 text-[10px] outline-none focus:border-indigo-500 transition-colors"
                      style={{ borderColor: logicHubApiKey ? 'var(--accent)' : 'var(--border)' }}
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
                    <label className="text-[8px] font-black text-slate-400 uppercase">Synthesis Pass (Refinement)</label>
                    <input
                      type="password"
                      value={synthesisApiKey}
                      onChange={(e) => onSynthesisKeyChange(e.target.value)}
                      placeholder="API Key (sk-...)"
                      className="w-full bg-slate-900 border rounded-lg px-3 py-2 text-[10px] outline-none focus:border-indigo-500 transition-colors"
                      style={{ borderColor: synthesisApiKey ? 'var(--accent)' : 'var(--border)' }}
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
  );
};

export default MissionSettings;
