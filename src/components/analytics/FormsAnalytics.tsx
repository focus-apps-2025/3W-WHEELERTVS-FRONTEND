import React, { useState, useMemo, useRef, useEffect, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Eye,
  Users,
  Calendar,
  Layers,
  ChevronRight,
  Trash2,
  Edit2,
  PlusCircle,
  Search,
  Copy,
  BarChart3,
  List,
  MoreVertical,
  Link2,
  Share2,
  Check,
  Upload,
  Download,
  MapPin,
} from "lucide-react";
import { useForms, useResponses, useMutation } from "../../hooks/useApi";
import { apiClient } from "../../api/client";
import { useNotification } from "../../context/NotificationContext";
import { parseFormWorkbook, downloadFormImportTemplate } from "../../utils/exportUtils";
import AnswerTemplateImport from "../AnswerTemplateImport";
import type { Question as FormQuestion } from "../../types";

interface FormItem {
  _id: string;
  id?: string;
  title: string;
  description?: string;
  isVisible?: boolean;
  locationEnabled?: boolean;
  isActive?: boolean;
  sections?: any[];
  questions?: any[];
  createdAt?: string;
  createdBy?: any;
  responseCount?: number;
  parentFormId?: string | null;
  childForms?: Array<{
    formId: string;
    formTitle?: string;
    order?: number;
  }>;
}

interface ResponseData {
  responses: any[];
}

