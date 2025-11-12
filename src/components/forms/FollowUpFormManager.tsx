import React, { useState, useEffect } from "react";
import {
  Plus,
  Eye,
  Edit,
  Trash2,
  Settings,
  BarChart3,
  Copy,
  ToggleLeft,
  ToggleRight,
  Search,
  Filter,
  FileText,
  AlertCircle,
  CheckCircle,
  Users,
} from "lucide-react";
import { FormWithFollowUpCreator } from "./FormWithFollowUpCreator";
import { FormWithFollowUpResponder } from "./FormWithFollowUpResponder";
import { SectionFollowUpCreator } from "./SectionFollowUpCreator";
import formWithFollowUpService, {
  FollowUpConfig,
} from "../../api/formWithFollowUpService";
import { useNotification } from "../../context/NotificationContext";

interface Form {
  id: string;
  title: string;
  description: string;
  logoUrl?: string;
  imageUrl?: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    username: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  permissions: {
    canRespond: string[];
    canViewResponses: string[];
    canEdit: string[];
    canAddFollowUp: string[];
    canDelete: string[];
  };
}

interface FormListItem extends Form {
  responseCount?: number;
  followUpConfig?: Record<string, FollowUpConfig>;
}

type ViewMode =
  | "list"
  | "create"
  | "edit"
  | "respond"
  | "analytics"
  | "config"
  | "create-sections";

interface FollowUpFormManagerProps {
  initialView?: ViewMode;
  onFormCreated?: (form: Form) => void;
  onFormUpdated?: (form: Form) => void;
  onFormDeleted?: (formId: string) => void;
}

