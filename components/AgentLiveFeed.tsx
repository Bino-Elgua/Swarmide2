
import React, { useEffect, useRef } from 'react';
import { ProjectState, ProtocolMessage } from '../types';

interface AgentLiveFeedProps {
  project: ProjectState;
  onSelectAgent: (id: string) => void;
}

const AgentLiveFeed: React.FC<AgentLiveFeedProps> = ({ project, onSelectAgent }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [project.protocolHistory]);

  const getActionStyles = (action: ProtocolMessage['action']) => {
    switch (action) {
      case 'HANDSHAKE': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'BROADCAST': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'COMMIT': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'ANALYZE': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'SIGNAL': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getActionIcon = (action: ProtocolMessage['action']) => {
    switch (action) {
      case 'HANDSHAKE': return 'fa-handshake';
      case 'BROADCAST': return 'fa-satellite-dish';
      case 'COMMIT': return 'fa-database';
      case 'ANALYZE': return 'fa-microscope';
      case 'SIGNAL': return 'fa-wifi';
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-transparent relative font-mono overflow-hidden">
      {/* Protocol Header */}
      <div className="p-4 border-b border-slate-800/50 bg-slate-900/20 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute inset-0 opacity-40"></div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 relative shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 leading-none">Cluster Protocol Stream</span>
            <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-widest mt-1">
              {project.phases[project.currentPhase]?.name || 'Initializing System'}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
           <div className="flex items-center space-x-2 text-[9px] font-black text-slate-700 uppercase tracking-widest">
              <span>Bitrate</span>
              <span className="text-slate-400">12.4 MB/s</span>
           </div>
           <div className="w-px h-4 bg-slate-800"></div>
           <div className="flex items-center space-x-2 text-[9px] font-black text-slate-700 uppercase tracking-widest">
              <span>Nodes</span>
              <span className="text-indigo-400">{project.agents.length} Online</span>
           </div>
        </div>
      </div>

      {/* Protocol Log */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar scroll-smooth"
      >
        {project.protocolHistory.length === 0 && !project.isOrchestrating && (
          <div className="h-full flex flex-col items-center justify-center text-slate-800 opacity-30 text-center">
             <i className="fa-solid fa-code-merge text-6xl mb-4"></i>
             <p className="text-[10px] font-black uppercase tracking-[0.4em]">Listening for Node Traffic...</p>
             <p className="text-[8px] mt-2 font-medium uppercase">Awaiting mission engagement</p>
          </div>
        )}

        {project.protocolHistory.map((log) => (
          <div 
            key={log.id} 
            className="flex items-start space-x-3 p-3 bg-slate-900/30 border border-white/5 rounded-xl hover:bg-slate-900/50 transition-colors group cursor-pointer"
            onClick={() => onSelectAgent(log.sourceId)}
          >
            <div className="text-[9px] text-slate-700 shrink-0 pt-0.5">
              [{log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
            </div>

            <div 
              className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 border border-white/5"
              style={{ backgroundColor: `${log.sourceColor}15`, color: log.sourceColor }}
            >
              <i className={`fa-solid fa-${log.sourceIcon} text-[10px]`}></i>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-tight">{log.sourceName}</span>
                <div className={`px-1.5 py-0.5 rounded border text-[7px] font-black uppercase tracking-tighter ${getActionStyles(log.action)}`}>
                  <i className={`fa-solid ${getActionIcon(log.action)} mr-1`}></i>
                  {log.action}
                </div>
                {log.targetName && (
                  <div className="flex items-center space-x-2">
                    <i className="fa-solid fa-arrow-right-long text-slate-800 text-[8px]"></i>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">{log.targetName}</span>
                  </div>
                )}
              </div>
              
              <div className="text-[10px] leading-relaxed text-slate-400 break-words group-hover:text-slate-200 transition-colors">
                {log.text}
              </div>
            </div>
          </div>
        ))}

        {project.isSynthesizing && (
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl animate-pulse flex items-center space-x-3">
             <i className="fa-solid fa-sync fa-spin text-emerald-500 text-[10px]"></i>
             <span className="text-[9px] font-black uppercase text-emerald-400 tracking-widest">Compiling Synthesis Stream...</span>
          </div>
        )}
      </div>
      
      {/* Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] overflow-hidden">
        <div className="w-full h-px bg-white animate-scanline"></div>
      </div>
      
      {/* Gradient Vignette */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(0,0,0,0.6)]"></div>
    </div>
  );
};

export default AgentLiveFeed;