export default function FormsAnalytics() {
  const navigate = useNavigate();
  const { showSuccess, showError, showConfirm } = useNotification();
  const [searchTerm, setSearchTerm] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isAnswerTemplateOpen, setIsAnswerTemplateOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: formsData, loading, error, execute: refetchForms } = useForms();

  const { data: responsesData, loading: responsesLoading } = useResponses();

  const deleteMutation = useMutation((id: string) => apiClient.deleteForm(id), {
    onSuccess: () => {
      refetchForms();
    },
  });

  const duplicateMutation = useMutation(
    (id: string) => apiClient.duplicateForm(id),
    {
      onSuccess: () => {
        refetchForms();
      },
    }
  );

  const visibilityMutation = useMutation(
    ({ id, isVisible }: { id: string; isVisible: boolean }) =>
      apiClient.updateFormVisibility(id, isVisible),
    {
      onSuccess: () => {
        refetchForms();
      },
    }
  );

  const locationMutation = useMutation(
    ({
      id,
      locationEnabled,
    }: {
      id: string;
      locationEnabled: boolean;
    }) => apiClient.updateFormLocationEnabled(id, locationEnabled),
    {
      onSuccess: () => {
        refetchForms();
      },
      onError: (error: any) => {
        showError(error.message || "Failed to update location setting", "Error");
      },
    }
  );

  const forms = formsData?.forms || [];
  const parentForms = forms.filter((form: FormItem) => !form.parentFormId);
  const totalForms = parentForms.length;
  const activeFormsCount = parentForms.filter(
    (form: FormItem) => form.isActive === true
  ).length;
  const inactiveFormsCount = parentForms.filter(
    (form: FormItem) => form.isActive === false
  ).length;

  const formsMap = useMemo(() => {
    const map = new Map<string, FormItem>();
    forms.forEach((form) => {
      if (form._id) {
        map.set(form._id, form);
      }
      if (form.id) {
        map.set(form.id, form);
      }
    });
    return map;
  }, [forms]);

  const filteredForms = forms.filter((form: FormItem) => {
    const titleMatch = form.title
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    const descriptionMatch = form.description
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    return titleMatch || descriptionMatch;
  });

  const responseCounts = useMemo(() => {
    const allResponses =
      (responsesData as ResponseData | undefined)?.responses || [];
    return allResponses.reduce<Record<string, number>>((acc, response: any) => {
      if (response.questionId) {
        acc[response.questionId] = (acc[response.questionId] || 0) + 1;
      }
      return acc;
    }, {});
  }, [responsesData]);

  const groupedForms = useMemo(() => {
    const result = filteredForms.reduce(
      (acc, form) => {
        const key = form.parentFormId || form.id || form._id;
        if (!key) {
          return acc;
        }

        if (!acc[key]) {
          acc[key] = {
            parent: form.parentFormId ? null : form,
            children: [],
          };
        }

        if (form.parentFormId) {
          const parentKey = form.parentFormId;
          acc[parentKey] = acc[parentKey] || {
            parent: null,
            children: [],
          };
          acc[parentKey].children.push(form);
        } else {
          acc[key].parent = form;
        }

        return acc;
      },
      {} as Record<string, { parent: FormItem | null; children: FormItem[] }>
    );

    Object.values(result).forEach((group) => {
      const parent = group.parent;
      if (!parent) {
        return;
      }

      const childRefs = [...(parent.childForms || [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );

      if (childRefs.length === 0) {
        return;
      }

      const existingChildrenMap = new Map<string, FormItem>();
      group.children.forEach((child) => {
        const childKey = child.id || child._id;
        if (childKey) {
          existingChildrenMap.set(childKey, child);
        }
      });

      const orderedChildren: FormItem[] = [];
      const usedChildIds = new Set<string>();

      childRefs.forEach((childRef, index) => {
        const childId = childRef.formId;
        if (!childId || usedChildIds.has(childId)) {
          return;
        }

        usedChildIds.add(childId);

        let child = existingChildrenMap.get(childId) || formsMap.get(childId);
        if (!child) {
          child = {
            _id: childId,
            id: childId,
            title: childRef.formTitle || "Linked Form",
            parentFormId: parent.id || parent._id || null,
          } as FormItem;
        }

        orderedChildren.push(child);
      });

      group.children.forEach((child) => {
        const childId = child.id || child._id;
        if (!childId || usedChildIds.has(childId)) {
          return;
        }
        orderedChildren.push(child);
      });

      group.children = orderedChildren;
    });

    return result;
  }, [filteredForms, formsMap]);

  const allForms = filteredForms.length;
  const totalResponses = filteredForms.reduce((sum, form) => {
    const formId = form.id || form._id;
    return sum + (responseCounts[formId] || form.responseCount || 0);
  }, 0);

  const handleDelete = async (id: string, title: string) => {
    showConfirm(
      `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      async () => {
        await deleteMutation.mutate(id);
        showSuccess("Form deleted successfully", "Success");
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
    currentVisibility: boolean | undefined
  ) => {
    await visibilityMutation.mutate({
      id,
      isVisible: !currentVisibility,
    });
  };

  const handleToggleLocation = async (
    id: string,
    currentLocationEnabled: boolean | undefined
  ) => {
    const isCurrentlyEnabled = currentLocationEnabled !== false;
    await locationMutation.mutate({
      id,
      locationEnabled: !isCurrentlyEnabled,
    });
  };

  const handleExportTemplate = () => {
    downloadFormImportTemplate();
  };

  const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const isValidType =
      file.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.name.toLowerCase().endsWith(".xlsx");
    if (!isValidType) {
      showError("Please select a valid .xlsx file", "Invalid File");
      return;
    }

    setIsImporting(true);

    try {
      const parsed = await parseFormWorkbook(file);
      const formPayload = {
        ...parsed,
        isVisible: parsed.isVisible ?? true,
        followUpQuestions: parsed.followUpQuestions || [],
      } as FormQuestion;
      const created = await apiClient.createForm(formPayload);
      showSuccess("Form imported successfully", "Import Complete");
      if (created?.form?._id) {
        navigate(`/forms/${created.form._id}/edit`);
      }
      refetchForms();
    } catch (error: any) {
      showError(error?.message || "Failed to import form", "Import Failed");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImportClick = () => {
    if (isImporting) {
      return;
    }
    fileInputRef.current?.click();
  };

  const toggleMenu = (formId: string) => {
    setOpenMenuId(openMenuId === formId ? null : formId);
  };

  const handleManageChildForms = (formId: string) => {
    // Navigate to edit page where ChildFormsManager is available
    navigate(`/forms/${formId}/edit`);
    setOpenMenuId(null);
    // Optionally scroll to child forms section after a short delay
    setTimeout(() => {
      const childFormsSection = document.querySelector(
        '[data-section="child-forms"]'
      );
      if (childFormsSection) {
        childFormsSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 500);
  };

  const handleLinkToParent = (formId: string) => {
    // Navigate to edit page where user can manage parent-child relationships
    navigate(`/forms/${formId}/edit`);
    setOpenMenuId(null);
    setTimeout(() => {
      const childFormsSection = document.querySelector(
        '[data-section="child-forms"]'
      );
      if (childFormsSection) {
        childFormsSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 500);
  };

  const handleCopyShareLink = (formId: string, tenantSlug?: string) => {
    const baseUrl = window.location.origin;
    const shareLink = tenantSlug
      ? `${baseUrl}/${tenantSlug}/form/${formId}`
      : `${baseUrl}/form/${formId}`;

    navigator.clipboard.writeText(shareLink).then(() => {
      setCopiedId(formId);
      setTimeout(() => setCopiedId(null), 2000);
    });
    setOpenMenuId(null);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuId]);

  if (loading || responsesLoading) {
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
    <div className="p-6 space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary-800">
            Service Analytics
          </h1>
          <p className="text-primary-600">
            Create, edit, and analyze service request forms
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportTemplate}
            className="btn-secondary flex items-center justify-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Import Template
          </button>
          <button
            onClick={handleImportClick}
            className="btn-secondary flex items-center justify-center"
            disabled={isImporting}
          >
            <Upload className="w-4 h-4 mr-2" />
            {isImporting ? "Importing..." : "Import Form (Excel)"}
          </button>
          <button
            onClick={() => setIsAnswerTemplateOpen(true)}
            className="btn-secondary flex items-center justify-center"
            title="Import answer templates for testing"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Answers
          </button>
          <button
            onClick={() =>
              navigate("/forms/create", { state: { mode: "create" } })
            }
            className="btn-primary flex items-center justify-center"
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Create New Service Form
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-primary-50 rounded-lg mr-4">
              <FileText className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <div className="text-2xl font-medium text-primary-600">
                {totalForms}
              </div>
              <div className="text-sm text-primary-500">Total Forms</div>
              {/* <div className="mt-2 text-xs text-primary-500 space-x-2">
                <span className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 rounded-full">
                  Active: {activeFormsCount}
                </span>
                <span className="inline-flex items-center px-2 py-1 bg-red-50 text-red-700 rounded-full">
                  Inactive: {inactiveFormsCount}
                </span>
              </div> */}
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-primary-50 rounded-lg mr-4">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <div className="text-2xl font-medium text-primary-600">
                {totalResponses}
              </div>
              <div className="text-sm text-primary-500">Total Responses</div>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-primary-50 rounded-lg mr-4">
              <Layers className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <div className="text-2xl font-medium text-primary-600">
                {Object.keys(groupedForms).length}
              </div>
              <div className="text-sm text-primary-500">Form Groups</div>
            </div>
          </div>
        </div>
      </div>

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

      {filteredForms.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg border border-neutral-200 dark:border-gray-700">
          <FileText className="w-12 h-12 text-primary-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-primary-600 mb-2">
            {searchTerm
              ? "No service forms found"
              : "No service forms created yet"}
          </h3>
          <p className="text-primary-500 mb-6">
            {searchTerm
              ? "Try adjusting your search criteria"
              : "Create your first service form to get started"}
          </p>
          {!searchTerm && (
            <button
              onClick={() => navigate("/forms/create")}
              className="btn-primary"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Create Your First Form
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(groupedForms).map(({ parent, children }) => {
            if (!parent) return null;

            const formId = parent.id || parent._id;
            const responseCount = responseCounts[formId] || 0;
            const isLocationEnabled = parent.locationEnabled !== false;

            return (
              <div
                key={formId}
                className="card p-6 hover:border-primary-300 transition-colors duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-medium text-primary-800 mb-2 line-clamp-2">
                      {parent.title}
                    </h3>
                    <p className="text-sm text-primary-600 line-clamp-2">
                      {parent.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-primary-500 mb-4">
                  <div className="flex items-center">
                    <Users className="w-3 h-3 mr-1" />
                    {responseCount} responses
                  </div>
                  <div className="flex items-center gap-3">
                    {/* 3-dot menu */}
                    <div
                      className="relative"
                      ref={openMenuId === formId ? menuRef : null}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMenu(formId);
                        }}
                        className="p-1.5 rounded-lg hover:bg-primary-100 transition-colors group"
                        title="More options"
                      >
                        <MoreVertical className="w-4 h-4 text-primary-500 group-hover:text-primary-700" />
                      </button>

                      {/* Dropdown menu */}
                      {openMenuId === formId && (
                        <div className="absolute right-0 top-8 w-56 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-primary-200 py-2 z-50 animate-fadeIn">
                          <button
                            onClick={() => handleManageChildForms(formId)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary-700 hover:bg-primary-50 transition-colors"
                          >
                            <div className="p-1.5 bg-gradient-to-br from-primary-100 to-purple-100 rounded-lg">
                              <Layers className="w-4 h-4 text-primary-600" />
                            </div>
                            <div className="text-left">
                              <div className="font-medium">
                                Manage Child Forms
                              </div>
                              <div className="text-xs text-primary-500">
                                Link & organize
                              </div>
                            </div>
                            {children.length > 0 && (
                              <span className="ml-auto px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full">
                                {children.length}
                              </span>
                            )}
                          </button>

                          <button
                            onClick={() => handleLinkToParent(formId)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary-700 hover:bg-primary-50 transition-colors"
                          >
                            <div className="p-1.5 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-lg">
                              <Link2 className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="text-left">
                              <div className="font-medium">Link to Parent</div>
                              <div className="text-xs text-primary-500">
                                Connect forms
                              </div>
                            </div>
                          </button>

                          <div className="border-t border-primary-100 my-1"></div>

                          <button
                            onClick={() => handleCopyShareLink(formId)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-primary-700 hover:bg-primary-50 transition-colors"
                          >
                            <div className="p-1.5 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg">
                              {copiedId === formId ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Share2 className="w-4 h-4 text-green-600" />
                              )}
                            </div>
                            <div className="text-left">
                              <div className="font-medium">
                                {copiedId === formId
                                  ? "Link Copied!"
                                  : "Copy Share Link"}
                              </div>
                              <div className="text-xs text-primary-500">
                                {copiedId === formId
                                  ? "Ready to share"
                                  : "Share with others"}
                              </div>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {parent.createdAt
                        ? new Date(parent.createdAt).toLocaleDateString()
                        : "Unknown"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        parent.isVisible
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {parent.isVisible ? "Public" : "Private"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        isLocationEnabled
                          ? "bg-blue-100 text-blue-800"
                          : "bg-neutral-200 text-neutral-700"
                      }`}
                    >
                      <MapPin className="w-3 h-3" />
                      {isLocationEnabled ? "Location Enabled" : "Location Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        handleToggleVisibility(formId, parent.isVisible)
                      }
                      disabled={visibilityMutation.loading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        parent.isVisible
                          ? "bg-green-500 focus:ring-green-500"
                          : "bg-red-500 focus:ring-red-500"
                      } ${
                        visibilityMutation.loading
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer"
                      }`}
                      title={
                        parent.isVisible
                          ? "Active - Click to deactivate"
                          : "Inactive - Click to activate"
                      }
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          parent.isVisible ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <button
                      onClick={() =>
                        handleToggleLocation(formId, parent.locationEnabled)
                      }
                      disabled={locationMutation.loading}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        isLocationEnabled
                          ? "bg-primary-600 focus:ring-primary-600"
                          : "bg-neutral-400 focus:ring-neutral-400"
                      } ${
                        locationMutation.loading
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer"
                      }`}
                      title={
                        isLocationEnabled
                          ? "Location enabled - Click to disable"
                          : "Location disabled - Click to enable"
                      }
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isLocationEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => navigate(`/forms/${formId}/preview`)}
                      className="px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg transition-colors hover:bg-primary-700"
                    >
                      View
                    </button>
                    <button
                      onClick={() => navigate(`/forms/${formId}/edit`)}
                      className="p-2 text-white bg-primary-600 rounded-lg transition-colors hover:bg-primary-700"
                      title="Edit form"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/forms/${formId}/analytics`)}
                      className="p-2 text-white bg-primary-600 rounded-lg transition-colors hover:bg-primary-700"
                      title="View analytics"
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/forms/${formId}/responses`)}
                      className="p-2 text-white bg-primary-600 rounded-lg transition-colors hover:bg-primary-700"
                      title="View responses"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDuplicate(formId)}
                      className="p-2 text-white bg-primary-600 rounded-lg transition-colors hover:bg-primary-700"
                      title="Duplicate form"
                      disabled={duplicateMutation.loading}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(formId, parent.title)}
                      className="p-2 text-white bg-red-600 rounded-lg transition-colors hover:bg-red-700"
                      title="Delete form"
                      disabled={deleteMutation.loading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {children.length > 0 && (
                  <div className="border-t border-neutral-200 dark:border-gray-700 pt-6 mt-6 bg-gradient-to-r from-primary-50/30 to-purple-50/30 -mx-6 px-6 pb-6 rounded-b-lg">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center">
                        <div className="p-2 bg-gradient-to-br from-primary-500 to-purple-500 rounded-lg mr-3 shadow-sm">
                          <Layers className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-primary-800 flex items-center">
                            Child Forms
                            <span className="ml-2 px-2.5 py-0.5 text-xs font-bold bg-gradient-to-r from-primary-500 to-purple-500 text-white rounded-full shadow-sm">
                              {children.length}
                            </span>
                          </h4>
                          <p className="text-xs text-primary-600 mt-0.5">
                            Connected follow-up forms
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {children.map((child, index) => {
                        const childId = child.id || child._id;
                        const childResponseCount = childId
                          ? responseCounts[childId] || child.responseCount || 0
                          : child.responseCount || 0;

                        return (
                          <div
                            key={childId}
                            className="relative bg-white dark:bg-gray-900 rounded-xl p-4 border-2 border-primary-100 hover:border-primary-300 hover:shadow-lg transition-all duration-300 group transform hover:-translate-y-1"
                            style={{
                              animationDelay: `${index * 50}ms`,
                              animation: "fadeInUp 0.5s ease-out forwards",
                            }}
                          >
                            {/* Corner decoration */}
                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-primary-100 to-purple-100 rounded-bl-full opacity-50"></div>

                            <div className="relative">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <div className="p-2.5 bg-gradient-to-br from-primary-500 to-purple-500 rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300">
                                    <FileText className="w-4 h-4 text-white" />
                                  </div>
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-primary-100 to-purple-100 text-primary-700 border border-primary-200">
                                    ✦ Child
                                  </span>
                                </div>
                              </div>

                              <h5 className="font-semibold text-primary-800 mb-2 line-clamp-2 text-sm group-hover:text-primary-600 transition-colors">
                                {child.title}
                              </h5>

                              {child.description && (
                                <p className="text-xs text-primary-600 mb-3 line-clamp-2">
                                  {child.description}
                                </p>
                              )}

                              <div className="flex items-center justify-between text-xs text-primary-600 mb-3 pb-3 border-b border-primary-100">
                                <div className="flex items-center space-x-1">
                                  <Users className="w-3.5 h-3.5 text-primary-500" />
                                  <span className="font-medium">
                                    {childResponseCount}
                                  </span>
                                  <span className="text-primary-500">
                                    responses
                                  </span>
                                </div>
                                {child.createdAt && (
                                  <div className="flex items-center space-x-1 text-primary-500">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>
                                      {new Date(
                                        child.createdAt
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Quick action buttons */}
                              <div className="flex items-center justify-between gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                <button
                                  onClick={() =>
                                    navigate(`/forms/${childId}/preview`)
                                  }
                                  className="flex-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-1"
                                  title="View form"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  View
                                </button>
                                <button
                                  onClick={() =>
                                    navigate(`/forms/${childId}/edit`)
                                  }
                                  className="p-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors"
                                  title="Edit form"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    navigate(`/forms/${childId}/analytics`)
                                  }
                                  className="p-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors"
                                  title="Analytics"
                                >
                                  <BarChart3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    navigate(`/forms/${childId}/responses`)
                                  }
                                  className="p-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 transition-colors"
                                  title="Responses"
                                >
                                  <List className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleDelete(childId, child.title || "")
                                  }
                                  className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AnswerTemplateImport
        isOpen={isAnswerTemplateOpen}
        onClose={() => setIsAnswerTemplateOpen(false)}
        onSuccess={() => refetchForms()}
      />
    </div>
  );
}
