import React from "react";
import type { Section } from "../../types";
import QuestionRenderer from "../QuestionRenderer";
import { useQuestionLogic } from "../../hooks/useQuestionLogic";

interface SectionContentProps {
  section: Section;
  formTitle: string;
  answers: Record<string, any>;
  onAnswerChange: (questionId: string, value: any) => void;
  readOnly?: boolean;
}

export default function SectionContent({
  section,
  formTitle,
  answers,
  onAnswerChange,
  readOnly = false,
}: SectionContentProps) {
  const { getOrderedVisibleQuestions } = useQuestionLogic();
  const visibleQuestions = getOrderedVisibleQuestions(
    section.questions,
    answers
  );

  return (
    <div className="w-full space-y-8">
      {section.title !== formTitle && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {section.title}
          </h2>
          {section.description && (
            <p className="text-base text-gray-600 dark:text-gray-400">{section.description}</p>
          )}
        </div>
      )}

      <div className="space-y-8">
        {visibleQuestions.map((q) => (
          <div
            key={q.id}
            className={`${
              q.showWhen
                ? "mt-3 ml-4 p-3 border-l-4 border-l-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded-r"
                : ""
            }`}
          >
            <QuestionRenderer
              question={q}
              value={answers[q.id]}
              onChange={(value) => onAnswerChange(q.id, value)}
              readOnly={readOnly}
              isFollowUp={!!q.showWhen}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
