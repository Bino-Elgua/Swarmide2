import React, { useState } from 'react';
import { PRDItem, RalphCheckpoint } from '../services/ralphLoop';

interface RalphLoopProgressImplProps {
  prdItems: PRDItem[];
  currentIteration: number;
  maxIterations: number;
  completionRate: number;
  checkpoints: RalphCheckpoint[];
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

const RalphLoopProgressImpl: React.FC<RalphLoopProgressImplProps> = ({
  prdItems,
  currentIteration,
  maxIterations,
  completionRate,
  checkpoints,
  isRunning,
  onStart,
  onPause,
  onResume,
  onStop,
}) => {
  const [activeTab, setActiveTab] = useState<'items' | 'progress' | 'checkpoints'>('items');
  const completedItems = prdItems.filter(i => i.completed);
  const remainingItems = prdItems.filter(i => !i.completed);

  const categoryBgColor: Record<PRDItem['category'], string> = {
    api: '#6366f133',
    database: '#8b5cf633',
    frontend: '#06b6d433',
    auth: '#f59e0b33',
    deployment: '#10b98133',
    testing: '#8b5cf633',
    docs: '#6366f133',
    other: '#6272a433',
  };

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
            🔁 Ralph Loop — PRD-Driven Execution
          </h3>
          <p style={{ margin: '4px 0 0 0', color: '#8b949e', fontSize: '12px' }}>
            Iterative execution with auto-checkpointing for 100+ item projects
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isRunning && currentIteration === 0 && (
            <button onClick={onStart} style={buttonStyle('#6366f1')}>
              ▶️ Start
            </button>
          )}
          {isRunning && (
            <button onClick={onPause} style={buttonStyle('#d29922')}>
              ⏸️ Pause
            </button>
          )}
          {!isRunning && currentIteration > 0 && (
            <button onClick={onResume} style={buttonStyle('#6366f1')}>
              ▶️ Resume
            </button>
          )}
          {currentIteration > 0 && (
            <button onClick={onStop} style={buttonStyle('#f85149')}>
              ⏹️ Stop
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <p style={{ margin: 0, color: '#8b949e', fontSize: '12px', fontWeight: 500 }}>
            Overall Completion
          </p>
          <p style={{ margin: 0, color: '#6366f1', fontSize: '13px', fontWeight: 600 }}>
            {Math.round(completionRate * 100)}%
          </p>
        </div>
        <div style={{
          width: '100%',
          height: '8px',
          background: '#0d1117',
          borderRadius: '4px',
          overflow: 'hidden',
        }}>
          <div
            style={{
              height: '100%',
              background: `linear-gradient(90deg, #6366f1, #8b5cf6)`,
              width: `${completionRate * 100}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Iteration Info */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
      }}>
        <StatCard label="Iteration" value={`${currentIteration}/${maxIterations}`} />
        <StatCard label="Completed" value={completedItems.length} color="#85e89d" />
        <StatCard label="Remaining" value={remainingItems.length} color={remainingItems.length > 0 ? '#d29922' : '#85e89d'} />
        <StatCard label="Checkpoints" value={checkpoints.length} color="#6366f1" />
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid #30363d',
      }}>
        {(['items', 'progress', 'checkpoints'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 12px',
              background: activeTab === tab ? '#6366f1' : 'transparent',
              color: activeTab === tab ? '#ffffff' : '#8b949e',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 500,
              borderBottom: activeTab === tab ? '2px solid #6366f1' : 'none',
              marginBottom: '-1px',
            }}
          >
            {tab === 'items' && `📋 Items (${completedItems.length}/${prdItems.length})`}
            {tab === 'progress' && '📊 Progress'}
            {tab === 'checkpoints' && '💾 Checkpoints'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ minHeight: '300px' }}>
        {activeTab === 'items' && (
          <ItemsTab
            items={prdItems}
            completed={completedItems}
            remaining={remainingItems}
            categoryBgColor={categoryBgColor}
          />
        )}
        {activeTab === 'progress' && (
          <ProgressTab
            items={prdItems}
            currentIteration={currentIteration}
            maxIterations={maxIterations}
          />
        )}
        {activeTab === 'checkpoints' && (
          <CheckpointsTab checkpoints={checkpoints} />
        )}
      </div>

      {/* Ralph Loop Info */}
      <div style={{
        padding: '12px',
        background: '#161b22',
        borderRadius: '4px',
        border: '1px solid #30363d',
        fontSize: '11px',
        color: '#8b949e',
      }}>
        <p style={{ margin: 0, marginBottom: '6px', fontWeight: 500, color: '#85e89d' }}>
          💡 Ralph Loop Features:
        </p>
        <ul style={{ margin: 0, paddingLeft: '16px' }}>
          <li>Prevents context overflow for 100+ item projects</li>
          <li>Fresh context each iteration (focused on remaining items)</li>
          <li>Auto-checkpointing for resume capability</li>
          <li>PRD-driven execution with category tracking</li>
        </ul>
      </div>
    </div>
  );
};

interface ItemsTabProps {
  items: PRDItem[];
  completed: PRDItem[];
  remaining: PRDItem[];
  categoryBgColor: Record<PRDItem['category'], string>;
}

const ItemsTab: React.FC<ItemsTabProps> = ({ completed, remaining, categoryBgColor }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '450px', overflowY: 'auto' }}>
    {completed.length > 0 && (
      <div>
        <p style={{ margin: '0 0 8px 0', color: '#85e89d', fontSize: '12px', fontWeight: 500 }}>
          ✅ Completed ({completed.length})
        </p>
        {completed.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '8px 12px',
              background: '#161b22',
              borderRadius: '4px',
              border: '1px solid #30363d',
              marginBottom: '4px',
              opacity: 0.7,
            }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'start' }}>
              <span
                style={{
                  padding: '2px 6px',
                  background: categoryBgColor[item.category],
                  borderRadius: '3px',
                  fontSize: '9px',
                  color: '#8b949e',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.category}
              </span>
              <p style={{ margin: 0, color: '#8b949e', fontSize: '11px', textDecoration: 'line-through' }}>
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    )}

    {remaining.length > 0 && (
      <div>
        {completed.length > 0 && <div style={{ height: '8px' }} />}
        <p style={{ margin: '0 0 8px 0', color: '#d29922', fontSize: '12px', fontWeight: 500 }}>
          ⏳ Remaining ({remaining.length})
        </p>
        {remaining.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '8px 12px',
              background: '#161b22',
              borderRadius: '4px',
              border: '1px solid #30363d',
              marginBottom: '4px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'start' }}>
              <span
                style={{
                  padding: '2px 6px',
                  background: categoryBgColor[item.category],
                  borderRadius: '3px',
                  fontSize: '9px',
                  color: '#8b949e',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.category}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, color: '#c9d1d9', fontSize: '11px' }}>
                  {item.description}
                </p>
                {item.priority && (
                  <p style={{ margin: '2px 0 0 0', color: '#8b949e', fontSize: '10px' }}>
                    Priority: {item.priority}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const ProgressTab: React.FC<{
  items: PRDItem[];
  currentIteration: number;
  maxIterations: number;
}> = ({ items, currentIteration, maxIterations }) => {
  const categoryStats = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = { total: 0, completed: 0 };
    }
    acc[item.category].total++;
    if (item.completed) acc[item.category].completed++;
    return acc;
  }, {} as Record<PRDItem['category'], { total: number; completed: number }>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{
        padding: '12px',
        background: '#161b22',
        borderRadius: '4px',
        border: '1px solid #30363d',
      }}>
        <p style={{ margin: '0 0 8px 0', color: '#c9d1d9', fontSize: '12px', fontWeight: 500 }}>
          Completion by Category
        </p>
        {Object.entries(categoryStats).map(([category, stats]) => {
          const pct = Math.round((stats.completed / stats.total) * 100);
          return (
            <div key={category} style={{ marginBottom: '12px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                marginBottom: '4px',
              }}>
                <span style={{ color: '#c9d1d9', textTransform: 'capitalize' }}>
                  {category}
                </span>
                <span style={{ color: '#6366f1' }}>
                  {stats.completed}/{stats.total} ({pct}%)
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                background: '#0d1117',
                borderRadius: '3px',
                overflow: 'hidden',
              }}>
                <div
                  style={{
                    height: '100%',
                    background: pct === 100 ? '#85e89d' : '#6366f1',
                    width: `${pct}%`,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        padding: '12px',
        background: '#161b22',
        borderRadius: '4px',
        border: '1px solid #30363d',
        fontSize: '11px',
        color: '#8b949e',
      }}>
        <p style={{ margin: 0, fontWeight: 500, marginBottom: '4px' }}>
          Iteration Strategy
        </p>
        <p style={{ margin: 0, fontSize: '10px', lineHeight: '1.6' }}>
          Ralph Loop runs iterations until {Math.round(95 * 100)}% completion threshold. Each iteration:
          <br />1. Generate architecture for remaining items
          <br />2. Check progress
          <br />3. If &lt;95%, run next iteration with fresh context
          <br />4. Save checkpoint before each iteration
        </p>
      </div>
    </div>
  );
};

const CheckpointsTab: React.FC<{ checkpoints: RalphCheckpoint[] }> = ({ checkpoints }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '450px', overflowY: 'auto' }}>
    {checkpoints.length === 0 ? (
      <p style={{ color: '#8b949e', fontSize: '12px' }}>No checkpoints saved yet.</p>
    ) : (
      checkpoints.map((cp) => (
        <div
          key={`${cp.iteration}`}
          style={{
            padding: '12px',
            background: '#161b22',
            borderRadius: '4px',
            border: '1px solid #30363d',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            marginBottom: '8px',
          }}>
            <p style={{ margin: 0, color: '#c9d1d9', fontSize: '12px', fontWeight: 500 }}>
              Checkpoint {cp.iteration}
            </p>
            <p style={{ margin: 0, color: '#6366f1', fontSize: '12px', fontWeight: 500 }}>
              {Math.round(cp.completionRate * 100)}%
            </p>
          </div>
          <p style={{ margin: '0 0 6px 0', color: '#8b949e', fontSize: '10px' }}>
            {cp.completedItems.length} completed, {cp.remainingItems.length} remaining
          </p>
          <p style={{ margin: 0, color: '#8b949e', fontSize: '10px' }}>
            {new Date(cp.timestamp).toLocaleTimeString()}
          </p>
          {cp.errors && cp.errors.length > 0 && (
            <p style={{ margin: '4px 0 0 0', color: '#f85149', fontSize: '10px' }}>
              ⚠️ {cp.errors.length} error(s)
            </p>
          )}
        </div>
      ))
    )}
  </div>
);

interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color }) => (
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
    <p style={{
      margin: '4px 0 0 0',
      color: color || '#6366f1',
      fontSize: '16px',
      fontWeight: 600,
    }}>
      {value}
    </p>
  </div>
);

function buttonStyle(bgColor: string) {
  return {
    padding: '8px 16px',
    background: bgColor,
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  } as const;
}

export default RalphLoopProgressImpl;
