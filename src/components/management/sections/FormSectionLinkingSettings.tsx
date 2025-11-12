import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Link2,
  Eye,
  AlertCircle,
  CheckCircle,
  Loader,
} from "lucide-react";
import { apiClient } from "../../../api/client";
import { SectionLinkManager } from "./SectionLinkManager";
import { FormFlowVisualizer } from "./FormFlowVisualizer";
import type { SectionFlowConfig } from "../../../types/forms";

interface Section {
  id: string;
  title: string;
  questions?: any[];
}

interface FormSectionLinkingSettingsProps {
  formId: string;
  formTitle?: string;
  sections?: Section[];
}

export const FormSectionLinkingSettings: React.FC<
  FormSectionLinkingSettingsProps
> = ({ formId, formTitle, sections: initialSections }) => {
  const [sections, setSections] = useState<Section[]>(initialSections || []);
  const [config, setConfig] = useState<SectionFlowConfig | null>(null);
  const [activeTab, setActiveTab] = useState<"manage" | "preview">("manage");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("manage");

  useEffect(() => {
    loadFormData();
  }, [formId]);

  const loadFormData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getFormById(formId);
      if (data.form) {
        setSections(data.form.sections || []);
      }
    } catch (err) {
      console.error("Error loading form data:", err);
      setError("Failed to load form data");
    } finally {
      setLoading(false);
    }
  };

  const handleConfigSaved = (newConfig: SectionFlowConfig) => {
    setConfig(newConfig);
    setError(null);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <Loader className="animate-spin h-8 w-8 text-blue-600 mx-auto" />
        <p className="mt-3 text-gray-600 dark:text-gray-400">Loading section linking settings...</p>
      </div>
    );
  }

  if (!sections || sections.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            No sections found in this form. Create sections first before setting up links.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => toggleSection("info")}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Section Linking Configuration
          </h3>
          {expandedSection === "info" ? (
            <ChevronUp className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          )}
        </button>

        {expandedSection === "info" && (
          <div className="p-6 bg-blue-50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-blue-800">
              <strong>Form:</strong> {formTitle || formId}
            </p>
            <p className="text-sm text-blue-800 mt-2">
              <strong>Sections:</strong> {sections.length} section
              {sections.length !== 1 ? "s" : ""} available
            </p>
            <p className="text-sm text-blue-700 mt-3">
              Use section linking to create conditional form flows where specific questions
              and answers determine which sections users see next. Enable "Linked Only Mode"
              to show only sections that are part of links.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("manage")}
            className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
              activeTab === "manage"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Link2 className="h-4 w-4" />
              Manage Links
            </div>
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
              activeTab === "preview"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Eye className="h-4 w-4" />
              Preview Flow
            </div>
          </button>
        </div>

        <div className="p-6">
          {activeTab === "manage" ? (
            <SectionLinkManager
              formId={formId}
              sections={sections}
              onConfigSaved={handleConfigSaved}
            />
          ) : (
            <FormFlowVisualizer
              formId={formId}
              sections={sections}
              config={config}
              onConfigUpdate={handleConfigSaved}
            />
          )}
        </div>
      </div>
    </div>
  );
};
