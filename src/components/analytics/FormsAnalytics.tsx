import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { useForms, useResponses, useMutation } from "../../hooks/useApi";
import { apiClient } from "../../api/client";

interface FormItem {
  _id: string;
  id?: string;
  title: string;
  description?: string;
  isVisible?: boolean;
  isActive?: boolean;
  sections?: any[];
  questions?: any[];
  createdAt?: string;
  createdBy?: any;
  responseCount?: number;
  parentFormId?: string | null;
}

interface ResponseData {
  responses: any[];
}

export default function FormsAnalytics() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

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

  const forms = formsData?.forms || [];
  const parentForms = forms.filter((form: FormItem) => !form.parentFormId);
  const totalForms = parentForms.length;
  const activeFormsCount = parentForms.filter(
    (form: FormItem) => form.isActive === true
  ).length;
  const inactiveFormsCount = parentForms.filter(
    (form: FormItem) => form.isActive === false
  ).length;

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
    return filteredForms.reduce((acc, form) => {
      const key = form.parentFormId || form._id;
      if (!acc[key]) {
        acc[key] = {
          parent: form.parentFormId ? null : form,
          children: [],
        };
      }

      if (form.parentFormId) {
        acc[form.parentFormId] = acc[form.parentFormId] || {
          parent: null,
          children: [],
        };
        acc[form.parentFormId].children.push(form);
      } else {
        acc[key].parent = form;
      }

      return acc;
    }, {} as Record<string, { parent: FormItem | null; children: FormItem[] }>);
  }, [filteredForms]);

  const allForms = filteredForms.length;
  const totalResponses = filteredForms.reduce((sum, form) => {
    const formId = form.id || form._id;
    return sum + (responseCounts[formId] || form.responseCount || 0);
  }, 0);

  const handleDelete = async (id: string, title: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${title}"? This action cannot be undone.`
      )
    ) {
      await deleteMutation.mutate(id);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-800">
            Service Analytics
          </h1>
          <p className="text-primary-600">
            Create, edit, and analyze service request forms
          </p>
        </div>
        <button
          onClick={() =>
            navigate("/forms/create", { state: { mode: "create" } })
          }
          className="btn-primary mt-4 sm:mt-0"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Create New Service Form
        </button>
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
        <div className="text-center py-12 bg-white rounded-lg border border-neutral-200">
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
                  <div className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {parent.createdAt
                      ? new Date(parent.createdAt).toLocaleDateString()
                      : "Unknown"}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      parent.isVisible
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {parent.isVisible ? "Public" : "Private"}
                  </span>
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
                  <div className="border-t border-neutral-200 pt-6 mt-6">
                    <div className="flex items-center mb-4">
                      <ChevronRight className="w-5 h-5 text-primary-500 mr-2" />
                      <h4 className="text-lg font-medium text-primary-600">
                        Connected Forms ({children.length})
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {children.map((child) => {
                        const childId = child.id || child._id;
                        const childResponseCount = child.responseCount || 0;

                        return (
                          <div
                            key={childId}
                            className="card p-4 hover:border-primary-300 transition-colors duration-200 group"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="p-2 bg-primary-50 rounded-lg">
                                <FileText className="w-5 h-5 text-primary-600" />
                              </div>
                              <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button
                                  onClick={() =>
                                    navigate(`/forms/${childId}/edit`)
                                  }
                                  className="p-2 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50"
                                  title="Edit form"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    navigate(`/forms/${childId}/preview`)
                                  }
                                  className="p-2 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50"
                                  title="View form"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    navigate(`/forms/${childId}/analytics`)
                                  }
                                  className="p-2 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50"
                                  title="View analytics"
                                >
                                  <BarChart3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    navigate(`/forms/${childId}/responses`)
                                  }
                                  className="p-2 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50"
                                  title="View responses"
                                >
                                  <List className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleDelete(childId, child.title || "")
                                  }
                                  className="p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                  title="Delete form"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <h5 className="font-medium text-primary-600 mb-2 line-clamp-2">
                              {child.title}
                            </h5>

                            <div className="flex items-center justify-between text-sm">
                              <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-primary-50 text-primary-600 border border-primary-200">
                                Child Form
                              </span>
                              <span className="text-xs text-primary-500">
                                {childResponseCount} responses
                              </span>
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
    </div>
  );
}
