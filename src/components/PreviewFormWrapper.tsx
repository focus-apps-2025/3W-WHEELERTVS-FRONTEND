import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import type { Response } from "../types";
import { useNotification } from "../context/NotificationContext";
import PreviewForm from "./PreviewForm";

export default function PreviewFormWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [form, setForm] = useState<any>(null);
  const [branchingRules, setBranchingRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Handle form submission
  const handleSubmit = async (response: Response) => {
    try {
      const submitData: any = {
        questionId: id!,
        answers: response.answers,
        timestamp: response.timestamp,
        submissionMetadata: {
          source: 'internal'
        }
      };

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 0
            });
          });

          submitData.location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: 'browser'
          };
        } catch (geoErr) {
          console.warn("Geolocation not available:", geoErr);
        }
      }

      // Submit response using the API
      await apiClient.createResponse(submitData);
      
      // Show success message and redirect to responses page
      // This ensures the user sees their submission in the list immediately
      showSuccess("Response submitted successfully!");
      navigate("/responses/all");
    } catch (err) {
      console.error("Error submitting response:", err);
      showError("Failed to submit response. Please try again.");
    }
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

    (section.questions || []).forEach((question: any) => {
      console.log("Processing question:", question.text, "ID:", question.id);

      // Add the main question (without followUpQuestions to avoid duplication)
      const { followUpQuestions, ...mainQuestion } = question;
      allQuestions.push(mainQuestion);

      // Extract branching rules from the question if they exist
      if (question.branchingRules && question.branchingRules.length > 0) {
        console.log("Found branching rules:", question.branchingRules);
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

      // Add follow-up questions if they exist
      if (followUpQuestions && followUpQuestions.length > 0) {
        console.log(
          `Found ${followUpQuestions.length} follow-up questions for "${question.text}"`
        );

        followUpQuestions.forEach((followUp: any) => {
          console.log(
            "Follow-up:",
            followUp.text,
            "showWhen:",
            followUp.showWhen
          );

          // Add follow-up with proper showWhen structure
          const followUpQuestion = {
            ...followUp,
            showWhen: followUp.showWhen || {
              questionId: question.id,
              value: followUp.showWhen?.value || "",
            },
          };

          console.log("Adding follow-up question:", followUpQuestion);
          allQuestions.push(followUpQuestion);
        });
      }

      // Also check if the question itself has showWhen (already flattened)
      if (question.showWhen) {
        console.log("Question already has showWhen:", question.showWhen);
      }
    });

    console.log(
      `Section "${section.title}" total questions:`,
      allQuestions.length
    );
    console.log(
      "Questions with showWhen:",
      allQuestions.filter((q) => q.showWhen).length
    );

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
    />
  );
}
