import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import type { Response } from "../types";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import PreviewForm from "./PreviewForm";

export default function PreviewFormWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [form, setForm] = useState<any>(null);
  const [branchingRules, setBranchingRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session tracking — use refs so values are always current inside async callbacks
  const formSessionIdRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<Date | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStarted = useRef(false); // guard against double-start

  // Question-level timing
  const currentQuestionIdRef = useRef<string | null>(null);
  const currentQuestionTextRef = useRef<string>("");
  const currentQuestionTypeRef = useRef<string>("");
  const currentSectionIdRef = useRef<string | null>(null);
  const currentSectionTitleRef = useRef<string>("");
  const currentQuestionStartRef = useRef<Date | null>(null);

  // ── Start session once after form loads ────────────────────────────────────
  const startSession = useCallback(async (formId: string, formTitle: string) => {
    if (sessionStarted.current) return;
    sessionStarted.current = true;

    try {
      console.log("📝 Starting form session for:", formId);
      const result = await apiClient.startFormSession(formId, formTitle);
      formSessionIdRef.current = result.sessionId;
      sessionStartedAtRef.current = new Date(result.startedAt || Date.now());
      console.log(`✅ Session started: ${result.sessionId} at ${sessionStartedAtRef.current.toISOString()}`);

      // Start heartbeat every 60s
      heartbeatIntervalRef.current = setInterval(async () => {
        if (formSessionIdRef.current) {
          try {
            await apiClient.sendHeartbeat({
              url: window.location.pathname,
              formSessionId: formSessionIdRef.current,
            });
          } catch { /* silent */ }
        }
      }, 60_000);
    } catch (err) {
      console.error("Failed to start session:", err);
      // Fallback: use a client-side session so we at least capture startedAt
      formSessionIdRef.current = `local-${Date.now()}`;
      sessionStartedAtRef.current = new Date();
    }
  }, []);

  // ── Fetch form ─────────────────────────────────────────────────────────────
  const fetchForm = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await apiClient.getForm(id);
      setForm(response.form);

      // Load branching rules
      try {
        const branchingResponse = await apiClient.request<{ sectionBranching: any[] }>(
          `/forms/${id}/section-branching`
        );
        setBranchingRules(branchingResponse?.sectionBranching ?? []);
      } catch {
        setBranchingRules([]);
      }

      setError(null);
    } catch (err) {
      console.error("[PreviewFormWrapper] Error fetching form:", err);
      setError("Failed to load form");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchForm();
  }, [fetchForm]);

  // Start session once form is loaded
  useEffect(() => {
    if (form && id) {
      startSession(id, form.title || "Untitled Form");
    }
    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [form, id, startSession]);

  // ── Question tracking ──────────────────────────────────────────────────────
  const handleQuestionChange = useCallback(async (
    newQuestionId: string,
    newQuestionText: string,
    newQuestionType: string,
    newSectionId: string,
    newSectionTitle: string,
    answer?: any
  ) => {
    // Record time on the PREVIOUS question
    const prevId = currentQuestionIdRef.current;
    const prevStart = currentQuestionStartRef.current;

    if (prevId && prevStart && formSessionIdRef.current && id) {
      const secs = Math.floor((Date.now() - prevStart.getTime()) / 1000);
      if (secs >= 2) {
        try {
          await apiClient.trackQuestionTime(id, {
            sessionId: formSessionIdRef.current,
            questionId: prevId,
            questionText: currentQuestionTextRef.current,
            questionType: currentQuestionTypeRef.current,
            sectionId: currentSectionIdRef.current ?? undefined,
            sectionTitle: currentSectionTitleRef.current,
            timeSpent: secs,
            answer,
          });
          console.log(`⏱️ Q "${prevId}" took ${secs}s`);
        } catch { /* non-critical */ }
      }
    }

    // Set new current question
    currentQuestionIdRef.current = newQuestionId;
    currentQuestionTextRef.current = newQuestionText;
    currentQuestionTypeRef.current = newQuestionType;
    currentSectionIdRef.current = newSectionId;
    currentSectionTitleRef.current = newSectionTitle;
    currentQuestionStartRef.current = new Date();
  }, [id]);

  // ── Section tracking ───────────────────────────────────────────────────────
  const handleSectionComplete = useCallback(async (
    sectionId: string,
    sectionTitle: string,
    timeSpentSeconds: number,
    questionCount: number
  ) => {
    if (!formSessionIdRef.current || !id) return;
    try {
      await apiClient.trackFormProgress(id, {
        sessionId: formSessionIdRef.current,
        sectionId,
        sectionTitle,
        timeSpent: timeSpentSeconds,
        questionCount,
      });
      console.log(`📊 Section "${sectionTitle}" took ${timeSpentSeconds}s`);
    } catch { /* non-critical */ }
  }, [id]);

  // ── Form submission ────────────────────────────────────────────────────────
 // In PreviewFormWrapper.tsx, find the handleSubmit function and update it:

const handleSubmit = async (response: Response) => {
  console.log("=== PREVIEW FORM SUBMISSION ===");

  const completedAt = new Date();
  const startedAt = sessionStartedAtRef.current ?? completedAt;
  const sessionId = formSessionIdRef.current;
  const timeSpent = Math.max(0, Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000));

  console.log("Session ID:", sessionId);
  console.log("Started At:", startedAt.toISOString());
  console.log("Time Spent:", timeSpent, "seconds");

  try {
    // Track final question timing
    const prevId = currentQuestionIdRef.current;
    const prevStart = currentQuestionStartRef.current;
    if (prevId && prevStart && sessionId && id) {
      const secs = Math.floor((Date.now() - prevStart.getTime()) / 1000);
      if (secs >= 2) {
        try {
          await apiClient.trackQuestionTime(id, {
            sessionId,
            questionId: prevId,
            questionText: currentQuestionTextRef.current,
            questionType: currentQuestionTypeRef.current,
            sectionId: currentSectionIdRef.current ?? undefined,
            sectionTitle: currentSectionTitleRef.current,
            timeSpent: secs,
            answer: response.answers[prevId],
          });
        } catch { /* non-critical */ }
      }
    }

    // Signal backend that session is complete
    if (sessionId && id) {
      try {
        await apiClient.trackFormComplete(id, {
          sessionId,
          answers: response.answers,
        });
      } catch { /* non-critical */ }
    }

    // Build submission payload
    const submitData: any = {
      questionId: id!,
      tenantSlug: tenant?.slug,
      answers: response.answers,
      timestamp: response.timestamp,
      sessionId: sessionId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      submissionMetadata: {
        source: "internal",
        formSessionId: sessionId,
        timeSpent,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
      },
    };

    // Attach geolocation if available
    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 0,
          })
        );
        submitData.location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: "browser",
        };
      } catch { /* geolocation not available */ }
    }

    console.log("📤 About to call createResponse with:", submitData);
    console.log("🚀 Calling apiClient.createResponse...");
    
    const submissionResult = await apiClient.createResponse(submitData);
    
    console.log("✅ createResponse SUCCESS! Result:", submissionResult);

    const responseId =
      submissionResult?.response?.id ||
      submissionResult?.response?._id ||
      submissionResult?.id ||
      submissionResult?._id;

    console.log("📝 Response ID:", responseId);

    // Auto-assign
    if (responseId && tenant?._id) {
      try {
        await apiClient.autoAssignResponse(responseId, { tenantId: tenant._id });
        console.log("✅ Auto-assign successful");
        showSuccess("Response submitted and assigned successfully!");
      } catch (assignErr) {
        console.warn("Auto-assign failed:", assignErr);
        showSuccess("Response submitted successfully!");
      }
    } else {
      showSuccess("Response submitted successfully!");
    }

    // Stop heartbeat
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

    console.log("🏃 Navigating to /responses/all");
    console.log("Current path:", window.location.pathname);
    
    setTimeout(() => {
      console.log("🏃 Navigating NOW...");
      navigate("/responses/all");
    }, 100);
    
  } catch (err) {
    console.error("❌ Submission failed:", err);
    console.error("❌ Error details:", err?.message, err?.stack);
    showError("Failed to submit response. Please try again.");
  }
};

  // ── Render states ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-primary-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 space-y-3">
            <h2 className="text-lg font-semibold text-red-800">Form Not Found</h2>
            <p className="text-red-600">
              {error || "The form you're trying to preview doesn't exist or has been deleted."}
            </p>
            <button
              onClick={() => { setForm(null); setError(null); }}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Flatten sections (handle nested follow-up questions) ───────────────────
  const extractedBranchingRules: any[] = [];

  const flattenedSections = (form.sections || []).map((section: any) => {
    const allQuestions: any[] = [];

    const flattenQuestions = (questions: any[], parentId?: string) => {
      questions.forEach((question: any) => {
        const { followUpQuestions, ...mainQuestion } = question;

        if (parentId && !mainQuestion.showWhen) {
          mainQuestion.showWhen = { questionId: parentId, value: "" };
        }

        allQuestions.push(mainQuestion);

        if (question.branchingRules?.length > 0) {
          question.branchingRules.forEach((rule: any) => {
            extractedBranchingRules.push({
              questionId: question.id,
              sectionId: section.id,
              optionLabel: rule.optionLabel,
              targetSectionId: rule.targetSectionId,
              isOtherOption: rule.isOtherOption || false,
            });
          });
        }

        if (followUpQuestions?.length > 0) {
          flattenQuestions(followUpQuestions, question.id);
        }
      });
    };

    flattenQuestions(section.questions || []);
    return { ...section, questions: allQuestions };
  });

  const finalBranchingRules = branchingRules.length > 0 ? branchingRules : extractedBranchingRules;

  const formData = {
    id: form.id,
    title: form.title,
    description: form.description,
    sections: flattenedSections,
    followUpQuestions: form.followUpQuestions || [],
    // ✅ CRITICAL FIX: Include chassis numbers and tenant assignments
    chassisNumbers: form.chassisNumbers || [],
    chassisTenantAssignments: form.chassisTenantAssignments || {},
  };

  return (
    <PreviewForm
      questions={[formData]}
      onSubmit={handleSubmit}
      branchingRules={finalBranchingRules}
      viewType={form.viewType}
      onQuestionChange={handleQuestionChange}
      onSectionComplete={handleSectionComplete}
      formSessionId={formSessionIdRef.current}
      // ✅ Pass chassis data to PreviewForm
      chassisNumbers={(form.chassisNumbers || []).map((cn: any) => 
        typeof cn === 'string' ? { chassisNumber: cn, partDescription: '' } : cn
      )}
      chassisTenantAssignments={form.chassisTenantAssignments || {}}
    />
  );
}
