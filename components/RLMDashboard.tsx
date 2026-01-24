/**
 * RLMDashboard Component
 * 
 * Visual dashboard for RLM context compression metrics
 * Shows token savings, compression ratio, and contextual snapshots
 * 
 * Props:
 * - compressionMetrics: CompressionMetrics - Current compression state
 * - snapshot: ContextSnapshot | null - Current compressed state
 * - isEnabled: boolean - Whether RLM is active
 * - onToggleRLM: () => void - Enable/disable RLM
 */

import React from 'react';
import { CompressionMetrics, ContextSnapshot } from '../types';

interface RLMDashboardProps {
  compressionMetrics: CompressionMetrics | null;
  snapshot: ContextSnapshot | null;
  isEnabled: boolean;
  onToggleRLM: (enabled: boolean) => void;
  totalPhases: number;
}

export const RLMDashboard: React.FC<RLMDashboardProps> = ({
  compressionMetrics,
  snapshot,
  isEnabled,
  onToggleRLM,
  totalPhases
}) => {
  const getCompressionColor = (percent: number) => {
    if (percent >= 30) return 'text-green-400';
    if (percent >= 20) return 'text-emerald-400';
    if (percent >= 10) return 'text-amber-400';
    return 'text-orange-400';
  };

  const getCompressionBgColor = (percent: number) => {
    if (percent >= 30) return 'bg-green-500/20';
    if (percent >= 20) return 'bg-emerald-500/20';
    if (percent >= 10) return 'bg-amber-500/20';
    return 'bg-orange-500/20';
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-lg font-semibold text-white">RLM Context Compression</div>
          <div className="text-xs font-mono bg-slate-700/50 px-2 py-1 rounded text-slate-300">
            {isEnabled ? 'ACTIVE' : 'DISABLED'}
          </div>
        </div>
        <button
          onClick={() => onToggleRLM(!isEnabled)}
          className={`px-3 py-1 rounded text-sm font-medium transition-all ${
            isEnabled
              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
          }`}
        >
          {isEnabled ? 'Disable' : 'Enable'}
        </button>
      </div>

      {/* Main Metrics Grid */}
      {compressionMetrics ? (
        <div className="grid grid-cols-2 gap-3">
          {/* Token Reduction */}
          <div className={`p-3 rounded border border-slate-600 ${getCompressionBgColor(compressionMetrics.reductionPercent)}`}>
            <div className="text-xs text-slate-400 mb-1">Token Reduction</div>
            <div className={`text-2xl font-bold ${getCompressionColor(compressionMetrics.reductionPercent)}`}>
              {compressionMetrics.reductionPercent.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {compressionMetrics.tokensSaved.toLocaleString()} tokens saved
            </div>
          </div>

          {/* Cost Savings */}
          <div className="p-3 rounded border border-slate-600 bg-emerald-500/10">
            <div className="text-xs text-slate-400 mb-1">Cost Saved</div>
            <div className="text-2xl font-bold text-emerald-400">
              ${compressionMetrics.estimatedCostSaved.toFixed(3)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Per run</div>
          </div>

          {/* Original Size */}
          <div className="p-3 rounded border border-slate-600 bg-slate-700/30">
            <div className="text-xs text-slate-400 mb-1">Original Size</div>
            <div className="text-xl font-mono text-slate-300">
              {compressionMetrics.originalTokens.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">tokens</div>
          </div>

          {/* Compressed Size */}
          <div className="p-3 rounded border border-slate-600 bg-slate-700/30">
            <div className="text-xs text-slate-400 mb-1">Compressed Size</div>
            <div className="text-xl font-mono text-slate-300">
              {compressionMetrics.compressedTokens.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">tokens</div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded border border-slate-600 bg-slate-700/20 text-center">
          <div className="text-sm text-slate-400">
            {isEnabled ? 'Compression metrics pending...' : 'Enable RLM to track compression metrics'}
          </div>
        </div>
      )}

      {/* Compression Progress Bar */}
      {compressionMetrics && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-xs text-slate-400">Compression Ratio</div>
            <div className="text-xs font-mono text-slate-300">
              {((compressionMetrics.compressedTokens / compressionMetrics.originalTokens) * 100).toFixed(1)}%
            </div>
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getCompressionColor(compressionMetrics.reductionPercent)}`}
              style={{
                width: `${100 - (compressionMetrics.compressedTokens / compressionMetrics.originalTokens) * 100}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Snapshot Info */}
      {snapshot && (
        <div className="space-y-3 border-t border-slate-600 pt-4">
          <div className="text-sm font-medium text-slate-300">Current Snapshot</div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-700/30 p-2 rounded">
              <div className="text-slate-400">Phase</div>
              <div className="text-slate-200 font-mono">{snapshot.phaseNumber} / {totalPhases}</div>
            </div>
            <div className="bg-slate-700/30 p-2 rounded">
              <div className="text-slate-400">Timestamp</div>
              <div className="text-slate-200 font-mono">
                {new Date(snapshot.timestamp).toLocaleTimeString()}
              </div>
            </div>
            <div className="bg-slate-700/30 p-2 rounded">
              <div className="text-slate-400">Open Issues</div>
              <div className="text-slate-200 font-mono">{snapshot.openIssues.length}</div>
            </div>
            <div className="bg-slate-700/30 p-2 rounded">
              <div className="text-slate-400">Constraints</div>
              <div className="text-slate-200 font-mono">{snapshot.constraints.length}</div>
            </div>
          </div>

          {/* Snapshot Contents Preview */}
          <div className="space-y-2">
            {snapshot.constraints.length > 0 && (
              <div className="text-xs">
                <div className="text-slate-400 mb-1">Key Constraints:</div>
                <div className="text-slate-300 text-xs space-y-0.5">
                  {snapshot.constraints.slice(0, 3).map((c, i) => (
                    <div key={i} className="text-slate-400">
                      • {c.substring(0, 60)}
                      {c.length > 60 ? '...' : ''}
                    </div>
                  ))}
                  {snapshot.constraints.length > 3 && (
                    <div className="text-slate-500 italic">
                      +{snapshot.constraints.length - 3} more constraints
                    </div>
                  )}
                </div>
              </div>
            )}

            {snapshot.openIssues.length > 0 && (
              <div className="text-xs">
                <div className="text-slate-400 mb-1">Open Issues:</div>
                <div className="text-slate-300 text-xs space-y-0.5">
                  {snapshot.openIssues.slice(0, 2).map((issue, i) => (
                    <div key={i} className="text-slate-400">
                      • {issue.substring(0, 60)}
                      {issue.length > 60 ? '...' : ''}
                    </div>
                  ))}
                  {snapshot.openIssues.length > 2 && (
                    <div className="text-slate-500 italic">
                      +{snapshot.openIssues.length - 2} more issues
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cost Breakdown */}
          {Object.keys(snapshot.costBreakdown).length > 0 && (
            <div className="text-xs">
              <div className="text-slate-400 mb-1">Cost Breakdown by Phase:</div>
              <div className="text-slate-300 text-xs space-y-0.5">
                {Object.entries(snapshot.costBreakdown).map(([phase, cost]) => (
                  <div key={phase} className="flex justify-between">
                    <span className="text-slate-400">{phase}:</span>
                    <span className="text-slate-300 font-mono">${cost.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feature Info */}
      <div className="border-t border-slate-600 pt-3 text-xs text-slate-400 space-y-1">
        <div>✓ 20-30% token reduction on long projects (5+ phases)</div>
        <div>✓ Prevents context rot and output degradation</div>
        <div>✓ Reduces API latency by caching compressed context</div>
      </div>
    </div>
  );
};

export default RLMDashboard;
