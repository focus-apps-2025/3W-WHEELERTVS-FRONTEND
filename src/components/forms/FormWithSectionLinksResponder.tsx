import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Send,
  Loader,
} from "lucide-react";
import { apiClient } from "../../api/client";
import type { SectionLink, OptionToSectionMapping } from "../../types/forms";

interface Question {
  id: string;
  text: string;
  type: string;
  required?: boolean;
  options?: string[];
  description?: string;
}

interface Section {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

interface SectionFlowConfig {
  linkedOnlyMode?: boolean;
  sectionLinks?: SectionLink[];
  optionToSectionMap?: OptionToSectionMapping[];
}

interface FormData {
  id: string;
  title: string;
  description: string;
  sections: Section[];
  sectionFlowConfig?: SectionFlowConfig;
}

interface FormWithSectionLinksResponderProps {
  formId: string;
  onSubmitted?: (response: any) => void;
  onError?: (error: string) => void;
}

export const FormWithSectionLinksResponder: React.FC<
  FormWithSectionLinksResponderProps
> = ({ formId, onSubmitted, onError }) => {
  const [form, setForm] = useState<FormData | null>(null);
  const [visibleSections, setVisibleSections] = useState<Section[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [autoAdvanceMessage, setAutoAdvanceMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    loadForm();
  }, [formId]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");
      const data = await apiClient.getFormById(formId);
      setForm(data.form);

      const flowData = await apiClient.calculateFormFlow(formId);
      setVisibleSections(flowData.visibleSections || data.form.sections || []);
      setCurrentSectionIndex(0);
    } catch (err) {
      const errorMessage = "Failed to load form";
      setError(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentSection = () => visibleSections[currentSectionIndex];

  const getNextSectionForOption = (
    questionId: string,
    optionValue: string
  ): Section | null => {
    if (!form?.sectionFlowConfig?.optionToSectionMap) return null;

    const mapping = form.sectionFlowConfig.optionToSectionMap.find(
      (m) => m.questionId === questionId && m.optionId === optionValue
    );

    if (mapping) {
      return (
        visibleSections.find((s) => s.id === mapping.targetSectionId) || null
      );
    }

    return null;
  };

  const handleQuestionChange = (questionId: string, value: any) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));

    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[questionId];
      return newErrors;
    });

    setError(null);

    const nextSection = getNextSectionForOption(questionId, value);
    if (nextSection) {
      const nextIndex = visibleSections.findIndex(
        (s) => s.id === nextSection.id
      );
      if (nextIndex !== -1) {
        setAutoAdvanceMessage(`Navigating to ${nextSection.title}...`);
        setTimeout(() => {
          setCurrentSectionIndex(nextIndex);
          setAutoAdvanceMessage(null);
        }, 300);
      }
    }
  };

  const validateCurrentSection = (): boolean => {
    const section = getCurrentSection();
    if (!section) return false;

    const errors: Record<string, string> = {};
    section.questions.forEach((question) => {
      if (question.required && !responses[question.id]) {
        errors[question.id] = `${question.text} is required`;
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (!validateCurrentSection()) return;
    if (currentSectionIndex < visibleSections.length - 1) {
      setCurrentSectionIndex(currentSectionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentSection()) return;

    try {
      setSubmitting(true);
      setError(null);

      const sectionFlow = visibleSections.map((s) => s.id);
      const responseData = {
        formId,
        answers: responses,
        sectionFlow,
      };

      const result = await apiClient.submitResponse(formId, responseData);
      setSuccess("Form submitted successfully!");

      if (onSubmitted) {
        onSubmitted(result.response);
      }

      setTimeout(() => {
        setResponses({});
        setCurrentSectionIndex(0);
      }, 2000);
    } catch (err) {
      const errorMessage = "Failed to submit form";
      setError(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="animate-spin h-8 w-8 text-blue-500" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
        <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
        <span className="text-red-700">Failed to load form</span>
      </div>
    );
  }

  const currentSection = getCurrentSection();
  const isLastSection =
    currentSectionIndex === visibleSections.length - 1;
  const isFirstSection = currentSectionIndex === 0;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{form.title}</h1>
        {form.description && (
          <p className="text-gray-600 dark:text-gray-400">{form.description}</p>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Section {currentSectionIndex + 1} of {visibleSections.length}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {Math.round(((currentSectionIndex + 1) / visibleSections.length) * 100)}% complete
            </span>
          </div>
          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-600 to-blue-400 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${((currentSectionIndex + 1) / visibleSections.length) * 100}%`,
              }}
            ></div>
          </div>
        </div>

        {form.sectionFlowConfig?.sectionLinks && form.sectionFlowConfig.sectionLinks.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-700">
              🔗 This form has conditional section linking enabled
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-2">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {autoAdvanceMessage && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-2 items-center animate-pulse">
          <div className="inline-block h-4 w-4 bg-blue-600 rounded-full animate-bounce"></div>
          <p className="text-blue-700 font-medium">{autoAdvanceMessage}</p>
        </div>
      )}

      {currentSection && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-8">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {currentSection.title}
              </h2>
              <span className="text-xs font-semibold px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                Section {currentSectionIndex + 1}
              </span>
            </div>
            {currentSection.description && (
              <p className="text-gray-600 dark:text-gray-400">{currentSection.description}</p>
            )}
          </div>

          <div className="space-y-6">
            {currentSection.questions.map((question) => (
              <div key={question.id}>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {question.text}
                  {question.required && (
                    <span className="text-red-600 ml-1">*</span>
                  )}
                </label>

                {question.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {question.description}
                  </p>
                )}

                {question.type === "text" || question.type === "paragraph" ? (
                  <textarea
                    value={responses[question.id] || ""}
                    onChange={(e) =>
                      handleQuestionChange(question.id, e.target.value)
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      validationErrors[question.id]
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                    rows={question.type === "paragraph" ? 5 : 3}
                  />
                ) : question.type === "radio" ? (
                  <div className="space-y-2">
                    {question.options?.map((option) => (
                      <label
                        key={option}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={responses[question.id] === option}
                          onChange={(e) =>
                            handleQuestionChange(question.id, e.target.value)
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{option}</span>
                      </label>
                    ))}
                  </div>
                ) : question.type === "checkbox" ? (
                  <div className="space-y-2">
                    {question.options?.map((option) => (
                      <label
                        key={option}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={(responses[question.id] || []).includes(
                            option
                          )}
                          onChange={(e) => {
                            const current =
                              responses[question.id] || [];
                            const updated = e.target.checked
                              ? [...current, option]
                              : current.filter((v) => v !== option);
                            handleQuestionChange(question.id, updated);
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{option}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={responses[question.id] || ""}
                    onChange={(e) =>
                      handleQuestionChange(question.id, e.target.value)
                    }
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      validationErrors[question.id]
                        ? "border-red-500"
                        : "border-gray-300"
                    }`}
                  />
                )}

                {validationErrors[question.id] && (
                  <p className="mt-2 text-sm text-red-600">
                    {validationErrors[question.id]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex justify-between gap-4">
        <button
          onClick={handlePrevious}
          disabled={isFirstSection || submitting}
          className="flex items-center gap-2 px-6 py-2 bg-gray-300 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="h-4 w-4" />
          Previous
        </button>

        <div className="flex gap-4">
          {!isLastSection && (
            <button
              onClick={handleNext}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          )}

          {isLastSection && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {submitting ? "Submitting..." : "Submit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
