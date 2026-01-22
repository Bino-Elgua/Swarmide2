/**
 * Health Monitor Component
 * Displays API health status, errors, and warnings in real-time
 */

import React, { useState, useEffect } from 'react';
import { HealthMetrics, CheckResult, ErrorLog } from '../services/healthCheck';
import { healthCheck } from '../services/healthCheck';

interface HealthMonitorProps {
  isVisible?: boolean;
  autoRefresh?: number; // ms, 0 to disable
}

const HealthMonitor: React.FC<HealthMonitorProps> = ({ 
  isVisible = true, 
  autoRefresh = 30000 
}) => {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisible) return;

    const fetchMetrics = async () => {
      const health = await healthCheck.runFullCheck();
      setMetrics(health);
    };

    fetchMetrics();

    if (autoRefresh > 0) {
      const interval = setInterval(fetchMetrics, autoRefresh);
      return () => clearInterval(interval);
    }
  }, [isVisible, autoRefresh]);

  if (!isVisible || !metrics) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'bg-emerald-900 border-emerald-500 text-emerald-100';
      case 'warning':
        return 'bg-amber-900 border-amber-500 text-amber-100';
      case 'error':
        return 'bg-red-900 border-red-500 text-red-100';
      default:
        return 'bg-slate-900 border-slate-500 text-slate-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return '✓';
      case 'warning':
        return '⚠';
      case 'error':
        return '✕';
      default:
        return '?';
    }
  };

  const statusBgColor = {
    healthy: 'bg-emerald-950',
    degraded: 'bg-amber-950',
    unhealthy: 'bg-red-950',
  };

  const statusTextColor = {
    healthy: 'text-emerald-400',
    degraded: 'text-amber-400',
    unhealthy: 'text-red-400',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      {/* Collapsed Summary */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full px-4 py-2 rounded-lg border-2 transition-all ${statusBgColor[metrics.status]} ${statusTextColor[metrics.status]}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">{getStatusIcon(metrics.status)}</span>
            <span className="text-sm font-semibold uppercase">{metrics.status}</span>
          </div>
          <span className="text-xs opacity-75">
            {metrics.errors.length} errors • {metrics.warnings.length} warnings
          </span>
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-2 bg-slate-950 border-2 border-slate-700 rounded-lg p-4 space-y-4 max-h-96 overflow-y-auto">
          {/* Uptime */}
          <div className="text-xs text-slate-400">
            Uptime: {Math.floor(metrics.uptime / 1000)}s
          </div>

          {/* Health Checks */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase">Health Checks</h4>
            {Object.entries(metrics.checks).map(([name, check]) => (
              <div
                key={name}
                className={`p-2 rounded border ${getStatusColor(check.status)} text-xs`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold">{getStatusIcon(check.status)}</span>
                    <span className="font-semibold ml-1 capitalize">{name}</span>
                  </div>
                  {check.latency && (
                    <span className="opacity-75">{check.latency.toFixed(0)}ms</span>
                  )}
                </div>
                <div className="mt-1 opacity-90">{check.message}</div>
              </div>
            ))}
          </div>

          {/* Errors */}
          {metrics.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-red-400 uppercase">Errors ({metrics.errors.length})</h4>
              {metrics.errors.slice(0, 3).map((error) => (
                <ErrorItem
                  key={error.id}
                  error={error}
                  isExpanded={expandedErrors === error.id}
                  onToggle={() =>
                    setExpandedErrors(
                      expandedErrors === error.id ? null : error.id
                    )
                  }
                />
              ))}
              {metrics.errors.length > 3 && (
                <div className="text-xs text-slate-500 p-2">
                  +{metrics.errors.length - 3} more errors
                </div>
              )}
            </div>
          )}

          {/* Warnings */}
          {metrics.warnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-amber-400 uppercase">Warnings ({metrics.warnings.length})</h4>
              {metrics.warnings.slice(0, 2).map((warning) => (
                <div
                  key={warning.id}
                  className="p-2 rounded bg-amber-950 border border-amber-700 text-xs text-amber-100"
                >
                  {warning.message}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t border-slate-700 space-y-1">
            <button
              onClick={() => {
                const diagnostics = healthCheck.exportDiagnostics();
                const blob = new Blob([diagnostics], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `health-diagnostics-${Date.now()}.json`;
                a.click();
              }}
              className="w-full px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-300 transition-colors"
            >
              📥 Export Diagnostics
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="w-full px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-300 transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface ErrorItemProps {
  error: ErrorLog;
  isExpanded: boolean;
  onToggle: () => void;
}

const ErrorItem: React.FC<ErrorItemProps> = ({ error, isExpanded, onToggle }) => {
  const severityColor = {
    critical: 'bg-red-950 border-red-600 text-red-100',
    high: 'bg-red-900 border-red-500 text-red-100',
    medium: 'bg-amber-900 border-amber-500 text-amber-100',
    low: 'bg-blue-900 border-blue-500 text-blue-100',
  };

  return (
    <div
      className={`p-2 rounded border cursor-pointer transition-all ${severityColor[error.severity]}`}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-bold text-xs">[{error.category.toUpperCase()}]</span>
          <span className="text-xs ml-1">{error.message}</span>
        </div>
        <span className="text-xs opacity-75">
          {new Date(error.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-current border-opacity-30 text-xs opacity-90 space-y-1">
          {error.context && (
            <pre className="bg-black bg-opacity-30 p-1 rounded overflow-x-auto text-xs">
              {JSON.stringify(error.context, null, 2)}
            </pre>
          )}
          {error.stack && (
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold">Stack Trace</summary>
              <pre className="mt-1 bg-black bg-opacity-30 p-1 rounded overflow-x-auto text-xs whitespace-pre-wrap break-words">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

export default HealthMonitor;
