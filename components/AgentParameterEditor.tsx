/**
 * Agent Parameter Editor Component
 * Edit agent configuration, parameters, and phase assignments
 */

import React, { useState } from 'react';
import { Agent } from '../types';
import AgentAPIKeyManager from './AgentAPIKeyManager';

interface AgentParameterEditorProps {
  agent: Agent;
  maxPhase: number;
  onSave: (agent: Agent) => void;
  onCancel: () => void;
}

const AgentParameterEditor: React.FC<AgentParameterEditorProps> = ({
  agent,
  maxPhase,
  onSave,
  onCancel
}) => {
  const [edited, setEdited] = useState<Agent>(agent);
  const [activeSection, setActiveSection] = useState<'basic' | 'role' | 'parameters' | 'phase' | 'apikeys'>('basic');

  const handleSave = () => {
    onSave(edited);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Edit Agent: {agent.name}</h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-900/50 px-4 overflow-x-auto">
          {(['basic', 'role', 'parameters', 'phase', 'apikeys'] as const).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-4 py-3 text-xs font-bold uppercase border-b-2 transition whitespace-nowrap ${
                activeSection === section
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-400'
              }`}
            >
              {section === 'basic' && '⚙️ Basic'}
              {section === 'role' && '👤 Role'}
              {section === 'parameters' && '⚡ Parameters'}
              {section === 'phase' && '📊 Phase'}
              {section === 'apikeys' && '🔑 API Keys'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeSection === 'basic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Agent Name</label>
                <input
                  type="text"
                  value={edited.name}
                  onChange={(e) => setEdited({ ...edited, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Description</label>
                <textarea
                  value={edited.description}
                  onChange={(e) => setEdited({ ...edited, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 h-24"
                  placeholder="What does this agent do?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">Category</label>
                  <input
                    type="text"
                    value={edited.category}
                    onChange={(e) => setEdited({ ...edited, category: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="e.g., engineering"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">Icon (FontAwesome)</label>
                  <input
                    type="text"
                    value={edited.icon}
                    onChange={(e) => setEdited({ ...edited, icon: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="e.g., fa-code"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">Color (Hex)</label>
                  <input
                    type="text"
                    value={edited.color}
                    onChange={(e) => setEdited({ ...edited, color: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    placeholder="#6366f1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2">Status</label>
                  <select
                    value={edited.status}
                    onChange={(e) => setEdited({ ...edited, status: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="idle">Idle</option>
                    <option value="active">Active</option>
                    <option value="thinking">Thinking</option>
                    <option value="working">Working</option>
                    <option value="complete">Complete</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'role' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Agent Role</label>
                <input
                  type="text"
                  value={edited.role}
                  onChange={(e) => setEdited({ ...edited, role: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g., Backend Architect"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Expertise</label>
                <textarea
                  value={edited.expertise}
                  onChange={(e) => setEdited({ ...edited, expertise: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 h-20"
                  placeholder="Key areas of expertise"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Specializations</label>
                <input
                  type="text"
                  value={edited.specialization?.join(', ') || ''}
                  onChange={(e) => setEdited({
                    ...edited,
                    specialization: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  placeholder="e.g., Node.js, PostgreSQL, Docker (comma-separated)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Thought Log</label>
                <textarea
                  value={edited.thoughtLog?.join('\n') || ''}
                  onChange={(e) => setEdited({
                    ...edited,
                    thoughtLog: e.target.value.split('\n').filter(Boolean)
                  })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 h-20"
                  placeholder="Internal thoughts (one per line)"
                />
              </div>
            </div>
          )}

          {activeSection === 'parameters' && (
            <div className="space-y-4">
              <div className="bg-slate-900/50 border border-slate-700 rounded p-4 space-y-3">
                <h4 className="text-xs font-bold text-indigo-400 uppercase">Model Parameters</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">Temperature</label>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={edited.modelParams?.temperature || 0.7}
                      onChange={(e) => setEdited({
                        ...edited,
                        modelParams: { ...edited.modelParams, temperature: parseFloat(e.target.value) }
                      })}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                    <div className="text-[9px] text-slate-500 mt-1">0.0 = Deterministic, 2.0 = Creative</div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">Top P</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={edited.modelParams?.topP || 0.9}
                      onChange={(e) => setEdited({
                        ...edited,
                        modelParams: { ...edited.modelParams, topP: parseFloat(e.target.value) }
                      })}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">Top K</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={edited.modelParams?.topK || 40}
                      onChange={(e) => setEdited({
                        ...edited,
                        modelParams: { ...edited.modelParams, topK: parseInt(e.target.value) }
                      })}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">Max Tokens</label>
                    <input
                      type="number"
                      min="256"
                      max="32000"
                      step="256"
                      value={edited.modelParams?.maxTokens || 2048}
                      onChange={(e) => setEdited({
                        ...edited,
                        modelParams: { ...edited.modelParams, maxTokens: parseInt(e.target.value) }
                      })}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={edited.modelParams?.recursiveRefinement || false}
                    onChange={(e) => setEdited({
                      ...edited,
                      modelParams: { ...edited.modelParams, recursiveRefinement: e.target.checked }
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-xs font-bold text-slate-400">Recursive Refinement</span>
                </label>
              </div>

              <div className="bg-slate-900/50 border border-slate-700 rounded p-4 space-y-3">
                <h4 className="text-xs font-bold text-pink-400 uppercase">Execution Parameters</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">Timeout (ms)</label>
                    <input
                      type="number"
                      min="1000"
                      step="1000"
                      value={edited.executionParams?.timeoutMs || 30000}
                      onChange={(e) => setEdited({
                        ...edited,
                        executionParams: { ...edited.executionParams, timeoutMs: parseInt(e.target.value) }
                      })}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">Retries</label>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      value={edited.executionParams?.retries || 2}
                      onChange={(e) => setEdited({
                        ...edited,
                        executionParams: { ...edited.executionParams, retries: parseInt(e.target.value) }
                      })}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">Priority (1-10)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={edited.executionParams?.priority || 5}
                      onChange={(e) => setEdited({
                        ...edited,
                        executionParams: { ...edited.executionParams, priority: parseInt(e.target.value) }
                      })}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">Parallelizable</label>
                    <select
                      value={edited.executionParams?.parallelizable ? 'yes' : 'no'}
                      onChange={(e) => setEdited({
                        ...edited,
                        executionParams: { ...edited.executionParams, parallelizable: e.target.value === 'yes' }
                      })}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'phase' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Phase Assignment</label>
                <select
                  value={edited.phase}
                  onChange={(e) => setEdited({ ...edited, phase: parseInt(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  {Array.from({ length: maxPhase + 1 }, (_, i) => (
                    <option key={i} value={i}>
                      Phase {i + 1}
                    </option>
                  ))}
                </select>
                <div className="text-[9px] text-slate-500 mt-2">
                  Currently in Phase {edited.phase + 1}
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-700 rounded p-4 space-y-3">
                <h4 className="text-xs font-bold text-amber-400 uppercase">Phase Dependencies</h4>
                <textarea
                  value={edited.phaseDependencies?.join(', ') || ''}
                  onChange={(e) => setEdited({
                    ...edited,
                    phaseDependencies: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 h-20"
                  placeholder="Phase numbers this agent depends on (e.g., 0, 1, 2)"
                />
              </div>
            </div>
          )}

          {activeSection === 'apikeys' && (
            <div className="space-y-4">
              <AgentAPIKeyManager
                agentId={edited.id}
                agentName={edited.name}
                apiKeys={edited.apiKeys || {}}
                onUpdate={(apiKeys) => setEdited({ ...edited, apiKeys })}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-900 border-t border-slate-700 p-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentParameterEditor;
