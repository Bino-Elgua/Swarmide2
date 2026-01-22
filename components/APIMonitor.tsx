/**
 * API Monitor Dashboard
 * Real-time monitoring of API calls, statistics, and performance
 */

import React, { useState, useEffect } from 'react';
import { apiErrorHandler, APICall } from '../services/apiErrorHandler';

interface APIMonitorProps {
  isVisible?: boolean;
  autoRefresh?: number; // ms
}

const APIMonitor: React.FC<APIMonitorProps> = ({ 
  isVisible = true, 
  autoRefresh = 5000 
}) => {
  const [history, setHistory] = useState<APICall[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisible) return;

    const updateData = () => {
      const allHistory = apiErrorHandler.getCallHistory();
      const filteredHistory = allHistory.filter(call => {
        if (filter === 'success') return call.status === 'success';
        if (filter === 'error') return call.status === 'error';
        return true;
      });

      setHistory(filteredHistory.reverse());
      setStats(apiErrorHandler.getStats());
    };

    updateData();

    if (autoRefresh > 0) {
      const interval = setInterval(updateData, autoRefresh);
      return () => clearInterval(interval);
    }
  }, [isVisible, autoRefresh, filter]);

  if (!isVisible || !stats) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-96 max-h-96 bg-slate-950 border-2 border-slate-700 rounded-lg p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-700">
        <h3 className="text-sm font-bold text-slate-300 uppercase">API Monitor</h3>
        <button
          onClick={() => setFilter(filter === 'all' ? 'success' : filter === 'success' ? 'error' : 'all')}
          className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-400 transition-colors"
        >
          Filter: {filter}
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-slate-900 p-2 rounded">
          <div className="text-slate-500 uppercase font-semibold">Requests</div>
          <div className="text-white font-bold text-lg">{stats.total}</div>
        </div>
        <div className="bg-emerald-900 p-2 rounded">
          <div className="text-emerald-400 uppercase font-semibold">Success</div>
          <div className="text-emerald-300 font-bold">{stats.successful}</div>
        </div>
        <div className="bg-red-900 p-2 rounded">
          <div className="text-red-400 uppercase font-semibold">Errors</div>
          <div className="text-red-300 font-bold">{stats.failed}</div>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-900 p-2 rounded">
          <div className="text-slate-500 uppercase font-semibold">Avg Duration</div>
          <div className="text-white font-mono">{stats.avgDuration}</div>
        </div>
        <div className="bg-slate-900 p-2 rounded">
          <div className="text-slate-500 uppercase font-semibold">Success Rate</div>
          <div className="text-white font-mono">{stats.successRate}</div>
        </div>
        <div className="bg-amber-900 p-2 rounded">
          <div className="text-amber-400 uppercase font-semibold">Cost</div>
          <div className="text-amber-300 font-mono">${stats.totalCost}</div>
        </div>
        <div className="bg-blue-900 p-2 rounded">
          <div className="text-blue-400 uppercase font-semibold">Tokens</div>
          <div className="text-blue-300 font-mono">{stats.totalTokens.toLocaleString()}</div>
        </div>
      </div>

      {/* Call History */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-400 uppercase">Recent Calls</h4>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {history.slice(0, 10).map((call) => (
            <CallItem
              key={call.id}
              call={call}
              isExpanded={expandedCall === call.id}
              onToggle={() =>
                setExpandedCall(expandedCall === call.id ? null : call.id)
              }
            />
          ))}
          {history.length === 0 && (
            <div className="text-xs text-slate-500 p-2">No API calls yet</div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="pt-2 border-t border-slate-700 space-y-1">
        <button
          onClick={() => {
            const logs = apiErrorHandler.exportLogs();
            const blob = new Blob([logs], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `api-logs-${Date.now()}.json`;
            a.click();
          }}
          className="w-full px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-300 transition-colors"
        >
          📥 Export Logs
        </button>
      </div>
    </div>
  );
};

interface CallItemProps {
  call: APICall;
  isExpanded: boolean;
  onToggle: () => void;
}

const CallItem: React.FC<CallItemProps> = ({ call, isExpanded, onToggle }) => {
  const statusColor = {
    success: 'text-emerald-400 bg-emerald-950',
    error: 'text-red-400 bg-red-950',
    pending: 'text-amber-400 bg-amber-950',
    timeout: 'text-red-400 bg-red-950',
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'timeout':
        return '⏱';
      default:
        return '⏳';
    }
  };

  return (
    <div
      className="text-xs border border-slate-700 rounded p-2 cursor-pointer hover:bg-slate-800 transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <span className={`font-bold w-4 ${statusColor[call.status as keyof typeof statusColor]}`}>
            {getStatusIcon(call.status)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-200 truncate">
              {call.service}/{call.method}
            </div>
            <div className="text-slate-500 text-xs">
              {call.duration}ms • {new Date(call.startTime).toLocaleTimeString()}
            </div>
          </div>
        </div>
        {call.costUSD !== undefined && (
          <div className="text-amber-400 font-mono whitespace-nowrap">
            ${call.costUSD.toFixed(4)}
          </div>
        )}
      </div>

      {isExpanded && call.error && (
        <div className="mt-2 pt-2 border-t border-slate-700 space-y-1">
          <div className="bg-red-950 border border-red-700 p-1 rounded text-red-200">
            <div className="font-semibold text-xs">{call.error.code}</div>
            <div className="text-xs opacity-90">{call.error.message}</div>
          </div>

          {call.error.context && Object.keys(call.error.context).length > 0 && (
            <pre className="bg-black bg-opacity-30 p-1 rounded text-xs overflow-x-auto text-slate-300">
              {JSON.stringify(call.error.context, null, 2)}
            </pre>
          )}
        </div>
      )}

      {isExpanded && call.status === 'success' && (
        <div className="mt-2 pt-2 border-t border-slate-700 text-xs text-slate-400 space-y-1">
          {call.tokensUsed && (
            <div>Tokens: {call.tokensUsed.toLocaleString()}</div>
          )}
          {call.costUSD && (
            <div>Cost: ${call.costUSD.toFixed(4)}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default APIMonitor;
