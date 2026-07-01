import React, { useState, useEffect } from "react";
import { X, Plus, Minus, Edit2, Trash2 } from "lucide-react";
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
  isNew?: boolean;
}

interface ParameterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onParameterCreated?: (parameters: ParameterInput[]) => void;
  formId?: string;
  existingParameters?: Parameter[];
}

export default function ParameterModal({
  isOpen,
  onClose,
  onParameterCreated,
  formId,
  existingParameters = [],
}: ParameterModalProps) {
  const [parameters, setParameters] = useState<ParameterInput[]>([]);
  const [existingParams, setExistingParams] = useState<ParameterInput[]>([]);
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetchedParameters, setFetchedParameters] = useState<Parameter[]>([]);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (isOpen) {
      fetchParameters();
    }
  }, [isOpen]);

  const fetchParameters = async () => {
    if (formId) {
      try {
        const response = await apiClient.getParameters({ formId });
        const params = response.parameters || [];
        setFetchedParameters(params);

        const existingParamsData: ParameterInput[] = params.map((param) => ({
          id: String(param.id || param._id),
          name: param.name,
          type: param.type,
          isNew: false,
        }));
        
        setExistingParams(existingParamsData);
        setParameters([
          { name: "", type: "main", id: `new_${Date.now()}_1`, isNew: true },
          { name: "", type: "followup", id: `new_${Date.now()}_2`, isNew: true },
          { name: "", type: "main", id: `new_${Date.now()}_3`, isNew: true },
          { name: "", type: "followup", id: `new_${Date.now()}_4`, isNew: true },
          { name: "", type: "main", id: `new_${Date.now()}_5`, isNew: true },
        ]);
        setEditingIds(new Set());
      } catch (error) {
        console.error("Failed to fetch parameters:", error);
      }
    } else {
      setFetchedParameters(existingParameters);

      const timestamp = Date.now();
      const existingParamsData: ParameterInput[] = (existingParameters || []).map((param, index) => ({
        id: `existing_${timestamp}_${index}`,
        name: param.name,
        type: param.type,
        isNew: false,
      }));
      
      setExistingParams(existingParamsData);
      setParameters([
        { name: "", type: "main", id: `new_${timestamp}_1`, isNew: true },
        { name: "", type: "followup", id: `new_${timestamp}_2`, isNew: true },
        { name: "", type: "main", id: `new_${timestamp}_3`, isNew: true },
        { name: "", type: "followup", id: `new_${timestamp}_4`, isNew: true },
        { name: "", type: "main", id: `new_${timestamp}_5`, isNew: true },
      ]);
      setEditingIds(new Set());
    }
  };

  const addParameterRow = () => {
    const newId = `new_${Date.now()}_${Math.random()}`;
    const defaultType = (parameters.length + 1) % 2 === 1 ? "main" : "followup";
    setParameters([...parameters, { name: "", type: defaultType as "main" | "followup", id: newId, isNew: true }]);
  };

  const removeParameterRow = (id: string) => {
    if (parameters.length > 1) {
      setParameters(parameters.filter(param => param.id !== id));
    }
  };

  const updateParameter = (id: string, field: 'name' | 'type', value: string) => {
    const isExisting = existingParams.some(p => p.id === id);
    
    if (isExisting) {
      setExistingParams(existingParams.map(param =>
        param.id === id ? { ...param, [field]: value } : param
      ));
    } else {
      setParameters(parameters.map(param =>
        param.id === id ? { ...param, [field]: value } : param
      ));
    }
  };

  const toggleEdit = (id: string) => {
    const newEditingIds = new Set(editingIds);
    if (newEditingIds.has(id)) {
      newEditingIds.delete(id);
    } else {
      newEditingIds.add(id);
    }
    setEditingIds(newEditingIds);
  };

  const deleteExistingParameter = async (id: string, name: string) => {
    if (!formId) {
      setExistingParams(existingParams.filter(p => p.id !== id));
      return;
    }

    try {
      await apiClient.deleteParameter(id);
      setExistingParams(existingParams.filter(p => p.id !== id));
      showSuccess(`Parameter "${name}" deleted successfully`);
    } catch (error: any) {
      console.error("Failed to delete parameter:", error);
      showError(
        error.response?.data?.message || "Failed to delete parameter",
        "Error"
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out empty new parameters
    const validNewParameters = parameters.filter(param => param.name.trim() !== "");

    if (validNewParameters.length === 0 && existingParams.filter(p => p.name.trim()).length === 0) {
      showError("At least one parameter name is required", "Validation Error");
      return;
    }

    // Check for duplicates within new parameters
    const newNames = validNewParameters.map(p => p.name.trim().toLowerCase());
    const newDuplicates = newNames.filter((name, index) => newNames.indexOf(name) !== index);
    if (newDuplicates.length > 0) {
      showError("Duplicate parameter names found in the form", "Validation Error");
      return;
    }

    // Check for duplicates between new and existing parameters (excluding the ones being edited)
    const existingNames = existingParams.filter(p => p.name.trim()).map(p => p.name.trim().toLowerCase());
    for (const param of validNewParameters) {
      if (existingNames.includes(param.name.trim().toLowerCase())) {
        showError(`A ${param.type} parameter "${param.name.trim()}" already exists`, "Duplicate Parameter");
        return;
      }
    }

    if (formId) {
      setLoading(true);
      try {
        const updatePromises: Promise<any>[] = [];
        
        existingParams.forEach(param => {
          if (editingIds.has(param.id)) {
            updatePromises.push(
              apiClient.updateParameter(param.id, {
                name: param.name.trim(),
                type: param.type,
                formId: formId,
              })
            );
          }
        });

        const createPromises = validNewParameters.map(param =>
          apiClient.createParameter({
            name: param.name.trim(),
            type: param.type,
            formId: formId,
          })
        );

        await Promise.all([...updatePromises, ...createPromises]);

        let message = '';
        if (updatePromises.length > 0) {
          message += `${updatePromises.length} parameter${updatePromises.length > 1 ? 's' : ''} updated`;
        }
        if (createPromises.length > 0) {
          if (message) message += ' and ';
          message += `${createPromises.length} parameter${createPromises.length > 1 ? 's' : ''} created`;
        }
        message += ' successfully!';
        
        showSuccess(message);
        onParameterCreated?.();
        onClose();
      } catch (error: any) {
        console.error("Failed to process parameters:", error);
        showError(
          error.response?.data?.message || "Failed to process parameters",
          "Error"
        );
      } finally {
        setLoading(false);
      }
    } else {
      const allParameters = [...existingParams, ...validNewParameters];
      onParameterCreated?.(allParameters);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-gray-900 pb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Manage Parameters
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
            {existingParams.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Existing Parameters
                  </h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {existingParams.length} parameter{existingParams.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  {existingParams.map((param, index) => (
                    <div key={param.id} className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-green-100 text-green-600 rounded-full text-xs font-medium">
                        {index + 1}
                      </div>

                      {editingIds.has(param.id) ? (
                        <>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={param.name}
                              onChange={(e) => updateParameter(param.id, 'name', e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:text-gray-100"
                              placeholder="Parameter name"
                            />
                          </div>
                          <div className="flex-shrink-0 w-32">
                            <select
                              value={param.type}
                              onChange={(e) => updateParameter(param.id, 'type', e.target.value)}
                              className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:text-gray-100"
                            >
                              <option value="main">Main</option>
                              <option value="followup">Followup</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleEdit(param.id)}
                            className="flex-shrink-0 p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-colors"
                            title="Save changes"
                          >
                            <span className="text-xs font-medium">Save</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex-1">
                            <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">{param.name}</p>
                          </div>
                          <div className="flex-shrink-0 px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded">
                            {param.type}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleEdit(param.id)}
                            className="flex-shrink-0 p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-colors"
                            title="Edit parameter"
                            disabled={loading}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteExistingParameter(param.id, param.name)}
                            className="flex-shrink-0 p-1 text-gray-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors"
                            title="Delete parameter"
                            disabled={loading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Add New Parameters
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

              <div className="space-y-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                {parameters.map((param, index) => (
                  <div key={param.id} className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-600 rounded-full text-xs font-medium">
                      N
                    </div>

                    <div className="flex-1">
                      <input
                        type="text"
                        value={param.name}
                        onChange={(e) => updateParameter(param.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:text-gray-100"
                        placeholder="Parameter name"
                      />
                    </div>

                    <div className="flex-shrink-0 w-32">
                      <select
                        value={param.type}
                        onChange={(e) => updateParameter(param.id, 'type', e.target.value)}
                        className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:text-gray-100"
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
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
              <p className="font-medium mb-1">Parameter Types:</p>
              <p>• <strong>Main:</strong> Can be linked to main questions across all sections</p>
              <p>• <strong>Followup:</strong> For followup/sub-questions only</p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 sticky bottom-0 bg-white dark:bg-gray-900 pt-4">
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
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>
                {loading
                  ? "Processing..."
                  : `Save Changes (${parameters.filter(p => p.name.trim()).length} new)`
                }
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}