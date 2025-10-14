import React from "react";
import { Trash2, Plus, X } from "lucide-react";

interface ShowWhen {
  questionId: string;
  value: string | number;
}

interface FollowUpQuestion {
  id: string;
  text: string;
  type: string;
  required: boolean;
  options?: string[];
  description?: string;
  showWhen?: ShowWhen;
  parentId: string;
  followUpQuestions?: FollowUpQuestion[];
  requireFollowUp?: boolean;
  correctAnswer?: string;
}

interface NestedFollowUpRendererProps {
  followUpQuestions: FollowUpQuestion[];
  sectionId: string;
  parentQuestion: {
    id: string;
    options?: string[];
  };
  path: string[]; // Path to current level in the nested structure
  onUpdate: (
    sectionId: string,
    followUpQuestionId: string,
    updates: Partial<FollowUpQuestion>,
    path: string[]
  ) => void;
  onDelete: (
    sectionId: string,
    followUpQuestionId: string,
    path: string[]
  ) => void;
  onAddNested: (
    sectionId: string,
    parentQuestionId: string,
    triggerValue: string,
    path: string[]
  ) => void;
  onAddOption: (
    sectionId: string,
    followUpQuestionId: string,
    path: string[]
  ) => void;
  onUpdateOption: (
    sectionId: string,
    followUpQuestionId: string,
    optionIndex: number,
    value: string,
    path: string[]
  ) => void;
  onRemoveOption: (
    sectionId: string,
    followUpQuestionId: string,
    optionIndex: number,
    path: string[]
  ) => void;
  questionTypes: Array<{
    value: string;
    label: string;
    description: string;
  }>;
  depth?: number; // Track nesting depth for visual indentation
}

