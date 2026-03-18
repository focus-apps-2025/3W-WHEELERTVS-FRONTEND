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
  formId?: string;
  tenantSlug?: string;
}

export default function SectionContent({
  section,
  formTitle,
  answers,
  onAnswerChange,
  readOnly = false,
  formId,
  tenantSlug,
}: SectionContentProps) {
  const { getOrderedVisibleQuestions } = useQuestionLogic();
  const visibleQuestions = getOrderedVisibleQuestions(
    section.questions || [],
    answers
  );

  const visibleSubsections = (section.subsections || []).filter((sub: any) => {
    const subQuestions = getOrderedVisibleQuestions(sub.questions || [], answers);
    return subQuestions.length > 0;
  });

  return (
    <div className="w-full space-y-8">
      {section.title !== formTitle && !section.isVirtual && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {section.title}
          </h2>
          {section.description && (
            <p className="text-base text-gray-600 dark:text-gray-400">
              {section.description}
            </p>
          )}
        </div>
      )}

      <div className="space-y-8">
        {visibleQuestions.map((q) => (
          <div
            key={q.id || q._id}
            className={`${
              q.showWhen
                ? "mt-3 ml-4 p-3 border-l-4 border-l-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded-r"
                : ""
            }`}
          >
            <QuestionRenderer
              question={q}
              value={answers[q.id || q._id]}
              onChange={(value) => onAnswerChange(q.id || q._id, value)}
              readOnly={readOnly}
              isFollowUp={!!q.showWhen}
              formId={formId}
              tenantSlug={tenantSlug}
            />
          </div>
        ))}
      </div>

      {/* Render Subsections */}
      {visibleSubsections.length > 0 && (
        <div className="mt-12 space-y-12 border-t pt-10">
          {visibleSubsections.map((sub: any) => (
            <div key={sub.id || sub._id} className="space-y-8">
              <div className="border-l-4 border-primary pl-4 py-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {sub.title}
                </h3>
                {sub.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {sub.description}
                  </p>
                )}
              </div>
              
              <div className="space-y-8">
                {getOrderedVisibleQuestions(sub.questions || [], answers).map((q: any) => (
                  <div
                    key={q.id || q._id}
                    className={`${
                      q.showWhen
                        ? "mt-3 ml-4 p-3 border-l-4 border-l-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded-r"
                        : ""
                    }`}
                  >
                    <QuestionRenderer
                      question={q}
                      value={answers[q.id || q._id]}
                      onChange={(value) => onAnswerChange(q.id || q._id, value)}
                      readOnly={readOnly}
                      isFollowUp={!!q.showWhen}
                      formId={formId}
                      tenantSlug={tenantSlug}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
