import React, { useState, useEffect } from "react";
import {
  Save,
  Eye,
  Settings,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

type FollowUpQuestionType = "paragraph" | "text" | "radio";

interface FollowUpConfig {
  hasFollowUp: boolean;
  required: boolean;
  questionText?: string;
  questionType?: FollowUpQuestionType;
  questionOptions?: string[];
}

interface FormWithFollowUpData {
  title: string;
  description: string;
  logoUrl?: string;
  imageUrl?: string;
  options: string[];
  followUpConfig: Record<string, FollowUpConfig>;
}

interface FormWithFollowUpCreatorProps {
  onFormCreated?: (form: any) => void;
  onPreview?: (form: FormWithFollowUpData) => void;
  initialData?: Partial<FormWithFollowUpData>;
}

const DEFAULT_OPTIONS = ["Option A", "Option B", "Option C", "Option D"];
const DEFAULT_FOLLOW_UP_OPTIONS = ["Yes", "No", "N/A"];

const getDefaultFollowUpQuestionText = (option: string) =>
  `Why did you choose ${option}?`;

const createDefaultFollowUpConfig = (
  options: string[]
): Record<string, FollowUpConfig> => {
  return options.reduce((acc, option, index) => {
    const preset = index === 0 || index === options.length - 1;
    acc[option] = {
      hasFollowUp: preset,
      required: preset,
      questionText: getDefaultFollowUpQuestionText(option),
      questionType: "paragraph",
      questionOptions: DEFAULT_FOLLOW_UP_OPTIONS,
    };
    if (!preset) {
      acc[option].hasFollowUp = false;
      acc[option].required = false;
    }
    return acc;
  }, {} as Record<string, FollowUpConfig>);
};

const normalizeFollowUpConfig = (
  options: string[],
  config?: Record<string, FollowUpConfig>
): Record<string, FollowUpConfig> => {
  return options.reduce((acc, option) => {
    const existing = config?.[option];
    const questionText =
      existing?.questionText && existing.questionText.trim().length > 0
        ? existing.questionText.trim()
        : getDefaultFollowUpQuestionText(option);
    const rawType = existing?.questionType;
    const questionType: FollowUpQuestionType =
      rawType === "text" || rawType === "radio" ? rawType : "paragraph";
    const questionOptions =
      questionType === "radio"
        ? existing?.questionOptions && existing.questionOptions.length > 0
          ? existing.questionOptions
          : DEFAULT_FOLLOW_UP_OPTIONS
        : undefined;

    acc[option] = {
      hasFollowUp: existing?.hasFollowUp ?? false,
      required: existing?.required ?? false,
      questionText,
      questionType,
      questionOptions,
    };
    return acc;
  }, {} as Record<string, FollowUpConfig>);
};

const DEFAULT_FOLLOW_UP_CONFIG = createDefaultFollowUpConfig(DEFAULT_OPTIONS);

export const FormWithFollowUpCreator: React.FC<
  FormWithFollowUpCreatorProps
> = ({ onFormCreated, onPreview, initialData }) => {
  const initialOptions = initialData?.options || DEFAULT_OPTIONS;
  const [formData, setFormData] = useState<FormWithFollowUpData>({
    title: initialData?.title || "",
    description: initialData?.description || "",
    logoUrl: initialData?.logoUrl || "",
    imageUrl: initialData?.imageUrl || "",
    options: initialOptions,
    followUpConfig: normalizeFollowUpConfig(
      initialOptions,
      initialData?.followUpConfig || createDefaultFollowUpConfig(initialOptions)
    ),
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleInputChange = (field: keyof FormWithFollowUpData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleOptionChange = (index: number, value: string) => {
    setFormData((prev) => {
      const newOptions = [...prev.options];
      const oldOption = newOptions[index];
      newOptions[index] = value;

      const newConfig = { ...prev.followUpConfig };

      if (oldOption in newConfig && oldOption !== value) {
        const existingConfig = newConfig[oldOption];
        newConfig[value] = {
          ...existingConfig,
          questionText:
            existingConfig.questionText &&
            existingConfig.questionText !==
              getDefaultFollowUpQuestionText(oldOption)
              ? existingConfig.questionText
              : getDefaultFollowUpQuestionText(value),
        };
        delete newConfig[oldOption];
      } else if (!(value in newConfig)) {
        newConfig[value] = {
          hasFollowUp: false,
          required: false,
          questionText: getDefaultFollowUpQuestionText(value),
          questionType: "paragraph",
          questionOptions: DEFAULT_FOLLOW_UP_OPTIONS,
        };
      }

      return {
        ...prev,
        options: newOptions,
        followUpConfig: normalizeFollowUpConfig(newOptions, newConfig),
      };
    });
    setError(null);
  };

  const addOption = () => {
    setFormData((prev) => {
      const newOption = `Option ${String.fromCharCode(65 + prev.options.length)}`;
      const updatedOptions = [...prev.options, newOption];
      const updatedConfig = {
        ...prev.followUpConfig,
        [newOption]: {
          hasFollowUp: false,
          required: false,
          questionText: getDefaultFollowUpQuestionText(newOption),
          questionType: "paragraph",
          questionOptions: DEFAULT_FOLLOW_UP_OPTIONS,
        },
      };

      return {
        ...prev,
        options: updatedOptions,
        followUpConfig: normalizeFollowUpConfig(updatedOptions, updatedConfig),
      };
    });
  };

  const removeOption = (index: number) => {
    if (formData.options.length <= 2) {
      setError("Form must have at least 2 options");
      return;
    }

    setFormData((prev) => {
      const optionToRemove = prev.options[index];
      const updatedOptions = prev.options.filter((_, i) => i !== index);
      const updatedConfig = { ...prev.followUpConfig };
      delete updatedConfig[optionToRemove];

      return {
        ...prev,
        options: updatedOptions,
        followUpConfig: normalizeFollowUpConfig(updatedOptions, updatedConfig),
      };
    });
  };

  const updateFollowUpConfig = (
    option: string,
    config: Partial<FollowUpConfig>
  ) => {
    setFormData((prev) => {
      const existing = prev.followUpConfig[option] || {
        hasFollowUp: false,
        required: false,
        questionText: getDefaultFollowUpQuestionText(option),
        questionType: "paragraph",
        questionOptions: DEFAULT_FOLLOW_UP_OPTIONS,
      };

      const merged: FollowUpConfig = {
        ...existing,
        ...config,
      };

      if (merged.hasFollowUp && (!merged.questionText || merged.questionText.trim().length === 0)) {
        merged.questionText = getDefaultFollowUpQuestionText(option);
      }

      if (merged.questionType === "radio") {
        merged.questionOptions =
          merged.questionOptions && merged.questionOptions.length > 0
            ? merged.questionOptions
            : DEFAULT_FOLLOW_UP_OPTIONS;
      } else {
        merged.questionOptions = undefined;
      }

      const updatedConfig = {
        ...prev.followUpConfig,
        [option]: merged,
      };

      return {
        ...prev,
        followUpConfig: normalizeFollowUpConfig(prev.options, updatedConfig),
      };
    });
  };

  const handleFollowUpQuestionTextChange = (option: string, value: string) => {
    updateFollowUpConfig(option, { questionText: value });
  };

  const handleFollowUpQuestionTypeChange = (
    option: string,
    value: FollowUpQuestionType
  ) => {
    updateFollowUpConfig(option, {
      questionType: value,
      questionOptions:
        value === "radio"
          ? formData.followUpConfig[option]?.questionOptions ||
            DEFAULT_FOLLOW_UP_OPTIONS
          : undefined,
    });
  };

  const handleFollowUpQuestionOptionsChange = (
    option: string,
    value: string
  ) => {
    const parsed = value
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    updateFollowUpConfig(option, {
      questionOptions: parsed.length > 0 ? parsed : DEFAULT_FOLLOW_UP_OPTIONS,
    });
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      setError("Form title is required");
      return false;
    }

    if (!formData.description.trim()) {
      setError("Form description is required");
      return false;
    }

    if (formData.options.length < 2) {
      setError("Form must have at least 2 options");
      return false;
    }

    if (formData.options.some((option) => !option.trim())) {
      setError("All options must have text");
      return false;
    }

    // Check for duplicate options
    const optionSet = new Set(
      formData.options.map((opt) => opt.trim().toLowerCase())
    );
    if (optionSet.size !== formData.options.length) {
      setError("All options must be unique");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/forms/with-followup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create form");
      }

      const result = await response.json();
      setSuccess("Form created successfully with follow-up questions!");

      if (onFormCreated) {
        onFormCreated(result.data.form);
      }

      // Reset form after successful creation
      setTimeout(() => {
        setFormData({
          title: "",
          description: "",
          logoUrl: "",
          imageUrl: "",
          options: DEFAULT_OPTIONS,
          followUpConfig: DEFAULT_FOLLOW_UP_CONFIG,
        });
        setSuccess(null);
      }, 2000);
    } catch (error) {
      console.error("Error creating form:", error);
      setError(
        error instanceof Error ? error.message : "Failed to create form"
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    if (!validateForm()) return;

    setShowPreview(true);
    if (onPreview) {
      onPreview(formData);
    }
  };

  const getFollowUpPreviewDetails = (option: string) => {
    const config = formData.followUpConfig[option];
    if (!config?.hasFollowUp) {
      return "No follow-up";
    }

    const typeLabel =
      config.questionType === "radio"
        ? "Multiple Choice"
        : config.questionType === "text"
        ? "Short Answer"
        : "Long Answer";
    const parts = [
      config.questionText || getDefaultFollowUpQuestionText(option),
      typeLabel,
    ];
    if (config.required) {
      parts.push("Required");
    }
    if (config.questionType === "radio" && config.questionOptions) {
      parts.push(`Options: ${config.questionOptions.join(", ")}`);
    }
    return parts.join(" · ");
  };

  const getFollowUpSummary = () => {
    const withFollowUp = Object.entries(formData.followUpConfig)
      .filter(([_, config]) => config.hasFollowUp)
      .map(
        ([option, config]) =>
          `${option} (${config.required ? "Required" : "Optional"})`
      );

    return withFollowUp.length > 0
      ? `Follow-up questions for: ${withFollowUp.join(", ")}`
      : "No follow-up questions configured";
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Create Form with Follow-up Questions
        </h2>
        <p className="text-gray-600">
          Create a form with multiple choice options and configurable follow-up
          questions
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Form Information */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Basic Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Form Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter form title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo URL (Optional)
              </label>
              <input
                type="url"
                value={formData.logoUrl}
                onChange={(e) => handleInputChange("logoUrl", e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://example.com/logo.png"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Form Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describe what this form is for"
              required
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image URL (Optional)
            </label>
            <input
              type="url"
              value={formData.imageUrl}
              onChange={(e) => handleInputChange("imageUrl", e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://example.com/image.jpg"
            />
          </div>
        </div>

        {/* Options Configuration */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Form Options
            </h3>
            <button
              type="button"
              onClick={addOption}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Option
            </button>
          </div>

          <div className="space-y-3">
            {formData.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-3">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                  {String.fromCharCode(65 + index)}
                </span>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                  required
                />
                {formData.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="flex-shrink-0 p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Follow-up Questions Configuration */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Follow-up Questions Configuration
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Configure which options should trigger follow-up questions and
            whether they're required.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.options.map((option, index) => {
              const config = formData.followUpConfig[option];
              const hasFollowUp = config?.hasFollowUp || false;
              const questionType = config?.questionType || "paragraph";

              return (
                <div
                  key={option}
                  className="border border-gray-200 rounded-lg p-4 bg-white space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{option}</span>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                      {String.fromCharCode(65 + index)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={hasFollowUp}
                        onChange={(e) =>
                          updateFollowUpConfig(option, {
                            hasFollowUp: e.target.checked,
                            required: e.target.checked
                              ? config?.required ?? false
                              : false,
                          })
                        }
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">
                        Has follow-up question
                      </span>
                    </label>

                    {hasFollowUp && (
                      <div className="ml-6 space-y-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={config?.required || false}
                            onChange={(e) =>
                              updateFollowUpConfig(option, {
                                hasFollowUp: true,
                                required: e.target.checked,
                              })
                            }
                            className="mr-2 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-red-700">
                            Required follow-up
                          </span>
                        </label>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Follow-up question text
                          </label>
                          <input
                            type="text"
                            value={config?.questionText || ""}
                            onChange={(e) =>
                              handleFollowUpQuestionTextChange(option, e.target.value)
                            }
                            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={getDefaultFollowUpQuestionText(option)}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Follow-up question type
                          </label>
                          <select
                            value={questionType}
                            onChange={(e) =>
                              handleFollowUpQuestionTypeChange(
                                option,
                                e.target.value as FollowUpQuestionType
                              )
                            }
                            className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="paragraph">Long answer</option>
                            <option value="text">Short answer</option>
                            <option value="radio">Multiple choice</option>
                          </select>
                        </div>

                        {questionType === "radio" && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Follow-up options (one per line)
                            </label>
                            <textarea
                              value={(config?.questionOptions || []).join("\n")}
                              onChange={(e) =>
                                handleFollowUpQuestionOptionsChange(
                                  option,
                                  e.target.value
                                )
                              }
                              rows={3}
                              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder={DEFAULT_FOLLOW_UP_OPTIONS.join("\n")}
                            />
                          </div>
                        )}

                        <div className="text-xs text-gray-500">
                          Preview: {getFollowUpPreviewDetails(option)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Summary:</strong> {getFollowUpSummary()}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6">
          <button
            type="button"
            onClick={handlePreview}
            className="flex-1 flex items-center justify-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            disabled={loading}
          >
            <Eye className="h-5 w-5 mr-2" />
            Preview Form
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-5 w-5 mr-2" />
            )}
            {loading ? "Creating..." : "Create Form"}
          </button>
        </div>
      </form>

      {/* Preview Modal */}
      {showPreview && (
        <FormPreviewModal
          formData={formData}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};

// Preview Modal Component
interface FormPreviewModalProps {
  formData: FormWithFollowUpData;
  onClose: () => void;
}

const FormPreviewModal: React.FC<FormPreviewModalProps> = ({
  formData,
  onClose,
}) => {
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [followUpAnswer, setFollowUpAnswer] = useState<string>("");

  const selectedConfig = selectedOption
    ? formData.followUpConfig[selectedOption]
    : null;
  const showFollowUp = selectedConfig?.hasFollowUp;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-800">Form Preview</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Preview Form */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            {formData.logoUrl && (
              <div className="mb-4">
                <img
                  src={formData.logoUrl}
                  alt="Logo"
                  className="h-12 object-contain"
                />
              </div>
            )}

            <h2 className="text-xl font-bold text-gray-800 mb-2">
              {formData.title}
            </h2>
            <p className="text-gray-600 mb-6">{formData.description}</p>

            {formData.imageUrl && (
              <div className="mb-6">
                <img
                  src={formData.imageUrl}
                  alt="Form"
                  className="w-full h-48 object-cover rounded-lg"
                />
              </div>
            )}

            <div className="space-y-3">
              <p className="font-medium text-gray-800">
                Please select one option:
              </p>
              {formData.options.map((option, index) => (
                <label
                  key={option}
                  className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="preview-option"
                    value={option}
                    checked={selectedOption === option}
                    onChange={(e) => setSelectedOption(e.target.value)}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="flex-1">{option}</span>
                  {formData.followUpConfig[option]?.hasFollowUp && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        formData.followUpConfig[option]?.required
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {formData.followUpConfig[option]?.required
                        ? "Required Follow-up"
                        : "Optional Follow-up"}
                    </span>
                  )}
                </label>
              ))}
            </div>

            {showFollowUp && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Please provide additional details for {selectedOption}:
                  {selectedConfig?.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                <textarea
                  value={followUpAnswer}
                  onChange={(e) => setFollowUpAnswer(e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your response here..."
                  required={selectedConfig?.required}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This follow-up question is{" "}
                  {selectedConfig?.required ? "mandatory" : "optional"} for{" "}
                  {selectedOption}
                </p>
              </div>
            )}

            <div className="mt-6">
              <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Submit Response
              </button>
            </div>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormWithFollowUpCreator;
