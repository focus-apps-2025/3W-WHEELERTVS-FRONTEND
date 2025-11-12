import React, { useState } from "react";
import { ExternalLink, X } from "lucide-react";

interface FormRoutingRule {
  optionLabel: string;
  linkedFormId: string;
}

interface FormRoutingConfigProps {
  questionId: string;
  sectionId: string;
  options: string[];
  availableForms: { id: string; title: string }[];
  existingConfig?: Record<string, { linkedFormId?: string }>;
  onSave: (config: Record<string, { linkedFormId: string }>) => void;
  onClose: () => void;
}

export const FormRoutingConfig: React.FC<FormRoutingConfigProps> = ({
  questionId,
  sectionId,
  options,
  availableForms,
  existingConfig = {},
  onSave,
  onClose,
}) => {
  const [formLinks, setFormLinks] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    Object.entries(existingConfig).forEach(([option, config]) => {
      if (config.linkedFormId) {
        initial[option] = config.linkedFormId;
      }
    });
    return initial;
  });

  const handleOptionChange = (optionLabel: string, linkedFormId: string) => {
    setFormLinks((prev) => {
      if (!linkedFormId) {
        const updated = { ...prev };
        delete updated[optionLabel];
        return updated;
      }
      return { ...prev, [optionLabel]: linkedFormId };
    });
  };

  const handleRemoveLink = (optionLabel: string) => {
    setFormLinks((prev) => {
      const updated = { ...prev };
      delete updated[optionLabel];
      return updated;
    });
  };

  const handleSave = () => {
    const config: Record<string, { linkedFormId: string }> = {};
    Object.entries(formLinks).forEach(([option, formId]) => {
      if (formId) {
        config[option] = { linkedFormId: formId };
      }
    });
    onSave(config);
  };

  const getFormTitle = (formId: string) => {
    const form = availableForms.find((f) => f.id === formId);
    return form ? form.title : "Select Form";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-green-50 to-blue-50 border-b border-green-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              🔗 Configure Follow-up Form Routing
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Link answers to different forms
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-900">
              <strong>How it works:</strong> When a user selects an option and
              submits the form, they will be automatically redirected to the
              linked follow-up form.
            </p>
            <p className="text-xs text-green-700 mt-2">
              ⚠️ Note: Only ONE form can be linked per submission (first match
              found will be used)
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">
              Option → Form Linking
            </h4>
            {options.map((option) => {
              const linkedFormId = formLinks[option] || "";
              return (
                <div
                  key={option}
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-green-50 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {option}
                    </p>
                  </div>
                  <select
                    value={linkedFormId}
                    onChange={(e) => handleOptionChange(option, e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-green-500 focus:border-green-500 min-w-[250px]"
                  >
                    <option value="">No follow-up form</option>
                    {availableForms.map((form) => (
                      <option key={form.id} value={form.id}>
                        📋 {form.title}
                      </option>
                    ))}
                  </select>
                  {linkedFormId && (
                    <button
                      onClick={() => handleRemoveLink(option)}
                      className="text-gray-400 hover:text-red-600"
                      title="Remove link"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {Object.keys(formLinks).length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">
                ✅ Active Form Links: {Object.keys(formLinks).length}
              </h4>
              <ul className="text-xs text-blue-800 space-y-1">
                {Object.entries(formLinks).map(([option, formId]) => (
                  <li key={option}>
                    <strong>{option}</strong> → {getFormTitle(formId)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Save Form Routing
          </button>
        </div>
      </div>
    </div>
  );
};
