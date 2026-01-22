import React from 'react';
import type { SynthesisResult, ModelConfig } from '../services/multiModelSynthesis';
import { MULTI_MODEL_OPTIONS } from '../services/multiModelSynthesis';

interface MultiModelPanelProps {
  result: SynthesisResult;
  isLoading?: boolean;
  onResynthesize?: () => void;
}

const MultiModelPanel: React.FC<MultiModelPanelProps> = ({ result, isLoading, onResynthesize }) => {
  const getProviderIcon = (provider: string): string => {
    const icons: Record<string, string> = {
      google: '🔍',
      openai: '⚡',
      anthropic: '🧠',
      groq: '⚙️',
      mistral: '✨',
      perplex: '🌐'
    };
    return icons[provider] || '🤖';
  };

  const getProviderColor = (provider: string): string => {
    const colors: Record<string, string> = {
      google: 'text-blue-400',
      openai: 'text-cyan-400',
      anthropic: 'text-amber-400',
      groq: 'text-pink-400',
      mistral: 'text-violet-400',
      perplex: 'text-green-400'
    };
    return colors[provider] || 'text-slate-400';
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="animate-spin text-2xl">⚙️</div>
          <div className="text-sm text-slate-400">Synthesizing with multiple models...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 bg-slate-900 border border-slate-700 rounded-lg">
        <h3 className="text-sm font-bold text-indigo-400 uppercase mb-3">🤖 Multi-Model Synthesis</h3>

        <div className="grid grid-cols-2 gap-3 text-xs mb-4">
          <div>
            <div className="text-slate-500 uppercase">Consensus</div>
            <div className="text-lg font-bold text-emerald-400">
              {(result.consensusScore * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <div className="text-slate-500 uppercase">Cost</div>
            <div className="text-lg font-bold text-cyan-400">
              ${result.estimatedCost.toFixed(3)}
            </div>
          </div>
        </div>

        {/* Model Contributions */}
        <div className="space-y-2 mb-4">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Model Contributions</div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(result.modelWeights).map(([provider, weight]) => {
              const config = MULTI_MODEL_OPTIONS[provider as keyof typeof MULTI_MODEL_OPTIONS];
              return (
                <div
                  key={provider}
                  className="p-2 bg-slate-800 rounded border border-slate-700 text-center"
                >
                  <div className={`text-lg ${getProviderColor(provider)}`}>
                    {getProviderIcon(provider)}
                  </div>
                  <div className="text-[9px] text-slate-300 mt-1">{config?.modelId.split('-')[0]}</div>
                  <div className="text-xs font-bold text-white mt-1">
                    {(weight * 100).toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Disagreements */}
        {result.dissents.length > 0 && (
          <div className="mb-4 p-2 bg-amber-950 border border-amber-700 rounded">
            <div className="text-[10px] text-amber-400 font-bold uppercase mb-1">Disagreements</div>
            <div className="space-y-1">
              {result.dissents.map((dissent, i) => (
                <div key={i} className="text-[9px] text-amber-200">⚠️ {dissent}</div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onResynthesize}
          className="w-full px-3 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded transition"
        >
          Re-synthesize
        </button>
      </div>

      {/* Model Responses */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-300 uppercase px-2">Individual Responses</h4>
        {result.modelResponses.map((response, i) => (
          <div
            key={i}
            className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-lg ${getProviderColor(response.provider)}`}>
                {getProviderIcon(response.provider)}
              </span>
              <span className="font-bold text-white">{response.provider}</span>
              <span className="text-slate-500 text-[9px]">
                Confidence: {(response.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed line-clamp-4">
              {response.response}
            </p>
          </div>
        ))}
      </div>

      {/* Merged Result */}
      <div className="p-4 bg-slate-900 border border-emerald-700 rounded-lg">
        <h4 className="text-xs font-bold text-emerald-400 uppercase mb-3">✓ Merged Architecture</h4>
        <p className="text-xs text-slate-300 leading-relaxed">
          {result.mergedArchitecture}
        </p>
      </div>
    </div>
  );
};

export default MultiModelPanel;
