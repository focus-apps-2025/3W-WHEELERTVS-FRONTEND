import React, { useState } from "react";
import { Trash2, Plus, X, MoreVertical } from "lucide-react";

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
  allowedFileTypes?: string[];
  description?: string;
  imageUrl?: string;
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
  onImageUpload: (
    sectionId: string,
    followUpQuestionId: string,
    file: File,
    path: string[]
  ) => void;
  onImageRemove: (
    sectionId: string,
    followUpQuestionId: string,
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
  onAddFollowUpSection?: (
    sectionId: string,
    parentQuestionId: string,
    triggerValue: string,
    path: string[]
  ) => void;
  onAddFollowUpForm?: (
    sectionId: string,
    parentQuestionId: string,
    triggerValue: string,
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
  onImageUpload,
  onImageRemove,
  onDelete,
  onAddNested,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  onAddFollowUpSection,
  onAddFollowUpForm,
  questionTypes,
  depth = 0,
}) => {
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const toggleMenu = (menuId: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }));
  };

  const closeMenu = (menuId: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuId]: false,
    }));
  };

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

  const fileTypeOptions = [
    { value: "any", label: "Any file type" },
    { value: "image", label: "Images (JPG, PNG, GIF)" },
    { value: "pdf", label: "PDF" },
    { value: "excel", label: "Excel (XLS, XLSX)" },
  ];

  return (
    <div className={`space-y-4 ${getIndentClass(depth)}`}>
      {followUpQuestions.map((followUpQ, fqIndex) => {
        const selectedFileType = followUpQ.allowedFileTypes?.[0] ?? "any";
        const selectedFileTypeOption = fileTypeOptions.find(
          (option) => option.value === selectedFileType
        );

        return (
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
                Question Text (optional when using image)
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

            <div className="lg:col-span-2">
              <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs mr-2">
                  3
                </span>
                Question Image (optional)
              </label>
              <div className="space-y-3">
                {followUpQ.imageUrl ? (
                  <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <img
                      src={followUpQ.imageUrl}
                      alt={`Follow-up question ${fqIndex + 1} image`}
                      className="h-20 w-20 object-contain rounded-md border border-gray-200 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => onImageRemove(sectionId, followUpQ.id, path)}
                      className="px-3 py-2 text-sm font-semibold text-red-600 hover:text-white hover:bg-red-500 border border-red-200 rounded-lg transition-colors"
                    >
                      Remove Image
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center justify-center px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer text-sm font-medium text-blue-600 hover:border-blue-400 hover:text-blue-700 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          onImageUpload(sectionId, followUpQ.id, file, path);
                          e.target.value = "";
                        }
                      }}
                    />
                    Upload Image
                  </label>
                  <p className="text-xs text-gray-500">JPEG or PNG up to 50KB.</p>
                </div>
              </div>
            </div>

            {/* Question Type */}
            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs mr-2">
                  4
                </span>
                Question Type
              </label>
              <select
                value={followUpQ.type}
                onChange={(e) => {
                  const nextType = e.target.value;
                  const updates: Partial<FollowUpQuestion> = {
                    type: nextType,
                    options:
                      requiresFollowUp(nextType) && !followUpQ.options
                        ? ["Option 1", "Option 2"]
                        : followUpQ.options,
                  };
                  if (nextType === "file") {
                    updates.allowedFileTypes =
                      followUpQ.allowedFileTypes && followUpQ.allowedFileTypes.length > 0
                        ? followUpQ.allowedFileTypes
                        : ["image", "pdf", "excel"];
                  } else if (followUpQ.allowedFileTypes) {
                    updates.allowedFileTypes = undefined;
                  }
                  onUpdate(sectionId, followUpQ.id, updates, path);
                }}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
              >
                {questionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {followUpQ.type === "file" ? (
              <div className="lg:col-span-2">
                <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs mr-2">
                    5
                  </span>
                  Allowed file type
                </label>
                <select
                  value={selectedFileType}
                  onChange={(e) => {
                    const value = e.target.value;
                    onUpdate(
                      sectionId,
                      followUpQ.id,
                      {
                        allowedFileTypes: value === "any" ? undefined : [value],
                      },
                      path
                    );
                  }}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                >
                  {fileTypeOptions.map((option) => (
                    <option key={`${followUpQ.id}-file-type-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedFileType === "any"
                    ? "Respondents can upload any file type."
                    : `Respondents must upload files matching ${selectedFileTypeOption?.label}.`}
                </p>
              </div>
            ) : null}

            {/* Required Checkbox - Styled */}
            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs mr-2">
                  6
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
                  7
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
                    8
                  </span>
                  Answer Options
                </label>
                <div className="space-y-2">
                  {followUpQ.options?.map((option, index) => (
                    <div key={index} className="relative">
                      <div className="flex items-center space-x-2">
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
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => toggleMenu(`${followUpQ.id}-${index}`)}
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200"
                            title="More options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenus[`${followUpQ.id}-${index}`] && (
                            <div className="absolute top-10 right-0 bg-white border border-gray-200 rounded-lg shadow-md z-50 min-w-max">
                              <button
                                type="button"
                                onClick={() => {
                                  onAddNested(sectionId, followUpQ.id, option, [
                                    ...path,
                                    followUpQ.id,
                                  ]);
                                  closeMenu(`${followUpQ.id}-${index}`);
                                }}
                                className="block w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors first:rounded-t-lg"
                              >
                                Add a question for this option
                              </button>

                              {onAddFollowUpSection && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onAddFollowUpSection(
                                      sectionId,
                                      followUpQ.id,
                                      option,
                                      [...path, followUpQ.id]
                                    );
                                    closeMenu(`${followUpQ.id}-${index}`);
                                  }}
                                  className="block w-full text-left px-4 py-2.5 text-sm text-green-600 hover:bg-green-50 transition-colors"
                                >
                                  Add a section for this option
                                </button>
                              )}

                              {onAddFollowUpForm && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onAddFollowUpForm(
                                      sectionId,
                                      followUpQ.id,
                                      option,
                                      [...path, followUpQ.id]
                                    );
                                    closeMenu(`${followUpQ.id}-${index}`);
                                  }}
                                  className="block w-full text-left px-4 py-2.5 text-sm text-purple-600 hover:bg-purple-50 transition-colors last:rounded-b-lg"
                                >
                                  Link a form for this option
                                </button>
                              )}
                            </div>
                          )}
                        </div>
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
                      onImageUpload={onImageUpload}
                      onImageRemove={onImageRemove}
                      onDelete={onDelete}
                      onAddNested={onAddNested}
                      onAddOption={onAddOption}
                      onUpdateOption={onUpdateOption}
                      onRemoveOption={onRemoveOption}
                      onAddFollowUpSection={onAddFollowUpSection}
                      onAddFollowUpForm={onAddFollowUpForm}
                      questionTypes={questionTypes}
                      depth={depth + 1}
                    />
                  )}
              </div>
            )}
        </div>
      );
      })}
    </div>
  );
};
