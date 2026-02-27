import React from "react";
import { Grip, Copy, Trash2 } from "lucide-react";
import type { Section, FollowUpQuestion } from "../../types/forms";
import QuestionsList from "../QuestionsList";

interface SectionEditorProps {
  section: Section;
  availableSections?: Section[];
  onUpdate: (updates: Partial<Section>) => void;
  onRemove: () => void;
  onCopy?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export default function SectionEditor({
  section,
  availableSections = [],
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

          <div>
            <label className="block text-sm font-medium text-neutral-600 mb-2">
              After Section Action (What should happen next?)
            </label>
            <div className="flex flex-col space-y-3 p-4 bg-white border border-neutral-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <input
                  type="radio"
                  id={`continue-${section.id}`}
                  name={`after-section-${section.id}`}
                  checked={!section.nextSectionId}
                  onChange={() => onUpdate({ nextSectionId: undefined })}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor={`continue-${section.id}`} className="text-sm text-neutral-700">
                  Continue to next sequential section
                </label>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="radio"
                  id={`end-${section.id}`}
                  name={`after-section-${section.id}`}
                  checked={section.nextSectionId === "end"}
                  onChange={() => onUpdate({ nextSectionId: "end" })}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor={`end-${section.id}`} className="text-sm text-neutral-700">
                  End the form here
                </label>
              </div>

              <div className="flex items-start space-x-3">
                <input
                  type="radio"
                  id={`jump-${section.id}`}
                  name={`after-section-${section.id}`}
                  checked={!!section.nextSectionId && section.nextSectionId !== "end"}
                  onChange={() => {
                    const firstAvailable = availableSections.find(s => s.id !== section.id);
                    onUpdate({ nextSectionId: firstAvailable?.id });
                  }}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500 mt-1"
                />
                <div className="flex-1">
                  <label htmlFor={`jump-${section.id}`} className="text-sm text-neutral-700 mb-2 block">
                    Go to specific section
                  </label>
                  {!!section.nextSectionId && section.nextSectionId !== "end" && (
                    <select
                      value={section.nextSectionId}
                      onChange={(e) => onUpdate({ nextSectionId: e.target.value })}
                      className="input-field mt-1"
                    >
                      {availableSections
                        .filter((s) => s.id !== section.id)
                        .map((s, idx) => (
                          <option key={s.id} value={s.id}>
                            Section {idx + 1}: {s.title || "Untitled Section"}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              This decides the path after this section is completed.
            </p>
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
