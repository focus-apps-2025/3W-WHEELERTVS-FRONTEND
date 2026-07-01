import React from "react";
import { Trash2 } from "lucide-react";
import type { FollowUpQuestion, QuestionType } from "../../types";
import QuestionTypeSelector from "./QuestionTypeSelector";
import OptionsEditor from "./OptionsEditor";
import GridOptionsEditor from "./GridOptionsEditor";

interface QuestionEditorProps {
  question: FollowUpQuestion;
  onUpdate: (updates: Partial<FollowUpQuestion>) => void;
  onRemove: () => void;
}

export default function QuestionEditor({
  question,
  onUpdate,
  onRemove,
}: QuestionEditorProps) {
  const handleTypeChange = (type: QuestionType) => {
    const updates: Partial<FollowUpQuestion> = { type };

    // Initialize options for types that need them
    if (["radio", "checkbox", "radio-image"].includes(type)) {
      updates.options = [""];
      
    }
    if (type.startsWith("chassis-")) {
      updates.trackResponseQuestion = true;
      updates.trackResponseQuestionType = "text";
      updates.trackResponseQuestionLabel = "Chassis Number";
    }

    // Initialize grid options for grid types
    if (["radio-grid", "checkbox-grid"].includes(type)) {
      updates.gridOptions = { rows: [""], columns: [""] };
    }

    onUpdate(updates);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-4">
          <input
            type="text"
            value={question.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Enter question text"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />

          <div className="flex space-x-4">
            <QuestionTypeSelector
              value={question.type}
              onChange={handleTypeChange}
            />

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) => onUpdate({ required: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Required
              </span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={question.trackResponseQuestion || false}
                disabled={question.trackResponseRank || false}
                onChange={(e) => onUpdate({ trackResponseQuestion: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 disabled:opacity-50"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Track Question
              </span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={question.trackResponseRank || false}
                disabled={question.trackResponseQuestion || false}
                onChange={(e) => onUpdate({ trackResponseRank: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 disabled:opacity-50"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Track Rank
              </span>
            </label>
          </div>
          
          {question.trackResponseRank && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl space-y-0">
              <div className="flex flex-col space-y-2">
                <label className="block text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Track Rank Question Label
                </label>
                <input
                  type="text"
                  value={question.trackResponseRankLabel || ""}
                  onChange={(e) => onUpdate({ trackResponseRankLabel: e.target.value })}
                  placeholder="Enter label for rank tracking"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                />
              </div>
              <div className="flex flex-col space-y-2">
                <label className="block text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Track Rank Question Type
                </label>
                <QuestionTypeSelector
                  value={(question.trackResponseRankType as QuestionType) || "text"}
                  onChange={(type) => onUpdate({ trackResponseRankType: type })}
                />
              </div>
            </div>
          )}

          {question.trackResponseQuestion && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-0 mt-4">
              <div className="flex flex-col space-y-2">
                <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                  Track Question Label
                </label>
                <input
                  type="text"
                  value={question.trackResponseQuestionLabel || ""}
                  onChange={(e) => onUpdate({ trackResponseQuestionLabel: e.target.value })}
                  placeholder="Enter label for tracking question"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                />
              </div>
              <div className="flex flex-col space-y-2">
                <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                  Track Question Type
                </label>
                <QuestionTypeSelector
                  value={(question.trackResponseQuestionType as QuestionType) || "text"}
                  onChange={(type) => onUpdate({ trackResponseQuestionType: type })}
                />
              </div>
            </div>
          )}

        </div>

        <button
          onClick={onRemove}
          className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {["radio", "checkbox", "radio-image"].includes(question.type) && (
        <>
          <OptionsEditor
            options={question.options || []}
            onChange={(options) => onUpdate({ options })}
          />

          {/* Correct Answer Selection for Quiz Questions */}
          {question.options && question.options.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Correct Answer (Optional - for quiz mode)
              </label>
              <select
                value={question.correctAnswer || ""}
                onChange={(e) =>
                  onUpdate({
                    correctAnswer: e.target.value || undefined,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">-- No correct answer --</option>
                {question.options
                  .filter((opt) => opt && opt.trim() !== "")
                  .map((option) => (
                    <option
                      key={`${question.id}-correct-${option}`}
                      value={option}
                    >
                      {option}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Select the correct answer if this is a quiz question. Leave
                empty for regular questions.
              </p>
            </div>
          )}
        </>
      )}

      {["radio-grid", "checkbox-grid"].includes(question.type) && (
        <GridOptionsEditor
          gridOptions={question.gridOptions || { rows: [""], columns: [""] }}
          onChange={(gridOptions) => onUpdate({ gridOptions })}
        />
      )}

      {["range", "scale"].includes(question.type) && (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Min
            </label>
            <input
              type="number"
              value={question.min || 0}
              onChange={(e) => onUpdate({ min: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Max
            </label>
            <input
              type="number"
              value={question.max || 10}
              onChange={(e) => onUpdate({ max: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Step
            </label>
            <input
              type="number"
              value={question.step || 1}
              onChange={(e) => onUpdate({ step: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
