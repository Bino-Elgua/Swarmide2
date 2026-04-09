/**
 * SwarmNarratorPanel
 * Floating side panel that shows live AI-narrated commentary of what the
 * swarm agents are doing. Supports 4 audience modes and displays:
 *  - Live narration feed
 *  - Agent thought stream
 *  - Active conflict theater
 *  - Phase transition announcements
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { NarrationEvent, NarrationAudience, Agent } from '../types';
import { getToneOptions, getToneDef } from '../services/agentPersonaService';
import type { SwarmSocketHook } from '../services/webSocketService';

interface SwarmNarratorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
  currentPhase: number;
  swarmSocket: SwarmSocketHook;
  /** Called when user triggers an on-demand narration from the panel. */
  onRequestNarration?: (agentId: string, action: string, audience: NarrationAudience) => void;
  theme?: {
    bg: string;
    panel: string;
    acc: string;
    fg: string;
    border: string;
  };
}

const AUDIENCE_META: Record<NarrationAudience, { label: string; icon: string; desc: string; color: string }> = {
  technical:   { label: 'Technical',   icon: 'fa-code',          desc: 'Precise engineering detail',          color: 'text-blue-400' },
  executive:   { label: 'Executive',   icon: 'fa-briefcase',     desc: 'Business value framing',              color: 'text-yellow-400' },
  educational: { label: 'Educational', icon: 'fa-graduation-cap',desc: 'Step-by-step with explanations',      color: 'text-green-400' },
  debug:       { label: 'Debug',       icon: 'fa-bug',           desc: 'Raw decision trace',                  color: 'text-red-400' },
};

type NarratorTab = 'narrations' | 'thoughts' | 'conflicts' | 'router';

