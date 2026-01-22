import React, { useState } from 'react';
import { PRDItem, RalphCheckpoint } from '../services/ralphLoop';

interface RalphLoopPanelProps {
  prdItems: PRDItem[];
  isRunning: boolean;
  currentIteration: number;
  maxIterations: number;
  completionRate: number;
  checkpoints: RalphCheckpoint[];
  onStartRalphLoop: (items: PRDItem[]) => void;
  onLoadCheckpoint: (checkpoint: RalphCheckpoint) => void;
  onExportCheckpoints: (checkpoints: RalphCheckpoint[]) => void;
}

const RalphLoopPanel: React.FC<RalphLoopPanelProps> = ({
  prdItems,
  isRunning,
  currentIteration,
  maxIterations,
  completionRate,
  checkpoints,
  onStartRalphLoop,
  onLoadCheckpoint,
  onExportCheckpoints
}) => {
  const [prdInput, setPrdInput] = useState('');
  const [showPRDEditor, setShowPRDEditor] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<RalphCheckpoint | undefined>();

  const completed = prdItems.filter(p => p.completed);
  const remaining = prdItems.filter(p => !p.completed);

  const handleAddPRDItems = () => {
    const lines = prdInput
      .split('\n')
      .filter(l => l.trim())
      .map((line, idx) => ({
        id: `prd-${idx}-${Date.now()}`,
        description: line.replace(/^[\d.)\-*]\s+/, '').trim(),
        category: 'other' as const,
        completed: false,
        priority: 'medium' as const
      }));

    onStartRalphLoop(lines);
    setPrdInput('');
    setShowPRDEditor(false);
  };

  return (
    <div className="p-4 space-y-4 bg-black/30 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
          🔄 Ralph Loop: PRD-Driven Execution
        </h3>
        <span className="text-[10px] opacity-60">{currentIteration}/{maxIterations} iterations</span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-[9px] font-black uppercase opacity-60">
          <span>Completion</span>
          <span>{(completionRate * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-black/50 rounded-full h-2 overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
          <div
            className="h-full transition-all"
            style={{
              width: `${completionRate * 100}%`,
              backgroundColor: completionRate >= 0.95 ? '#10b981' : 'var(--accent)'
            }}
          />
        </div>
        <div className="flex justify-between text-[8px] opacity-50">
          <span>{completed.length} completed</span>
          <span>{remaining.length} remaining</span>
        </div>
      </div>

      {/* PRD Items Summary */}
      <div className="grid grid-cols-2 gap-3 text-[9px]">
        <div className="bg-black/40 rounded-lg p-3 border" style={{ borderColor: 'var(--border)' }}>
          <div className="font-bold uppercase opacity-60 mb-2">✓ Completed</div>
          <ul className="space-y-1 opacity-70">
            {completed.slice(0, 5).map(item => (
              <li key={item.id} className="truncate text-[8px] text-green-400">
                {item.description}
              </li>
            ))}
            {completed.length > 5 && <li className="text-[8px] opacity-40">+{completed.length - 5} more</li>}
          </ul>
        </div>

        <div className="bg-black/40 rounded-lg p-3 border" style={{ borderColor: 'var(--border)' }}>
          <div className="font-bold uppercase opacity-60 mb-2">⏳ Remaining</div>
          <ul className="space-y-1 opacity-70">
            {remaining.slice(0, 5).map(item => (
              <li key={item.id} className="truncate text-[8px] text-yellow-400">
                {item.description}
              </li>
            ))}
            {remaining.length > 5 && <li className="text-[8px] opacity-40">+{remaining.length - 5} more</li>}
          </ul>
        </div>
      </div>

      {/* Checkpoints */}
      {checkpoints.length > 0 && (
        <div className="bg-black/40 rounded-lg p-3 border" style={{ borderColor: 'var(--border)' }}>
          <div className="font-bold uppercase text-[9px] opacity-60 mb-2">📌 Checkpoints</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {checkpoints.map((cp, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSelectedCheckpoint(cp);
                  onLoadCheckpoint(cp);
                }}
                className={`w-full text-left text-[8px] p-2 rounded border transition-all ${
                  selectedCheckpoint?.iteration === cp.iteration
                    ? 'bg-indigo-600/30 border-indigo-500'
                    : 'bg-black/30 border-white/10 hover:border-indigo-500/50'
                }`}
              >
                <div className="font-bold">Iter {cp.iteration}: {(cp.completionRate * 100).toFixed(0)}%</div>
                <div className="opacity-60 text-[7px]">{cp.timestamp.toLocaleTimeString([], { hour12: false })}</div>
              </button>
            ))}
          </div>
          <button
            onClick={() => onExportCheckpoints(checkpoints)}
            className="w-full mt-2 px-3 py-1 text-[8px] font-bold uppercase rounded bg-indigo-600/20 border border-indigo-500/50 hover:bg-indigo-600/40 transition-colors"
          >
            💾 Export All Checkpoints
          </button>
        </div>
      )}

      {/* PRD Editor */}
      {showPRDEditor ? (
        <div className="space-y-2">
          <textarea
            value={prdInput}
            onChange={e => setPrdInput(e.target.value)}
            placeholder="Paste PRD items (one per line)&#10;Example:&#10;1. Build REST API&#10;2. Setup database schema&#10;3. Create auth system"
            className="w-full h-24 bg-black/50 border rounded-lg p-2 text-[9px] font-mono outline-none focus:border-indigo-500 resize-none"
            style={{ borderColor: 'var(--border)' }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddPRDItems}
              disabled={!prdInput.trim() || isRunning}
              className="flex-1 px-3 py-1 text-[9px] font-bold uppercase rounded bg-green-600/20 border border-green-500/50 hover:bg-green-600/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              🚀 Start Ralph Loop
            </button>
            <button
              onClick={() => {
                setShowPRDEditor(false);
                setPrdInput('');
              }}
              className="flex-1 px-3 py-1 text-[9px] font-bold uppercase rounded bg-black/40 border border-white/20 hover:border-white/40 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowPRDEditor(true)}
          disabled={isRunning}
          className="w-full px-3 py-2 text-[9px] font-bold uppercase rounded bg-indigo-600/30 border border-indigo-500/50 hover:bg-indigo-600/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          + Add PRD Items
        </button>
      )}

      {/* Info Box */}
      <div className="bg-black/40 rounded-lg p-2 border border-white/10 text-[8px] opacity-70">
        <div className="font-bold mb-1">How Ralph Loop Works:</div>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>Parses PRD items into categories (API, DB, Frontend, etc.)</li>
          <li>Iterates up to {maxIterations} times, refreshing context each iteration</li>
          <li>Prevents token overflow by starting fresh every cycle</li>
          <li>Creates checkpoints to resume from saved state</li>
          <li>Ideal for 100+ item projects</li>
        </ul>
      </div>
    </div>
  );
};

export default RalphLoopPanel;
