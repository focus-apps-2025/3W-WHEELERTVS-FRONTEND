import React, { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Zap,
  ArrowRight,
} from "lucide-react";
import { apiClient } from "../../../api/client";
import type { SectionFlowConfig } from "../../../types/forms";

interface Section {
  id: string;
  title: string;
  questions?: any[];
}

interface FormFlowData {
  formId: string;
  title: string;
  allSections: Section[];
  visibleSections: Section[];
  sectionOrder: string[];
  config: SectionFlowConfig;
  linkedOnlyMode: boolean;
}

interface FormFlowVisualizerProps {
  formId: string;
  sections: Section[];
  config?: SectionFlowConfig;
  onConfigUpdate?: (config: SectionFlowConfig) => void;
}

export const FormFlowVisualizer: React.FC<FormFlowVisualizerProps> = ({
  formId,
  sections,
  config,
  onConfigUpdate,
}) => {
  const [flowData, setFlowData] = useState<FormFlowData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadFormFlow();
  }, [formId]);

  const loadFormFlow = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.calculateFormFlow(formId);
      setFlowData(data);
    } catch (err) {
      console.error("Error loading form flow:", err);
      setError("Failed to load form flow data");
    } finally {
      setLoading(false);
    }
  };

  const toggleLinkedOnlyMode = async () => {
    if (!flowData) return;

    try {
      setLoading(true);
      const newConfig = {
        ...flowData.config,
        linkedOnlyMode: !flowData.linkedOnlyMode,
      };

      await apiClient.setSectionFlowConfig(formId, newConfig);

      setFlowData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          linkedOnlyMode: !prev.linkedOnlyMode,
          config: newConfig,
        };
      });

      setSuccess(
        `Linked only mode ${!flowData.linkedOnlyMode ? "enabled" : "disabled"}`
      );
      setTimeout(() => setSuccess(null), 3000);

      if (onConfigUpdate) {
        onConfigUpdate(newConfig);
      }
    } catch (err) {
      console.error("Error toggling linked only mode:", err);
      setError("Failed to update linked only mode");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !flowData) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
        <div className="animate-spin inline-block h-8 w-8 text-blue-600 rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <p className="mt-2 text-gray-600">Loading form flow...</p>
      </div>
    );
  }

  if (!flowData) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-600">No form flow data available</p>
      </div>
    );
  }

  const allSectionIds = new Set(flowData.allSections.map((s) => s.id));
  const visibleSectionIds = new Set(flowData.visibleSections.map((s) => s.id));
  const hiddenSections = flowData.allSections.filter(
    (s) => !visibleSectionIds.has(s.id)
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-500" />
          Form Flow Visualization
        </h2>
        <p className="text-gray-600">
          Preview which sections will be displayed to users based on your
          configuration.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-2">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {flowData.linkedOnlyMode ? (
              <Eye className="h-5 w-5 text-amber-600" />
            ) : (
              <EyeOff className="h-5 w-5 text-gray-400" />
            )}
            <span className="font-semibold text-gray-900">
              Linked Only Mode: {flowData.linkedOnlyMode ? "ON" : "OFF"}
            </span>
          </div>
          <button
            onClick={toggleLinkedOnlyMode}
            disabled={loading}
            className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
              flowData.linkedOnlyMode
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : "bg-gray-300 text-gray-800 hover:bg-gray-400"
            }`}
          >
            {flowData.linkedOnlyMode ? "Disable" : "Enable"}
          </button>
        </div>
        <p className="text-sm text-gray-700">
          {flowData.linkedOnlyMode
            ? "Only linked sections are shown to users. Unlinked sections are hidden."
            : "All sections are shown to users in order. Links define optional branching paths."}
        </p>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📊 Form Structure
        </h3>
        <div className="space-y-4">
          {flowData.allSections.map((section, index) => {
            const isVisible = visibleSectionIds.has(section.id);
            const isLinked = flowData.config.sectionLinks?.some(
              link => link.sourceSectionId === section.id || link.targetSectionId === section.id
            ) || false;
            
            return (
              <div key={section.id} className="flex items-start gap-4">
                {/* Section Number */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  isVisible 
                    ? isLinked ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                
                {/* Section Info */}
                <div className={`flex-1 p-3 rounded-lg border ${
                  isVisible
                    ? isLinked ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
                    : 'bg-gray-100 border-gray-300 opacity-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium ${isVisible ? 'text-gray-900' : 'text-gray-600'}`}>
                        {section.title}
                      </p>
                      <p className="text-xs text-gray-600">
                        {section.questions?.length || 0} questions
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isVisible && (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                          ✓ Visible
                        </span>
                      )}
                      {isLinked && flowData.linkedOnlyMode && (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                          🔗 Linked
                        </span>
                      )}
                      {!isVisible && (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-200 text-gray-600">
                          ✗ Hidden
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Arrow */}
                {index < flowData.allSections.length - 1 && isVisible && (
                  <div className="flex-shrink-0 flex items-center h-10">
                    <ArrowRight className="h-4 w-4 text-green-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {flowData.config.sectionLinks && flowData.config.sectionLinks.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Active Section Links ({flowData.config.sectionLinks.length})
          </h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            {flowData.config.sectionLinks.map((link, index) => {
              const sourceSection = flowData.allSections.find(
                (s) => s.id === link.sourceSectionId
              );
              const targetSection = flowData.allSections.find(
                (s) => s.id === link.targetSectionId
              );

              return (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-900">
                    {sourceSection?.title}
                  </span>
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-gray-900">
                    {targetSection?.title}
                  </span>
                  {link.linkedByOptionId && (
                    <span className="ml-auto text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      if: {link.linkedByOptionId}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={loadFormFlow}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 font-medium disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Flow
        </button>
      </div>
    </div>
  );
};
