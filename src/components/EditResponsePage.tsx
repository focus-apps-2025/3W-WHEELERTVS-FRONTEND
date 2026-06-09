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

// ── flatten ALL questions (top-level + follow-ups) recursively ───────────────
function flattenQuestions(questions: any[]): any[] {
  const result: any[] = [];
  for (const q of questions || []) {
    result.push(q);
    if (q.followUpQuestions?.length) {
      result.push(...flattenQuestions(q.followUpQuestions));
    }
  }
  return result;
}

function getAllFormQuestions(form: any): any[] {
  const all: any[] = [];
  for (const section of form?.sections || []) {
    all.push(...flattenQuestions(section.questions || []));
    for (const sub of section.subsections || []) {
      all.push(...flattenQuestions(sub.questions || []));
    }
  }
  all.push(...flattenQuestions(form?.followUpQuestions || []));
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
        const resp = await apiClient.getResponse(id);
        setResponse(resp as any);
        setAnswers(resp.answers || {});

        const formIdentifier = resp.questionId || resp.formId;
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

  // ── build visible question list ─────────────────────────────────────────────
  const allQuestions = getAllFormQuestions(form);

  const visibleQuestions = questionLogic
    ? questionLogic.getOrderedVisibleQuestions(allQuestions, answers)
    : allQuestions.filter((q) => isQuestionVisible(q, answers));

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    // Full-screen overlay backdrop
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-6 px-4">
      {/* Modal panel — wide & tall */}
      <div className="w-full max-w-5xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col">
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 px-8 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Edit Response
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <form
          onSubmit={handleSubmit}
          className="p-8 space-y-8 overflow-y-auto flex-1"
        >
          {visibleQuestions.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">
              No questions found for this form.
            </p>
          )}

          {visibleQuestions.map((q) => {
            const qId: string = q.id ?? q._id;
            return (
              <div
                key={qId}
                // indent follow-up questions visually
                className={
                  q.parentId || q.parent_id || q.parentQuestionId
                    ? "pl-6 border-l-2 border-blue-200 dark:border-blue-700"
                    : ""
                }
              >
                <QuestionRenderer
                  question={q}
                  value={answers[qId]}
                  trackingValue={answers[`${qId}_tracking`]}
                  onChange={(value) => handleAnswer(qId, value)}
                  onTrackingChange={(value) => handleTrackingAnswer(qId, value)}
                />
              </div>
            );
          })}
        </form>

        {/* ── Sticky footer (repeat save on long forms) ── */}
        <div className="sticky bottom-0 px-8 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-xl flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
