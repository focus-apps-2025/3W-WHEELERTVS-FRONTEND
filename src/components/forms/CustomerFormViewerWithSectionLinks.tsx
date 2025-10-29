import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Loader,
  CheckCircle,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { FormWithSectionLinksResponder } from "./FormWithSectionLinksResponder";

export const CustomerFormViewerWithSectionLinks: React.FC = () => {
  const { tenantSlug, formId } = useParams<{
    tenantSlug: string;
    formId: string;
  }>();
  const navigate = useNavigate();

  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  useEffect(() => {
    loadForm();
  }, [formId, tenantSlug]);

  const loadForm = async () => {
    try {
      setLoading(true);
      if (!formId || !tenantSlug) throw new Error("Form ID and tenant slug are required");

      const data = await apiClient.getPublicForm(formId, tenantSlug);
      setForm(data.form);
      setError(null);
    } catch (err) {
      console.error("Error loading form:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load form. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmitted = (response: any) => {
    setSubmitted(true);
    setSubmittedMessage(`Thank you for your response!`);
    
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  };

  const handleFormError = (errorMessage: string) => {
    setError(errorMessage);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-12 max-w-md w-full text-center">
          <Loader className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-red-200 p-12 max-w-md w-full">
          <div className="flex items-center justify-center h-16 w-16 mx-auto bg-red-100 rounded-full mb-6">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Form Not Found
          </h2>
          <p className="text-gray-600 text-center mb-6">
            {error ||
              "The form you're looking for doesn't exist or is no longer available."}
          </p>
          <button
            onClick={() => window.history.back()}
            className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-green-200 p-12 max-w-md w-full text-center">
          <div className="flex items-center justify-center h-16 w-16 mx-auto bg-green-100 rounded-full mb-6">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Thank You!
          </h2>
          <p className="text-gray-600 mb-6">
            {submittedMessage || "Your response has been submitted successfully."}
          </p>
          <p className="text-sm text-gray-500">
            Redirecting in a moment...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Form with Section Linking Responder */}
      <FormWithSectionLinksResponder
        formId={formId!}
        onSubmitted={handleFormSubmitted}
        onError={handleFormError}
      />
    </div>
  );
};
