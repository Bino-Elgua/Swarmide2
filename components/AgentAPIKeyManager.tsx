/**
 * Agent API Key Manager Component
 * Manage API keys and credentials for each agent's services
 */

import React, { useState } from 'react';

export interface APIKeyConfig {
  [key: string]: string; // service: key
}

interface AgentAPIKeyManagerProps {
  agentId: string;
  agentName: string;
  apiKeys: APIKeyConfig;
  onUpdate: (apiKeys: APIKeyConfig) => void;
}

const COMMON_SERVICES = [
  { id: 'openai', label: 'OpenAI', icon: 'fa-robot', tooltip: 'GPT-4, GPT-3.5' },
  { id: 'anthropic', label: 'Anthropic', icon: 'fa-leaf', tooltip: 'Claude API' },
  { id: 'google', label: 'Google', icon: 'fa-google', tooltip: 'Gemini, Vertex AI' },
  { id: 'groq', label: 'Groq', icon: 'fa-bolt', tooltip: 'Mixtral, LLaMA' },
  { id: 'mistral', label: 'Mistral', icon: 'fa-wind', tooltip: 'Mistral AI' },
  { id: 'cohere', label: 'Cohere', icon: 'fa-hexagon', tooltip: 'Cohere API' },
  { id: 'huggingface', label: 'Hugging Face', icon: 'fa-face-smile', tooltip: 'HF Inference API' },
  { id: 'elevenlabs', label: 'ElevenLabs', icon: 'fa-volume-high', tooltip: 'Text-to-Speech' },
  { id: 'stability', label: 'Stability AI', icon: 'fa-image', tooltip: 'Image Generation' },
  { id: 'aws', label: 'AWS', icon: 'fa-aws', tooltip: 'AWS Services' },
];

const AgentAPIKeyManager: React.FC<AgentAPIKeyManagerProps> = ({
  agentId,
  agentName,
  apiKeys,
  onUpdate,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [keyValue, setKeyValue] = useState('');
  const [showValues, setShowValues] = useState<Set<string>>(new Set());
  const [customServiceName, setCustomServiceName] = useState('');

  const handleAddKey = () => {
    if (!selectedService && !customServiceName) {
      alert('Select or enter a service name');
      return;
    }

    if (!keyValue.trim()) {
      alert('Enter an API key');
      return;
    }

    const serviceName = customServiceName || selectedService;
    const updated = { ...apiKeys, [serviceName]: keyValue };

    onUpdate(updated);
    setSelectedService('');
    setKeyValue('');
    setCustomServiceName('');
    setShowForm(false);
  };

  const handleRemoveKey = (service: string) => {
    const updated = { ...apiKeys };
    delete updated[service];
    onUpdate(updated);
  };

  const toggleShowValue = (service: string) => {
    const updated = new Set(showValues);
    if (updated.has(service)) {
      updated.delete(service);
    } else {
      updated.add(service);
    }
    setShowValues(updated);
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '*'.repeat(key.length);
    return key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4);
  };

  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-emerald-400 uppercase">🔑 API Keys & Credentials</h4>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition"
        >
          {showForm ? '✕' : '+ Add Key'}
        </button>
      </div>

      {/* Add New Key Form */}
      {showForm && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2">Service</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {COMMON_SERVICES.map((service) => (
                <button
                  key={service.id}
                  onClick={() => {
                    setSelectedService(selectedService === service.id ? '' : service.id);
                    setCustomServiceName('');
                  }}
                  className={`text-xs px-2 py-1 rounded border transition ${
                    selectedService === service.id
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                  title={service.tooltip}
                >
                  <i className={`fa-solid ${service.icon} mr-1`} />
                  {service.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Or enter custom service name..."
                value={customServiceName}
                onChange={(e) => {
                  setCustomServiceName(e.target.value);
                  if (e.target.value) setSelectedService('');
                }}
                className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-2">API Key / Token</label>
            <textarea
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder="Paste your API key here (securely stored)"
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 h-20 font-mono"
            />
            <div className="text-[9px] text-slate-500 mt-1">
              ℹ️ Keys are stored in browser localStorage. Never share in code or public.
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowForm(false);
                setSelectedService('');
                setKeyValue('');
                setCustomServiceName('');
              }}
              className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAddKey}
              className="text-xs px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition"
            >
              Add Key
            </button>
          </div>
        </div>
      )}

      {/* List of Keys */}
      {Object.keys(apiKeys).length > 0 ? (
        <div className="space-y-2">
          {Object.entries(apiKeys).map(([service, key]) => (
            <div
              key={service}
              className="flex items-center justify-between bg-slate-800 p-2 rounded border border-slate-700"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 rounded bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-xs">
                  🔑
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-300 capitalize">{service}</div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    {showValues.has(service) ? (
                      <span className="select-all">{key}</span>
                    ) : (
                      maskKey(key)
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                <button
                  onClick={() => toggleShowValue(service)}
                  className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded transition"
                  title={showValues.has(service) ? 'Hide' : 'Show'}
                >
                  <i className={`fa-solid ${showValues.has(service) ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Remove API key for ${service}?`)) {
                      handleRemoveKey(service);
                    }
                  }}
                  className="text-xs px-2 py-1 bg-red-900/30 hover:bg-red-800/50 text-red-400 rounded transition"
                  title="Delete"
                >
                  <i className="fa-solid fa-trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-slate-500 text-center py-3">
          No API keys configured for {agentName}
        </div>
      )}

      {/* Info Box */}
      <div className="text-[8px] bg-slate-800/50 border border-slate-700 rounded p-2 space-y-1 text-slate-400">
        <div className="font-bold text-slate-300">💡 Tips:</div>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Each agent can have multiple API keys for different services</li>
          <li>Keys are encrypted in localStorage and never logged</li>
          <li>Use custom service names for internal/private APIs</li>
          <li>Required for tools: REST API, Web Search, Code Interpreter, Media Synthesis</li>
          <li>You can also set global keys in Settings → Intelligence Config</li>
        </ul>
      </div>
    </div>
  );
};

export default AgentAPIKeyManager;
