/**
 * Orchestration Dashboard
 * Complete view of mission execution with all Phase 1-5 features integrated
 */

import React, { useState, useEffect } from 'react';
import { OrchestrationResult, OrchestrationPhaseResult } from '../services/orchestrationFlow';
import { HealthMetrics } from '../services/healthCheck';

interface OrchestrationDashboardProps {
  isVisible: boolean;
  isExecuting: boolean;
  result?: OrchestrationResult;
  currentPhase?: number;
  totalPhases?: number;
  healthMetrics?: HealthMetrics;
  log: string[];
}

const OrchestrationDashboard: React.FC<OrchestrationDashboardProps> = ({
  isVisible,
  isExecuting,
  result,
  currentPhase = 0,
  totalPhases = 0,
  healthMetrics,
  log
}) => {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);
  const [showHealthDetails, setShowHealthDetails] = useState(false);

  if (!isVisible) return null;

  const progressPercent = totalPhases > 0 ? ((currentPhase / totalPhases) * 100) : 0;

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-md max-h-96 bg-slate-950 border border-slate-700 rounded-lg overflow-hidden flex flex-col">
      
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700 p-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase text-indigo-400">Orchestration Dashboard</h3>
        <div className="flex items-center gap-2">
          {isExecuting && <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />}
          <span className="text-xs text-slate-500">
            {isExecuting ? 'Running' : result?.success ? 'Complete' : 'Idle'}
          </span>
        </div>
      </div>

      {/* Progress */}
      {isExecuting && (
        <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-700">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-bold text-slate-400">Progress</span>
            <span className="text-[9px] text-indigo-400">{currentPhase}/{totalPhases}</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Result Summary */}
      {result && !isExecuting && (
        <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-700 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-[9px]">
            <div className="bg-slate-800 p-2 rounded">
              <div className="text-slate-500">Cost</div>
              <div className={`font-bold ${result.totalCostUSD > 1 ? 'text-amber-400' : 'text-emerald-400'}`}>
                ${result.totalCostUSD.toFixed(4)}
              </div>
            </div>
            <div className="bg-slate-800 p-2 rounded">
              <div className="text-slate-500">Tokens</div>
              <div className="font-bold text-cyan-400">{result.totalTokensUsed.toLocaleString()}</div>
            </div>
          </div>
          <div className="text-[8px] text-slate-500">
            Time: {(result.timeElapsedMs / 1000).toFixed(1)}s
          </div>
        </div>
      )}

      {/* Phases */}
      <div className="flex-1 overflow-y-auto space-y-1 px-3 py-2">
        {result?.completedPhases.map((phase) => (
          <div key={phase.phaseNumber} className="bg-slate-900 border border-slate-800 rounded">
            <button
              onClick={() => setExpandedPhase(
                expandedPhase === phase.phaseNumber ? null : phase.phaseNumber
              )}
              className="w-full p-2 text-left flex items-center justify-between hover:bg-slate-800/50 transition"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[9px] font-bold text-indigo-400">
                  Phase {phase.phaseNumber + 1}
                </span>
                <span className="text-[8px] text-slate-500 truncate">
                  {phase.phaseName}
                </span>
              </div>
              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                <span className="text-[8px] font-bold text-emerald-400">
                  ✓ {phase.agentResults.size}
                </span>
                <span className="text-[9px] text-slate-500">
                  {expandedPhase === phase.phaseNumber ? '▼' : '▶'}
                </span>
              </div>
            </button>

            {expandedPhase === phase.phaseNumber && (
              <div className="border-t border-slate-800 p-2 space-y-1 bg-slate-900/50">
                {Array.from(phase.agentResults.values()).map((agent) => (
                  <div key={agent.agentId} className="text-[8px] bg-slate-800/50 p-1.5 rounded flex items-center justify-between">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        agent.status === 'completed' ? 'bg-emerald-500' :
                        agent.status === 'failed' ? 'bg-red-500' :
                        'bg-slate-500'
                      }`} />
                      <span className="text-slate-400 truncate">{agent.agentName}</span>
                    </div>
                    <span className="text-slate-500 ml-1 flex-shrink-0">
                      ${agent.costUSD.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent Logs */}
      <div className="border-t border-slate-700 max-h-24 overflow-y-auto bg-slate-900/30 px-3 py-2">
        <div className="text-[8px] space-y-1 font-mono">
          {log.slice(0, 5).map((line, i) => (
            <div
              key={i}
              className={`text-slate-500 ${
                line.includes('ERROR') ? 'text-red-400' :
                line.includes('✓') || line.includes('✅') ? 'text-emerald-400' :
                line.includes('⚠') ? 'text-amber-400' :
                'text-slate-500'
              }`}
            >
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* Health Status */}
      {healthMetrics && (
        <div className="border-t border-slate-700 bg-slate-900/50 px-3 py-2">
          <button
            onClick={() => setShowHealthDetails(!showHealthDetails)}
            className="w-full text-left flex items-center justify-between hover:bg-slate-800/30 transition"
          >
            <div className="flex items-center gap-2 text-[9px]">
              <span className={`w-2 h-2 rounded-full ${
                healthMetrics.status === 'healthy' ? 'bg-emerald-500' :
                healthMetrics.status === 'degraded' ? 'bg-amber-500' :
                'bg-red-500'
              }`} />
              <span className="font-bold text-slate-400 uppercase">{healthMetrics.status}</span>
            </div>
            <span className="text-[8px] text-slate-500">
              {showHealthDetails ? '▼' : '▶'}
            </span>
          </button>

          {showHealthDetails && (
            <div className="mt-1 pt-1 border-t border-slate-700 space-y-1 text-[8px]">
              {Object.entries(healthMetrics.checks).map(([name, check]) => (
                <div key={name} className="flex items-center justify-between text-slate-500">
                  <span>{name}</span>
                  <span className={check.status === 'ok' ? 'text-emerald-400' : 'text-amber-400'}>
                    {check.latency ? `${check.latency.toFixed(0)}ms` : 'ok'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Summary */}
      {result?.errors && result.errors.length > 0 && (
        <div className="border-t border-slate-700 bg-red-950/30 px-3 py-2">
          <div className="text-[8px] font-bold text-red-400 uppercase mb-1">
            {result.errors.length} Error{result.errors.length > 1 ? 's' : ''}
          </div>
          <div className="text-[8px] text-red-400/70 space-y-0.5">
            {result.errors.slice(0, 2).map((error, i) => (
              <div key={i} className="truncate">{error}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrchestrationDashboard;
