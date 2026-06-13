import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Save, ArrowLeft } from "lucide-react";
import { apiClient } from "../api/client";
import type { Response, Question } from "../types";
import QuestionRenderer from "./QuestionRenderer";
import { useQuestionLogic } from "../hooks/useQuestionLogic";

// ── inline score helper (avoids missing-file error) ─────────────────────────
function computeYesNoScore(answers: Record<string, any>, form: any): number {
  let yes = 0;
  let total = 0;
  const walk = (questions: any[]) => {
    for (const q of questions || []) {
      if (q.type === "yes_no" || q.type === "yesno") {
        total++;
        const v = answers[q.id ?? q._id];
        if (v === true || v === "yes" || v === "Yes") yes++;
      }
      if (q.followUpQuestions?.length) walk(q.followUpQuestions);
    }
  };
  for (const section of form?.sections || []) {
    walk(section.questions || []);
    for (const sub of section.subsections || []) walk(sub.questions || []);
  }
  walk(form?.followUpQuestions || []);
  return total ? Math.round((yes / total) * 100) : 0;
}

// ── get questions by section (keep hierarchy) ────────────────────────────────
function getFormQuestionsBySection(form: any): any[] {
  const all: any[] = [];
  for (const section of form?.sections || []) {
    all.push(...(section.questions || []));
    for (const sub of section.subsections || []) {
      all.push(...(sub.questions || []));
    }
  }
  all.push(...(form?.followUpQuestions || []));
  return all;
}

// ── determine whether a follow-up question should be visible ─────────────────
function isQuestionVisible(q: any, answers: Record<string, any>): boolean {
  // If the question has no trigger condition it's always visible
  if (!q.triggerValue && !q.showWhen && !q.condition) return true;

  const parentId: string | undefined =
    q.parentId ?? q.parent_id ?? q.parentQuestionId;

  if (!parentId) return true;

  const parentAnswer = answers[parentId];

  // Support several schema conventions
  const trigger = q.triggerValue ?? q.showWhen?.value ?? q.condition?.value;

  if (trigger === undefined) return true;

  if (Array.isArray(trigger)) {
    return trigger.includes(parentAnswer);
  }

  return String(parentAnswer).toLowerCase() === String(trigger).toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────

export default function EditResponsePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [response, setResponse] = useState<Response | null>(null);
  const [form, setForm] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // optional – keep using the hook if it adds extra logic; falls back gracefully
  const questionLogic = (() => {
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useQuestionLogic();
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!id) return;
        const respWrapper = await apiClient.getResponse(id);
        const resp = respWrapper.response;
        setResponse(resp as any);
        setAnswers(resp?.answers || {});

        const formIdentifier = resp?.questionId || resp?.formId;
        if (!formIdentifier)
          throw new Error("Missing form identifier for response");

        const formData = await apiClient.getForm(formIdentifier);
        setForm(formData?.form ?? formData);
      } catch (err: any) {
        console.error("Failed to fetch data:", err);
        setError(err.message || "Failed to load response for editing.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleAnswer = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleTrackingAnswer = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [`${questionId}_tracking`]: value }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!id || !response) return;
    setSaving(true);
    try {
      const score = form ? computeYesNoScore(answers, form) : undefined;
      await apiClient.updateResponse(id, { answers, score });
      navigate(-1);
    } catch (err) {
      console.error("Failed to update response:", err);
      alert("Failed to update response. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── loading / error states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !response || !form) {
    return (
      <div className="p-6 text-center text-red-600 bg-red-50 rounded-lg">
        {error || "Failed to load data"}
      </div>
    );
  }

  // ── build visible question list with hierarchy ────────────────────────────
  const topLevelQuestions = getFormQuestionsBySection(form);

  // Render question with follow-ups
  const renderQuestionWithFollowUps = (
    q: any,
    depth: number = 0,
  ): React.ReactNode => {
    const qId: string = q.id ?? q._id;
    const isVisible = isQuestionVisible(q, answers);

    if (!isVisible) return null;

    const followUps = (q.followUpQuestions || []).filter((fq: any) =>
      isQuestionVisible(fq, answers),
    );

    return (
      <div key={qId} className="space-y-4">
        {/* Main question */}
        <div
          className={
            depth > 0
              ? "pl-6 border-l-4 border-blue-300 dark:border-blue-600 py-3 rounded"
              : ""
          }
        >
          <QuestionRenderer
            question={q}
            value={answers[qId]}
            trackingValue={answers[`${qId}_tracking`]}
            onChange={(value) => handleAnswer(qId, value)}
            onTrackingChange={(value) => handleTrackingAnswer(qId, value)}
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

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Navigation Bar */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
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
                onClick={() => navigate(-1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
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
        <form onSubmit={handleSubmit} className="space-y-0">
          {/* Questions Container */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            {topLevelQuestions.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  No questions found for this form.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {topLevelQuestions.map((q, idx) => (
                  <div
                    key={q.id ?? q._id}
                    className="p-6 sm:p-8 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-semibold text-sm">
                        {idx + 1}
                      </div>
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
              onClick={() => navigate(-1)}
              className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
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
                onClick={() => navigate(-1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
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
