import React, { useMemo } from "react";
import { X, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

interface Parameter {
  name: string;
  type: "main" | "followup";
}

interface QuestionPreview {
  text: string;
  type: string;
  required: boolean;
  subParam1?: string;
  subParam2?: string;
  options?: string[];
  hasFollowUps?: boolean;
}

interface SectionPreview {
  title: string;
  description?: string;
  weightage?: number;
  questions: QuestionPreview[];
}

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  formData: {
    title: string;
    description: string;
    sections: SectionPreview[];
  };
  parameters: Parameter[];
  isLoading?: boolean;
}

export default function ImportPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  formData,
  parameters,
  isLoading = false,
}: ImportPreviewModalProps) {
  const [expandedSections, setExpandedSections] = React.useState<
    Record<number, boolean>
  >({});

  const { mainParams, followupParams } = useMemo(() => {
    return {
      mainParams: parameters.filter((p) => p.type === "main"),
      followupParams: parameters.filter((p) => p.type === "followup"),
    };
  }, [parameters]);

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const countQuestions = () => {
    return formData.sections.reduce((sum, s) => sum + s.questions.length, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Import Preview
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Review your form structure and parameters before importing
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Form Title & Description */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              {formData.title}
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {formData.description}
            </p>
          </div>

          {/* Parameters Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Parameters to Create
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Main Parameters */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Main Parameters ({mainParams.length})
                </h4>
                {mainParams.length > 0 ? (
                  <ul className="space-y-2">
                    {mainParams.map((param, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-purple-800 dark:text-purple-200 flex items-center gap-2"
                      >
                        <span className="w-2 h-2 bg-purple-600 rounded-full" />
                        {param.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-purple-600 dark:text-purple-300">
                    No main parameters
                  </p>
                )}
              </div>

              {/* Followup Parameters */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Followup Parameters ({followupParams.length})
                </h4>
                {followupParams.length > 0 ? (
                  <ul className="space-y-2">
                    {followupParams.map((param, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2"
                      >
                        <span className="w-2 h-2 bg-green-600 rounded-full" />
                        {param.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-green-600 dark:text-green-300">
                    No followup parameters
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Sections & Questions */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Form Sections ({formData.sections.length} sections,{" "}
              {countQuestions()} questions)
            </h3>

            <div className="space-y-3">
              {formData.sections.map((section, sectionIdx) => (
                <div
                  key={sectionIdx}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(sectionIdx)}
                    className="w-full bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex-1 text-left">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {section.title}
                      </h4>
                      {section.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {section.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {section.questions.length} question
                        {section.questions.length !== 1 ? "s" : ""}
                        {section.weightage !== undefined &&
                          ` • Weightage: ${section.weightage}%`}
                      </p>
                    </div>
                    {expandedSections[sectionIdx] ? (
                      <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>

                  {/* Questions List */}
                  {expandedSections[sectionIdx] && (
                    <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
                      {section.questions.map((question, qIdx) => (
                        <div
                          key={qIdx}
                          className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-medium text-gray-900 dark:text-gray-100 flex-1">
                              {question.text}
                            </p>
                            {question.required && (
                              <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 px-2 py-1 rounded ml-2">
                                Required
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded text-xs font-medium">
                              {question.type}
                            </span>
                            {question.hasFollowUps && (
                              <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200 rounded text-xs font-medium">
                                Has Follow-ups
                              </span>
                            )}
                          </div>

                          {/* Parameters */}
                          {(question.subParam1 || question.subParam2) && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {question.subParam1 && (
                                <div className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200 px-2 py-1 rounded">
                                  <span className="font-medium">Main:</span>{" "}
                                  {question.subParam1}
                                </div>
                              )}
                              {question.subParam2 && (
                                <div className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded">
                                  <span className="font-medium">Followup:</span>{" "}
                                  {question.subParam2}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Options */}
                          {question.options && question.options.length > 0 && (
                            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Options: </span>
                              {question.options.join(", ")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Warning/Info Messages */}
          {parameters.length === 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  No parameters found
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  The Excel file doesn't contain a Parameters sheet. You can
                  create parameters after importing the form.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Confirm & Import
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
