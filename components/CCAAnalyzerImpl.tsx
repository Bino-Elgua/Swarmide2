import React, { useState } from 'react';

interface DependencyNode {
  id: string;
  name: string;
  type: 'file' | 'module' | 'component';
  size: number;
  imports: string[];
  exports: string[];
  circularDeps: string[];
  deadCode: boolean;
  antiPatterns: string[];
}

interface RefactoringOpportunity {
  id: string;
  title: string;
  description: string;
  files: string[];
  impact: 'high' | 'medium' | 'low';
  effort: 'easy' | 'medium' | 'hard';
  savings: string;
}

interface ModuleExtraction {
  id: string;
  name: string;
  files: string[];
  purpose: string;
  complexity: 'low' | 'medium' | 'high';
  reusability: number; // 0-100
}

interface CCAAnalyzerImplProps {
  isAnalyzing: boolean;
  dependencyGraph?: DependencyNode[];
  refactoringOpportunities?: RefactoringOpportunity[];
  moduleExtractions?: ModuleExtraction[];
  auditReport?: string;
  onAnalyzeCodebase: (fileGlob: string) => void;
  onSelectModule: (module: ModuleExtraction) => void;
}

const CCAAnalyzerImpl: React.FC<CCAAnalyzerImplProps> = ({
  isAnalyzing,
  dependencyGraph = [],
  refactoringOpportunities = [],
  moduleExtractions = [],
  auditReport = '',
  onAnalyzeCodebase,
  onSelectModule,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'graph' | 'refactor' | 'extract' | 'report'>('overview');
  const [fileGlob, setFileGlob] = useState('src/**/*.ts');

  const circularDeps = dependencyGraph?.filter(n => n.circularDeps.length > 0) || [];
  const deadCodeFiles = dependencyGraph?.filter(n => n.deadCode) || [];
  const totalSize = dependencyGraph?.reduce((sum, n) => sum + n.size, 0) || 0;

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
            📊 Code Architecture Analysis (CCA)
          </h3>
          <p style={{ margin: '4px 0 0 0', color: '#8b949e', fontSize: '12px' }}>
            Analyze codebase for refactoring and modular extraction
          </p>
        </div>
        <button
          onClick={() => onAnalyzeCodebase(fileGlob)}
          disabled={isAnalyzing}
          style={{
            padding: '8px 16px',
            background: isAnalyzing ? '#6272a4' : '#6366f1',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {isAnalyzing ? '⏳ Analyzing...' : '🔍 Analyze Codebase'}
        </button>
      </div>

      {/* File Glob Input */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '8px',
      }}>
        <input
          type="text"
          placeholder="File glob pattern (e.g., src/**/*.ts)"
          value={fileGlob}
          onChange={(e) => setFileGlob(e.target.value)}
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
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid #30363d',
      }}>
        {(['overview', 'graph', 'refactor', 'extract', 'report'] as const).map((tab) => (
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
            {tab === 'overview' && '📈 Overview'}
            {tab === 'graph' && '🕸️ Dependencies'}
            {tab === 'refactor' && '🔧 Refactor'}
            {tab === 'extract' && '📦 Extract'}
            {tab === 'report' && '📄 Report'}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ minHeight: '300px' }}>
        {activeTab === 'overview' && (
          <OverviewTab graph={dependencyGraph} circular={circularDeps} deadCode={deadCodeFiles} totalSize={totalSize} />
        )}

        {activeTab === 'graph' && (
          <DependencyGraphTab graph={dependencyGraph} />
        )}

        {activeTab === 'refactor' && (
          <RefactoringTab opportunities={refactoringOpportunities} />
        )}

        {activeTab === 'extract' && (
          <ModuleExtractionTab modules={moduleExtractions} onSelect={onSelectModule} />
        )}

        {activeTab === 'report' && (
          <ReportTab report={auditReport} />
        )}
      </div>
    </div>
  );
};

const OverviewTab: React.FC<{
  graph: DependencyNode[];
  circular: DependencyNode[];
  deadCode: DependencyNode[];
  totalSize: number;
}> = ({ graph, circular, deadCode, totalSize }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
      <StatCard label="Total Files" value={graph.length} />
      <StatCard label="Total Size" value={`${(totalSize / 1024).toFixed(1)}KB`} />
      <StatCard label="Circular Deps" value={circular.length} severity="warning" />
      <StatCard label="Dead Code" value={deadCode.length} severity={deadCode.length > 0 ? 'error' : 'success'} />
    </div>

    <div style={{
      padding: '12px',
      background: '#161b22',
      borderRadius: '4px',
      border: '1px solid #30363d',
    }}>
      <p style={{ margin: '0 0 8px 0', color: '#c9d1d9', fontSize: '12px', fontWeight: 500 }}>
        🔍 Analysis Summary
      </p>
      <p style={{ margin: 0, color: '#8b949e', fontSize: '11px', lineHeight: '1.6' }}>
        {graph.length} files analyzed. {circular.length > 0 ? `${circular.length} circular dependencies detected.` : 'No circular dependencies.'} {deadCode.length > 0 ? `${deadCode.length} files with dead code.` : 'No dead code detected.'}
      </p>
    </div>
  </div>
);

