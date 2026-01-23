import React, { useState, useEffect } from 'react';

interface RLMSnapshot {
  id: string;
  phaseNumber: number;
  timestamp: Date;
  architectureDecisions: string;
  implementationPatterns: string;
  constraints: string[];
  openIssues: string[];
  originalTokenCount: number;
  compressedTokenCount: number;
  reductionPercent: number;
  estimatedCostSaved: number;
}

interface RLMDashboardImplProps {
  snapshots: RLMSnapshot[];
  currentPhase: number;
  isCompressing: boolean;
  onCompress: () => void;
  onQuerySnapshot: (query: string) => void;
}

const RLMDashboardImpl: React.FC<RLMDashboardImplProps> = ({
  snapshots,
  currentPhase,
  isCompressing,
  onCompress,
  onQuerySnapshot,
}) => {
  const [selectedSnapshot, setSelectedSnapshot] = useState<RLMSnapshot | null>(
    snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  );
  const [queryInput, setQueryInput] = useState('');
  const [totalSavings, setTotalSavings] = useState(0);

  useEffect(() => {
    const total = snapshots.reduce((sum, s) => sum + s.estimatedCostSaved, 0);
    setTotalSavings(total);
  }, [snapshots]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '16px',
      background: '#111827',
      borderRadius: '8px',
      border: '1px solid #6366f133',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h3 style={{ margin: 0, color: '#f3f4f6', fontSize: '16px' }}>
            🧠 RLM Context Compression
          </h3>
          <p style={{ margin: '4px 0 0 0', color: '#8b949e', fontSize: '12px' }}>
            Compress conversation history for long projects
          </p>
        </div>
        <button
          onClick={onCompress}
          disabled={isCompressing}
          style={{
            padding: '8px 16px',
            background: isCompressing ? '#6272a4' : '#6366f1',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: isCompressing ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {isCompressing ? '⏳ Compressing...' : '💾 Create Snapshot'}
        </button>
      </div>

      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
      }}>
        <StatCard label="Snapshots" value={snapshots.length} />
        <StatCard label="Tokens Saved" value={`${snapshots.reduce((s, snap) => s + (snap.originalTokenCount - snap.compressedTokenCount), 0)}`} />
        <StatCard label="Cost Saved" value={`$${totalSavings.toFixed(2)}`} />
        <StatCard label="Current Phase" value={currentPhase} />
      </div>

      {/* Snapshots List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxHeight: '200px',
        overflowY: 'auto',
      }}>
        <label style={{ color: '#8b949e', fontSize: '12px', fontWeight: 500 }}>
          Recent Snapshots
        </label>
        {snapshots.map((snap) => (
          <div
            key={snap.id}
            onClick={() => setSelectedSnapshot(snap)}
            style={{
              padding: '8px 12px',
              background: selectedSnapshot?.id === snap.id ? '#3b4252' : '#161b22',
              border: `1px solid ${selectedSnapshot?.id === snap.id ? '#6366f1' : '#30363d'}`,
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <p style={{ margin: 0, color: '#c9d1d9', fontSize: '12px', fontWeight: 500 }}>
                  Phase {snap.phaseNumber}
                </p>
                <p style={{ margin: '2px 0 0 0', color: '#8b949e', fontSize: '11px' }}>
                  {snap.timestamp.toLocaleTimeString()}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, color: '#6366f1', fontSize: '11px' }}>
                  {snap.reductionPercent.toFixed(0)}% reduction
                </p>
                <p style={{ margin: '2px 0 0 0', color: '#85e89d', fontSize: '11px' }}>
                  Save ${snap.estimatedCostSaved.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Snapshot Details */}
      {selectedSnapshot && (
        <div style={{
          padding: '12px',
          background: '#161b22',
          borderRadius: '4px',
          border: '1px solid #30363d',
        }}>
          <p style={{ margin: '0 0 8px 0', color: '#c9d1d9', fontSize: '13px', fontWeight: 500 }}>
            Phase {selectedSnapshot.phaseNumber} Context
          </p>

          <div style={{ fontSize: '11px', color: '#8b949e', lineHeight: '1.6' }}>
            <p><strong>Architecture:</strong> {selectedSnapshot.architectureDecisions.substring(0, 100)}...</p>
            <p><strong>Patterns:</strong> {selectedSnapshot.implementationPatterns.substring(0, 100)}...</p>
            <p><strong>Compression:</strong> {selectedSnapshot.originalTokenCount} → {selectedSnapshot.compressedTokenCount} tokens</p>
            <p><strong>Cost Saved:</strong> ${selectedSnapshot.estimatedCostSaved.toFixed(2)}</p>
          </div>

          {selectedSnapshot.constraints.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <p style={{ margin: '0 0 4px 0', color: '#85e89d', fontSize: '11px' }}>Constraints:</p>
              <ul style={{ margin: '0', paddingLeft: '16px', fontSize: '10px', color: '#8b949e' }}>
                {selectedSnapshot.constraints.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {selectedSnapshot.openIssues.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <p style={{ margin: '0 0 4px 0', color: '#f85149', fontSize: '11px' }}>Open Issues:</p>
              <ul style={{ margin: '0', paddingLeft: '16px', fontSize: '10px', color: '#8b949e' }}>
                {selectedSnapshot.openIssues.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Query Section */}
      <div style={{
        padding: '12px',
        background: '#161b22',
        borderRadius: '4px',
        border: '1px solid #30363d',
      }}>
        <label style={{ color: '#8b949e', fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '8px' }}>
          Query Snapshot Context
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="What do you want to know? (e.g., 'database schema')"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && queryInput.trim()) {
                onQuerySnapshot(queryInput);
                setQueryInput('');
              }
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: '4px',
              color: '#c9d1d9',
              fontSize: '12px',
            }}
          />
          <button
            onClick={() => {
              if (queryInput.trim()) {
                onQuerySnapshot(queryInput);
                setQueryInput('');
              }
            }}
            style={{
              padding: '8px 12px',
              background: '#6366f1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            🔍 Query
          </button>
        </div>
      </div>

      {/* Compression Benefits */}
      <div style={{
        padding: '12px',
        background: '#161b22',
        borderRadius: '4px',
        border: '1px solid #30363d',
        fontSize: '11px',
        color: '#8b949e',
      }}>
        <p style={{ margin: 0, marginBottom: '8px', fontWeight: 500, color: '#85e89d' }}>
          💡 RLM Benefits for Long Projects:
        </p>
        <ul style={{ margin: 0, paddingLeft: '16px' }}>
          <li>20-30% fewer tokens needed</li>
          <li>Better output quality (more tokens for current phase)</li>
          <li>Faster API responses</li>
          <li>Lower costs (~$0.30-0.50 savings per run)</li>
          <li>Sub-query capability for specific details</li>
        </ul>
      </div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string | number;
}

const StatCard: React.FC<StatCardProps> = ({ label, value }) => (
  <div style={{
    padding: '12px',
    background: '#161b22',
    borderRadius: '4px',
    border: '1px solid #30363d',
    textAlign: 'center',
  }}>
    <p style={{ margin: 0, color: '#8b949e', fontSize: '11px', fontWeight: 500 }}>
      {label}
    </p>
    <p style={{ margin: '4px 0 0 0', color: '#6366f1', fontSize: '16px', fontWeight: 600 }}>
      {value}
    </p>
  </div>
);

export default RLMDashboardImpl;
