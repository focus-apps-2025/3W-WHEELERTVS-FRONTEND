import React, { useState, useEffect } from "react";
import {
  Save,
  Eye,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  CheckCircle,
  MoreVertical,
} from "lucide-react";

interface FormSection {
  id: string;
  title: string;
  description: string;
  questions: FormQuestion[];
}

interface FollowUpQuestion {
  id: string;
  text: string;
  type: string;
  required: boolean;
  options?: string[];
  parentId: string;
  showWhen?: {
    questionId: string;
    value: string;
  };
}

interface FormQuestion {
  id: string;
  text: string;
  type: "shortText" | "multipleChoice" | "longText" | "checkboxes" | "dropdown";
  required: boolean;
  options?: string[];
  followUpQuestions?: FollowUpQuestion[];
  followUpConfig?: Record<string, { hasFollowUp: boolean; required: boolean }>;
}

interface FormData {
  title: string;
  description: string;
  isPublic: boolean;
  sections: FormSection[];
}

interface MultipleChoiceFormBuilderProps {
  onFormCreated?: (form: FormData) => void;
  onPreview?: (form: FormData) => void;
  initialData?: Partial<FormData>;
}

const DEFAULT_FORM_DATA: FormData = {
  title: "",
  description: "",
  isPublic: false,
  sections: [
    {
      id: "section1",
      title: "",
      description: "",
      questions: [
        {
          id: "q1",
          text: "",
          type: "shortText",
          required: false,
        },
        {
          id: "q2",
          text: "",
          type: "shortText",
          required: false,
        },
        {
          id: "q3",
          text: "",
          type: "shortText",
          required: false,
        },
      ],
    },
    {
      id: "section2",
      title: "",
      description: "",
      questions: [
        {
          id: "q4",
          text: "",
          type: "multipleChoice",
          required: false,
          options: ["RECENTLY PURCHASED", "Option 2", "Option 3", "Option 4"],
          followUpConfig: {},
        },
      ],
    },
  ],
};

export const MultipleChoiceFormBuilder: React.FC<
  MultipleChoiceFormBuilderProps
