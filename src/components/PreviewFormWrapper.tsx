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
  
  // NEW: Session tracking state
  const [formSessionId, setFormSessionId] = useState<string | null>(null);
  const [currentQuestionStartTime, setCurrentQuestionStartTime] = useState<Date | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const [currentSectionTitle, setCurrentSectionTitle] = useState<string>("");
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isTrackingRef = useRef(false);
  
// Add these missing state variables
const [currentQuestionText, setCurrentQuestionText] = useState<string>("");
const [currentQuestionType, setCurrentQuestionType] = useState<string>("");

  const fetchForm = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      console.log("[PreviewFormWrapper] Fetching form with ID:", id);
      const response = await apiClient.getForm(id);
      setForm(response.form);

      // Load branching rules
      try {
        const branchingResponse = await apiClient.request<{
          sectionBranching: any[];
        }>(`/forms/${id}/section-branching`);
        if (branchingResponse && branchingResponse.sectionBranching) {
          setBranchingRules(branchingResponse.sectionBranching);
          console.log("=== PreviewFormWrapper: Branching rules loaded ===");
          console.log("Count:", branchingResponse.sectionBranching.length);
          console.log("Rules:", branchingResponse.sectionBranching);
        } else {
          console.log(
            "=== PreviewFormWrapper: No branching rules in response ==="
          );
          setBranchingRules([]);
        }
      } catch (branchErr) {
        console.warn("Preview - Failed to fetch branching rules:", branchErr);
        setBranchingRules([]);
      }

      console.log(
        "[PreviewFormWrapper] Form loaded successfully:",
        response.form.id
      );
      setError(null);
    } catch (err) {
      console.error("[PreviewFormWrapper] Error fetching form with ID:", id);
      console.error("[PreviewFormWrapper] Error details:", err);
      setError("Failed to load form");
      console.error("Error fetching form:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchForm();
  }, [fetchForm]);

  // NEW: Track form start when form loads
  useEffect(() => {
    const trackFormStart = async () => {
      if (!form || !id || isTrackingRef.current) return;
      
      try {
        isTrackingRef.current = true;
        console.log("📝 Starting form session tracking for:", id);
        
        const result = await apiClient.startFormSession(id, form.title || 'Unknown Form');
        setFormSessionId(result.sessionId);
        
        console.log(`✅ Form session started: ${result.sessionId}`);
        
        // Start heartbeat for active tracking
        heartbeatIntervalRef.current = setInterval(async () => {
          if (result.sessionId) {
            try {
              await apiClient.sendHeartbeat({
                url: window.location.pathname,
                formSessionId: result.sessionId
              });
            } catch (error) {
              console.error('Heartbeat failed:', error);
            }
          }
        }, 60000); // Every minute
        
      } catch (error) {
        console.error('Failed to track form start:', error);
        isTrackingRef.current = false;
      }
    };

    if (form && id) {
      trackFormStart();
    }

    // Cleanup on unmount
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [form, id]);

  // NEW: Function to track question change (will be passed to PreviewForm)
  const trackQuestionChange = async (
    newQuestionId: string,
    newQuestionText: string,
    newQuestionType: string,
    newSectionId: string,
    newSectionTitle: string,
    answer?: any
  ) => {
    // Track time spent on previous question
    if (currentQuestionId && currentQuestionStartTime && formSessionId) {
      const timeSpentSeconds = Math.floor(
        (new Date().getTime() - currentQuestionStartTime.getTime()) / 1000
      );

      if (timeSpentSeconds >= 2) { // Only track if they spent at least 2 seconds
        try {
          await apiClient.trackQuestionTime(id!, {
            sessionId: formSessionId,
            questionId: currentQuestionId,
            questionText: currentQuestionText,
            questionType: currentQuestionType,
            sectionId: currentSectionId!,
            sectionTitle: currentSectionTitle,
            timeSpent: timeSpentSeconds,
            answer
          });
          console.log(`⏱️ Question ${currentQuestionId} took ${timeSpentSeconds}s`);
        } catch (error) {
          console.error('Failed to track question time:', error);
        }
      }
    }

    // Set new question as current
    setCurrentQuestionId(newQuestionId);
    setCurrentQuestionStartTime(new Date());
    setCurrentQuestionText(newQuestionText);
    setCurrentQuestionType(newQuestionType);
    setCurrentSectionId(newSectionId);
    setCurrentSectionTitle(newSectionTitle);
  };

  // NEW: Track section progress
  const trackSectionProgress = async (
    sectionId: string,
    sectionTitle: string,
    timeSpentSeconds: number,
    questionCount: number
  ) => {
    if (!formSessionId) return;

    try {
      await apiClient.trackFormProgress(id!, {
        sessionId: formSessionId,
        sectionId,
        sectionTitle,
        timeSpent: timeSpentSeconds,
        questionCount
      });
      console.log(`📊 Section ${sectionTitle} took ${timeSpentSeconds}s`);
    } catch (error) {
      console.error('Failed to track section progress:', error);
    }
  };

  // NEW: Track form completion
  const trackFormCompletion = async (finalAnswers: any) => {
    if (!formSessionId) return;

    try {
      // Track final question if needed
      if (currentQuestionId && currentQuestionStartTime) {
        const timeSpentSeconds = Math.floor(
          (new Date().getTime() - currentQuestionStartTime.getTime()) / 1000
        );

        if (timeSpentSeconds >= 2) {
          await apiClient.trackQuestionTime(id!, {
            sessionId: formSessionId,
            questionId: currentQuestionId,
            questionText: currentQuestionText,
            questionType: currentQuestionType,
            sectionId: currentSectionId!,
            sectionTitle: currentSectionTitle,
            timeSpent: timeSpentSeconds,
            answer: finalAnswers[currentQuestionId]
          });
        }
      }

      // Track form completion
      await apiClient.trackFormComplete(id!, {
        sessionId: formSessionId,
        answers: finalAnswers
      });

      console.log('✅ Form completion tracked');
      
    } catch (error) {
      console.error('Failed to track form completion:', error);
    }
  };

  // UPDATED handleSubmit with tracking
  const handleSubmit = async (response: Response) => {
    console.log("=== DEBUG: PREVIEW FORM SUBMISSION STARTED ===");
    console.log("1. Response object:", response);
    
    try {
      // Track form completion BEFORE submitting
      await trackFormCompletion(response.answers);

      const submitData: any = {
        questionId: id!,
        answers: response.answers,
        timestamp: response.timestamp,
        submissionMetadata: {
          source: 'internal',
          formSessionId: formSessionId // Include session ID for reference
        }
      };

      console.log("2. Submit data prepared");

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 0
            });
          });
          console.log("3. Geolocation obtained");
          submitData.location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: 'browser'
          };
        } catch (geoErr) {
          console.warn("3. Geolocation not available:", geoErr);
        }
      }

      console.log("4. Calling apiClient.createResponse...");
      const submissionResult = await apiClient.createResponse(submitData);
      console.log("5. Submission result:", submissionResult);

      const responseId = submissionResult?.response?.id || 
                        submissionResult?.response?._id || 
                        submissionResult?.id || 
                        submissionResult?._id;

      console.log("6. Extracted responseId:", responseId);
      console.log("7. Tenant ID:", tenant?._id);

      // Auto-assign the response if we have tenant and response ID
      if (responseId && tenant?._id) {
        console.log(`8. Calling autoAssignResponse with:`, {
          responseId,
          tenantId: tenant._id
        });
        
        try {
          const assignResult = await apiClient.autoAssignResponse(responseId, {
            tenantId: tenant._id
          });
          console.log("9. Auto-assign result:", assignResult);
          showSuccess("Response submitted and assigned to admin successfully!");
        } catch (assignError) {
          console.error("9. Auto-assignment failed:", assignError);
          showSuccess("Response submitted successfully (auto-assignment failed)");
        }
      } else {
        console.log("8. Skipping auto-assign - missing responseId or tenant");
        showSuccess("Response submitted successfully!");
      }
      
      console.log("10. Navigating to /responses/all");
      navigate("/responses/all");
      
      // Clear heartbeat interval
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
    } catch (err) {
      console.error("❌ Error in handleSubmit:", err);
      showError("Failed to submit response. Please try again.");
    }
  };

  // NEW: Function to be passed to PreviewForm for question tracking
  const handleQuestionChange = (
    newQuestionId: string,
    newQuestionText: string,
    newQuestionType: string,
    newSectionId: string,
    newSectionTitle: string,
    answer?: any
  ) => {
    trackQuestionChange(
      newQuestionId,
      newQuestionText,
      newQuestionType,
      newSectionId,
      newSectionTitle,
      answer
    );
  };

  // NEW: Function to be passed to PreviewForm for section tracking
  const handleSectionComplete = (
    sectionId: string,
    sectionTitle: string,
    timeSpentSeconds: number,
    questionCount: number
  ) => {
    trackSectionProgress(sectionId, sectionTitle, timeSpentSeconds, questionCount);
  };
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
            <h2 className="text-lg font-semibold text-red-800">
              Form Not Found
            </h2>
            <p className="text-red-600">
              {error ||
                "The form you're trying to preview doesn't exist or has been deleted."}
            </p>
            <button
              onClick={() => {
                setForm(null);
                setError(null);
              }}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              Try Again
            </button>
            <p className="text-sm text-red-500">
              Please check the form ID or contact the administrator if you
              believe this is an error.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Convert the API form data to the format expected by PreviewForm
  // Flatten follow-up questions into section questions with showWhen property
  console.log("=== PreviewFormWrapper: Processing form ===");
  console.log("Form sections:", form.sections);

  // Extract branching rules from questions if not already loaded from API
  const extractedBranchingRules: any[] = [];
  
  const flattenedSections = (form.sections || []).map((section: any) => {
    const allQuestions: any[] = [];

    const flattenQuestions = (questions: any[], parentId?: string) => {
      questions.forEach((question: any) => {
        // Add the main question (without followUpQuestions to avoid duplication)
        const { followUpQuestions, ...mainQuestion } = question;
        
        if (parentId && !mainQuestion.showWhen) {
          mainQuestion.showWhen = {
            questionId: parentId,
            value: mainQuestion.showWhen?.value || ""
          };
        }
        
        allQuestions.push(mainQuestion);

        // Extract branching rules from the question if they exist
        if (question.branchingRules && question.branchingRules.length > 0) {
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

        // Recursively add follow-up questions
        if (followUpQuestions && followUpQuestions.length > 0) {
          flattenQuestions(followUpQuestions, question.id);
        }
      });
    };

    flattenQuestions(section.questions || []);

    return {
      ...section,
      questions: allQuestions,
    };
  });

  // Use extracted branching rules if API rules are empty
  const finalBranchingRules = branchingRules.length > 0 ? branchingRules : extractedBranchingRules;

  const formData = {
    id: form.id,
    title: form.title,
    description: form.description,
    sections: flattenedSections,
    followUpQuestions: form.followUpQuestions || [],
  };

  console.log("=== Final Branching Rules ===");
  console.log("Branching Rules Count:", finalBranchingRules.length);
  console.log("Branching Rules:", finalBranchingRules);

  return (
    <PreviewForm
      questions={[formData]}
      onSubmit={handleSubmit}
      branchingRules={finalBranchingRules}
      viewType={form.viewType}
      // NEW: Pass tracking functions to PreviewForm
      onQuestionChange={handleQuestionChange}
      onSectionComplete={handleSectionComplete}
      formSessionId={formSessionId}
    />
  );
}
