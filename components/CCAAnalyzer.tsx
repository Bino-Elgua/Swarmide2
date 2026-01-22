import React, { useState } from 'react';
import { 
  CCAAuditReport, 
  RefactoringOpportunity, 
  ToolExtractionSuggestion,
  ModuleGraph 
} from '../services/ccaService';

interface CCAAnalyzerProps {
  report: CCAAuditReport;
  isLoading?: boolean;
  onDismiss?: () => void;
}

const CCAAnalyzer: React.FC<CCAAnalyzerProps> = ({ 
  report, 
  isLoading = false,
  onDismiss 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'graph' | 'refactoring' | 'tools'>('overview');
  const [expandedOpportunity, setExpandedOpportunity] = useState<string | null>(null);

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'critical': return 'bg-red-900/30 border-red-600 text-red-300';
      case 'high': return 'bg-orange-900/30 border-orange-600 text-orange-300';
      case 'medium': return 'bg-yellow-900/30 border-yellow-600 text-yellow-300';
      default: return 'bg-green-900/30 border-green-600 text-green-300';
    }
  };

  const getOpportunityTypeIcon = (type: string) => {
    switch (type) {
      case 'circular_break': return '🔄';
      case 'dead_code': return '💀';
      case 'extract_module': return '📦';
      case 'consolidate': return '🔗';
      case 'anti_pattern': return '⚠️';
      default: return '🎯';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'text-emerald-400';
      case 'medium': return 'text-amber-400';
      case 'high': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  const getScopeIcon = (scope: string) => {
    switch (scope) {
      case 'utility': return '🔧';
      case 'core_feature': return '⭐';
      case 'integration': return '🔌';
      case 'shared_infrastructure': return '🏗️';
      default: return '📌';
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl">
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 text-center max-w-md">
          <div className="mb-6">
            <div className="inline-block animate-spin">
              <i className="fa-solid fa-microscope text-amber-400 text-4xl" />
            </div>
          </div>
          <h3 className="text-xl font-black text-white mb-2">Analyzing Codebase</h3>
          <p className="text-slate-400 text-sm">
            Building dependency graph and identifying optimization opportunities...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl p-4">
      <div className="w-full max-w-6xl h-5/6 bg-slate-950 border border-slate-800 rounded-3xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="border-b border-slate-800 p-6 flex items-center justify-between">
          <div className="flex items-center">
            <i className="fa-solid fa-microscope text-amber-400 text-2xl mr-4" />
            <div>
              <h2 className="text-2xl font-black text-white">CCA Audit Report</h2>
              <p className="text-xs text-slate-500 mt-1">Cross-Codebase Analysis - Large Scale Architecture Review</p>
            </div>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-slate-500 hover:text-white transition"
            >
              <i className="fa-solid fa-xmark text-lg" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-800 px-6 flex gap-2 bg-slate-900/50">
          {[
            { id: 'overview', label: 'Overview', icon: 'chart-pie' },
            { id: 'graph', label: 'Dependency Graph', icon: 'diagram-project' },
            { id: 'refactoring', label: 'Refactoring', icon: 'wrench' },
            { id: 'tools', label: 'Tool Extraction', icon: 'box' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 font-semibold text-sm transition border-b-2 ${
                activeTab === tab.id
                  ? 'text-amber-400 border-amber-400'
                  : 'text-slate-400 border-transparent hover:text-slate-300'
              }`}
            >
              <i className={`fa-solid fa-${tab.icon} mr-2`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                  <div className="text-slate-500 text-xs font-black uppercase mb-2">Total Files</div>
                  <div className="text-3xl font-black text-white">{report.summary.totalFiles}</div>
                </div>
                
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                  <div className="text-slate-500 text-xs font-black uppercase mb-2">Lines of Code</div>
                  <div className="text-3xl font-black text-white">{report.summary.totalLines.toLocaleString()}</div>
                </div>
                
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                  <div className="text-slate-500 text-xs font-black uppercase mb-2">Avg File Size</div>
                  <div className="text-3xl font-black text-white">{report.summary.avgFileSize}</div>
                  <div className="text-xs text-slate-500 mt-1">lines/file</div>
                </div>
                
                <div className={`border rounded-xl p-4 ${getComplexityColor(report.summary.complexity)}`}>
                  <div className="text-xs font-black uppercase mb-2">Complexity</div>
                  <div className="text-2xl font-black capitalize">{report.summary.complexity}</div>
                </div>
              </div>

              {/* Improvements */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <h3 className="font-black text-white mb-4 flex items-center">
                  <i className="fa-solid fa-arrow-trend-up text-emerald-400 mr-3" />
                  Estimated Improvements
                </h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <div className="text-emerald-400 font-black text-lg">{report.estimatedImprovements.codeReduction}%</div>
                    <div className="text-xs text-slate-400 mt-1">Code reduction potential</div>
                  </div>
                  
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <div className="text-blue-400 font-black text-lg">{report.estimatedImprovements.performanceGain}</div>
                    <div className="text-xs text-slate-400 mt-1">Performance improvement</div>
                  </div>
                  
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <div className="text-amber-400 font-black text-lg">{report.estimatedImprovements.maintainabilityScore}/100</div>
                    <div className="text-xs text-slate-400 mt-1">Maintainability score</div>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {report.recommendations.length > 0 && (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                  <h3 className="font-black text-white mb-4 flex items-center">
                    <i className="fa-solid fa-lightbulb text-amber-400 mr-3" />
                    Key Recommendations
                  </h3>
                  
                  <ul className="space-y-2">
                    {report.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <i className="fa-solid fa-check text-emerald-400 mt-1 text-sm flex-shrink-0" />
                        <span className="text-sm text-slate-300">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Dependency Graph Tab */}
          {activeTab === 'graph' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                  <div className="text-slate-500 text-xs font-black uppercase mb-2">Module Dependencies</div>
                  <div className="text-3xl font-black text-white">{report.dependencyGraph.edges.length}</div>
                </div>
                
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                  <div className="text-slate-500 text-xs font-black uppercase mb-2">Circular Dependencies</div>
                  <div className={`text-3xl font-black ${report.dependencyGraph.circularDeps.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {report.dependencyGraph.circularDeps.length}
                  </div>
                </div>
              </div>

              {report.dependencyGraph.circularDeps.length > 0 && (
                <div className="bg-red-900/20 border border-red-600 rounded-xl p-4">
                  <h4 className="font-black text-red-300 mb-3 flex items-center">
                    <i className="fa-solid fa-circle-exclamation mr-2" />
                    Circular Dependencies Detected
                  </h4>
                  <div className="space-y-2">
                    {report.dependencyGraph.circularDeps.map((cycle, i) => (
                      <div key={i} className="text-xs text-red-200 font-mono bg-slate-900/50 p-2 rounded">
                        {cycle.join(' → ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.dependencyGraph.deadCode.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-600 rounded-xl p-4">
                  <h4 className="font-black text-yellow-300 mb-3 flex items-center">
                    <i className="fa-solid fa-skull mr-2" />
                    Dead Code Modules ({report.dependencyGraph.deadCode.length})
                  </h4>
                  <div className="space-y-1">
                    {report.dependencyGraph.deadCode.slice(0, 5).map((dead, i) => (
                      <div key={i} className="text-xs text-yellow-200">• {dead}</div>
                    ))}
                    {report.dependencyGraph.deadCode.length > 5 && (
                      <div className="text-xs text-yellow-300 mt-2">... and {report.dependencyGraph.deadCode.length - 5} more</div>
                    )}
                  </div>
                </div>
              )}

              {report.dependencyGraph.criticalPaths.length > 0 && (
                <div className="bg-blue-900/20 border border-blue-600 rounded-xl p-4">
                  <h4 className="font-black text-blue-300 mb-3 flex items-center">
                    <i className="fa-solid fa-route mr-2" />
                    Critical Dependency Paths
                  </h4>
                  <div className="space-y-2">
                    {report.dependencyGraph.criticalPaths.slice(0, 3).map((path, i) => (
                      <div key={i} className="text-xs text-blue-200 font-mono bg-slate-900/50 p-2 rounded break-all">
                        {path.join(' → ')}
                      </div>
                    ))}
                    {report.dependencyGraph.criticalPaths.length > 3 && (
                      <div className="text-xs text-blue-300">... and {report.dependencyGraph.criticalPaths.length - 3} more paths</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Refactoring Tab */}
          {activeTab === 'refactoring' && (
            <div className="space-y-3">
              {report.refactoringOpportunities.length === 0 ? (
                <div className="text-center py-8">
                  <i className="fa-solid fa-check-circle text-emerald-400 text-4xl mb-3 block" />
                  <p className="text-slate-400">No refactoring opportunities identified.</p>
                </div>
              ) : (
                report.refactoringOpportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition cursor-pointer"
                    onClick={() => setExpandedOpportunity(
                      expandedOpportunity === opp.id ? null : opp.id
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{getOpportunityTypeIcon(opp.type)}</span>
                          <div>
                            <h4 className="font-black text-white capitalize">{opp.type.replace(/_/g, ' ')}</h4>
                            <p className="text-xs text-slate-500">{opp.modules.length} module(s) involved</p>
                          </div>
                        </div>
                        
                        <p className="text-sm text-slate-300 mb-3">{opp.description}</p>
                        
                        <div className="flex gap-4 text-xs">
                          <span className="text-slate-400">
                            <span className="font-black text-slate-300">Benefit:</span> {opp.benefit}
                          </span>
                          <span className={`font-black ${getEffortColor(opp.effort)}`}>
                            Effort: {opp.effort}
                          </span>
                          <span className="text-slate-400">
                            Risk: <span className={opp.riskLevel === 'high' ? 'text-red-400' : opp.riskLevel === 'medium' ? 'text-yellow-400' : 'text-emerald-400'}>{opp.riskLevel}</span>
                          </span>
                        </div>
                      </div>
                      
                      <i className={`fa-solid fa-chevron-down text-slate-600 ml-4 transition ${expandedOpportunity === opp.id ? 'rotate-180' : ''}`} />
                    </div>

                    {expandedOpportunity === opp.id && (
                      <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                        <div>
                          <div className="text-xs font-black text-slate-400 uppercase mb-1">Modules</div>
                          <div className="flex flex-wrap gap-2">
                            {opp.modules.map((mod, i) => (
                              <span key={i} className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded">
                                {mod}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-400 uppercase">Estimated Savings: {opp.estimatedSavings} lines</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tool Extraction Tab */}
          {activeTab === 'tools' && (
            <div className="space-y-3">
              {report.toolExtractionCandidates.length === 0 ? (
                <div className="text-center py-8">
                  <i className="fa-solid fa-box text-slate-500 text-4xl mb-3 block" />
                  <p className="text-slate-400">No tool extraction candidates identified.</p>
                </div>
              ) : (
                report.toolExtractionCandidates.map((tool) => (
                  <div
                    key={tool.id}
                    className={`border rounded-xl p-4 transition ${
                      tool.priority === 'high'
                        ? 'bg-emerald-900/20 border-emerald-600'
                        : tool.priority === 'medium'
                        ? 'bg-amber-900/20 border-amber-600'
                        : 'bg-slate-900/50 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getScopeIcon(tool.scope)}</span>
                        <div>
                          <h4 className="font-black text-white">{tool.name}</h4>
                          <p className="text-xs text-slate-500">{tool.scope.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded font-black text-xs ${
                        tool.priority === 'high'
                          ? 'bg-emerald-600/50 text-emerald-300'
                          : tool.priority === 'medium'
                          ? 'bg-amber-600/50 text-amber-300'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {tool.priority.toUpperCase()}
                      </div>
                    </div>

                    <p className="text-sm text-slate-300 mb-3">{tool.description}</p>
                    
                    <p className="text-xs text-slate-400 mb-3">
                      <span className="font-black">Rationale:</span> {tool.rationale}
                    </p>

                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Reusability Score: <span className="font-black text-slate-300">{(tool.reusability * 100).toFixed(0)}%</span></span>
                      <span>Modules: {tool.modules.length}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-6 py-4 flex justify-end gap-3 bg-slate-900/50">
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-lg transition"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CCAAnalyzer;
