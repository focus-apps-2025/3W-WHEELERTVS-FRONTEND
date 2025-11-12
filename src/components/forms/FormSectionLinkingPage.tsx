import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  AlertCircle,
  Loader,
  Link2,
  Eye,
  Settings,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { SectionLinkManager } from "../management/sections/SectionLinkManager";
import { FormFlowVisualizer } from "../management/sections/FormFlowVisualizer";
import type { SectionFlowConfig } from "../../types/forms";

interface Section {
  id: string;
  title: string;
  description?: string;
  questions?: any[];
}

interface FormData {
  id: string;
  title: string;
  description: string;
  sections: Section[];
  sectionFlowConfig?: SectionFlowConfig;
}

export const FormSectionLinkingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"manage" | "visualize">("manage");
  const [config, setConfig] = useState<SectionFlowConfig | null>(null);

  useEffect(() => {
    loadForm();
  }, [id]);

  const loadForm = async () => {
    try {
      setLoading(true);
      if (!id) throw new Error("Form ID is required");

      const data = await apiClient.getFormById(id);
      setForm(data.form);
      setConfig(data.form.sectionFlowConfig);
      setError(null);
    } catch (err) {
      console.error("Error loading form:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load form"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfigSaved = (newConfig: SectionFlowConfig) => {
    setConfig(newConfig);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <Loader className="animate-spin h-8 w-8 text-blue-500" />
        </div>
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => navigate("/forms/management")}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Section Linking
          </h1>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex gap-3">
          <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
          <div>
            <h2 className="font-semibold text-red-800 mb-1">Error</h2>
            <p className="text-red-700">
              {error || "Failed to load form"}
            </p>
            <button
              onClick={() => navigate("/forms/management")}
              className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
            >
              ← Back to Forms
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate("/forms/management")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg transition"
              title="Back to forms"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Link2 className="h-7 w-7 text-blue-600" />
                Section Linking
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">{form.title}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              onClick={() => setActiveTab("manage")}
              className={`flex items-center gap-2 px-4 py-2 font-medium rounded-t-lg transition-colors ${
                activeTab === "manage"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Settings className="h-4 w-4" />
              Manage Links
            </button>
            <button
              onClick={() => setActiveTab("visualize")}
              className={`flex items-center gap-2 px-4 py-2 font-medium rounded-t-lg transition-colors ${
                activeTab === "visualize"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Eye className="h-4 w-4" />
              Preview Flow
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === "manage" && (
          <SectionLinkManager
            formId={form.id}
            sections={form.sections || []}
            onConfigSaved={handleConfigSaved}
          />
        )}

        {activeTab === "visualize" && (
          <FormFlowVisualizer
            formId={form.id}
            sections={form.sections || []}
            config={config}
            onConfigUpdate={handleConfigSaved}
          />
        )}
      </div>

      {/* Info Section */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-3">How it works:</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex gap-2">
              <span className="font-medium min-w-fit">1. Create Links:</span>
              <span>Connect sections by selecting a source section and target section.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-medium min-w-fit">2. Bind to Options:</span>
              <span>
                (Optional) Link to specific question options to create conditional flows.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-medium min-w-fit">3. Enable Mode:</span>
              <span>
                Toggle "Linked Only Mode" to show only sections that are part of links.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-medium min-w-fit">4. Preview:</span>
              <span>
                Use the Preview Flow tab to see how users will experience the form.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
