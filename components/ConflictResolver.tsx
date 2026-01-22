import React, { useState } from 'react';
import { ProposalOutput } from '../types';

interface ConflictResolverProps {
  isOpen: boolean;
  proposals: ProposalOutput[];
  selectedProposal?: ProposalOutput;
  resolution: string;
  onSelectProposal: (proposal: ProposalOutput) => void;
  onClose: () => void;
  onConfirm: () => void;
}

const ConflictResolver: React.FC<ConflictResolverProps> = ({
  isOpen,
  proposals,
  selectedProposal,
  resolution,
  onSelectProposal,
  onClose,
  onConfirm
}) => {
  const [expandedProposal, setExpandedProposal] = useState<string | null>(
    selectedProposal?.id || proposals[0]?.id || null
  );

  if (!isOpen || proposals.length === 0) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-950 border border-slate-700 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-white">Resolve Conflicting Proposals</h2>
                <p className="text-sm text-slate-400 mt-1">
                  {proposals.length} agents proposed different architectures
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Resolution Strategy */}
            {resolution && (
              <div className="bg-indigo-500/10 border border-indigo-500/50 rounded-lg p-4">
                <h3 className="text-sm font-bold text-indigo-400 mb-2">Resolution Strategy</h3>
                <p className="text-sm text-slate-300">{resolution}</p>
              </div>
            )}

            {/* Proposals Grid */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-300">Proposals</h3>

              {proposals.map((proposal) => (
                <div
                  key={proposal.id}
                  className={`border rounded-lg transition cursor-pointer ${
                    selectedProposal?.id === proposal.id
                      ? 'border-indigo-500 bg-indigo-500/5'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'
                  }`}
                >
                  {/* Proposal Header */}
                  <button
                    onClick={() => {
                      onSelectProposal(proposal);
                      setExpandedProposal(
                        expandedProposal === proposal.id ? null : proposal.id
                      );
                    }}
                    className="w-full p-4 text-left flex justify-between items-start hover:bg-slate-800/50 transition"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-white">{proposal.agentName}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 bg-slate-700 rounded overflow-hidden">
                            <div
                              className="h-full bg-indigo-500"
                              style={{
                                width: `${Math.min(proposal.confidence * 100, 100)}%`
                              }}
                            />
                          </div>
                          <span className="text-xs text-slate-400">
                            {(proposal.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-400 line-clamp-2">
                        {proposal.architecture.slice(0, 120)}...
                      </p>
                    </div>
                    <span className="text-slate-500 ml-2">
                      {expandedProposal === proposal.id ? '▼' : '▶'}
                    </span>
                  </button>

                  {/* Expanded Content */}
                  {expandedProposal === proposal.id && (
                    <div className="border-t border-slate-700 p-4 space-y-4">
                      {/* Architecture */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">
                          Architecture
                        </h4>
                        <p className="text-sm text-slate-300 bg-slate-900 rounded p-3 max-h-32 overflow-y-auto">
                          {proposal.architecture}
                        </p>
                      </div>

                      {/* Rationale */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">
                          Rationale
                        </h4>
                        <p className="text-sm text-slate-300">{proposal.rationale}</p>
                      </div>

                      {/* Tradeoffs */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-emerald-400 uppercase mb-2">
                            ✓ Pros
                          </h4>
                          <ul className="text-xs text-slate-300 space-y-1">
                            {proposal.tradeoffs.pro.map((item, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="text-emerald-500">+</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-red-400 uppercase mb-2">
                            ✗ Cons
                          </h4>
                          <ul className="text-xs text-slate-300 space-y-1">
                            {proposal.tradeoffs.con.map((item, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="text-red-500">-</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Risks */}
                      {proposal.risks.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-amber-400 uppercase mb-2">
                            ⚠ Risks
                          </h4>
                          <ul className="text-xs text-slate-300 space-y-1">
                            {proposal.risks.map((risk, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="text-amber-500">!</span>
                                <span>{risk}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Dependencies */}
                      {proposal.dependencies.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">
                            Dependencies
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {proposal.dependencies.map((dep, i) => (
                              <span
                                key={i}
                                className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded"
                              >
                                {dep}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cost Estimate */}
                      {proposal.costEstimate && (
                        <div className="bg-slate-800/50 rounded p-3">
                          <p className="text-xs text-slate-400">
                            Estimated tokens: <span className="font-bold text-indigo-400">{proposal.costEstimate}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Selection Summary */}
            {selectedProposal && (
              <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-lg p-4">
                <p className="text-sm text-slate-300">
                  <strong>Selected:</strong> {selectedProposal.agentName}'s proposal
                  <span className="text-indigo-400 ml-2">
                    ({(selectedProposal.confidence * 100).toFixed(0)}% confidence)
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 p-4 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!selectedProposal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded font-medium transition"
            >
              Accept {selectedProposal?.agentName || 'Proposal'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConflictResolver;
