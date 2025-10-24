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
    <div className={`space-y-4 ${getIndentClass(depth)}`}>
      {followUpQuestions.map((followUpQ, fqIndex) => (
        <div
          key={followUpQ.id}
          className={`bg-gradient-to-br from-white to-gray-50 p-5 rounded-xl border-2 ${getBorderColor(
            depth
          )} shadow-sm hover:shadow-md transition-shadow duration-200`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                  depth === 0
                    ? "bg-blue-100 text-blue-700"
                    : depth === 1
                    ? "bg-green-100 text-green-700"
                    : depth === 2
                    ? "bg-purple-100 text-purple-700"
                    : "bg-orange-100 text-orange-700"
                }`}
              >
                Level {depth + 1} · Q{fqIndex + 1}
              </span>
              <span className="text-xs text-gray-500">Follow-up Question</span>
            </div>
            <button
              onClick={() => onDelete(sectionId, followUpQ.id, path)}
              className="p-2 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200"
              title="Delete follow-up question"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Show When - Full Width */}
            <div className="lg:col-span-2">
              <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs mr-2">
                  1
                </span>
                Show when answer is
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
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
              >
                <option value="">Select trigger option...</option>
                {parentQuestion.options?.map((option, optIndex) => (
                  <option key={optIndex} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {/* Question Text - Full Width */}
            <div className="lg:col-span-2">
              <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs mr-2">
                  2
                </span>
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
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                placeholder="Enter your follow-up question..."
              />
            </div>

            {/* Question Type */}
            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs mr-2">
                  3
                </span>
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
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
              >
                {questionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Required Checkbox - Styled */}
            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs mr-2">
                  4
                </span>
                Options
              </label>
              <div className="flex items-center h-[42px] px-4 py-2.5 border-2 border-gray-300 rounded-lg bg-gray-50">
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
                  className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor={`required-${followUpQ.id}`}
                  className="ml-3 text-sm font-medium text-gray-700 cursor-pointer"
                >
                  Required Question
                </label>
              </div>
            </div>

            {/* Description - Full Width */}
            <div className="lg:col-span-2">
              <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs mr-2">
                  5
                </span>
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
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm resize-none"
                rows={2}
                placeholder="Add helpful context or instructions..."
              />
            </div>

            {/* Options for radio, checkbox, select, search-select - Full Width */}
            {requiresFollowUp(followUpQ.type) && (
              <div className="lg:col-span-2">
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs mr-2">
                    6
                  </span>
                  Answer Options
                </label>
                <div className="space-y-2">
                  {followUpQ.options?.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                        {index + 1}
                      </span>
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
                        className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                        placeholder={`Option ${index + 1}`}
                      />
                      <button
                        onClick={() =>
                          onRemoveOption(sectionId, followUpQ.id, index, path)
                        }
                        className="p-2 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200"
                        title="Remove option"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => onAddOption(sectionId, followUpQ.id, path)}
                    className="flex items-center px-4 py-2 text-blue-600 hover:text-white hover:bg-blue-600 border-2 border-blue-600 rounded-lg transition-all duration-200 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Option
                  </button>
                </div>
              </div>
            )}

            {/* Correct Answer Section */}
            {followUpQ.options && followUpQ.options.length > 0 && (
              <div className="lg:col-span-2">
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600 text-xs mr-2">
                    ✓
                  </span>
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
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors text-sm"
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
              <div
                className={`mt-6 p-4 ${getBgColor(
                  depth + 1
                )} rounded-xl border-2 ${getBorderColor(depth + 1)}`}
              >
                <div className="flex items-center mb-3">
                  <div className="flex-1 flex items-center">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        depth === 0
                          ? "bg-green-100 text-green-700"
                          : depth === 1
                          ? "bg-purple-100 text-purple-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      Nested Follow-ups
                    </span>
                  </div>
                </div>

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
                <div className="space-y-2 mt-3">
                  <p className="text-xs text-gray-600 font-medium mb-2">
                    Add follow-up questions for specific answers:
                  </p>
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
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm border-2 border-green-300 rounded-lg text-green-700 hover:bg-green-50 hover:border-green-500 transition-all duration-200 font-medium"
                    >
                      <span>
                        If answer is:{" "}
                        <span className="font-semibold">"{option}"</span>
                      </span>
                      <Plus className="w-4 h-4" />
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
