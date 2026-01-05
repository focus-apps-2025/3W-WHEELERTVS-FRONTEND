import React, { useState, useEffect } from "react";
import ProductNPSBuckets from "./ProductNPSBuckets";
import {
  Save,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

interface FollowUpQuestion {
  id: string;
  text: string;
  type: string;
  required: boolean;
  showWhen?: {
    questionId: string;
    value: string;
  };
  parentId: string;
  description?: string;
  options?: string[];
  followUpQuestions?: FollowUpQuestion[]; // Support nested follow-ups
}

interface Question {
  id: string;
  text: string;
  type: string;
  required: boolean;
  options?: string[];
  description?: string;
  followUpQuestions?: FollowUpQuestion[]; // Support nested follow-ups
}

interface Section {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

interface Form {
  id: string;
  title: string;
  description: string;
  logoUrl?: string;
  imageUrl?: string;
  sections: Section[];
  followUpQuestions: FollowUpQuestion[];
}

interface FormResponse {
  [questionId: string]: any;
}

interface FormWithFollowUpResponderProps {
  formId: string;
  onSubmitted?: (response: any) => void;
  onError?: (error: string) => void;
}

export const FormWithFollowUpResponder: React.FC<
  FormWithFollowUpResponderProps
> = ({ formId, onSubmitted, onError }) => {
  const [form, setForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<FormResponse>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    loadForm();
  }, [formId]);

  const loadForm = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/forms/${formId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load form");
      }

      const result = await response.json();
      setForm(result.data.form);
    } catch (error) {
      console.error("Error loading form:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load form";
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (questionId: string, value: any) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));

    // Clear validation error for this field
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[questionId];
      return newErrors;
    });

    // Clear any global errors
    setError(null);
  };

  // Recursively get all visible nested follow-up questions
  const getVisibleNestedFollowUps = (
    followUps: FollowUpQuestion[] | undefined
  ): FollowUpQuestion[] => {
    if (!followUps || followUps.length === 0) return [];

    const visible: FollowUpQuestion[] = [];

    followUps.forEach((followUp) => {
      // Check if this follow-up should be visible
      if (followUp.showWhen) {
        const parentAnswer = responses[followUp.showWhen.questionId];
        if (parentAnswer === followUp.showWhen.value) {
          visible.push(followUp);
          // Recursively get nested follow-ups
          visible.push(
            ...getVisibleNestedFollowUps(followUp.followUpQuestions)
          );
        }
      }
    });

    return visible;
  };

  const getVisibleFollowUpQuestions = (): FollowUpQuestion[] => {
    if (!form) return [];

    const visible: FollowUpQuestion[] = [];

    // Get follow-ups from form level (legacy support)
    const formLevelFollowUps = form.followUpQuestions.filter((followUp) => {
      if (!followUp.showWhen) return false;
      const parentAnswer = responses[followUp.showWhen.questionId];
      return parentAnswer === followUp.showWhen.value;
    });
    visible.push(...formLevelFollowUps);

    // Get nested follow-ups from each section's questions
    form.sections.forEach((section) => {
      section.questions.forEach((question) => {
        visible.push(...getVisibleNestedFollowUps(question.followUpQuestions));
      });
    });

    return visible;
  };

  const getAllVisibleQuestions = (): (Question | FollowUpQuestion)[] => {
    if (!form) return [];

    const questions: (Question | FollowUpQuestion)[] = [];

    // Add main questions from sections
    form.sections.forEach((section) => {
      questions.push(...section.questions);
    });

    // Add visible follow-up questions (including nested ones)
    questions.push(...getVisibleFollowUpQuestions());

    return questions;
  };

  const validateQuestion = (
    question: Question | FollowUpQuestion
  ): string | null => {
    if (!question.required) return null;

    const value = responses[question.id];

    if (value === undefined || value === null || value === "") {
      return `${question.text} is required`;
    }

    // For arrays (like multiple choice), check if empty
    if (Array.isArray(value) && value.length === 0) {
      return `${question.text} is required`;
    }

    return null;
  };

  const validateCurrentStep = (): boolean => {
    const allQuestions = getAllVisibleQuestions();
    const currentQuestions = [allQuestions[currentStep]].filter(Boolean);

    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    currentQuestions.forEach((question) => {
      const error = validateQuestion(question);
      if (error) {
        newErrors[question.id] = error;
        hasErrors = true;
      }
    });

    setValidationErrors(newErrors);
    return !hasErrors;
  };

  const validateAllResponses = (): boolean => {
    const allQuestions = getAllVisibleQuestions();
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    allQuestions.forEach((question) => {
      const error = validateQuestion(question);
      if (error) {
        newErrors[question.id] = error;
        hasErrors = true;
      }
    });

    setValidationErrors(newErrors);

    if (hasErrors) {
      setError("Please fill in all required fields");
    }

    return !hasErrors;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      const allQuestions = getAllVisibleQuestions();
      if (currentStep < allQuestions.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateAllResponses()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          questionId: formId,
          answers: responses,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit form");
      }

      const result = await response.json();
      setSuccess("Form submitted successfully!");

      if (onSubmitted) {
        onSubmitted(result.data);
      }

      // Reset form after successful submission
      setTimeout(() => {
        setResponses({});
        setCurrentStep(0);
        setSuccess(null);
      }, 2000);
    } catch (error) {
      console.error("Error submitting form:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to submit form";
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: Question | FollowUpQuestion) => {
    const value = responses[question.id];
    const hasError = validationErrors[question.id];

    return (
      <div key={question.id} className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-primary-600 mb-2">
            {question.text}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </h3>
          {question.description && (
            <p className="text-primary-500 mb-4">{question.description}</p>
          )}
        </div>

        {question.type === "radio" && (question as Question).options && (
          <div className="space-y-2">
            {(question as Question).options!.map((option, index) => (
              <label
                key={option}
                className="flex items-center p-3 border border-primary-200 rounded-lg hover:bg-primary-50 cursor-pointer transition-colors"
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) =>
                    handleInputChange(question.id, e.target.value)
                  }
                  className="mr-3 h-4 w-4 text-primary-600 focus:ring-primary-500 border-primary-300"
                />
                <span className="flex-1 text-primary-600">{option}</span>
              </label>
            ))}
          </div>
        )}

        {question.type === "checkbox" && (question as Question).options && (
          <div className="space-y-2">
            {(question as Question).options!.map((option, index) => (
              <label
                key={option}
                className="flex items-center p-3 border border-primary-200 rounded-lg hover:bg-primary-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  value={option}
                  checked={(value || []).includes(option)}
                  onChange={(e) => {
                    const currentValues = value || [];
                    if (e.target.checked) {
                      handleInputChange(question.id, [
                        ...currentValues,
                        option,
                      ]);
                    } else {
                      handleInputChange(
                        question.id,
                        currentValues.filter((v: string) => v !== option)
                      );
                    }
                  }}
                  className="mr-3 h-4 w-4 text-primary-600 focus:ring-primary-500 border-primary-300 rounded"
                />
                <span className="flex-1 text-primary-600">{option}</span>
              </label>
            ))}
          </div>
        )}

        {question.type === "text" && (
          <input
            type="text"
            value={value || ""}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full p-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-900 text-primary-600"
            placeholder="Enter your answer"
          />
        )}

        {question.type === "paragraph" && (
          <textarea
            value={value || ""}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            rows={4}
            className="w-full p-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-900 text-primary-600"
            placeholder="Enter your detailed response"
          />
        )}

        {(question.type === "search-select" || question.type === "select") && (question as Question).options && (
          <select
            value={value || ""}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full p-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-900 text-primary-600"
          >
            <option value="">Select an option</option>
            {(question as Question).options!.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}

        {question.type === "email" && (
          <input
            type="email"
            value={value || ""}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full p-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-900 text-primary-600"
            placeholder="Enter your email address"
          />
        )}

        {question.type === "tel" && (
          <input
            type="tel"
            value={value || ""}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full p-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-900 text-primary-600"
            placeholder="Enter your phone number"
          />
        )}

        {question.type === "date" && (
          <input
            type="date"
            value={value || ""}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            className="w-full p-3 border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-900 text-primary-600"
          />
        )}

        {(question.type === "productNPSTGWBuckets") && (
          <ProductNPSBuckets
            value={value}
            onChange={(newValue) => handleInputChange(question.id, newValue)}
          />
        )}

        {hasError && (
          <div className="flex items-center text-red-600 text-sm">
            <AlertCircle className="h-4 w-4 mr-1" />
            {hasError}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-primary-600">Loading form...</span>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-600 mb-2">Form not found</div>
        <p className="text-primary-600">
          The requested form could not be loaded.
        </p>
      </div>
    );
  }

  const allQuestions = getAllVisibleQuestions();
  const currentQuestion = allQuestions[currentStep];
  const isLastStep = currentStep === allQuestions.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      {/* Form Header */}
      <div className="mb-8">
        {form.logoUrl && (
          <div className="mb-4">
            <img
              src={form.logoUrl}
              alt="Logo"
              className="h-12 object-contain"
            />
          </div>
        )}

        <h1 className="text-2xl font-bold text-primary-600 mb-2">
          {form.title}
        </h1>
        <p className="text-primary-500">{form.description}</p>

        {form.imageUrl && (
          <div className="mt-4">
            <img
              src={form.imageUrl}
              alt="Form"
              className="w-full h-48 object-cover rounded-lg"
            />
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {allQuestions.length > 1 && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-primary-600 mb-2">
            <span>
              Step {currentStep + 1} of {allQuestions.length}
            </span>
            <span>
              {Math.round(((currentStep + 1) / allQuestions.length) * 100)}%
              Complete
            </span>
          </div>
          <div className="w-full bg-primary-100 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${((currentStep + 1) / allQuestions.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Error Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Current Question */}
        {currentQuestion && (
          <div className="mb-8">
            {renderQuestion(currentQuestion)}

            {/* Follow-up Indicator */}
            {"showWhen" in currentQuestion && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Follow-up Question:</strong> This question appears
                  because you selected "{currentQuestion.showWhen.value}"
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <div>
            {!isFirstStep && (
              <button
                type="button"
                onClick={handlePrevious}
                className="flex items-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </button>
            )}
          </div>

          <div>
            {!isLastStep ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {submitting ? "Submitting..." : "Submit Form"}
              </button>
            )}
          </div>
        </div>

        {/* Form Summary (only show on last step) */}
        {isLastStep && allQuestions.length > 1 && (
          <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Review Your Responses
            </h3>
            <div className="space-y-4">
              {allQuestions.map((question, index) => {
                const response = responses[question.id];
                if (!response && !question.required) return null;

                return (
                  <div
                    key={question.id}
                    className="border-b border-gray-200 dark:border-gray-700 pb-2"
                  >
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {question.text}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {Array.isArray(response)
                        ? response.join(", ")
                        : response || "No response"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default FormWithFollowUpResponder;
