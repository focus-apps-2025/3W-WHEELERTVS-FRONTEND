import React, { useState, useEffect } from "react";
import {
  Plus,
  X,
  GripVertical,
  Link,
  Unlink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { apiClient } from "../../api/client";

interface ChildForm {
  id: string;
  _id: string;
  title: string;
  description: string;
  isVisible: boolean;
  isActive: boolean;
  order: number;
}

interface ChildFormsManagerProps {
  parentFormId: string;
  onUpdate?: () => void;
}

export default function ChildFormsManager({
  parentFormId,
  onUpdate,
}: ChildFormsManagerProps) {
  const [childForms, setChildForms] = useState<ChildForm[]>([]);
  const [availableForms, setAvailableForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    fetchData();
  }, [parentFormId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch child forms
      const childData = await apiClient.getChildForms(parentFormId);
      setChildForms(childData.childForms || []);

      // Fetch all available forms
      const allForms = await apiClient.getForms();
      // Filter out the parent form and already linked forms
      const linkedIds = (childData.childForms || []).map(
        (cf: ChildForm) => cf.id
      );
      const available = allForms.forms.filter(
        (f: any) => f.id !== parentFormId && !linkedIds.includes(f.id)
      );
      setAvailableForms(available);
    } catch (error) {
      console.error("Error fetching forms:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkForm = async () => {
    if (!selectedFormId) return;

    try {
      await apiClient.linkChildForm(parentFormId, selectedFormId);
      setShowAddModal(false);
      setSelectedFormId("");
      await fetchData();
      onUpdate?.();
    } catch (error: any) {
      alert(error.message || "Failed to link child form");
    }
  };

  const handleUnlinkForm = async (childFormId: string) => {
    if (!confirm("Are you sure you want to unlink this child form?")) return;

    try {
      await apiClient.unlinkChildForm(parentFormId, childFormId);
      await fetchData();
      onUpdate?.();
    } catch (error: any) {
      alert(error.message || "Failed to unlink child form");
    }
  };

  const handleReorder = async (index: number, direction: "up" | "down") => {
    const newForms = [...childForms];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newForms.length) return;

    // Swap
    [newForms[index], newForms[targetIndex]] = [
      newForms[targetIndex],
      newForms[index],
    ];

    // Update order property
    newForms.forEach((form, i) => {
      form.order = i;
    });

    setChildForms(newForms);

    try {
      const formOrder = newForms.map((f) => f.id);
      await apiClient.reorderChildForms(parentFormId, formOrder);
      onUpdate?.();
    } catch (error: any) {
      alert(error.message || "Failed to reorder child forms");
      fetchData(); // Revert on error
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
      <div
        className="p-6 border-b cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Child Forms ({childForms.length})
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Forms that will be shown to customers after completing this form
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-6">
          {childForms.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
              <Link className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">No child forms linked yet</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Child Form</span>
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {childForms.map((form, index) => (
                  <div
                    key={form.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="flex flex-col space-y-1">
                        <button
                          onClick={() => handleReorder(index, "up")}
                          disabled={index === 0}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleReorder(index, "down")}
                          disabled={index === childForms.length - 1}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-500">
                            #{index + 1}
                          </span>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            {form.title}
                          </h4>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {form.description || "No description"}
                        </p>
                        <div className="flex items-center space-x-3 mt-2">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              form.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {form.isActive ? "Active" : "Inactive"}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              form.isVisible
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {form.isVisible ? "Visible" : "Hidden"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlinkForm(form.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Unlink child form"
                    >
                      <Unlink className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors inline-flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Child Form</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Add Child Form Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Add Child Form
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Form
              </label>
              <select
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Select a form --</option>
                {availableForms.map((form) => (
                  <option key={form.id} value={form.id}>
                    {form.title}
                  </option>
                ))}
              </select>
              {availableForms.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  No available forms to link. Create more forms first.
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkForm}
                disabled={!selectedFormId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Child Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
