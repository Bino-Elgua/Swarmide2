import React, { useState, useCallback } from 'react';
import { appIntegration, ExecutionResult } from '../services/appIntegration';
import { Agent } from '../types';

interface ExecutionEngineProps {
  prompt: string;
  registry: Agent[];
  onExecutionStart?: () => void;
  onExecutionComplete?: (result: ExecutionResult) => void;
  onError?: (error: Error) => void;
}

const ExecutionEngine: React.FC<ExecutionEngineProps> = ({
  prompt,
  registry,
  onExecutionStart,
  onExecutionComplete,
  onError,
}) => {
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState('');

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
  }, []);

  const startExecution = useCallback(async () => {
    if (executing || !prompt.trim()) return;

    setExecuting(true);
    setLogs([]);
    setResult(null);
    onExecutionStart?.();

    try {
      addLog('🚀 Starting execution pipeline...');
      setCurrentStep('Initializing...');

      const execResult = await appIntegration.executeProject(
        prompt,
        'current-user',
        registry
      );

      setResult(execResult);
      setCurrentStep('Complete');

      if (execResult.success) {
        addLog('✅ Execution completed successfully');
        addLog(`📊 Execution time: ${execResult.executionTime}ms`);
        addLog(`💰 Cost: $${execResult.cost.totalCost.toFixed(4)}`);
        addLog(`💡 Proposals: ${execResult.proposals.length}`);
        onExecutionComplete?.(execResult);
      } else {
        addLog(`❌ Execution failed: ${execResult.error}`);
        onError?.(new Error(execResult.error || 'Unknown error'));
      }
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
      setCurrentStep('Error');
      onError?.(error);
    } finally {
      setExecuting(false);
    }
  }, [prompt, registry, executing, addLog, onExecutionStart, onExecutionComplete, onError]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#0a0e27',
      color: '#e0e0e0',
      fontFamily: 'monospace',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px',
        backgroundColor: '#1a2847',
        borderBottom: '1px solid #333',
      }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
          🔧 EXECUTION ENGINE
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          {executing ? '⚙️ RUNNING' : currentStep ? `✅ ${currentStep}` : '⏹️ IDLE'}
        </div>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        fontSize: '11px',
        backgroundColor: '#0f1419',
      }}>
        {logs.map((log, idx) => (
          <div key={idx} style={{ marginBottom: '4px' }}>
            {log}
          </div>
        ))}
      </div>

      <div style={{
        padding: '12px',
        backgroundColor: '#1a2847',
        borderTop: '1px solid #333',
        display: 'flex',
        gap: '8px',
      }}>
        <button
          onClick={startExecution}
          disabled={executing || !prompt.trim()}
          style={{
            padding: '8px 16px',
            backgroundColor: executing ? '#444' : '#00ff41',
            color: executing ? '#888' : '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: executing ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '11px',
          }}
        >
          {executing ? '⏳ EXECUTING...' : '▶️ START'}
        </button>
        <button
          onClick={() => setLogs([])}
          style={{
            padding: '8px 16px',
            backgroundColor: '#666',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '11px',
          }}
        >
          🧹 CLEAR
        </button>
      </div>
    </div>
  );
};

export default ExecutionEngine;