export const FollowUpFormManager: React.FC<FollowUpFormManagerProps> = ({
  initialView = "list",
  onFormCreated,
  onFormUpdated,
  onFormDeleted,
}) => {
  const { showSuccess, showError, showConfirm } = useNotification();
  const [currentView, setCurrentView] = useState<ViewMode>(initialView);
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [selectedForm, setSelectedForm] = useState<FormListItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters and search
  const [searchTerm, setSearchTerm] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<
    "all" | "visible" | "hidden"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadForms();
  }, [currentPage, searchTerm, visibilityFilter]);

  const loadForms = async () => {
    setLoading(true);
    try {
      const result = await formWithFollowUpService.getAllForms({
        page: currentPage,
        limit: 10,
        search: searchTerm || undefined,
        isVisible:
          visibilityFilter === "all"
            ? undefined
            : visibilityFilter === "visible",
      });

      setForms(result.data.forms);
      setTotalPages(result.data.pagination.totalPages);

      // Load follow-up configs for each form
      await loadFollowUpConfigs(result.data.forms);
    } catch (error) {
      console.error("Error loading forms:", error);
      setError(error instanceof Error ? error.message : "Failed to load forms");
    } finally {
      setLoading(false);
    }
  };

  const loadFollowUpConfigs = async (formList: Form[]) => {
    try {
      const configPromises = formList.map(async (form) => {
        try {
          const result = await formWithFollowUpService.getFollowUpConfig(
            form.id
          );
          return { formId: form.id, config: result.data.followUpConfig };
        } catch (error) {
          return { formId: form.id, config: {} };
        }
      });

      const configs = await Promise.all(configPromises);

      setForms((prevForms) =>
        prevForms.map((form) => {
          const config = configs.find((c) => c.formId === form.id);
          return {
            ...form,
            followUpConfig: config?.config || {},
          };
        })
      );
    } catch (error) {
      console.error("Error loading follow-up configs:", error);
    }
  };

  const handleCreateForm = (form: Form) => {
    setForms((prev) => [form, ...prev]);
    setCurrentView("list");
    setSuccess("Form created successfully!");
    setTimeout(() => setSuccess(null), 3000);

    if (onFormCreated) {
      onFormCreated(form);
    }
  };

  const handleEditForm = (form: FormListItem) => {
    setSelectedForm(form);
    setCurrentView("edit");
  };

  const handleViewForm = (form: FormListItem) => {
    setSelectedForm(form);
    setCurrentView("respond");
  };

  const handleConfigureFollowUp = (form: FormListItem) => {
    setSelectedForm(form);
    setCurrentView("config");
  };

  const handleToggleVisibility = async (form: FormListItem) => {
    try {
      await formWithFollowUpService.updateFormVisibility(
        form.id,
        !form.isVisible
      );

      setForms((prev) =>
        prev.map((f) =>
          f.id === form.id ? { ...f, isVisible: !f.isVisible } : f
        )
      );

      setSuccess(
        `Form ${!form.isVisible ? "published" : "unpublished"} successfully!`
      );
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update form visibility"
      );
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDuplicateForm = async (form: FormListItem) => {
    try {
      const result = await formWithFollowUpService.duplicateForm(form.id);
      await loadForms(); // Reload to show the new form

      setSuccess("Form duplicated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to duplicate form"
      );
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteForm = async (form: FormListItem) => {
    showConfirm(
      `Are you sure you want to delete "${form.title}"? This action cannot be undone.`,
      async () => {
        try {
          await formWithFollowUpService.deleteForm(form.id);

          setForms((prev) => prev.filter((f) => f.id !== form.id));
          showSuccess("Form deleted successfully!", "Success");

          if (onFormDeleted) {
            onFormDeleted(form.id);
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "Failed to delete form";
          showError(errorMsg, "Error");
        }
      },
      "Delete Form",
      "Delete",
      "Cancel"
    );
  };

  const getFollowUpSummary = (
    followUpConfig?: Record<string, FollowUpConfig>
  ) => {
    if (!followUpConfig) return "No follow-up configuration";

    return formWithFollowUpService.getFollowUpSummary(followUpConfig).summary;
  };

  const renderFormsList = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
            Forms with Follow-up Questions
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create and manage forms with configurable follow-up questions
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setCurrentView("create")}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Form
          </button>
          <button
            onClick={() => setCurrentView("create-sections")}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Sections Form
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search forms..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <select
          value={visibilityFilter}
          onChange={(e) => setVisibilityFilter(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Forms</option>
          <option value="visible">Published</option>
          <option value="hidden">Unpublished</option>
        </select>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
          <span className="text-green-700">{success}</span>
        </div>
      )}

      {/* Forms List */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading forms...</span>
        </div>
      ) : forms.length === 0 ? (
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
            No forms found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {searchTerm
              ? "Try adjusting your search criteria"
              : "Get started by creating your first form with follow-up questions"}
          </p>
          <button
            onClick={() => setCurrentView("create")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create New Form
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {forms.map((form) => (
            <div
              key={form.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {form.title}
                    </h3>
                    {form.isVisible ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        Published
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium rounded-full">
                        Draft
                      </span>
                    )}
                  </div>

                  <p className="text-gray-600 dark:text-gray-400 mb-3">{form.description}</p>

                  <div className="text-sm text-gray-500 dark:text-gray-500 mb-3">
                    <div>
                      Created by{" "}
                      {form.createdBy.firstName || form.createdBy.username} on{" "}
                      {new Date(form.createdAt).toLocaleDateString()}
                    </div>
                    <div className="mt-1">
                      {getFollowUpSummary(form.followUpConfig)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleViewForm(form)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View/Respond"
                  >
                    <Eye className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleEditForm(form)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleConfigureFollowUp(form)}
                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Configure Follow-up Questions"
                  >
                    <Settings className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleToggleVisibility(form)}
                    className={`p-2 rounded-lg transition-colors ${
                      form.isVisible
                        ? "text-green-600 hover:bg-green-50"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                    title={form.isVisible ? "Unpublish" : "Publish"}
                  >
                    {form.isVisible ? (
                      <ToggleRight className="h-4 w-4" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                  </button>

                  <button
                    onClick={() => handleDuplicateForm(form)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Duplicate"
                  >
                    <Copy className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteForm(form)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <span className="px-3 py-2 text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );

  const renderView = () => {
    switch (currentView) {
      case "create":
        return (
          <div>
            <div className="mb-6">
              <button
                onClick={() => setCurrentView("list")}
                className="flex items-center text-blue-600 hover:text-blue-800"
              >
                ← Back to Forms
              </button>
            </div>
            <FormWithFollowUpCreator onFormCreated={handleCreateForm} />
          </div>
        );

      case "edit":
        return selectedForm ? (
          <div>
            <div className="mb-6">
              <button
                onClick={() => setCurrentView("list")}
                className="flex items-center text-blue-600 hover:text-blue-800"
              >
                ← Back to Forms
              </button>
            </div>
            <FormWithFollowUpCreator
              initialData={{
                title: selectedForm.title,
                description: selectedForm.description,
                logoUrl: selectedForm.logoUrl,
                imageUrl: selectedForm.imageUrl,
                // Note: Would need to extract options from form data
                options: ["Option A", "Option B", "Option C", "Option D"],
                followUpConfig: selectedForm.followUpConfig || {},
              }}
              onFormCreated={(form) => {
                setCurrentView("list");
                loadForms(); // Reload forms
              }}
            />
          </div>
        ) : null;

      case "respond":
        return selectedForm ? (
          <div>
            <div className="mb-6">
              <button
                onClick={() => setCurrentView("list")}
                className="flex items-center text-blue-600 hover:text-blue-800"
              >
                ← Back to Forms
              </button>
            </div>
            <FormWithFollowUpResponder
              formId={selectedForm.id}
              onSubmitted={() => {
                setCurrentView("list");
                setSuccess("Form response submitted successfully!");
                setTimeout(() => setSuccess(null), 3000);
              }}
              onError={(error) => {
                setError(error);
                setTimeout(() => setError(null), 5000);
              }}
            />
          </div>
        ) : null;

      case "create-sections":
        return (
          <div>
            <div className="mb-6">
              <button
                onClick={() => setCurrentView("list")}
                className="flex items-center text-blue-600 hover:text-blue-800"
              >
                ← Back to Forms
              </button>
            </div>
            <SectionFollowUpCreator />
          </div>
        );

      case "config":
        return selectedForm ? (
          <div>
            <div className="mb-6">
              <button
                onClick={() => setCurrentView("list")}
                className="flex items-center text-blue-600 hover:text-blue-800"
              >
                ← Back to Forms
              </button>
            </div>
            <FollowUpConfigEditor
              form={selectedForm}
              onConfigUpdated={() => {
                setCurrentView("list");
                loadForms();
                setSuccess("Follow-up configuration updated successfully!");
                setTimeout(() => setSuccess(null), 3000);
              }}
            />
          </div>
        ) : null;

      default:
        return renderFormsList();
    }
  };

  return <div className="max-w-7xl mx-auto p-6">{renderView()}</div>;
};

// Follow-up Configuration Editor Component
interface FollowUpConfigEditorProps {
  form: FormListItem;
  onConfigUpdated: () => void;
}

const FollowUpConfigEditor: React.FC<FollowUpConfigEditorProps> = ({
  form,
  onConfigUpdated,
}) => {
  const [config, setConfig] = useState<Record<string, FollowUpConfig>>(
    form.followUpConfig || {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default options (would be extracted from actual form data in real implementation)
  const options = ["Option A", "Option B", "Option C", "Option D"];

  const handleConfigChange = (option: string, newConfig: FollowUpConfig) => {
    setConfig((prev) => ({
      ...prev,
      [option]: newConfig,
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      await formWithFollowUpService.updateFollowUpConfig(form.id, config);
      onConfigUpdated();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update configuration"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
          Configure Follow-up Questions
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure which options trigger follow-up questions for:{" "}
          <strong>{form.title}</strong>
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {options.map((option, index) => (
          <div key={option} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">{option}</h3>
              <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                {String.fromCharCode(65 + index)}
              </span>
            </div>

            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config[option]?.hasFollowUp || false}
                  onChange={(e) =>
                    handleConfigChange(option, {
                      hasFollowUp: e.target.checked,
                      required: config[option]?.required || false,
                    })
                  }
                  className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Enable follow-up question
                </span>
              </label>

              {config[option]?.hasFollowUp && (
                <label className="flex items-center ml-7">
                  <input
                    type="checkbox"
                    checked={config[option]?.required || false}
                    onChange={(e) =>
                      handleConfigChange(option, {
                        hasFollowUp: true,
                        required: e.target.checked,
                      })
                    }
                    className="mr-3 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <span className="text-sm text-red-700">
                    Make follow-up required
                  </span>
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end space-x-4">
        <button
          onClick={onConfigUpdated}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors"
        >
          Cancel
        </button>

        <button
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Saving..." : "Save Configuration"}
        </button>
      </div>
    </div>
  );
};

export default FollowUpFormManager;
