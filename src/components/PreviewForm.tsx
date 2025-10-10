import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Question, Response, Section } from "../types";
import { useQuestionLogic } from "../hooks/useQuestionLogic";
import ThankYouMessage from "./ThankYouMessage";
import FormHeader from "./preview/FormHeader";
import SectionProgress from "./preview/SectionProgress";
import SectionContent from "./preview/SectionContent";
import NavigationButtons from "./preview/NavigationButtons";

interface PreviewFormProps {
  questions: Question[];
  onSubmit: (response: Response) => void;
}

export default function PreviewForm({ questions, onSubmit }: PreviewFormProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const { getOrderedVisibleQuestions } = useQuestionLogic();

  const question = questions.find((q) => q.id === id);

  if (!question) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Form Preview
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          See how your form will appear to users
        </p>
        <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-red-800">Form Not Found</h2>
          <p className="text-sm text-red-600">
            The form you're looking for doesn't exist or may have been removed.
          </p>
          <button
            onClick={() => navigate("/forms")}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Return to Forms
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return <ThankYouMessage />;
  }

  // Initialize sections if they don't exist
  const sections: Section[] =
    question.sections?.length > 0
      ? question.sections
      : [
          {
            id: "default",
            title: question.title,
            description: question.description,
            questions: question.followUpQuestions,
          },
        ];

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();

    // Validate all sections before submitting
    let isValid = true;
    sections.forEach((section) => {
      const visibleQuestions = getOrderedVisibleQuestions(
        section.questions,
        answers
      );
      const hasRequiredAnswers = visibleQuestions.every(
        (q) => !q.required || answers[q.id]
      );
      if (!hasRequiredAnswers) {
        isValid = false;
      }
    });

    if (!isValid) {
      alert("Please fill in all required fields before submitting.");
      return;
    }

    const response: Response = {
      id: crypto.randomUUID(),
      questionId: question.id,
      answers,
      timestamp: new Date().toISOString(),
    };
    onSubmit(response);
    setSubmitted(true);
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleNext = () => {
    // Move to next section without validation
    if (currentSectionIndex + 1 < sections.length) {
      setCurrentSectionIndex(currentSectionIndex + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevious = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const currentSection = sections[currentSectionIndex];
  const isLastSection = currentSectionIndex === sections.length - 1;
  const isFirstSection = currentSectionIndex === 0;

  return (
    <div className="min-h-screen bg-white py-12">
      <div className="max-w-3xl mx-auto px-6">
        <FormHeader
          title={question.title}
          description={question.description}
          imageUrl={question.imageUrl}
        />

        <form onSubmit={handleSubmit} className="mt-12 space-y-10">
          {sections.length > 1 && (
            <SectionProgress
              currentSection={currentSectionIndex}
              totalSections={sections.length}
            />
          )}

          <SectionContent
            section={currentSection}
            formTitle={question.title}
            answers={answers}
            onAnswerChange={handleAnswerChange}
          />

          <NavigationButtons
            isFirstSection={isFirstSection}
            isLastSection={isLastSection}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onSubmit={handleSubmit}
          />
        </form>
      </div>
    </div>
  );
}
