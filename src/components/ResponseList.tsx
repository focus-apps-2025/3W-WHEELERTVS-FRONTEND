import React, { useState, useEffect } from "react";
import {
  Download,
  Edit2,
  Eye,
  UserPlus,
  ChevronRight,
  MessageSquarePlus,
  ArrowUpRight,
  Trash2,
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import type { Question, Response } from "../types";
import { exportResponsesToExcel } from "../utils/exportUtils";
import ResponseEdit from "./ResponseEdit";
import ResponseDetails from "./ResponseDetails";
import StaffAssignment from "./staff/StaffAssignment";
import { responsesApi, questionsApi } from "../api/storage";
import FollowUpModal from "./settings/forms/FollowUpModal";
import ResponsePreview from "./responses/ResponsePreview";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";

export default function ResponseList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError, showConfirm } = useNotification();
  const [editingResponse, setEditingResponse] = useState<Response | null>(null);
  const [viewingResponse, setViewingResponse] = useState<Response | null>(null);
  const [assigningResponse, setAssigningResponse] = useState<Response | null>(
    null
  );
  const [localResponses, setLocalResponses] = useState<Response[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set());
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [selectedParentForm, setSelectedParentForm] = useState<Question | null>(
    null
  );
  const [selectedResponse, setSelectedResponse] = useState<Response | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch form data and responses in parallel
        const [formResult, responsesResult, allFormsResult] = await Promise.all(
          [
            apiClient.getForm(id),
            apiClient.getFormResponses(id),
            apiClient.getForms(),
          ]
        );

        // Transform responses to match expected format
        const transformedResponses = responsesResult.responses.map(
          (response: any) => ({
            id: response._id,
            questionId: response.formId,
            answers: response.answers,
            timestamp: response.createdAt,
            assignedTo: response.assignedTo,
            assignedAt: response.assignedAt,
            parentResponseId: response.parentResponseId,
          })
        );

        // Transform forms to match expected format
        const transformedForms = allFormsResult.forms.map((form: any) => ({
          id: form._id,
          title: form.title,
          description: form.description,
          sections: form.sections,
          followUpQuestions: form.followUpQuestions,
          parentFormId: form.parentFormId,
          createdAt: form.createdAt,
          updatedAt: form.updatedAt,
        }));

        // Include the specific form if it's not in allForms (in case of filtering or timing issues)
        const specificForm = {
          id: formResult.form._id,
          title: formResult.form.title,
          description: formResult.form.description,
          sections: formResult.form.sections,
          followUpQuestions: formResult.form.followUpQuestions,
          parentFormId: formResult.form.parentFormId,
          createdAt: formResult.form.createdAt,
          updatedAt: formResult.form.updatedAt,
        };

        const allForms = transformedForms.some((f) => f.id === specificForm.id)
          ? transformedForms
          : [...transformedForms, specificForm];

        setQuestions(allForms);
        setLocalResponses(transformedResponses);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load responses. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const mainForm = questions.find((q) => q.id === id);
  const allChildForms = questions.filter((q) => {
    let currentId = q.parentFormId;
    while (currentId) {
      if (currentId === id) return true;
      const parentForm = questions.find((pf) => pf.id === currentId);
      currentId = parentForm?.parentFormId;
    }
    return false;
  });

  const toggleFormExpansion = (formId: string) => {
    setExpandedForms((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(formId)) {
        newSet.delete(formId);
      } else {
        newSet.add(formId);
      }
      return newSet;
    });
  };

  const handleExport = (form: Question) => {
    const formResponses = localResponses.filter(
      (r) => r.questionId === form.id
    );
    exportResponsesToExcel(formResponses, form);
  };

  const handleEdit = (response: Response) => {
    setEditingResponse(response);
  };

  const handleView = (response: Response) => {
    const form = questions.find((q) => q.id === response.questionId);
    if (form) {
      setViewingResponse({ ...response, questionId: form.id });
    }
  };

  const handleAssignStaff = (response: Response) => {
    setAssigningResponse(response);
  };

  const handleCreateChildForm = (parentForm: Question) => {
    setSelectedParentForm(parentForm);
    setShowFollowUpModal(true);
  };

  const handleFollowUpForm = (response: Response) => {
    const followUpForms = questions.filter(
      (q) => q.parentFormId === response.questionId
    );
    setSelectedResponse(response);

    if (followUpForms.length === 1) {
      navigate(
        `/forms/${followUpForms[0].id}/respond?parentResponse=${response.id}`
      );
    } else if (followUpForms.length > 1) {
      navigate(`/forms?parentResponse=${response.id}`);
    } else {
      alert("No follow-up forms available for this response.");
    }
  };

  const handleViewParentResponse = (response: Response) => {
    const parentResponse = localResponses.find(
      (r) => r.id === response.parentResponseId
    );
    if (parentResponse) {
      const parentForm = questions.find(
        (q) => q.id === parentResponse.questionId
      );
      if (parentForm) {
        setViewingResponse({ ...parentResponse, questionId: parentForm.id });
      }
    }
  };

  const handleDelete = async (response: Response) => {
    showConfirm(
      "Are you sure you want to delete this response? This action cannot be undone.",
      async () => {
        try {
          await apiClient.deleteResponse(response.id);
          setLocalResponses((prevResponses) =>
            prevResponses.filter((r) => r.id !== response.id)
          );
          showSuccess("Response deleted successfully", "Success");
        } catch (err) {
          console.error("Error deleting response:", err);
          showError("Failed to delete response. Please try again.", "Error");
        }
      },
      "Delete Response",
      "Delete",
      "Cancel"
    );
  };

  const handleSaveEdit = async (updatedResponse: Response) => {
    try {
      await apiClient.updateResponse(updatedResponse.id, updatedResponse);
      setLocalResponses((prevResponses) =>
        prevResponses.map((r) =>
          r.id === updatedResponse.id ? updatedResponse : r
        )
      );
      setEditingResponse(null);
    } catch (err) {
      console.error("Error updating response:", err);
      alert("Failed to update response. Please try again.");
    }
  };

  const handleAssignmentComplete = async (
    responseId: string,
    staffId: string
  ) => {
    try {
      await apiClient.assignResponse(responseId, staffId);
      const updatedResponse = localResponses.find((r) => r.id === responseId);
      if (updatedResponse) {
        const newResponse = {
          ...updatedResponse,
          assignedTo: staffId,
          assignedAt: new Date().toISOString(),
        };
        setLocalResponses((prevResponses) =>
          prevResponses.map((r) => (r.id === responseId ? newResponse : r))
        );
      }
      setAssigningResponse(null);
    } catch (err) {
      console.error("Error assigning response:", err);
      alert("Failed to assign response. Please try again.");
    }
  };

  const handleFollowUpSave = async (newQuestion: Question) => {
    try {
      const formData = {
        ...newQuestion,
        ...(user?.tenantId && { tenantId: user.tenantId }),
      };
      await apiClient.createForm(formData);
      setShowFollowUpModal(false);
      setSelectedParentForm(null);
      navigate(`/forms/${newQuestion.id}/edit`);
    } catch (err) {
      console.error("Error creating follow-up form:", err);
      alert("Failed to create follow-up form. Please try again.");
    }
  };

  const hasFollowUpResponse = (parentResponseId: string) => {
    return localResponses.some((r) => r.parentResponseId === parentResponseId);
  };

  const renderFormResponses = (form: Question | undefined, level = 0) => {
    if (!form) return null;

    const formResponses = localResponses.filter(
      (r) => r.questionId === form.id
    );
    const isExpanded = expandedForms.has(form.id);
    const hasFollowUpForms = questions.some((q) => q.parentFormId === form.id);
    const childForms = questions.filter((q) => q.parentFormId === form.id);

    const allQuestions =
      form.sections && form.sections.length > 0
        ? form.sections.flatMap((section) => section.questions)
        : form.followUpQuestions || [];

    return (
      <div
        key={form.id}
        className={`mb-8 ${
          level > 0
            ? "ml-8 border-l-2 border-blue-200 dark:border-blue-800 pl-4"
            : ""
        }`}
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <button
              onClick={() => toggleFormExpansion(form.id)}
              className="mr-2 transform transition-transform"
            >
              <ChevronRight
                className={`w-5 h-5 transition-transform ${
                  isExpanded ? "transform rotate-90" : ""
                }`}
              />
            </button>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {form.title}
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExport(form)}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-5 h-5 mr-2" />
              Export to Excel
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Timestamp
                  </th>
                  {allQuestions.map((q) => (
                    <th
                      key={q.id}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      {q.text}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {formResponses.map((response) => (
                  <tr
                    key={response.id}
                    className={`${
                      hasFollowUpResponse(response.id)
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : ""
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(response.timestamp).toLocaleString()}
                    </td>
                    {allQuestions.map((q) => (
                      <td
                        key={q.id}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                      >
                        {Array.isArray(response.answers[q.id])
                          ? (response.answers[q.id] as string[]).join(", ")
                          : (response.answers[q.id] as string)}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                      <button
                        onClick={() => handleView(response)}
                        className="inline-flex items-center text-purple-600 hover:text-purple-800"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </button>
                      <button
                        onClick={() => handleEdit(response)}
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 ml-2"
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </button>
                      {hasFollowUpForms && (
                        <button
                          onClick={() => handleFollowUpForm(response)}
                          className="inline-flex items-center text-green-600 hover:text-green-800 ml-2"
                        >
                          <MessageSquarePlus className="w-4 h-4 mr-1" />
                          Follow-up
                        </button>
                      )}
                      {response.parentResponseId && (
                        <button
                          onClick={() => handleViewParentResponse(response)}
                          className="inline-flex items-center text-indigo-600 hover:text-indigo-800 ml-2"
                        >
                          <ArrowUpRight className="w-4 h-4 mr-1" />
                          Parent
                        </button>
                      )}
                      <button
                        onClick={() => handleAssignStaff(response)}
                        className="inline-flex items-center text-green-600 hover:text-green-800 ml-2"
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Assign
                      </button>
                      <button
                        onClick={() => handleDelete(response)}
                        className="inline-flex items-center text-red-600 hover:text-red-800 ml-2"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {formResponses.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                No responses yet
              </p>
            )}
          </div>
        )}

        {/* Render child forms recursively */}
        {isExpanded &&
          childForms.map((childForm) =>
            renderFormResponses(childForm, level + 1)
          )}
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Loading responses...
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!mainForm) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Form Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          The form you're looking for doesn't exist or has been deleted.
        </p>
        <button
          onClick={() => navigate("/forms")}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Return to Forms
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Render main form and its responses */}
      {renderFormResponses(mainForm)}

      {/* Render all child forms and their responses */}
      {allChildForms.map((childForm) => renderFormResponses(childForm, 1))}

      {editingResponse && (
        <ResponseEdit
          response={editingResponse}
          question={questions.find((q) => q.id === editingResponse.questionId)!}
          onSave={handleSaveEdit}
          onCancel={() => setEditingResponse(null)}
        />
      )}

      {viewingResponse && (
        <ResponseDetails
          response={viewingResponse}
          question={questions.find((q) => q.id === viewingResponse.questionId)!}
          onClose={() => setViewingResponse(null)}
        />
      )}

      {assigningResponse && (
        <StaffAssignment
          responseId={assigningResponse.id}
          onAssign={handleAssignmentComplete}
          onCancel={() => setAssigningResponse(null)}
        />
      )}

      {showFollowUpModal && selectedParentForm && (
        <FollowUpModal
          question={selectedParentForm}
          onClose={() => {
            setShowFollowUpModal(false);
            setSelectedParentForm(null);
          }}
          onSave={handleFollowUpSave}
        />
      )}

      {selectedResponse && (
        <ResponsePreview
          response={selectedResponse}
          question={
            questions.find((q) => q.id === selectedResponse.questionId)!
          }
          onClose={() => setSelectedResponse(null)}
        />
      )}
    </div>
  );
}
