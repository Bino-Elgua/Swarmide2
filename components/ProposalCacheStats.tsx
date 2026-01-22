import React, { useState, useEffect } from 'react';
import { proposalCache } from '../services/proposalCache';
import type { ProposalCacheIndex, CachedProposal } from '../services/proposalCache';

interface ProposalCacheStatsProps {
  onClearCache?: () => void;
}

const ProposalCacheStats: React.FC<ProposalCacheStatsProps> = ({ onClearCache }) => {
  const [stats, setStats] = useState<ProposalCacheIndex | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const updateStats = () => {
      setStats(proposalCache.getStats());
    };
    updateStats();
    // Update every 10 seconds
    const interval = setInterval(updateStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!stats || stats.totalCached === 0) {
    return (
      <div className="p-3 bg-slate-900 border border-slate-700 rounded text-xs text-slate-400">
        No cached proposals yet
      </div>
    );
  }

  const handleClear = () => {
    proposalCache.clear();
    setStats(null);
    onClearCache?.();
  };

  return (
    <div className="space-y-3">
      {/* Summary Card */}
      <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg">
        <div className="flex justify-between items-start mb-3">
          <h4 className="text-xs font-bold uppercase text-emerald-400">Cache Statistics</h4>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-500 hover:text-slate-300 text-xs"
          >
            {isExpanded ? '−' : '+'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[10px]">
          <div>
            <div className="text-slate-500 uppercase mb-1">Total Cached</div>
            <div className="text-lg font-bold text-white">{stats.totalCached}</div>
          </div>
          <div>
            <div className="text-slate-500 uppercase mb-1">Hit Rate</div>
            <div className="text-lg font-bold text-emerald-400">
              {(stats.hitRate * 100).toFixed(0)}%
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-slate-500 uppercase mb-1">Avg Quality Score</div>
            <div className="text-lg font-bold text-indigo-400">
              {(stats.averageEvaluationScore * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        {isExpanded && (
          <button
            onClick={handleClear}
            className="mt-3 w-full px-2 py-1 text-[10px] bg-red-950 hover:bg-red-900 text-red-300 rounded transition"
          >
            Clear Cache
          </button>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <>
          {/* Top Proposals */}
          {stats.topProposals.length > 0 && (
            <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg">
              <h5 className="text-xs font-bold text-emerald-400 mb-2 uppercase">Top Proposals</h5>
              <div className="space-y-2 text-[9px]">
                {stats.topProposals.slice(0, 5).map((p, i) => (
                  <div key={p.cacheKey} className="p-2 bg-slate-800 rounded border border-slate-700">
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 font-bold">{i + 1}. {p.agentName}</span>
                      <span className="text-emerald-400">
                        {(proposalCache.getSuccessScore(p.cacheKey) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-slate-500 truncate">{p.architecture.slice(0, 50)}...</div>
                    <div className="text-slate-600 mt-1">Hits: {p.hitCount}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recently Used */}
          {stats.recentlyUsed.length > 0 && (
            <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg">
              <h5 className="text-xs font-bold text-blue-400 mb-2 uppercase">Recently Used</h5>
              <div className="space-y-2 text-[9px]">
                {stats.recentlyUsed.slice(0, 3).map(p => (
                  <div key={p.cacheKey} className="p-2 bg-slate-800 rounded border border-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-300">{p.agentName}</span>
                      <span className="text-slate-500">
                        {p.lastAccessed.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProposalCacheStats;
