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
  trackResponseRank?: boolean;
  trackResponseRankLabel?: string;
  trackResponseRankType?: string;

  options?: string[];
  allowedFileTypes?: string[];
  description?: string;
  imageUrl?: string;
  subParam1?: string;
  subParam2?: string;
  showWhen?: ShowWhen;
  parentId: string;
  followUpQuestions?: FollowUpQuestion[];
  requireFollowUp?: boolean;
  correctAnswer?: string;
}

interface Parameter {
  id: string;
  name: string;
  type: "main" | "followup";
}

interface NestedFollowUpRendererProps {
  followUpQuestions: FollowUpQuestion[];
  sectionId: string;
  parentQuestion: {
    id: string;
    options?: string[];
  };
  path: string[]; // Path to current level in the nested structure
  parameters?: Parameter[];
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
  parameters = [],
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
    return ["radio", "checkbox", "select", "search-select","yesNoNA"].includes(type);
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
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
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
                <span className="text-xs text-gray-500 dark:text-gray-500">Follow-up Question</span>
              </div>
              <div className="flex items-center space-x-2">
                 <label className="flex items-center space-x-1 cursor-pointer px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg transition-colors" title="Track Question">
                  <input
                    type="checkbox"
                    checked={followUpQ.trackResponseQuestion || false}
                    disabled={followUpQ.trackResponseRank || false}
                    onChange={(e) =>
                      onUpdate(
                        sectionId,
                        followUpQ.id,
                        { trackResponseQuestion: e.target.checked },
                        path
                      )
                    }
                    className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
                  />
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">Track Question</span>
                </label>
                <label className="flex items-center space-x-1 cursor-pointer px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg transition-colors" title="Track Rank">
                  <input
                    type="checkbox"
                    checked={followUpQ.trackResponseRank || false}
                    disabled={followUpQ.trackResponseQuestion || false}
                    onChange={(e) =>
                      onUpdate(
                        sectionId,
                        followUpQ.id,
                        { trackResponseRank: e.target.checked },
                        path
                      )
                    }
                    className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
                  />
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">Track Rank</span>
                </label>
                <button
                  onClick={() => onDelete(sectionId, followUpQ.id, path)}
                  className="p-2 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200"
                  title="Delete follow-up question"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Parameter Display */}
            {followUpQ.subParam1 && (
              <div className="mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 border border-purple-300 dark:border-purple-600 rounded-lg">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                    {followUpQ.subParam1}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Show When - Full Width */}
              <div className="lg:col-span-2">
              <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
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
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
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
              <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
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
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                placeholder="Enter your follow-up question..."
              />
            </div>

            <div className="lg:col-span-2">
              <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs mr-2">
                  3
                </span>
                Question Image (optional)
              </label>
              <div className="space-y-3">
                {followUpQ.imageUrl ? (
                  <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <img
                      src={followUpQ.imageUrl}
                      alt={`Follow-up question ${fqIndex + 1} image`}
                      className="h-20 w-20 object-contain rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
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
                  <label className="inline-flex items-center justify-center px-3 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer text-sm font-medium text-blue-600 hover:border-blue-400 hover:text-blue-700 transition-colors">
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
                  <p className="text-xs text-gray-500 dark:text-gray-500">JPEG or PNG up to 50KB.</p>
                </div>
              </div>
            </div>

            {/* Question Type */}
            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
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

  
  // Handle Yes/No/NA type - initialize with default options but make them editable
  if (nextType === "yesNoNA") {
    // Only set default options if there are no existing options
    if (!followUpQ.options || followUpQ.options.length === 0) {
      updates.options = ["Yes", "No", "N/A"];
    }
    updates.correctAnswer = "Yes";
  }
  // Handle other multiple choice types
  else if (requiresFollowUp(nextType)) {
    if (!followUpQ.options || followUpQ.options.length === 0) {
      updates.options = ["Option 1", "Option 2"];
    }
    // Clear correctAnswer if switching from Yes/No/NA
    if (followUpQ.type === "yesNoNA") {
      updates.correctAnswer = undefined;
    }
  } 
  // Handle non-option types
  else {
    updates.options = undefined;
    updates.correctAnswer = undefined;
  }
  
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
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
              >
                {questionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
                        {/* Track Rank Configuration */}
            {followUpQ.trackResponseRank && (
              <div className="lg:col-span-2 mt-2 p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider">Track Rank Configuration</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2 uppercase tracking-wide">
                      Track Rank Question Label
                    </label>
                    <input
                      type="text"
                      value={followUpQ.trackResponseRankLabel || ""}
                      onChange={(e) =>
                        onUpdate(
                          sectionId,
                          followUpQ.id,
                          { trackResponseRankLabel: e.target.value },
                          path
                        )
                      }
                      className="w-full px-3 py-2.5 border-2 border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm bg-white dark:bg-gray-900"
                      placeholder="Enter label for rank tracking"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2 uppercase tracking-wide">
                      Track Rank Question Type
                    </label>
                    <select
                      value={followUpQ.trackResponseRankType || "text"}
                      onChange={(e) =>
                        onUpdate(
                          sectionId,
                          followUpQ.id,
                          { trackResponseRankType: e.target.value },
                          path
                        )
                      }
                      className="w-full px-3 py-2.5 border-2 border-blue-200 dark:border-blue-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm bg-white dark:bg-gray-900"
                    >
                      {questionTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {followUpQ.trackResponseQuestion && (
              <div className="lg:col-span-2 mt-2 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                  <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100 uppercase tracking-wider">Track Question Configuration</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2 uppercase tracking-wide">
                      Track Question Label
                    </label>
                    <input
                      type="text"
                      value={followUpQ.trackResponseQuestionLabel || ""}
                      onChange={(e) =>
                        onUpdate(
                          sectionId,
                          followUpQ.id,
                          { trackResponseQuestionLabel: e.target.value },
                          path
                        )
                      }
                      className="w-full px-3 py-2.5 border-2 border-indigo-200 dark:border-indigo-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm bg-white dark:bg-gray-900"
                      placeholder="Enter label for tracking question"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2 uppercase tracking-wide">
                      Track Question Type
                    </label>
                    <select
                      value={followUpQ.trackResponseQuestionType || "text"}
                      onChange={(e) =>
                        onUpdate(
                          sectionId,
                          followUpQ.id,
                          { trackResponseQuestionType: e.target.value },
                          path
                        )
                      }
                      className="w-full px-3 py-2.5 border-2 border-indigo-200 dark:border-indigo-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm bg-white dark:bg-gray-900"
                    >
                      {questionTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}



            {followUpQ.type === "file" ? (
              <div className="lg:col-span-2">
                <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
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
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                >
                  {fileTypeOptions.map((option) => (
                    <option key={`${followUpQ.id}-file-type-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {selectedFileType === "any"
                    ? "Respondents can upload any file type."
                    : `Respondents must upload files matching ${selectedFileTypeOption?.label}.`}
                </p>
              </div>
            ) : null}

            {/* Required Checkbox - Styled */}
            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs mr-2">
                  6
                </span>
                Options
              </label>
              <div className="flex flex-col gap-2 p-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800">
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
                    className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <label
                    htmlFor={`required-${followUpQ.id}`}
                    className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    Required Question
                  </label>
                </div>
              </div>
            </div>

            {/* Description - Full Width */}
            <div className="lg:col-span-2">
              <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
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
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm resize-none"
                rows={2}
                placeholder="Add helpful context or instructions..."
              />
            </div>

            {/* Sub Parameters - Full Width */}
            <div className="lg:col-span-2">
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    Sub Parameter 1
                  </label>
                  <select
                    value={followUpQ.subParam1 || ""}
                    onChange={(e) =>
                      onUpdate(
                        sectionId,
                        followUpQ.id,
                        {
                          subParam1: e.target.value,
                        },
                        path
                      )
                    }
                    className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="">-- Select Parameter --</option>
                    {parameters
                      .filter(param => param.type === 'followup')
                      .map((param) => (
                        <option key={param.id} value={param.name}>
                          {param.name} (followup)
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
                    Sub Parameter 2
                  </label>
                  <select
                    value={followUpQ.subParam2 || ""}
                    onChange={(e) =>
                      onUpdate(
                        sectionId,
                        followUpQ.id,
                        {
                          subParam2: e.target.value,
                        },
                        path
                      )
                    }
                    className="w-full px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="">-- Select Parameter --</option>
                    {parameters
                      .filter(param => param.type === 'followup')
                      .map((param) => (
                        <option key={param.id} value={param.name}>
                          {param.name} (followup)
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Options for radio, checkbox, select, search-select - Full Width */}
       {requiresFollowUp(followUpQ.type) && (
  <div className="lg:col-span-2">
    <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs mr-2">
        8
      </span>
      Answer Options
    </label>
    <div className="space-y-2">
      {followUpQ.options?.map((option, index) => {
        // For follow-up questions, Yes/No/NA options should be editable
        // Only make them read-only if it's the main question (check if depth === 0 and it's the root level)
        const isMainQuestionYesNoNA = false; // Since this is a follow-up renderer, all questions here are follow-ups
        
        // Alternatively, if you want to allow editing for ALL Yes/No/NA follow-ups:
        const isReadOnly = false; // Allow editing for follow-up questions
        
        return (
          <div key={index} className="relative">
            <div className="flex items-center space-x-2">
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-medium">
                {index + 1}
              </span>
              
              {/* Option input - Editable for follow-up questions */}
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
                className={`flex-1 px-4 py-2 border-2 rounded-lg transition-colors text-sm ${
                  isReadOnly
                    ? "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-600 cursor-not-allowed"
                    : "border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                }`}
                placeholder={`Option ${index + 1}`}
                disabled={isReadOnly}
                readOnly={isReadOnly}
              />
              
              {/* Three-dot menu - ALWAYS show for ALL options */}
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMenu(`${followUpQ.id}-${index}`);
                  }}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200"
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {openMenus[`${followUpQ.id}-${index}`] && (
                  <>
                    {/* Backdrop to close menu */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => closeMenu(`${followUpQ.id}-${index}`)}
                    />
                    <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md z-50 min-w-[200px]">
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
                        📝 Add a question for this option
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
                          📄 Add a section for this option
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
                          🔗 Link a form for this option
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Delete button - Always show for follow-up questions */}
              <button
                onClick={() =>
                  onRemoveOption(sectionId, followUpQ.id, index, path)
                }
                className="flex-shrink-0 p-2 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200"
                title="Remove option"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
      
      {/* Add Option button - Always show for follow-up questions */}
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
                <label className="flex items-center text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
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
                  className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors text-sm"
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
                      parameters={parameters}
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
