import React from "react";
import { Grip, Copy, Trash2 } from "lucide-react";
import type { Section, FollowUpQuestion } from "../../types/forms";
import QuestionsList from "../QuestionsList";

interface SectionEditorProps {
  section: Section;
  onUpdate: (updates: Partial<Section>) => void;
  onRemove: () => void;
  onCopy?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export default function SectionEditor({
  section,
  onUpdate,
  onRemove,
  onCopy,
  onMoveUp,
  onMoveDown,
}: SectionEditorProps) {
  const handleQuestionsChange = (questions: FollowUpQuestion[]) => {
    onUpdate({ questions });
  };

  return (
    <div className="card p-6 space-y-6 bg-neutral-50">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-4">
          <div className="flex items-center space-x-4">
            <Grip className="w-5 h-5 text-primary-400 cursor-move" />
            <div className="flex-1">
              <input
                type="text"
                value={section.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
                placeholder="Section Title"
                className="input-field"
              />
            </div>
            {onCopy && (
              <button
                onClick={onCopy}
                className="p-2 text-primary-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                title="Copy Section"
              >
                <Copy className="w-5 h-5" />
              </button>
            )}
          </div>

          <textarea
            value={section.description || ""}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Section Description (optional)"
            className="input-field resize-none"
            rows={2}
          />

          <div>
            <label className="block text-sm font-medium text-neutral-600 mb-2">
              Section Weightage (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={section.weightage ?? 0}
              onChange={(e) => {
                const value = Number(e.target.value);
                onUpdate({ weightage: Number.isNaN(value) ? 0 : value });
              }}
              placeholder="Enter weightage"
              className="input-field"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 ml-4">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              className="p-2 text-primary-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
              title="Move Up"
            >
              ↑
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              className="p-2 text-primary-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
              title="Move Down"
            >
              ↓
            </button>
          )}
          <button
            onClick={onRemove}
            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            title="Remove Section"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <QuestionsList
        questions={section.questions}
        onQuestionsChange={handleQuestionsChange}
      />
    </div>
  );
}
