import React, { useState } from "react";
import { Save, ArrowLeft } from "lucide-react";
import type { Question, Response } from "../types";
import QuestionRenderer from "./QuestionRenderer";
import { useQuestionLogic } from "../hooks/useQuestionLogic";

interface ResponseEditProps {
  response: Response;
  question: Question;
  onSave: (updatedResponse: Response) => void;
  onCancel: () => void;
}

// Helper function to check if follow-up should be visible
function isFollowUpVisible(fq: any, answers: Record<string, any>): boolean {
  if (!fq.triggerValue && !fq.showWhen && !fq.condition) return true;

  const parentId = fq.parentId ?? fq.parent_id ?? fq.parentQuestionId;
  if (!parentId) return true;

  const parentAnswer = answers[parentId];
  const trigger = fq.triggerValue ?? fq.showWhen?.value ?? fq.condition?.value;

  if (trigger === undefined) return true;

  if (Array.isArray(trigger)) {
    return trigger.includes(parentAnswer);
  }

  return String(parentAnswer).toLowerCase() === String(trigger).toLowerCase();
}

export default function ResponseEdit({
  response,
  question,
  onSave,
  onCancel,
}: ResponseEditProps) {
  const [answers, setAnswers] = useState(response.answers);
  const [saving, setSaving] = useState(false);
  const { getOrderedVisibleQuestions } = useQuestionLogic();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updatedResponse: Response = {
        ...response,
        answers,
        timestamp: new Date().toISOString(),
      };
      onSave(updatedResponse);
    } catch (err) {
      console.error("Failed to save response:", err);
      alert("Failed to save response. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Get all questions from sections
  const allQuestions =
    question.sections.length > 0
      ? question.sections.flatMap((section) => [
          ...(section.questions || []),
          ...(section.subsections?.flatMap((sub: any) => sub.questions || []) ||
            []),
        ])
      : question.followUpQuestions || [];

  const visibleQuestions = getOrderedVisibleQuestions(allQuestions, answers);

  // Render question with follow-ups recursively
  const renderQuestionWithFollowUps = (
    q: any,
    depth: number = 0,
  ): React.ReactNode => {
    const qId: string = q.id ?? q._id;
    const followUps = (q.followUpQuestions || []).filter((fq: any) =>
      isFollowUpVisible(fq, answers),
    );

    return (
      <div key={qId} className="space-y-4">
        {/* Main question */}
        <div
          className={
            depth > 0
              ? "pl-6 border-l-4 border-blue-300 dark:border-blue-600 py-3"
              : ""
          }
        >
          <QuestionRenderer
            question={q}
            value={answers[qId]}
            trackingValue={answers[`${qId}_tracking`]}
            onChange={(value) => setAnswers({ ...answers, [qId]: value })}
            onTrackingChange={(value) =>
              setAnswers({ ...answers, [`${qId}_tracking`]: value })
            }
            isFollowUp={depth > 0}
          />
        </div>

        {/* Follow-up questions */}
        {followUps.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide pl-6">
              Follow-up Questions
            </div>
            <div className="space-y-3">
              {followUps.map((fq: any) => (
                <div key={fq.id ?? fq._id} className="ml-2">
                  {renderQuestionWithFollowUps(fq, depth + 1)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Navigation Bar */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center justify-center p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Edit Response
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Review and update your answers
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center space-x-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="response-edit-form"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form
          id="response-edit-form"
          onSubmit={handleSubmit}
          className="space-y-0"
        >
          {/* Questions Container */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            {visibleQuestions.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  No questions found for this response.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {visibleQuestions.map((q, idx) => (
                  <div
                    key={q.id ?? q._id}
                    className="p-6 sm:p-8 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start space-x-4">
                      {/* Question number badge */}
                      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-semibold text-sm">
                        {idx + 1}
                      </div>
                      {/* Question content */}
                      <div className="flex-1 min-w-0">
                        {renderQuestionWithFollowUps(q, 0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mobile Action Buttons */}
          <div className="sm:hidden mt-6 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>

        {/* Sticky Action Bar at Bottom (Desktop) */}
        <div className="hidden sm:block fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {saving && "Saving your changes..."}
            </p>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="response-edit-form"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom spacing for sticky footer */}
        <div className="hidden sm:block h-24" />
      </div>
    </div>
  );
}
