import React, { useState, useEffect } from "react";
import { X, Plus, Minus } from "lucide-react";
import { apiClient } from "../api/client";
import { useNotification } from "../context/NotificationContext";

interface Parameter {
  id: string;
  name: string;
  type: "main" | "followup";
}

interface ParameterInput {
  name: string;
  type: "main" | "followup";
  id: string;
}

interface ParameterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onParameterCreated?: () => void;
  formId?: string;
}

export default function ParameterModal({
  isOpen,
  onClose,
  onParameterCreated,
  formId,
}: ParameterModalProps) {
  const [parameters, setParameters] = useState<ParameterInput[]>([
    { name: "", type: "main", id: "1" },
    { name: "", type: "main", id: "2" },
    { name: "", type: "main", id: "3" },
    { name: "", type: "main", id: "4" },
    { name: "", type: "main", id: "5" },
  ]);
  const [loading, setLoading] = useState(false);
  const [existingParameters, setExistingParameters] = useState<Parameter[]>([]);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (isOpen) {
      fetchParameters();
      // Reset form with default 5 empty parameters
      setParameters([
        { name: "", type: "main", id: "1" },
        { name: "", type: "main", id: "2" },
        { name: "", type: "main", id: "3" },
        { name: "", type: "main", id: "4" },
        { name: "", type: "main", id: "5" },
      ]);
    }
  }, [isOpen]);

  const fetchParameters = async () => {
    try {
      const response = await apiClient.getParameters({ formId });
      setExistingParameters(response.parameters || []);
    } catch (error) {
      console.error("Failed to fetch parameters:", error);
    }
  };

  const addParameterRow = () => {
    const newId = (parameters.length + 1).toString();
    setParameters([...parameters, { name: "", type: "main", id: newId }]);
  };

  const removeParameterRow = (id: string) => {
    if (parameters.length > 1) {
      setParameters(parameters.filter(param => param.id !== id));
    }
  };

  const updateParameter = (id: string, field: 'name' | 'type', value: string) => {
    setParameters(parameters.map(param =>
      param.id === id ? { ...param, [field]: value } : param
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formId) {
      showError("Form ID is required to create parameters", "Validation Error");
      return;
    }

    // Filter out empty parameters and validate
    const validParameters = parameters.filter(param => param.name.trim() !== "");

    if (validParameters.length === 0) {
      showError("At least one parameter name is required", "Validation Error");
      return;
    }

    // Check for duplicates within the form
    const names = validParameters.map(p => p.name.trim().toLowerCase());
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length > 0) {
      showError("Duplicate parameter names found in the form", "Validation Error");
      return;
    }

    // Check for duplicates with existing parameters for this form
    for (const param of validParameters) {
      const duplicate = existingParameters.find(
        (existing) => existing.name.toLowerCase() === param.name.trim().toLowerCase() && existing.type === param.type && existing.formId === formId
      );
      if (duplicate) {
        showError(`A ${param.type} parameter "${param.name.trim()}" already exists for this form`, "Duplicate Parameter");
        return;
      }
    }

    setLoading(true);
    try {
      // Create all valid parameters
      const createPromises = validParameters.map(param =>
        apiClient.createParameter({
          name: param.name.trim(),
          type: param.type,
          formId: formId!,
        })
      );

      await Promise.all(createPromises);

      const count = validParameters.length;
      showSuccess(`${count} parameter${count > 1 ? 's' : ''} created successfully!`);
      onParameterCreated?.();
      onClose();
    } catch (error: any) {
      console.error("Failed to create parameters:", error);
      showError(
        error.response?.data?.message || "Failed to create parameters",
        "Error"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Create Parameters
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Parameters to Create
              </h4>
              <button
                type="button"
                onClick={addParameterRow}
                className="flex items-center space-x-1 px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                title="Add another parameter"
              >
                <Plus className="w-3 h-3" />
                <span>Add Row</span>
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {parameters.map((param, index) => (
                <div key={param.id} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-xs font-medium">
                    {index + 1}
                  </div>

                  <div className="flex-1">
                    <input
                      type="text"
                      value={param.name}
                      onChange={(e) => updateParameter(param.id, 'name', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                      placeholder="Parameter name"
                    />
                  </div>

                  <div className="flex-shrink-0 w-32">
                    <select
                      value={param.type}
                      onChange={(e) => updateParameter(param.id, 'type', e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="main">Main</option>
                      <option value="followup">Followup</option>
                    </select>
                  </div>

                  {parameters.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeParameterRow(param.id)}
                      className="flex-shrink-0 p-1 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-colors"
                      title="Remove this parameter"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
              <p className="font-medium mb-1">Parameter Types:</p>
              <p>• <strong>Main:</strong> Can be linked to main questions across all sections</p>
              <p>• <strong>Followup:</strong> For followup/sub-questions only</p>
              <p className="mt-2">Only filled parameter names will be created. Empty rows will be ignored.</p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || parameters.every(p => !p.name.trim())}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>
                {loading
                  ? "Creating..."
                  : `Create Parameters (${parameters.filter(p => p.name.trim()).length})`
                }
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}