export const NestedFollowUpRenderer: React.FC<NestedFollowUpRendererProps> = ({
  followUpQuestions,
  sectionId,
  parentQuestion,
  path,
  onUpdate,
  onDelete,
  onAddNested,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  questionTypes,
  depth = 0,
}) => {
  const requiresFollowUp = (type: string): boolean => {
    return ["radio", "checkbox", "select", "search-select"].includes(type);
  };

  const getIndentClass = (depth: number): string => {
    const indents = [
      "ml-0",
      "ml-4",
      "ml-8",
      "ml-12",
      "ml-16",
      "ml-20",
      "ml-24",
    ];
    return indents[Math.min(depth, indents.length - 1)];
  };

  const getBorderColor = (depth: number): string => {
    const colors = [
      "border-blue-200",
      "border-green-200",
      "border-purple-200",
      "border-orange-200",
      "border-pink-200",
      "border-indigo-200",
    ];
    return colors[depth % colors.length];
  };

  const getBgColor = (depth: number): string => {
    const colors = [
      "bg-blue-50",
      "bg-green-50",
      "bg-purple-50",
      "bg-orange-50",
      "bg-pink-50",
      "bg-indigo-50",
    ];
    return colors[depth % colors.length];
  };

  return (
    <div className={`space-y-3 ${getIndentClass(depth)}`}>
      {followUpQuestions.map((followUpQ, fqIndex) => (
        <div
          key={followUpQ.id}
          className={`bg-white p-3 rounded border ${getBorderColor(depth)}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-600">
              Follow-up Level {depth + 1} - Question {fqIndex + 1}
            </span>
            <button
              onClick={() => onDelete(sectionId, followUpQ.id, path)}
              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {/* Show When */}
            <div>
              <label className="block text-xs font-medium text-blue-600 mb-1">
                Show when answer is:
              </label>
              <select
                value={followUpQ.showWhen?.value || ""}
                onChange={(e) =>
                  onUpdate(
                    sectionId,
                    followUpQ.id,
                    {
                      showWhen: {
                        questionId: parentQuestion.id,
                        value: e.target.value,
                      },
                    },
                    path
                  )
                }
                className="input-field text-xs"
              >
                <option value="">Select trigger option</option>
                {parentQuestion.options?.map((option, optIndex) => (
                  <option key={optIndex} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {/* Question Text */}
            <div>
              <label className="block text-xs font-medium text-blue-600 mb-1">
                Question Text
              </label>
              <input
                type="text"
                value={followUpQ.text}
                onChange={(e) =>
                  onUpdate(
                    sectionId,
                    followUpQ.id,
                    { text: e.target.value },
                    path
                  )
                }
                className="input-field text-xs"
                placeholder="Enter follow-up question"
              />
            </div>

            {/* Question Type */}
            <div>
              <label className="block text-xs font-medium text-blue-600 mb-1">
                Question Type
              </label>
              <select
                value={followUpQ.type}
                onChange={(e) =>
                  onUpdate(
                    sectionId,
                    followUpQ.id,
                    {
                      type: e.target.value,
                      options:
                        requiresFollowUp(e.target.value) && !followUpQ.options
                          ? ["Option 1", "Option 2"]
                          : followUpQ.options,
                    },
                    path
                  )
                }
                className="input-field text-xs"
              >
                {questionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Required Checkbox */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id={`required-${followUpQ.id}`}
                checked={followUpQ.required}
                onChange={(e) =>
                  onUpdate(
                    sectionId,
                    followUpQ.id,
                    { required: e.target.checked },
                    path
                  )
                }
                className="mr-2 h-3 w-3 text-blue-600 focus:ring-blue-500 border-neutral-300 rounded"
              />
              <label
                htmlFor={`required-${followUpQ.id}`}
                className="text-xs text-blue-600"
              >
                Required
              </label>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-blue-600 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={followUpQ.description || ""}
                onChange={(e) =>
                  onUpdate(
                    sectionId,
                    followUpQ.id,
                    { description: e.target.value },
                    path
                  )
                }
                className="input-field text-xs"
                rows={2}
                placeholder="Add a description"
              />
            </div>

            {/* Options for radio, checkbox, select, search-select */}
            {requiresFollowUp(followUpQ.type) && (
              <div>
                <label className="block text-xs font-medium text-blue-600 mb-1">
                  Options
                </label>
                <div className="space-y-1">
                  {followUpQ.options?.map((option, index) => (
                    <div key={index} className="flex items-center space-x-1">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) =>
                          onUpdateOption(
                            sectionId,
                            followUpQ.id,
                            index,
                            e.target.value,
                            path
                          )
                        }
                        className="flex-1 p-1 border border-neutral-300 rounded text-xs focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder={`Option ${index + 1}`}
                      />
                      <button
                        onClick={() =>
                          onRemoveOption(sectionId, followUpQ.id, index, path)
                        }
                        className="p-1 text-red-500 hover:text-red-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => onAddOption(sectionId, followUpQ.id, path)}
                    className="flex items-center text-blue-600 hover:text-blue-800 text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Option
                  </button>
                </div>
              </div>
            )}

            {/* Correct Answer Section */}
            {followUpQ.options && followUpQ.options.length > 0 && (
              <div className="mt-2">
                <label className="block text-xs font-medium text-blue-600 mb-1">
                  Correct Answer (Optional)
                </label>
                <select
                  value={followUpQ.correctAnswer || ""}
                  onChange={(e) =>
                    onUpdate(
                      sectionId,
                      followUpQ.id,
                      {
                        correctAnswer: e.target.value || undefined,
                      },
                      path
                    )
                  }
                  className="w-full p-1 border border-neutral-300 rounded text-xs focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">No correct answer</option>
                  {followUpQ.options.map((option, index) => (
                    <option key={index} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Nested Follow-up Questions */}
          {requiresFollowUp(followUpQ.type) &&
            followUpQ.options &&
            followUpQ.options.length > 0 && (
              <div className={`mt-3 p-2 ${getBgColor(depth + 1)} rounded-lg`}>
                <h6 className="text-xs font-medium text-gray-700 mb-2">
                  Nested Follow-ups for this question
                </h6>

                {/* Render existing nested follow-ups */}
                {followUpQ.followUpQuestions &&
                  followUpQ.followUpQuestions.length > 0 && (
                    <NestedFollowUpRenderer
                      followUpQuestions={followUpQ.followUpQuestions}
                      sectionId={sectionId}
                      parentQuestion={{
                        id: followUpQ.id,
                        options: followUpQ.options,
                      }}
                      path={[...path, followUpQ.id]}
                      onUpdate={onUpdate}
                      onDelete={onDelete}
                      onAddNested={onAddNested}
                      onAddOption={onAddOption}
                      onUpdateOption={onUpdateOption}
                      onRemoveOption={onRemoveOption}
                      questionTypes={questionTypes}
                      depth={depth + 1}
                    />
                  )}

                {/* Add nested follow-up buttons */}
                <div className="space-y-1 mt-2">
                  {followUpQ.options?.map((option, optIndex) => (
                    <button
                      key={optIndex}
                      onClick={() => {
                        console.log("Add nested follow-up clicked:", {
                          sectionId,
                          followUpQId: followUpQ.id,
                          option,
                          path: [...path, followUpQ.id],
                        });
                        onAddNested(sectionId, followUpQ.id, option, [
                          ...path,
                          followUpQ.id,
                        ]);
                      }}
                      className="w-full p-2 text-xs border border-green-300 rounded text-green-600 hover:bg-green-100 transition-colors"
                    >
                      Add nested follow-up for "{option}"
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>
      ))}
    </div>
  );
};
