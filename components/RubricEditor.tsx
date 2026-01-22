import React, { useState } from 'react';
import type { CustomScoringRubric, ScoringDimension } from '../services/customScoringRubric';
import { generateCustomRubric, saveRubric } from '../services/customScoringRubric';

interface RubricEditorProps {
  rubric: CustomScoringRubric;
  onSave: (rubric: CustomScoringRubric) => void;
  onCancel: () => void;
}

const RubricEditor: React.FC<RubricEditorProps> = ({ rubric, onSave, onCancel }) => {
  const [editingRubric, setEditingRubric] = useState<CustomScoringRubric>(rubric);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState('');

  const handleDimensionChange = (dimId: string, field: keyof ScoringDimension, value: any) => {
    setEditingRubric(prev => ({
      ...prev,
      dimensions: prev.dimensions.map(d =>
        d.id === dimId ? { ...d, [field]: value } : d
      )
    }));
  };

  const handleWeightChange = (dimId: string, weight: number) => {
    const dimensions = editingRubric.dimensions.map(d =>
      d.id === dimId ? { ...d, weight } : d
    );

    // Normalize weights to sum to 1.0
    const total = dimensions.reduce((sum, d) => sum + d.weight, 0);
    const normalized = dimensions.map(d => ({
      ...d,
      weight: d.weight / total
    }));

    setEditingRubric(prev => ({
      ...prev,
      dimensions: normalized
    }));
  };

  const handleGenerateFromPrompt = async () => {
    if (!generationPrompt.trim()) return;
    
    setIsGenerating(true);
    try {
      const generated = await generateCustomRubric(
        generationPrompt,
        editingRubric.projectType
      );
      setEditingRubric(generated);
      setGenerationPrompt('');
    } catch (err) {
      console.error('Generation failed:', err);
      alert('Failed to generate rubric from prompt');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    saveRubric(editingRubric);
    onSave(editingRubric);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-950 border border-slate-700 rounded-lg max-w-2xl max-h-[90vh] overflow-y-auto w-full">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">{editingRubric.name}</h2>

          {/* Generation Section */}
          <div className="mb-6 p-4 bg-slate-900 rounded border border-slate-700">
            <h3 className="text-sm font-bold text-indigo-400 mb-3 uppercase">Generate from Description</h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={generationPrompt}
                onChange={(e) => setGenerationPrompt(e.target.value)}
                placeholder="e.g., 'Prioritize security and scalability for enterprise applications'"
                className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-xs text-white placeholder-slate-500"
              />
              <button
                onClick={handleGenerateFromPrompt}
                disabled={isGenerating || !generationPrompt.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white text-xs font-bold rounded transition"
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>

          {/* Dimensions */}
          <div className="space-y-4 mb-6">
            <h3 className="text-sm font-bold text-emerald-400 uppercase">Evaluation Dimensions</h3>
            {editingRubric.dimensions.map((dim) => (
              <div key={dim.id} className="p-4 bg-slate-900 rounded border border-slate-700 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={dim.name}
                    onChange={(e) => handleDimensionChange(dim.id, 'name', e.target.value)}
                    className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white"
                    placeholder="Dimension name"
                  />
                  <div className="flex gap-2 items-center">
                    <label className="text-xs text-slate-400">Weight:</label>
                    <input
                      type="range"
                      min="0.05"
                      max="0.5"
                      step="0.05"
                      value={dim.weight}
                      onChange={(e) => handleWeightChange(dim.id, parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs text-white font-bold w-10">
                      {(dim.weight * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <textarea
                  value={dim.description}
                  onChange={(e) => handleDimensionChange(dim.id, 'description', e.target.value)}
                  className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white"
                  placeholder="What does this measure?"
                  rows={2}
                />

                <textarea
                  value={dim.rubricGuidelines || ''}
                  onChange={(e) => handleDimensionChange(dim.id, 'rubricGuidelines', e.target.value)}
                  className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white"
                  placeholder="Scoring guidelines (e.g., '100: Excellent, 50: Fair, 0: Poor')"
                  rows={2}
                />

                {dim.examples && (
                  <div className="grid grid-cols-2 gap-2 text-[9px]">
                    <textarea
                      value={dim.examples.good}
                      onChange={(e) => handleDimensionChange(dim.id, 'examples', {
                        good: e.target.value,
                        bad: dim.examples!.bad
                      })}
                      className="p-2 bg-green-950 border border-green-700 rounded text-green-200"
                      placeholder="Good example"
                      rows={2}
                    />
                    <textarea
                      value={dim.examples.bad}
                      onChange={(e) => handleDimensionChange(dim.id, 'examples', {
                        good: dim.examples!.good,
                        bad: e.target.value
                      })}
                      className="p-2 bg-red-950 border border-red-700 rounded text-red-200"
                      placeholder="Bad example"
                      rows={2}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Weight Verification */}
          <div className="mb-6 p-3 bg-slate-900 rounded text-xs">
            <div className="text-slate-400 mb-1">Total Weight:</div>
            <div className={`font-bold ${
              Math.abs(editingRubric.dimensions.reduce((sum, d) => sum + d.weight, 0) - 1.0) < 0.01
                ? 'text-emerald-400'
                : 'text-red-400'
            }`}>
              {(editingRubric.dimensions.reduce((sum, d) => sum + d.weight, 0) * 100).toFixed(0)}%
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={Math.abs(editingRubric.dimensions.reduce((sum, d) => sum + d.weight, 0) - 1.0) > 0.01}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white text-xs font-bold rounded transition"
            >
              Save Rubric
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RubricEditor;
