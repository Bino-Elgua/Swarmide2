/**
 * Agent Editor Component
 * Edit individual agent parameters: API keys, models, settings
 */

import React, { useState } from 'react';
import { Agent, AIProvider } from '../types';

interface AgentEditorProps {
  isOpen: boolean;
  agent: Agent | null;
  onClose: () => void;
  onSave: (agent: Agent) => void;
}

const AgentEditor: React.FC<AgentEditorProps> = ({ isOpen, agent, onClose, onSave }) => {
  const [editedAgent, setEditedAgent] = useState<Agent | null>(agent);

  React.useEffect(() => {
    setEditedAgent(agent);
  }, [agent]);

  if (!isOpen || !editedAgent) return null;

  const handleSave = () => {
    if (editedAgent) {
      onSave(editedAgent);
      onClose();
    }
  };

  const handleChange = (field: string, value: any) => {
    setEditedAgent(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleIntConfigChange = (field: string, value: any) => {
    setEditedAgent(prev =>
      prev
        ? {
            ...prev,
            intelligenceConfig: { ...prev.intelligenceConfig, [field]: value }
          }
        : null
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-950 border-2 border-slate-700 rounded-xl p-6 max-w-2xl w-96 max-h-96 overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700">
          <h3 className="text-lg font-bold text-white">Edit Agent</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Agent Name */}
        <div>
          <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
            Name
          </label>
          <input
            type="text"
            value={editedAgent.name}
            onChange={e => handleChange('name', e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Role */}
        <div>
          <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
            Role
          </label>
          <input
            type="text"
            value={editedAgent.role}
            onChange={e => handleChange('role', e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
            Description
          </label>
          <textarea
            value={editedAgent.description}
            onChange={e => handleChange('description', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none"
          />
        </div>

        {/* Intelligence Config Section */}
        <div className="pt-2 border-t border-slate-700">
          <h4 className="text-xs font-bold uppercase text-slate-300 mb-3">Intelligence Config</h4>

          {/* Provider */}
          <div>
            <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
              AI Provider
            </label>
            <select
              value={editedAgent.intelligenceConfig.provider}
              onChange={e => handleIntConfigChange('provider', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="google">Google (Gemini)</option>
              <option value="openai">OpenAI (GPT)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="groq">Groq</option>
              <option value="mistral">Mistral</option>
              <option value="perplex">Perplexity</option>
            </select>
          </div>

          {/* Model */}
          <div className="mt-2">
            <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
              Model
            </label>
            <input
              type="text"
              value={editedAgent.intelligenceConfig.model}
              onChange={e => handleIntConfigChange('model', e.target.value)}
              placeholder="e.g., gemini-3-pro-preview"
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Max Tokens */}
          <div className="mt-2">
            <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
              Max Tokens
            </label>
            <input
              type="number"
              value={editedAgent.intelligenceConfig.maxTokens}
              onChange={e => handleIntConfigChange('maxTokens', parseInt(e.target.value))}
              min="256"
              max="128000"
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Top P */}
          <div className="mt-2">
            <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
              Top P (0.0 - 1.0)
            </label>
            <input
              type="number"
              value={editedAgent.intelligenceConfig.topP}
              onChange={e => handleIntConfigChange('topP', parseFloat(e.target.value))}
              min="0"
              max="1"
              step="0.05"
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Reasoning Depth */}
          <div className="mt-2">
            <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
              Reasoning Depth
            </label>
            <select
              value={editedAgent.intelligenceConfig.reasoningDepth}
              onChange={e => handleIntConfigChange('reasoningDepth', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="shallow">Shallow</option>
              <option value="standard">Standard</option>
              <option value="deep">Deep</option>
              <option value="exhaustive">Exhaustive</option>
            </select>
          </div>

          {/* Safety Level */}
          <div className="mt-2">
            <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
              Safety Level
            </label>
            <select
              value={editedAgent.intelligenceConfig.safetyLevel}
              onChange={e => handleIntConfigChange('safetyLevel', e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="permissive">Permissive</option>
              <option value="moderate">Moderate</option>
              <option value="strict">Strict</option>
            </select>
          </div>
        </div>

        {/* Personality */}
        <div className="pt-2 border-t border-slate-700">
          <h4 className="text-xs font-bold uppercase text-slate-300 mb-2">Personality</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
                Verbosity (0.1 - 1.0)
              </label>
              <input
                type="number"
                value={editedAgent.personality?.verbosity || 0.5}
                onChange={e =>
                  setEditedAgent(prev =>
                    prev
                      ? {
                          ...prev,
                          personality: {
                            ...prev.personality,
                            verbosity: parseFloat(e.target.value)
                          }
                        }
                      : null
                  )
                }
                min="0.1"
                max="1"
                step="0.1"
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-slate-400 block mb-1">
                Risk Aversion (0.1 - 1.0)
              </label>
              <input
                type="number"
                value={editedAgent.personality?.riskAversion || 0.5}
                onChange={e =>
                  setEditedAgent(prev =>
                    prev
                      ? {
                          ...prev,
                          personality: {
                            ...prev.personality,
                            riskAversion: parseFloat(e.target.value)
                          }
                        }
                      : null
                  )
                }
                min="0.1"
                max="1"
                step="0.1"
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-4 border-t border-slate-700 flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 text-xs font-bold uppercase bg-emerald-900 hover:bg-emerald-800 border border-emerald-700 rounded text-emerald-300 transition-colors"
          >
            💾 Save
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-xs font-bold uppercase bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-300 transition-colors"
          >
            ✕ Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentEditor;
