import React, { useMemo } from 'react';
import { CostMetrics } from '../types';

interface CostTrackerProps {
  metrics: CostMetrics[];
  budgetUSD?: number;
  maxCost?: number;
}

interface FormattedMetrics {
  totalCost: number;
  totalTokens: number;
  averageTokenPrice: number;
  byPhase: Record<number, { cost: number; tokens: number }>;
  byAgent: Record<string, { cost: number; tokens: number }>;
}

const CostTracker: React.FC<CostTrackerProps> = ({ metrics, budgetUSD, maxCost = 10 }) => {
  const formatted = useMemo(() => {
    const totalCost = metrics.reduce((sum, m) => sum + m.costUSD, 0);
    const totalTokens = metrics.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);
    const averageTokenPrice = totalTokens > 0 ? (totalCost / totalTokens) * 1000 : 0;

    const byPhase: Record<number, { cost: number; tokens: number }> = {};
    const byAgent: Record<string, { cost: number; tokens: number }> = {};

    metrics.forEach(m => {
      const phase = m.phaseNumber ?? 0;
      const agent = m.agentName ?? 'unknown';
      const tokens = m.inputTokens + m.outputTokens;

      if (!byPhase[phase]) byPhase[phase] = { cost: 0, tokens: 0 };
      byPhase[phase].cost += m.costUSD;
      byPhase[phase].tokens += tokens;

      if (!byAgent[agent]) byAgent[agent] = { cost: 0, tokens: 0 };
      byAgent[agent].cost += m.costUSD;
      byAgent[agent].tokens += tokens;
    });

    return {
      totalCost: parseFloat(totalCost.toFixed(2)),
      totalTokens,
      averageTokenPrice: parseFloat(averageTokenPrice.toFixed(4)),
      byPhase,
      byAgent
    };
  }, [metrics]);

  const percentUsed = budgetUSD ? (formatted.totalCost / budgetUSD * 100) : (formatted.totalCost / maxCost * 100);
  const isOverBudget = budgetUSD && formatted.totalCost > budgetUSD;
  const isWarning = budgetUSD && formatted.totalCost > budgetUSD * 0.8;

  return (
    <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-4">
      <h4 className="text-xs font-black uppercase text-indigo-400">Cost Tracking</h4>
      
      <div className="space-y-2">
        <div className="flex justify-between text-[10px]">
          <span className="text-slate-400">Total Cost</span>
          <span className={`font-bold ${isOverBudget ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-white'}`}>
            ${formatted.totalCost.toFixed(2)}
          </span>
        </div>
        <div className="w-full h-2 bg-slate-900 rounded overflow-hidden">
          <div 
            className={`h-full transition-all ${
              isOverBudget ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
            }`} 
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
        {budgetUSD && (
          <div className="flex justify-between text-[9px] text-slate-500">
            <span>${formatted.totalCost.toFixed(2)} / ${budgetUSD.toFixed(2)}</span>
            <span>{percentUsed.toFixed(0)}%</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[9px]">
        <div className="bg-slate-900 p-2 rounded">
          <div className="text-slate-500 uppercase">Tokens</div>
          <div className="text-white font-bold">{formatted.totalTokens.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900 p-2 rounded">
          <div className="text-slate-500 uppercase">$/1k tokens</div>
          <div className="text-white font-bold">${(formatted.averageTokenPrice).toFixed(4)}</div>
        </div>
      </div>

      {Object.keys(formatted.byAgent).length > 0 && (
        <div className="border-t border-slate-800 pt-2">
          <div className="text-[9px] font-bold text-slate-400 uppercase mb-2">By Agent</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {Object.entries(formatted.byAgent).map(([agent, data]) => (
              <div key={agent} className="flex justify-between text-[8px] text-slate-500 bg-slate-900/50 p-1.5 rounded">
                <span className="truncate">{agent}</span>
                <span className="font-bold text-indigo-400">${data.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOverBudget && (
        <div className="bg-red-500/10 border border-red-500/50 rounded p-2 text-[9px] text-red-400">
          <strong>⚠️ Budget Exceeded</strong> — ${(formatted.totalCost - (budgetUSD || 0)).toFixed(2)} over limit
        </div>
      )}

      {isWarning && !isOverBudget && (
        <div className="bg-amber-500/10 border border-amber-500/50 rounded p-2 text-[9px] text-amber-400">
          <strong>⚡ Budget Warning</strong> — {(100 - percentUsed).toFixed(0)}% remaining
        </div>
      )}
    </div>
  );
};

export default CostTracker;