const DependencyGraphTab: React.FC<{ graph: DependencyNode[] }> = ({ graph }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
    <p style={{ margin: 0, color: '#8b949e', fontSize: '11px' }}>
      {graph.length} nodes in dependency graph
    </p>
    {graph.map((node) => (
      <div
        key={node.id}
        style={{
          padding: '8px 12px',
          background: '#161b22',
          borderRadius: '4px',
          border: node.circularDeps.length > 0 ? '1px solid #f85149' : '1px solid #30363d',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <p style={{ margin: 0, color: '#c9d1d9', fontSize: '12px', fontWeight: 500 }}>
              {node.name}
            </p>
            <p style={{ margin: '2px 0 0 0', color: '#8b949e', fontSize: '10px' }}>
              Imports: {node.imports.length} | Exports: {node.exports.length} | Size: {node.size} bytes
            </p>
          </div>
          {node.circularDeps.length > 0 && (
            <span style={{ color: '#f85149', fontSize: '10px' }}>🔴 Circular</span>
          )}
        </div>
        {node.antiPatterns.length > 0 && (
          <p style={{ margin: '4px 0 0 0', color: '#d29922', fontSize: '10px' }}>
            ⚠️ {node.antiPatterns.join(', ')}
          </p>
        )}
      </div>
    ))}
  </div>
);

const RefactoringTab: React.FC<{ opportunities: RefactoringOpportunity[] }> = ({ opportunities }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
    {opportunities.length === 0 ? (
      <p style={{ color: '#8b949e', fontSize: '12px' }}>No refactoring opportunities identified yet.</p>
    ) : (
      opportunities.map((opp) => (
        <div
          key={opp.id}
          style={{
            padding: '12px',
            background: '#161b22',
            borderRadius: '4px',
            border: '1px solid #30363d',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, color: '#c9d1d9', fontSize: '12px', fontWeight: 500 }}>
                {opp.title}
              </p>
              <p style={{ margin: '4px 0 0 0', color: '#8b949e', fontSize: '11px' }}>
                {opp.description}
              </p>
              <p style={{ margin: '4px 0 0 0', color: '#85e89d', fontSize: '10px' }}>
                💰 Savings: {opp.savings}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  padding: '2px 6px',
                  background: opp.impact === 'high' ? '#f85149' : opp.impact === 'medium' ? '#d29922' : '#85e89d',
                  color: '#ffffff',
                  borderRadius: '3px',
                  fontSize: '10px',
                  marginRight: '4px',
                }}
              >
                {opp.impact}
              </span>
              <span
                style={{
                  padding: '2px 6px',
                  background: opp.effort === 'easy' ? '#85e89d' : opp.effort === 'medium' ? '#d29922' : '#f85149',
                  color: '#ffffff',
                  borderRadius: '3px',
                  fontSize: '10px',
                }}
              >
                {opp.effort}
              </span>
            </div>
          </div>
        </div>
      ))
    )}
  </div>
);

const ModuleExtractionTab: React.FC<{
  modules: ModuleExtraction[];
  onSelect: (module: ModuleExtraction) => void;
}> = ({ modules, onSelect }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
    {modules.length === 0 ? (
      <p style={{ color: '#8b949e', fontSize: '12px' }}>No module extraction candidates identified yet.</p>
    ) : (
      modules.map((mod) => (
        <div
          key={mod.id}
          onClick={() => onSelect(mod)}
          style={{
            padding: '12px',
            background: '#161b22',
            borderRadius: '4px',
            border: '1px solid #30363d',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <p style={{ margin: 0, color: '#c9d1d9', fontSize: '12px', fontWeight: 500 }}>
                📦 {mod.name}
              </p>
              <p style={{ margin: '4px 0 0 0', color: '#8b949e', fontSize: '11px' }}>
                {mod.purpose}
              </p>
              <p style={{ margin: '2px 0 0 0', color: '#8b949e', fontSize: '10px' }}>
                {mod.files.length} files | Reusability: {mod.reusability}%
              </p>
            </div>
            <span
              style={{
                padding: '2px 6px',
                background: mod.complexity === 'low' ? '#85e89d' : mod.complexity === 'medium' ? '#d29922' : '#f85149',
                color: '#ffffff',
                borderRadius: '3px',
                fontSize: '10px',
              }}
            >
              {mod.complexity}
            </span>
          </div>
        </div>
      ))
    )}
  </div>
);

const ReportTab: React.FC<{ report: string }> = ({ report }) => (
  <div style={{
    padding: '12px',
    background: '#161b22',
    borderRadius: '4px',
    border: '1px solid #30363d',
    maxHeight: '400px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#8b949e',
    lineHeight: '1.6',
  }}>
    {report || 'No audit report generated yet. Run analysis to generate report.'}
  </div>
);

interface StatCardProps {
  label: string;
  value: string | number;
  severity?: 'success' | 'warning' | 'error';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, severity }) => {
  const colors = {
    success: '#85e89d',
    warning: '#d29922',
    error: '#f85149',
  };

  return (
    <div style={{
      padding: '12px',
      background: '#161b22',
      borderRadius: '4px',
      border: `1px solid ${severity ? colors[severity] + '33' : '#30363d'}`,
      textAlign: 'center',
    }}>
      <p style={{ margin: 0, color: '#8b949e', fontSize: '11px', fontWeight: 500 }}>
        {label}
      </p>
      <p
        style={{
          margin: '4px 0 0 0',
          color: severity ? colors[severity] : '#6366f1',
          fontSize: '16px',
          fontWeight: 600,
        }}
      >
        {value}
      </p>
    </div>
  );
};

export default CCAAnalyzerImpl;
