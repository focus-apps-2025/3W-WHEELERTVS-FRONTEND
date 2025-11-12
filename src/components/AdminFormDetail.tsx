import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Settings,
  Link2,
  Eye,
  Save,
  Loader,
  AlertCircle,
} from "lucide-react";
import { apiClient } from "../api/client";
import { FormSectionLinkingSettings } from "./management/sections/FormSectionLinkingSettings";

interface FormData {
  _id: string;
  id: string;
  title: string;
  description: string;
  sections: any[];
  sectionFlowConfig?: any;
}

export const AdminFormDetail: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"edit" | "links" | "preview">(
    "links"
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadForm();
  }, [formId]);

  const loadForm = async () => {
    if (!formId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getFormById(formId);
      if (data.form) {
        setForm(data.form);
      }
    } catch (err) {
      console.error("Error loading form:", err);
      setError("Failed to load form details");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-800">
        <Loader className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-800 p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate("/forms")}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Forms
          </button>

          <div className="bg-white dark:bg-gray-900 rounded-lg border border-red-200 p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-700 text-lg">{error || "Form not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate("/forms")}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Forms
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-200 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 font-medium"
            >
              Refresh
            </button>
          </div>

          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{form.title}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">{form.description}</p>

            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">Sections:</span> {form.sections?.length || 0}
              <span className="mx-2">•</span>
              <span>
                <strong>Form ID:</strong> {form.id}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("links")}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === "links"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Link2 className="h-4 w-4" />
              Section Linking
            </button>
            <button
              onClick={() => setActiveTab("edit")}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === "edit"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === "preview"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
          </div>

          <div className="p-8">
            {activeTab === "links" && (
              <FormSectionLinkingSettings
                formId={formId || ""}
                formTitle={form.title}
                sections={form.sections}
              />
            )}

            {activeTab === "edit" && (
              <div className="text-center py-12">
                <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
                  Form Settings & Details
                </p>
                <p className="text-gray-500 dark:text-gray-500 mb-6 max-w-md mx-auto">
                  General form settings like visibility, active status, and form
                  metadata are managed from the Forms Management page.
                </p>
                <button
                  onClick={() => navigate("/forms")}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go to Forms Management
                </button>
              </div>
            )}

            {activeTab === "preview" && (
              <div className="text-center py-12">
                <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
                  Form Preview
                </p>
                <p className="text-gray-500 dark:text-gray-500 mb-6 max-w-md mx-auto">
                  View the form as customers will see it, including all section
                  linking and conditional navigation.
                </p>
                <a
                  href={`/forms/${form.id}/preview`}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <Eye className="h-4 w-4" />
                  Open Preview
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
