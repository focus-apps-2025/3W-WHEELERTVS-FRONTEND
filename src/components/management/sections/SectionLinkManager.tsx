import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Link2,
  AlertCircle,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
  Save,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "../../../api/client";
import type { SectionLink, OptionToSectionMapping, SectionFlowConfig } from "../../../types/forms";

interface SectionQuestion {
  id: string;
  text: string;
  type: string;
  options?: string[];
}

interface FormSection {
  id: string;
  title: string;
  questions: SectionQuestion[];
}

interface SectionLinkManagerProps {
  formId: string;
  sections: FormSection[];
  onConfigSaved?: (config: SectionFlowConfig) => void;
}

export const SectionLinkManager: React.FC<SectionLinkManagerProps> = ({
  formId,
  sections,
  onConfigSaved,
}) => {
  const [config, setConfig] = useState<SectionFlowConfig>({
    linkedOnlyMode: false,
    sectionLinks: [],
    optionToSectionMap: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedLinks, setExpandedLinks] = useState<Set<number>>(new Set());
  const [newLinkSourceSection, setNewLinkSourceSection] = useState<string>("");
  const [newLinkSourceQuestion, setNewLinkSourceQuestion] = useState<string>("");
  const [newLinkOption, setNewLinkOption] = useState<string>("");
  const [newLinkTargetSection, setNewLinkTargetSection] = useState<string>("");

  useEffect(() => {
    loadConfig();
  }, [formId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getSectionFlowConfig(formId);
      if (data.sectionFlowConfig) {
        setConfig(data.sectionFlowConfig);
      }
    } catch (err) {
      console.error("Error loading section flow config:", err);
      setError("Failed to load section configuration");
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.setSectionFlowConfig(formId, config);
      setSuccess("Section flow configuration saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
      if (onConfigSaved) {
        onConfigSaved(config);
      }
    } catch (err) {
      console.error("Error saving section flow config:", err);
      setError("Failed to save configuration");
    } finally {
      setLoading(false);
    }
  };

  const addLink = () => {
    if (!newLinkSourceSection || !newLinkTargetSection) {
      setError("Please select source and target sections");
      return;
    }

    const newLink: SectionLink = {
      sourceSectionId: newLinkSourceSection,
      sourceQuestionId: newLinkSourceQuestion,
      targetSectionId: newLinkTargetSection,
      linkedByOptionId: newLinkOption || undefined,
    };

    setConfig((prev) => ({
      ...prev,
      sectionLinks: [...(prev.sectionLinks || []), newLink],
    }));

    if (newLinkSourceQuestion && newLinkOption) {
      const optionMapping: OptionToSectionMapping = {
        questionId: newLinkSourceQuestion,
        optionId: newLinkOption,
        targetSectionId: newLinkTargetSection,
      };
      setConfig((prev) => ({
        ...prev,
        optionToSectionMap: [...(prev.optionToSectionMap || []), optionMapping],
      }));
    }

    setNewLinkSourceSection("");
    setNewLinkSourceQuestion("");
    setNewLinkOption("");
    setNewLinkTargetSection("");
    setError(null);
  };

  const removeLink = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      sectionLinks: prev.sectionLinks?.filter((_, i) => i !== index) || [],
    }));
  };

  const toggleLinkExpanded = (index: number) => {
    setExpandedLinks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getSourceSection = (sectionId: string) =>
    sections.find((s) => s.id === sectionId);
  const getTargetSection = (sectionId: string) =>
    sections.find((s) => s.id === sectionId);
  const getQuestion = (sectionId: string, questionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    return section?.questions.find((q) => q.id === questionId);
  };

  const getSourceSectionQuestions = () => {
    if (!newLinkSourceSection) return [];
    const section = sections.find((s) => s.id === newLinkSourceSection);
    return section?.questions || [];
  };

  const getQuestionOptions = () => {
    if (!newLinkSourceQuestion) return [];
    const questions = getSourceSectionQuestions();
    const question = questions.find((q) => q.id === newLinkSourceQuestion);
    return question?.options || [];
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
          <Link2 className="h-6 w-6 text-blue-600" />
          Section Linking Configuration
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Link sections together to create conditional form flows based on user responses.
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

      <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.linkedOnlyMode || false}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                linkedOnlyMode: e.target.checked,
              }))
            }
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            Linked Only Mode
          </span>
        </label>
        <p className="text-sm text-gray-600 dark:text-gray-400 ml-7 mt-2">
          When enabled, only sections that are part of links will be shown to users. This is useful for creating branching paths where only relevant sections appear.
        </p>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Add New Link</h3>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Source Section
              </label>
              <select
                value={newLinkSourceSection}
                onChange={(e) => {
                  setNewLinkSourceSection(e.target.value);
                  setNewLinkSourceQuestion("");
                  setNewLinkOption("");
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select section...</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Section
              </label>
              <select
                value={newLinkTargetSection}
                onChange={(e) => setNewLinkTargetSection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select section...</option>
                {sections
                  .filter((s) => s.id !== newLinkSourceSection)
                  .map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.title}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {newLinkSourceSection && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Trigger Question (Optional)
                </label>
                <select
                  value={newLinkSourceQuestion}
                  onChange={(e) => {
                    setNewLinkSourceQuestion(e.target.value);
                    setNewLinkOption("");
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Any question in section</option>
                  {getSourceSectionQuestions().map((question) => (
                    <option key={question.id} value={question.id}>
                      {question.text.substring(0, 50)}...
                    </option>
                  ))}
                </select>
              </div>

              {newLinkSourceQuestion && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Trigger Option (Optional)
                  </label>
                  <select
                    value={newLinkOption}
                    onChange={(e) => setNewLinkOption(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Any answer</option>
                    {getQuestionOptions().map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <button
            onClick={addLink}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Link
          </button>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          🔗 Active Links ({config.sectionLinks?.length || 0})
        </h3>
        <div className="space-y-4">
          {config.sectionLinks && config.sectionLinks.length > 0 ? (
            config.sectionLinks.map((link, index) => {
              const sourceSection = getSourceSection(link.sourceSectionId);
              const targetSection = getTargetSection(link.targetSectionId);
              const question = link.sourceQuestionId
                ? getQuestion(link.sourceSectionId, link.sourceQuestionId)
                : null;

              return (
                <div
                  key={index}
                  className="border-2 border-blue-200 rounded-lg overflow-hidden bg-gradient-to-r from-blue-50 to-white"
                >
                  <button
                    onClick={() => toggleLinkExpanded(index)}
                    className="w-full px-4 py-4 hover:from-blue-100 flex items-center justify-between transition-colors"
                  >
                    <div className="text-left flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-blue-900">
                          {sourceSection?.title}
                        </span>
                        <span className="text-blue-600 font-bold">→</span>
                        <span className="font-semibold text-blue-900">
                          {targetSection?.title}
                        </span>
                      </div>
                      {question && (
                        <p className="text-sm text-blue-700 ml-0">
                          📌 <span className="font-medium">Trigger:</span> {question.text.substring(0, 50)}
                          {question.text.length > 50 ? "..." : ""}
                        </p>
                      )}
                      {link.linkedByOptionId && (
                        <p className="text-xs text-blue-600 mt-1">
                          📍 When answer = <span className="font-semibold">"{link.linkedByOptionId}"</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {expandedLinks.has(index) ? (
                        <ChevronUp className="h-5 w-5 text-blue-600" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                  </button>

                  {expandedLinks.has(index) && (
                    <div className="px-4 py-4 bg-blue-50 border-t border-blue-200">
                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div className="bg-white dark:bg-gray-900 p-3 rounded border border-blue-100">
                          <p className="text-xs font-semibold text-blue-600 mb-1">SOURCE</p>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{sourceSection?.title}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">ID: {link.sourceSectionId}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-3 rounded border border-blue-100">
                          <p className="text-xs font-semibold text-blue-600 mb-1">TARGET</p>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{targetSection?.title}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">ID: {link.targetSectionId}</p>
                        </div>
                      </div>
                      
                      {link.sourceQuestionId && (
                        <div className="bg-white dark:bg-gray-900 p-3 rounded border border-blue-100 mb-3">
                          <p className="text-xs font-semibold text-blue-600 mb-1">TRIGGER CONDITION</p>
                          <p className="text-sm text-gray-900 dark:text-gray-100">
                            Question: <span className="font-medium">{question?.text}</span>
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">ID: {link.sourceQuestionId}</p>
                          {link.linkedByOptionId && (
                            <p className="text-sm text-blue-700 mt-2 font-medium">
                              ✓ Answer must equal: <span className="text-blue-900">"{link.linkedByOptionId}"</span>
                            </p>
                          )}
                        </div>
                      )}

                      <button
                        onClick={() => removeLink(index)}
                        className="mt-3 flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded font-medium text-sm"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove Link
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-gray-600 dark:text-gray-400 text-center py-6">
              No links created yet. Add links to create conditional section flows.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={saveConfig}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {loading ? "Saving..." : "Save Configuration"}
        </button>

        <button
          onClick={loadConfig}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-6 py-2 bg-gray-300 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 font-medium disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>
    </div>
  );
};