> = ({ onFormCreated, onPreview, initialData }) => {
  const [formData, setFormData] = useState<FormData>(() => ({
    ...DEFAULT_FORM_DATA,
    ...initialData,
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openMenuOption, setOpenMenuOption] = useState<string | null>(null);

  const handleFormFieldChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSectionChange = (
    sectionIndex: number,
    field: keyof FormSection,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, index) =>
        index === sectionIndex ? { ...section, [field]: value } : section
      ),
    }));
  };

  const handleQuestionChange = (
    sectionIndex: number,
    questionIndex: number,
    field: keyof FormQuestion,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((question, qIndex) =>
                qIndex === questionIndex
                  ? { ...question, [field]: value }
                  : question
              ),
            }
          : section
      ),
    }));
  };

  const addOption = (sectionIndex: number, questionIndex: number) => {
    const question = formData.sections[sectionIndex].questions[questionIndex];
    if (!question.options) return;

    const newOption = `Option ${question.options.length + 1}`;

    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((q, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...q,
                      options: [...(q.options || []), newOption],
                      followUpConfig: {
                        ...(q.followUpConfig || {}),
                        [newOption]: { hasFollowUp: false, required: false },
                      },
                    }
                  : q
              ),
            }
          : section
      ),
    }));
  };

  const removeOption = (
    sectionIndex: number,
    questionIndex: number,
    optionIndex: number
  ) => {
    const question = formData.sections[sectionIndex].questions[questionIndex];
    if (!question.options || question.options.length <= 2) {
      setError("Minimum 2 options required");
      return;
    }

    const optionToRemove = question.options[optionIndex];
    const newOptions = question.options.filter(
      (_, index) => index !== optionIndex
    );
    const newFollowUpConfig = { ...question.followUpConfig };
    delete newFollowUpConfig[optionToRemove];

    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((q, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...q,
                      options: newOptions,
                      followUpConfig: newFollowUpConfig,
                    }
                  : q
              ),
            }
          : section
      ),
    }));
  };

  const updateOption = (
    sectionIndex: number,
    questionIndex: number,
    optionIndex: number,
    newValue: string
  ) => {
    const question = formData.sections[sectionIndex].questions[questionIndex];
    if (!question.options) return;

    const oldValue = question.options[optionIndex];
    const newOptions = question.options.map((option, index) =>
      index === optionIndex ? newValue : option
    );

    // Update follow-up config keys
    const newFollowUpConfig = { ...question.followUpConfig };
    if (oldValue in newFollowUpConfig && oldValue !== newValue) {
      newFollowUpConfig[newValue] = newFollowUpConfig[oldValue];
      delete newFollowUpConfig[oldValue];
    }

    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((q, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...q,
                      options: newOptions,
                      followUpConfig: newFollowUpConfig,
                    }
                  : q
              ),
            }
          : section
      ),
    }));
  };

  const addFollowUp = (
    sectionIndex: number,
    questionIndex: number,
    option: string
  ) => {
    const question = formData.sections[sectionIndex].questions[questionIndex];

    // Create a new follow-up question
    const newFollowUp: FollowUpQuestion = {
      id: `followup-${Date.now()}`,
      text: `Follow-up for "${option}"`,
      type: "shortText",
      required: false,
      parentId: question.id,
      showWhen: {
        questionId: question.id,
        value: option,
      },
    };

    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((q, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...q,
                      followUpQuestions: [
                        ...(q.followUpQuestions || []),
                        newFollowUp,
                      ],
                      followUpConfig: {
                        ...(q.followUpConfig || {}),
                        [option]: { hasFollowUp: true, required: false },
                      },
                    }
                  : q
              ),
            }
          : section
      ),
    }));
  };

  const updateFollowUp = (
    sectionIndex: number,
    questionIndex: number,
    followUpIndex: number,
    field: keyof FollowUpQuestion,
    value: any
  ) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((q, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...q,
                      followUpQuestions: q.followUpQuestions?.map(
                        (fq, fqIndex) =>
                          fqIndex === followUpIndex
                            ? { ...fq, [field]: value }
                            : fq
                      ),
                    }
                  : q
              ),
            }
          : section
      ),
    }));
  };

  const removeFollowUp = (
    sectionIndex: number,
    questionIndex: number,
    followUpIndex: number
  ) => {
    const question = formData.sections[sectionIndex].questions[questionIndex];
    const followUpToRemove = question.followUpQuestions?.[followUpIndex];

    if (!followUpToRemove) return;

    const option = followUpToRemove.showWhen?.value as string;
    const newFollowUpConfig = { ...question.followUpConfig };
    if (option) {
      delete newFollowUpConfig[option];
    }

    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.map((section, sIndex) =>
        sIndex === sectionIndex
          ? {
              ...section,
              questions: section.questions.map((q, qIndex) =>
                qIndex === questionIndex
                  ? {
                      ...q,
                      followUpQuestions: q.followUpQuestions?.filter(
                        (_, fqIndex) => fqIndex !== followUpIndex
                      ),
                      followUpConfig: newFollowUpConfig,
                    }
                  : q
              ),
            }
          : section
      ),
    }));
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

    // Validate each section and question
    for (const section of formData.sections) {
      for (const question of section.questions) {
        if (
          question.type === "multipleChoice" ||
          question.type === "checkboxes" ||
          question.type === "dropdown"
        ) {
          if (!question.options || question.options.length < 2) {
            setError(
              `${
                question.type === "checkboxes"
                  ? "Checkbox"
                  : question.type === "dropdown"
                  ? "Dropdown"
                  : "Multiple choice"
              } questions must have at least 2 options`
            );
            return false;
          }

          if (question.options.some((option) => !option.trim())) {
            setError("All options must have text");
            return false;
          }

          // Check for duplicates
          const optionSet = new Set(
            question.options.map((opt) => opt.trim().toLowerCase())
          );
          if (optionSet.size !== question.options.length) {
            setError("All options must be unique");
            return false;
          }
        }
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSuccess("Form saved successfully!");
      if (onFormCreated) {
        onFormCreated(formData);
      }

      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError("Failed to save form");
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    if (!validateForm()) return;
    if (onPreview) {
      onPreview(formData);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Customer Service Request Form Builder
        </h2>
        <p className="text-gray-600">
          Create a comprehensive form with sections and multiple choice
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

      <div className="space-y-8">
        {/* Form Details */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Form Details
          </h3>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="form-title"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Form Title *
              </label>
              <input
                id="form-title"
                type="text"
                value={formData.title}
                onChange={(e) => handleFormFieldChange("title", e.target.value)}
                placeholder="Enter form title (e.g., 'Customer Service Request')"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="form-description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Description
              </label>
              <textarea
                id="form-description"
                value={formData.description}
                onChange={(e) =>
                  handleFormFieldChange("description", e.target.value)
                }
                placeholder="Describe your form purpose (e.g., 'Collect customer feedback and service requests')"
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center">
              <input
                id="public-visibility"
                type="checkbox"
                checked={formData.isPublic}
                onChange={(e) =>
                  handleFormFieldChange("isPublic", e.target.checked)
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="public-visibility"
                className="ml-2 block text-sm text-gray-700"
              >
                Make form publicly visible
              </label>
            </div>
          </div>
        </div>

        {/* Sections */}
        {formData.sections.map((section, sectionIndex) => (
          <div key={section.id} className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Section {sectionIndex + 1}
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor={`section-${sectionIndex}-title`}
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Section Title
                </label>
                <input
                  id={`section-${sectionIndex}-title`}
                  type="text"
                  value={section.title}
                  onChange={(e) =>
                    handleSectionChange(sectionIndex, "title", e.target.value)
                  }
                  placeholder={`Section title (e.g., "Personal Information", "Service Details")`}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor={`section-${sectionIndex}-description`}
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Section Description
                </label>
                <input
                  id={`section-${sectionIndex}-description`}
                  type="text"
                  value={section.description}
                  onChange={(e) =>
                    handleSectionChange(
                      sectionIndex,
                      "description",
                      e.target.value
                    )
                  }
                  placeholder="Brief description of this section's purpose"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Questions */}
              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-800 mb-3">
                  Questions
                </h4>

                {section.questions.map((question, questionIndex) => (
                  <div
                    key={question.id}
                    className="border border-gray-200 p-4 rounded-lg mb-4 bg-white"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label
                          htmlFor={`question-${sectionIndex}-${questionIndex}-text`}
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Question Text
                        </label>
                        <input
                          id={`question-${sectionIndex}-${questionIndex}-text`}
                          type="text"
                          value={question.text}
                          onChange={(e) =>
                            handleQuestionChange(
                              sectionIndex,
                              questionIndex,
                              "text",
                              e.target.value
                            )
                          }
                          placeholder="What would you like to ask?"
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`question-${sectionIndex}-${questionIndex}-type`}
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Question Type
                        </label>
                        <select
                          id={`question-${sectionIndex}-${questionIndex}-type`}
                          value={question.type}
                          onChange={(e) => {
                            const newType = e.target.value as
                              | "shortText"
                              | "multipleChoice"
                              | "longText"
                              | "checkboxes"
                              | "dropdown";
                            const updatedQuestion = {
                              ...question,
                              type: newType,
                            };

                            const needsOptions = [
                              "multipleChoice",
                              "checkboxes",
                              "dropdown",
                            ].includes(newType);

                            if (needsOptions && !question.options) {
                              updatedQuestion.options = [
                                "Option 1",
                                "Option 2",
                                "Option 3",
                                "Option 4",
                              ];
                              updatedQuestion.followUpConfig = {};
                            } else if (!needsOptions) {
                              delete updatedQuestion.options;
                              delete updatedQuestion.followUpConfig;
                            }

                            handleQuestionChange(
                              sectionIndex,
                              questionIndex,
                              "type",
                              newType
                            );
                            if (needsOptions && !question.options) {
                              handleQuestionChange(
                                sectionIndex,
                                questionIndex,
                                "options",
                                ["Option 1", "Option 2", "Option 3", "Option 4"]
                              );
                              handleQuestionChange(
                                sectionIndex,
                                questionIndex,
                                "followUpConfig",
                                {}
                              );
                            }
                          }}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="shortText">
                            Short Text - Single line text input
                          </option>
                          <option value="multipleChoice">
                            Multiple Choice - Select one option from many
                          </option>
                          <option value="checkboxes">
                            Checkboxes - Select multiple options
                          </option>
                          <option value="dropdown">
                            Dropdown - Select from searchable list
                          </option>
                          <option value="longText">
                            Long Text - Multi-line text input
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center mb-4">
                      <input
                        id={`question-${sectionIndex}-${questionIndex}-required`}
                        type="checkbox"
                        checked={question.required}
                        onChange={(e) =>
                          handleQuestionChange(
                            sectionIndex,
                            questionIndex,
                            "required",
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label
                        htmlFor={`question-${sectionIndex}-${questionIndex}-required`}
                        className="ml-2 block text-sm text-gray-700"
                      >
                        Required
                      </label>
                    </div>

                    {/* Multiple Choice/Checkboxes/Dropdown Options */}
                    {(question.type === "multipleChoice" ||
                      question.type === "checkboxes" ||
                      question.type === "dropdown") &&
                      question.options && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Options (one per line)
                          </label>

                          <div className="space-y-2">
                            {question.options.map((option, optionIndex) => {
                              const menuKey = `${sectionIndex}-${questionIndex}-${optionIndex}`;
                              const isMenuOpen = openMenuOption === menuKey;

                              return (
                                <div
                                  key={optionIndex}
                                  className="flex items-center space-x-2"
                                >
                                  <input
                                    aria-label={`Option ${optionIndex + 1}`}
                                    type="text"
                                    value={option}
                                    onChange={(e) =>
                                      updateOption(
                                        sectionIndex,
                                        questionIndex,
                                        optionIndex,
                                        e.target.value
                                      )
                                    }
                                    placeholder={`Option ${optionIndex + 1}`}
                                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  />

                                  {question.options &&
                                    question.options.length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeOption(
                                            sectionIndex,
                                            questionIndex,
                                            optionIndex
                                          )
                                        }
                                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                                        aria-label="Remove option"
                                      >
                                        <Minus className="h-4 w-4" />
                                      </button>
                                    )}

                                  {/* Three dots menu */}
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenMenuOption(
                                          isMenuOpen ? null : menuKey
                                        )
                                      }
                                      className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                                      aria-label={`Options for ${option}`}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </button>

                                    {/* Dropdown menu */}
                                    {isMenuOpen && (
                                      <>
                                        {/* Backdrop to close menu */}
                                        <div
                                          className="fixed inset-0 z-10"
                                          onClick={() =>
                                            setOpenMenuOption(null)
                                          }
                                        />

                                        <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                                          <div className="py-1">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                addFollowUp(
                                                  sectionIndex,
                                                  questionIndex,
                                                  option
                                                );
                                                setOpenMenuOption(null);
                                              }}
                                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                            >
                                              📝 Follow-up Question
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                // TODO: Implement follow-up section logic
                                                alert(
                                                  "Follow-up Section feature coming soon!"
                                                );
                                                setOpenMenuOption(null);
                                              }}
                                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                            >
                                              📋 Follow-up Section
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                // TODO: Implement follow-up form logic
                                                alert(
                                                  "Follow-up Form feature coming soon!"
                                                );
                                                setOpenMenuOption(null);
                                              }}
                                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                            >
                                              📄 Follow-up Form
                                            </button>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              addOption(sectionIndex, questionIndex)
                            }
                            className="mt-3 flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Option
                          </button>

                          <div className="mt-2 text-xs text-gray-500">
                            💡 Tip: Each line becomes a selectable option for
                            your users
                          </div>

                          {/* Follow-up Questions */}
                          {question.followUpQuestions &&
                            question.followUpQuestions.length > 0 && (
                              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <h5 className="text-sm font-semibold text-blue-900 mb-3">
                                  Follow-up Questions
                                </h5>
                                <div className="space-y-3">
                                  {question.followUpQuestions.map(
                                    (followUp, followUpIndex) => (
                                      <div
                                        key={followUp.id}
                                        className="bg-white p-3 rounded-lg border border-blue-200"
                                      >
                                        <div className="flex items-start justify-between mb-2">
                                          <span className="text-xs font-medium text-blue-600">
                                            Shown when: "
                                            {followUp.showWhen?.value}"
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              removeFollowUp(
                                                sectionIndex,
                                                questionIndex,
                                                followUpIndex
                                              )
                                            }
                                            className="text-red-600 hover:text-red-800"
                                            aria-label="Remove follow-up"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </button>
                                        </div>

                                        <input
                                          type="text"
                                          value={followUp.text}
                                          onChange={(e) =>
                                            updateFollowUp(
                                              sectionIndex,
                                              questionIndex,
                                              followUpIndex,
                                              "text",
                                              e.target.value
                                            )
                                          }
                                          placeholder="Follow-up question text"
                                          className="w-full p-2 mb-2 border border-gray-300 rounded-lg text-sm"
                                        />

                                        <div className="grid grid-cols-2 gap-2">
                                          <select
                                            value={followUp.type}
                                            onChange={(e) =>
                                              updateFollowUp(
                                                sectionIndex,
                                                questionIndex,
                                                followUpIndex,
                                                "type",
                                                e.target.value
                                              )
                                            }
                                            className="p-2 border border-gray-300 rounded-lg text-sm"
                                          >
                                            <option value="shortText">
                                              Short Text
                                            </option>
                                            <option value="longText">
                                              Long Text
                                            </option>
                                            <option value="multipleChoice">
                                              Multiple Choice
                                            </option>
                                            <option value="checkboxes">
                                              Checkboxes
                                            </option>
                                            <option value="dropdown">
                                              Dropdown
                                            </option>
                                          </select>

                                          <label className="flex items-center space-x-2 p-2">
                                            <input
                                              type="checkbox"
                                              checked={followUp.required}
                                              onChange={(e) =>
                                                updateFollowUp(
                                                  sectionIndex,
                                                  questionIndex,
                                                  followUpIndex,
                                                  "required",
                                                  e.target.checked
                                                )
                                              }
                                              className="h-4 w-4 text-blue-600"
                                            />
                                            <span className="text-sm text-gray-700">
                                              Required
                                            </span>
                                          </label>
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={handlePreview}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
          >
            <Eye className="h-4 w-4" />
            <span>Preview Form</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{loading ? "Saving..." : "Save Form"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
