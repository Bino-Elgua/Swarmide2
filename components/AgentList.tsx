
import React, { useState, useMemo } from 'react';
import { Agent, AgentStatus, Phase } from '../types';

interface AgentListProps {
  agents: Agent[];
  phases?: Phase[];
  activeAgentId?: string;
  onSelectAgent: (id: string, initialMode?: 'work' | 'hub') => void;
  onEditAgent?: (agent: Agent) => void;
}

const AgentList: React.FC<AgentListProps> = ({ agents, phases, activeAgentId, onSelectAgent, onEditAgent }) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const togglePhase = (phaseIdx: number) => {
    setCollapsedPhases(prev => ({ ...prev, [phaseIdx]: !prev[phaseIdx] }));
  };

  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;
    const query = searchQuery.toLowerCase();
    return agents.filter(a => 
      a.name.toLowerCase().includes(query) || 
      a.role.toLowerCase().includes(query)
    );
  }, [agents, searchQuery]);

  const groupedAgents = useMemo(() => {
    const groups: Record<number, Agent[]> = {};
    filteredAgents.forEach(agent => {
      if (!groups[agent.phase]) groups[agent.phase] = [];
      groups[agent.phase].push(agent);
    });
    return groups;
  }, [filteredAgents]);

  const sortedPhases = useMemo(() => {
    return Object.keys(groupedAgents).map(Number).sort((a, b) => a - b);
  }, [groupedAgents]);

  const clearSearch = () => setSearchQuery('');

  const renderStatusIndicator = (status: AgentStatus) => {
    switch (status) {
      case AgentStatus.THINKING:
        return (
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
            <i className="fa-solid fa-brain text-[8px] text-indigo-400 animate-pulse"></i>
            <span className="text-[7px] font-black text-indigo-400 uppercase tracking-tighter">Thinking</span>
          </div>
        );
      case AgentStatus.WORKING:
        return (
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
            <div className="flex space-x-0.5">
              <span className="w-1 h-1 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1 h-1 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.15s]"></span>
            </div>
            <span className="text-[7px] font-black text-blue-400 uppercase tracking-tighter">Active</span>
          </div>
        );
      case AgentStatus.VERIFYING:
        return (
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
            <i className="fa-solid fa-shield-halved text-[8px] text-amber-400 animate-pulse"></i>
            <span className="text-[7px] font-black text-amber-400 uppercase tracking-tighter">Verifying</span>
          </div>
        );
      case AgentStatus.COMPLETED:
        return (
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <i className="fa-solid fa-check-double text-[8px] text-emerald-500"></i>
            <span className="text-[7px] font-black text-emerald-400 uppercase tracking-tighter">Done</span>
          </div>
        );
      case AgentStatus.ERROR:
        return (
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
            <i className="fa-solid fa-triangle-exclamation text-[8px] text-red-500 animate-ping"></i>
            <span className="text-[7px] font-black text-red-400 uppercase tracking-tighter">Fault</span>
          </div>
        );
      case AgentStatus.IDLE:
      default:
        return (
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-slate-800/50 border border-slate-700/30">
            <div className="w-1 h-1 rounded-full bg-slate-600"></div>
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Standby</span>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filter/Search Bar */}
      <div className="px-1 mb-6 relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
          <i className="fa-solid fa-magnifying-glass text-[10px]"></i>
        </div>
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter nodes by name or role..." 
          className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2.5 pl-9 pr-8 text-[11px] font-medium text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
        />
        {searchQuery && (
          <button 
            onClick={clearSearch}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
          >
            <i className="fa-solid fa-circle-xmark text-[10px]"></i>
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col space-y-6 overflow-y-auto pr-3 custom-scrollbar pb-32 relative">
        {sortedPhases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600 space-y-4 opacity-40">
            <div className="w-20 h-20 bg-slate-800/20 rounded-full flex items-center justify-center border border-dashed border-slate-800">
              <i className={`fa-solid ${searchQuery ? 'fa-filter-circle-xmark' : 'fa-dna'} text-4xl`}></i>
            </div>
            <p className="text-[10px] uppercase font-black tracking-[0.3em]">
              {searchQuery ? 'No matching nodes' : 'No clusters detected'}
            </p>
          </div>
        ) : (
          sortedPhases.map(phaseIdx => {
            const phaseAgents = groupedAgents[phaseIdx];
            const phaseInfo = phases?.find(p => p.id === phaseIdx);
            const isCollapsed = collapsedPhases[phaseIdx];

            return (
              <div key={phaseIdx} className="space-y-3">
                {/* Phase Header */}
                <button 
                  onClick={() => togglePhase(phaseIdx)}
                  className="w-full flex items-center justify-between group py-2 px-1 border-b border-slate-800/50 hover:border-indigo-500/50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded">
                      Phase {phaseIdx + 1}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 group-hover:text-slate-200 truncate max-w-[200px]">
                      {phaseInfo?.name || 'Development Cycle'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-[9px] font-mono text-slate-600">{phaseAgents.length} Agents</span>
                    <i className={`fa-solid fa-chevron-down text-[10px] text-slate-700 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''}`}></i>
                  </div>
                </button>

                {/* Collapsible Content */}
                {!isCollapsed && (
                  <div className="space-y-3 animate-fade-in">
                    {phaseAgents.map(agent => {
                      const isActive = activeAgentId === agent.id;
                      const isHovered = hoveredId === agent.id;

                      return (
                        <div 
                          key={agent.id} 
                          className="relative"
                          onMouseEnter={() => setHoveredId(agent.id)}
                          onMouseLeave={() => setHoveredId(null)}
                        >
                          <div className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-indigo-500 transition-all duration-300 z-20 ${isActive ? 'opacity-100' : 'opacity-0'}`} />

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => onSelectAgent(agent.id, 'work')}
                              className={`flex-1 group flex items-center space-x-4 p-4 rounded-2xl transition-all duration-300 border relative overflow-hidden ${
                                isActive 
                                  ? 'bg-indigo-600/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10 scale-[1.02] ring-1 ring-indigo-500/20' 
                                  : 'bg-slate-900/40 border-slate-800/50 hover:bg-slate-800/50 hover:border-slate-700 hover:scale-[1.01]'
                              }`}
                            >
                              {isActive && (
                                <div className="absolute inset-0 bg-indigo-500/5 animate-pulse-slow pointer-events-none" />
                              )}

                              <div 
                                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500 ${
                                  isActive ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/40 rotate-3' : 'bg-slate-800 text-slate-400 group-hover:rotate-6'
                                }`}
                                style={!isActive ? { color: agent.color, backgroundColor: `${agent.color}10` } : {}}
                              >
                                <i className={`fa-solid fa-${agent.icon} text-lg`}></i>
                              </div>

                              <div className="text-left overflow-hidden flex-1">
                                <h4 className={`font-black text-[11px] uppercase tracking-wider truncate transition-colors ${isActive ? 'text-white' : 'text-slate-300'}`}>
                                  {agent.name}
                                </h4>
                                <p className={`text-[10px] truncate font-medium transition-colors ${isActive ? 'text-indigo-300/80' : 'text-slate-500'}`}>
                                  {agent.role}
                                </p>
                              </div>

                              <div className="flex flex-col items-end space-y-2">
                                {renderStatusIndicator(agent.status)}
                                <div className="text-[8px] font-black text-slate-700 uppercase">Node.{agent.id.split('-')[1] || 'X'}</div>
                              </div>
                            </button>

                            {/* Direct Hub Access Button */}
                            <button 
                              onClick={() => onSelectAgent(agent.id, 'hub')}
                              title="Node Configuration Hub"
                              className={`w-10 h-[68px] rounded-xl flex items-center justify-center border transition-all ${
                                isActive 
                                  ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-400' 
                                  : 'bg-slate-900/40 border-slate-800/50 text-slate-700 hover:text-indigo-500 hover:bg-slate-800'
                              }`}
                            >
                              <i className="fa-solid fa-cog text-sm"></i>
                            </button>

                            {/* Edit Agent Button */}
                            {onEditAgent && (
                              <button 
                                onClick={() => onEditAgent(agent)}
                                title="Edit Agent Parameters"
                                className={`w-10 h-[68px] rounded-xl flex items-center justify-center border transition-all ${
                                  isActive 
                                    ? 'bg-amber-600/10 border-amber-500/40 text-amber-400' 
                                    : 'bg-slate-900/40 border-slate-800/50 text-slate-700 hover:text-amber-500 hover:bg-slate-800'
                                }`}
                              >
                                <i className="fa-solid fa-sliders text-sm"></i>
                              </button>
                            )}
                          </div>

                          {isHovered && (
                            <div 
                              className="absolute top-0 right-full mr-12 w-80 p-6 bg-slate-900/98 backdrop-blur-2xl border border-slate-700/50 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] animate-fade-in-right pointer-events-none overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 p-4 opacity-5">
                                 <i className={`fa-solid fa-${agent.icon} text-6xl rotate-12`}></i>
                              </div>

                              <div className="relative z-10">
                                <div className="flex items-center space-x-4 mb-5">
                                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner" style={{ backgroundColor: `${agent.color}15`, color: agent.color, border: `1px solid ${agent.color}30` }}>
                                    <i className={`fa-solid fa-${agent.icon}`}></i>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-black text-white uppercase tracking-tight">{agent.name}</span>
                                    <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{agent.role}</span>
                                  </div>
                                </div>
                                
                                <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/5">
                                  <h5 className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center">
                                    <i className="fa-solid fa-brain mr-2 text-[10px]"></i>
                                    Profile
                                  </h5>
                                  <p className="text-[11px] text-slate-300 leading-relaxed font-medium italic">"{agent.description}"</p>
                                </div>

                                <div>
                                  <h5 className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center">
                                    <i className="fa-solid fa-list-check mr-2 text-[10px]"></i>
                                    Directives
                                  </h5>
                                  <div className="space-y-2">
                                    {agent.tasks.map((task, idx) => (
                                      <div key={task.id} className="flex items-start space-x-3">
                                        <div className="w-5 h-5 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 border border-slate-700/50">
                                          <span className="text-[9px] font-black text-slate-500">{idx + 1}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 leading-snug">{task.label}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="absolute right-0 top-0 bottom-0 w-1.5" style={{ background: `linear-gradient(to bottom, transparent, ${agent.color}, transparent)` }}></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AgentList;