export const SwarmNarratorPanel: React.FC<SwarmNarratorPanelProps> = ({
  isOpen,
  onClose,
  agents,
  currentPhase,
  swarmSocket,
  onRequestNarration,
  theme,
}) => {
  const [activeTab, setActiveTab] = useState<NarratorTab>('narrations');
  const [isPinned, setIsPinned] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll narration feed
  useEffect(() => {
    if (feedRef.current && activeTab === 'narrations') {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [swarmSocket.narrations, activeTab]);

  const handleAudienceChange = useCallback((aud: NarrationAudience) => {
    swarmSocket.setAudience(aud);
  }, [swarmSocket]);

  if (!isOpen) return null;

  const audienceMeta = AUDIENCE_META[swarmSocket.currentAudience];
  const toneOptions  = getToneOptions();

  return (
    <div
      className={`fixed right-0 top-0 h-full z-[200] flex flex-col border-l shadow-2xl transition-all duration-300 ${isPinned ? 'w-96' : 'w-80'}`}
      style={{ backgroundColor: theme?.panel ?? '#0f1117', borderColor: theme?.border ?? 'rgba(255,255,255,0.08)' }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="h-10 px-4 flex items-center justify-between border-b shrink-0 bg-black/30" style={{ borderColor: theme?.border ?? 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center space-x-2">
          <i className="fa-solid fa-waveform text-purple-400 text-[10px]" />
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">Swarm Narrator</span>
          {swarmSocket.isConnected
            ? <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Live" />
            : <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-pulse" title="Offline — start swarm server" />}
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => setIsPinned(p => !p)} title={isPinned ? 'Unpin' : 'Pin wide'} className={`text-[9px] w-6 h-6 flex items-center justify-center rounded transition-colors ${isPinned ? 'text-purple-400' : 'text-slate-500 hover:text-white'}`}>
            <i className={`fa-solid ${isPinned ? 'fa-thumbtack' : 'fa-thumbtack-slash'}`} />
          </button>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors w-6 h-6 flex items-center justify-center">
            <i className="fa-solid fa-xmark text-[10px]" />
          </button>
        </div>
      </div>

      {/* ── Audience selector ────────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b flex items-center space-x-1 flex-wrap gap-1 shrink-0" style={{ borderColor: theme?.border ?? 'rgba(255,255,255,0.08)' }}>
        {(Object.keys(AUDIENCE_META) as NarrationAudience[]).map(aud => {
          const m = AUDIENCE_META[aud];
          const active = swarmSocket.currentAudience === aud;
          return (
            <button
              key={aud}
              onClick={() => handleAudienceChange(aud)}
              title={m.desc}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest border transition-all ${active ? `border-current ${m.color} bg-white/5` : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              <i className={`fa-solid ${m.icon} text-[8px]`} />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center border-b shrink-0" style={{ borderColor: theme?.border ?? 'rgba(255,255,255,0.08)' }}>
        {(['narrations', 'thoughts', 'conflicts', 'router'] as NarratorTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-[8px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab ? 'text-purple-300 border-purple-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
          >
            {tab === 'router' ? 'Providers' : tab}
            {tab === 'conflicts' && swarmSocket.conflicts.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[7px] rounded-full px-1">{swarmSocket.conflicts.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* NARRATIONS TAB */}
        {activeTab === 'narrations' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar text-[9px]" ref={feedRef}>
            {swarmSocket.narrations.length === 0 && (
              <div className="text-center text-slate-600 pt-8">
                <i className="fa-solid fa-microphone-slash text-2xl mb-2 block" />
                <p>Narrator is quiet.</p>
                <p className="mt-1 text-[8px]">Run an orchestration to hear the swarm.</p>
              </div>
            )}
            {swarmSocket.narrations.map((n, i) => {
              const toneDef = getToneDef(n.toneStyle);
              return (
                <div key={n.id ?? i} className="rounded-lg p-2 border animate-fade-in" style={{ borderColor: theme?.border ?? 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[8px] font-bold" style={{ color: n.agentColor }}>{n.agentIcon} {n.agentName}</span>
                      <span className={`text-[7px] border rounded-full px-1.5 py-0.5 ${toneDef ? `bg-slate-800/50 ${n.toneStyle}` : ''}`} style={{ borderColor: theme?.border ?? 'rgba(255,255,255,0.1)', color: 'var(--accent)' }}>
                        <i className={`fa-solid ${toneDef?.icon ?? 'fa-circle'} mr-0.5`} />{n.toneStyle}
                      </span>
                    </div>
                    <span className="text-[7px] text-slate-600">
                      {n.timestamp instanceof Date ? n.timestamp.toLocaleTimeString([], { hour12: false }) : String(n.timestamp).slice(11, 19)}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{n.narration}</p>
                  {n.phase && <span className="text-[7px] text-slate-600 mt-0.5 block">Phase {n.phase} · {n.audience}</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* THOUGHTS TAB */}
        {activeTab === 'thoughts' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar text-[9px]">
            {swarmSocket.thoughts.length === 0 && (
              <div className="text-center text-slate-600 pt-8">
                <i className="fa-solid fa-brain text-2xl mb-2 block" />
                <p>No agent thoughts yet.</p>
              </div>
            )}
            {[...swarmSocket.thoughts].reverse().map((t, i) => (
              <div key={i} className="flex items-start space-x-2 py-1.5 border-b" style={{ borderColor: theme?.border ?? 'rgba(255,255,255,0.04)' }}>
                <span className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: t.agentColor ?? '#6366f1' }} />
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-slate-400">{t.agentName} </span>
                  <span className="text-slate-300">{t.thought}</span>
                </div>
                <span className="text-[7px] text-slate-600 shrink-0">{t.timestamp.slice(11, 19)}</span>
              </div>
            ))}
          </div>
        )}

        {/* CONFLICTS TAB */}
        {activeTab === 'conflicts' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar text-[9px]">
            {swarmSocket.conflicts.length === 0 ? (
              <div className="text-center text-slate-600 pt-8">
                <i className="fa-solid fa-handshake text-2xl mb-2 block text-green-600" />
                <p>No active conflicts.</p>
                <p className="mt-1 text-[8px]">Agents are in harmony.</p>
              </div>
            ) : (
              swarmSocket.conflicts.map((c, i) => (
                <div key={i} className="rounded-lg p-3 border border-red-500/20 bg-red-500/5 animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[8px] font-black uppercase tracking-widest text-red-400">
                      <i className="fa-solid fa-swords mr-1" />Live Conflict
                    </span>
                    <span className="text-[7px] text-slate-600">{c.timestamp.slice(11, 19)}</span>
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-orange-300 font-bold">{c.agentAName}</span>
                    <i className="fa-solid fa-vs text-[8px] text-red-400" />
                    <span className="text-yellow-300 font-bold">{c.agentBName}</span>
                  </div>
                  <p className="text-slate-400 text-[8px] mb-1"><span className="font-bold">Topic:</span> {c.topic.slice(0, 120)}</p>
                  {c.narration && <p className="text-slate-300 italic border-t pt-2 mt-2" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>{c.narration}</p>}
                </div>
              ))
            )}

            {/* Phase events */}
            {swarmSocket.phaseEvents.length > 0 && (
              <div className="mt-3 border-t pt-3" style={{ borderColor: theme?.border ?? 'rgba(255,255,255,0.08)' }}>
                <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-2">Phase History</p>
                {swarmSocket.phaseEvents.map((p, i) => (
                  <div key={i} className="text-[8px] text-slate-400 py-0.5">
                    <i className="fa-solid fa-arrow-right mr-1 text-cyan-400" />
                    Phase {p.fromPhase} → {p.toPhase}: <span className="text-slate-300">{p.phaseName}</span>
                    {p.narration && <p className="text-slate-500 mt-0.5 pl-4">{p.narration}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROVIDERS TAB */}
        {activeTab === 'router' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar text-[9px]">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                <i className="fa-solid fa-route mr-1" />Provider Router
              </p>
              {/* Tone Style legend */}
              <div className="space-y-1 mb-3">
                <p className="text-slate-500 text-[7px] uppercase tracking-wider mb-1">Agent Tone Styles</p>
                {toneOptions.map(({ tone, label, icon, badgeColor }) => {
                  const agentsWithTone = agents.filter(a => (a.toneStyle ?? 'casual') === tone);
                  return (
                    <div key={tone} className="flex items-center justify-between">
                      <span className={`text-[8px] border rounded-full px-2 py-0.5 ${badgeColor}`}>
                        <i className={`fa-solid ${icon} mr-1`} />{label}
                      </span>
                      <span className="text-slate-600">{agentsWithTone.length} agent{agentsWithTone.length !== 1 ? 's' : ''}</span>
                    </div>
                  );
                })}
              </div>
              {/* Per-agent tone display */}
              <p className="text-slate-500 text-[7px] uppercase tracking-wider mb-1">Active Agents</p>
              <div className="space-y-1">
                {agents.slice(0, 12).map(agent => {
                  const tone = agent.toneStyle ?? 'casual';
                  const def  = getToneDef(tone);
                  return (
                    <div key={agent.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[9px]" style={{ color: agent.color }}>{agent.icon}</span>
                        <span className="text-slate-300 truncate max-w-[100px]">{agent.name}</span>
                      </div>
                      <span className={`text-[7px] border rounded-full px-1.5 py-0.5 ${def.badgeColor}`}>
                        <i className={`fa-solid ${def.icon} mr-0.5`} />{def.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* WebSocket status */}
            <div className="border-t pt-3" style={{ borderColor: theme?.border ?? 'rgba(255,255,255,0.08)' }}>
              <p className="text-slate-500 text-[7px] uppercase tracking-wider mb-2">Swarm WebSocket</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status</span>
                  <span className={`font-bold ${swarmSocket.isConnected ? 'text-green-400' : swarmSocket.isConnecting ? 'text-yellow-400 animate-pulse' : 'text-slate-600'}`}>
                    {swarmSocket.isConnected ? 'Live' : swarmSocket.isConnecting ? 'Connecting…' : 'Offline'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Narrations</span>
                  <span className="text-purple-400">{swarmSocket.narrations.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Thoughts</span>
                  <span className="text-blue-400">{swarmSocket.thoughts.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Cost ticks</span>
                  <span className="text-yellow-400">{swarmSocket.costTicks.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer actions ───────────────────────────────────────────────────── */}
      <div className="h-9 px-3 flex items-center justify-between border-t shrink-0 bg-black/20" style={{ borderColor: theme?.border ?? 'rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => { swarmSocket.clearNarrations(); swarmSocket.clearThoughts(); }}
          className="text-[8px] text-slate-500 hover:text-white transition-colors"
        >
          <i className="fa-solid fa-trash-can mr-1" />Clear
        </button>
        <span className="text-[7px] text-slate-600">
          <i className={`fa-solid ${audienceMeta.icon} mr-1 ${audienceMeta.color}`} />
          {audienceMeta.label} mode · Phase {currentPhase}
        </span>
      </div>
    </div>
  );
};

export default SwarmNarratorPanel;
