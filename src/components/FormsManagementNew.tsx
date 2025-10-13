import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircle,
  Search,
  Edit2,
  Trash2,
  Eye,
  FileText,
  MessageSquarePlus,
  Copy,
  BarChart3,
  TrendingUp,
  Users,
  Calendar,
  MoreVertical,
  List,
  Link as LinkIcon,
  ExternalLink,
} from "lucide-react";
import { useForms, useMutation } from "../hooks/useApi";
import { apiClient } from "../api/client";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";

interface Form {
  _id: string;
  title: string;
  description: string;
  isVisible: boolean;
  isActive: boolean;
  sections: any[];
  questions: any[];
  createdAt: string;
  createdBy: any;
  responseCount?: number;
}

export default function FormsManagementNew() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const { data: formsData, loading, error, execute: refetchForms } = useForms();
  const { showSuccess, showError, showConfirm } = useNotification();
  const { user } = useAuth();

  const deleteMutation = useMutation((id: string) => apiClient.deleteForm(id), {
    onSuccess: () => {
      refetchForms();
      showSuccess("Form deleted successfully", "Success");
    },
    onError: (error: any) => {
      showError(error.message || "Failed to delete form", "Error");
    },
  });

  const duplicateMutation = useMutation(
    (id: string) => apiClient.duplicateForm(id),
    {
      onSuccess: () => {
        refetchForms();
        showSuccess("Form duplicated successfully", "Success");
      },
      onError: (error: any) => {
        showError(error.message || "Failed to duplicate form", "Error");
      },
    }
  );

  const visibilityMutation = useMutation(
    ({ id, isVisible }: { id: string; isVisible: boolean }) =>
      apiClient.updateFormVisibility(id, isVisible),
    {
      onSuccess: (data, variables) => {
        refetchForms();
        showSuccess(
          `Form is now ${variables.isVisible ? "public" : "private"}`,
          "Visibility Updated"
        );
      },
      onError: (error: any) => {
        showError(error.message || "Failed to update visibility", "Error");
      },
    }
  );

  const activeMutation = useMutation(
    ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.updateFormActiveStatus(id, isActive),
    {
      onSuccess: (data, variables) => {
        refetchForms();
        showSuccess(
          `Form is now ${variables.isActive ? "active" : "inactive"}`,
          "Status Updated"
        );
      },
      onError: (error: any) => {
        showError(error.message || "Failed to update active status", "Error");
      },
    }
  );

  const forms = formsData?.forms || [];

  const searchValue = searchTerm.toLowerCase();
  const activeForms = forms.filter((form: Form) => form.isActive);
  const filteredForms = activeForms.filter(
    (form: Form) =>
      form.title.toLowerCase().includes(searchValue) ||
      form.description.toLowerCase().includes(searchValue)
  );
  const hasAnyForms = forms.length > 0;
  const hasActiveForms = activeForms.length > 0;

  const handleDelete = async (id: string, title: string) => {
    showConfirm(
      `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      async () => {
        await deleteMutation.mutate(id);
      },
      "Delete Form",
      "Delete",
      "Cancel"
    );
  };

  const handleDuplicate = async (id: string) => {
    await duplicateMutation.mutate(id);
  };

  const handleToggleVisibility = async (
    id: string,
    currentVisibility: boolean
  ) => {
    await visibilityMutation.mutate({
      id,
      isVisible: !currentVisibility,
    });
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    await activeMutation.mutate({
      id,
      isActive: !currentActive,
    });
  };

  const handleCreateForm = () => {
    navigate("/forms/create");
  };

  const handleEditForm = (id: string) => {
    navigate(`/forms/${id}/edit`);
  };

  const handleViewResponses = (id: string) => {
    navigate(`/forms/${id}/responses`);
  };

  const handlePreviewForm = (id: string) => {
    navigate(`/forms/${id}/preview`);
  };

  const handleViewAnalytics = (id: string) => {
    navigate(`/forms/${id}/analytics`);
  };

  const getCustomerFormUrl = (formId: string) => {
    const tenantSlug = user?.tenant?.slug || "default";
    // For production, use your actual customer frontend URL
    const baseUrl = window.location.origin.includes("localhost")
      ? "http://localhost:5174"
      : "https://formsuser.focusengineeringapp.com";
    return `${baseUrl}/${tenantSlug}/forms/${formId}`;
  };

  const handleCopyFormLink = (formId: string, formTitle: string) => {
    const url = getCustomerFormUrl(formId);
    navigator.clipboard
      .writeText(url)
      .then(() => {
        showSuccess(`Link copied for "${formTitle}"`, "Link Copied!");
      })
      .catch(() => {
        showError("Failed to copy link", "Error");
      });
  };

  const handleOpenFormLink = (formId: string) => {
    const url = getCustomerFormUrl(formId);
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-primary-600">Loading forms...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-600">Error loading forms: {error}</p>
          <button onClick={() => refetchForms()} className="mt-4 btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-bold">Service Request Management</h1>
            <p>Create, edit, and manage service request forms</p>
          </div>
          <button
            onClick={handleCreateForm}
            className="btn-primary mt-2 sm:mt-0"
          >
            <PlusCircle className="w-3 h-3 mr-1" />
            Create New Service Form
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search service forms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 input-field"
          />
        </div>
      </div>

      {/* Forms List */}
      {filteredForms.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-neutral-200">
          <FileText className="w-12 h-12 text-primary-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary-600 mb-2">
            {(() => {
              if (!hasAnyForms) {
                return "No service forms created yet";
              }
              if (!hasActiveForms) {
                return "No active service forms";
              }
              return "No service forms found";
            })()}
          </h3>
          <p className="text-primary-500 mb-6">
            {(() => {
              if (!hasAnyForms) {
                return "Create your first service form to get started";
              }
              if (!hasActiveForms) {
                return "Activate a form to make it available here";
              }
              return "Try adjusting your search criteria";
            })()}
          </p>
          {!hasAnyForms && (
            <button onClick={handleCreateForm} className="btn-primary">
              <PlusCircle className="w-4 h-4 mr-2" />
              Create Your First Form
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredForms.map((form: Form) => (
            <div
              key={form._id}
              className="bg-white rounded-lg border border-neutral-200 p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-medium mb-1 line-clamp-2">
                    {form.title}
                  </h3>
                  <p className="text-sm line-clamp-2">{form.description}</p>
                </div>
                <div className="relative ml-2">
                  <button className="p-1 hover:bg-neutral-100 rounded">
                    <MoreVertical className="w-4 h-4 text-primary-400" />
                  </button>
                </div>
              </div>

              {/* Form Stats */}
              <div className="flex items-center justify-between text-xs text-primary-500 mb-4">
                <div className="flex items-center">
                  <Users className="w-3 h-3 mr-1" />
                  {form.responseCount || 0} responses
                </div>
                <div className="flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  {new Date(form.createdAt).toLocaleDateString()}
                </div>
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    form.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {form.isActive ? "Active" : "Inactive"}
                </span>
                <button
                  onClick={() => handleToggleActive(form._id, form.isActive)}
                  className="text-xs text-primary-600 hover:text-primary-800"
                  disabled={activeMutation.loading}
                >
                  {activeMutation.loading ? "..." : "Toggle"}
                </button>
              </div>

              {/* Customer Form Link - Only show if form is active */}
              {/* {form.isActive && (
                <div className="mb-4 p-2 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-blue-700 flex-1 min-w-0">
                      <LinkIcon className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span className="truncate font-medium">
                        Customer Link
                      </span>
                    </div>
                    <div className="flex space-x-1 ml-2">
                      <button
                        onClick={() =>
                          handleCopyFormLink(form.id || form._id, form.title)
                        }
                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                        title="Copy customer link"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleOpenFormLink(form.id || form._id)}
                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-blue-600 truncate">
                    {getCustomerFormUrl(form.id || form._id)}
                  </div>
                </div>
              )} */}

              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePreviewForm(form.id || form._id)}
                    className="px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg transition-colors hover:bg-primary-700"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleEditForm(form._id)}
                    className="p-2 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Edit form"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleViewResponses(form._id)}
                    className="p-2 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
                    title="View responses"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  {/* <button
                    onClick={() => handleViewAnalytics(form._id)}
                    className="p-2 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
                    title="View analytics"
                  >
                    <TrendingUp className="w-4 h-4" />
                  </button> */}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleDuplicate(form._id)}
                    className="p-2 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Duplicate form"
                    disabled={duplicateMutation.loading}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(form._id, form.title)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete form"
                    disabled={deleteMutation.loading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
