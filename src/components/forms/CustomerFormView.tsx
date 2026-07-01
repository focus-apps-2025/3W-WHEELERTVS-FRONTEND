import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle,
  Loader,
  Eye,
  ChevronRight,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { FormWithSectionLinksResponder } from "./FormWithSectionLinksResponder";
import type { SectionFlowConfig } from "../../types/forms";

interface CustomerFormViewProps {
  formId: string;
  tenantSlug?: string;
  onSubmitted?: (response: any) => void;
  onError?: (error: string) => void;
}

export const CustomerFormView: React.FC<CustomerFormViewProps> = ({
  formId,
  tenantSlug,
  onSubmitted,
  onError,
}) => {
  const [form, setForm] = useState<any>(null);
  const [flowConfig, setFlowConfig] = useState<SectionFlowConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFlowInfo, setShowFlowInfo] = useState(true);

  useEffect(() => {
    loadForm();
  }, [formId, tenantSlug]);

  const loadForm = async () => {
    try {
      setLoading(true);
      setError(null);

      const formData = tenantSlug
        ? await apiClient.getPublicForm(formId, tenantSlug)
        : await apiClient.getFormById(formId);

      if (formData.form) {
        setForm(formData.form);

        if (formData.form.sectionFlowConfig) {
          setFlowConfig(formData.form.sectionFlowConfig);
        }
      }
    } catch (err) {
      const errorMessage = "Failed to load form";
      setError(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const hasFlowConfig = flowConfig && flowConfig.sectionLinks && flowConfig.sectionLinks.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-800">
        <div className="text-center">
          <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-800 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Form Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || "The form you're looking for doesn't exist."}
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Return Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      {hasFlowConfig && showFlowInfo && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    {flowConfig.linkedOnlyMode
                      ? "Adaptive Form"
                      : "Multi-Path Form"}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">
                    {flowConfig.linkedOnlyMode
                      ? "This form shows different sections based on your answers."
                      : "This form has conditional sections that may appear based on your selections."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFlowInfo(false)}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-6">
        <FormWithSectionLinksResponder
          formId={formId}
          onSubmitted={(response) => {
            if (onSubmitted) onSubmitted(response);
          }}
          onError={(error) => {
            setError(error);
            if (onError) onError(error);
          }}
        />
      </div>
    </div>
  );
};
