import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Eye,
  Calendar,
  FileText,
  User,
  X,
  ArrowLeft,
  Save,
  Download,
} from "lucide-react";
import { apiClient } from "../api/client";
import { formatTimestamp } from "../utils/dateUtils";
import { useNotification } from "../context/NotificationContext";
import { exportResponsesToExcel } from "../utils/exportUtils";

interface Response {
  _id: string;
  id: string;
  questionId: string;
  answers: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  status?: string;
  submissionMetadata?: {
    ipAddress?: string;
    userAgent?: string;
    browser?: string;
    device?: string;
    os?: string;
    location?: {
      country?: string;
      countryCode?: string;
      region?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      timezone?: string;
      isp?: string;
    };
    capturedLocation?: {
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      source?: "browser" | "ip" | "manual" | "unknown";
      capturedAt?: string;
    };
    submittedAt?: string;
  };
}

interface Question {
  id: string;
  text: string;
  type: string;
}

interface Section {
  id: string;
  title: string;
  questions: Question[];
}

interface Form {
  _id: string;
  id: string;
  title: string;
  description?: string;
  sections?: Section[];
  followUpQuestions?: Question[];
}

export default function FormResponses() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [responses, setResponses] = useState<Response[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<Response | null>(
    null
  );
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [responsesData, formData] = await Promise.all([
        apiClient.getResponses(),
        apiClient.getForm(id!),
      ]);

      // Set the form
      if (!formData.form) {
        setError("Form not found");
        return;
      }
      setForm(formData.form);

      // Filter responses for this form
      const formResponses = responsesData.responses.filter(
        (response: Response) => response.questionId === id
      );

      setResponses(formResponses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load responses");
    } finally {
      setLoading(false);
    }
  };

  const getQuestionText = (questionId: string): string => {
    if (!form) return questionId;

    // Search in sections
    if (form.sections) {
      for (const section of form.sections) {
        const question = section.questions?.find((q) => q.id === questionId);
        if (question) return question.text;
      }
    }

    // Search in follow-up questions
    if (form.followUpQuestions) {
      const question = form.followUpQuestions.find((q) => q.id === questionId);
      if (question) return question.text;
    }

    return questionId;
  };

  const handleStatusUpdate = async () => {
    if (!selectedResponse || !selectedStatus) return;

    try {
      setUpdating(true);
      await apiClient.updateResponse(selectedResponse.id, {
        status: selectedStatus,
      });

      // Update local state
      setResponses((prev) =>
        prev.map((r) =>
          r.id === selectedResponse.id ? { ...r, status: selectedStatus } : r
        )
      );
      setSelectedResponse({ ...selectedResponse, status: selectedStatus });

      showSuccess("Status updated successfully!");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const groupResponsesByDate = (responses: Response[]) => {
    return responses.reduce((groups, response) => {
      const date = new Date(response.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(response);
      return groups;
    }, {} as Record<string, Response[]>);
  };

  const groupedResponses = groupResponsesByDate(responses);

  const handleExport = (targetForm: Form) => {
    exportResponsesToExcel(responses, {
      id: targetForm.id,
      title: targetForm.title,
      description: targetForm.description,
      sections: targetForm.sections,
    } as any);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="text-red-600 mb-2">Error loading responses</div>
        <div className="text-primary-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-primary-600 hover:text-primary-700 mr-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-medium text-primary-600 mb-2">
              Customer Responses
            </h1>
            <p className="text-primary-500">Responses for: {form?.title}</p>
            {form?.description && (
              <p className="text-sm text-primary-400 mt-1">
                {form.description}
              </p>
            )}
          </div>
        </div>

        {/* Response Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">
                {responses.length}
              </div>
              <div className="text-sm text-primary-500">Total Responses</div>
            </div>
          </div>
          <div className="card p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {responses.filter((r) => r.status === "verified").length}
              </div>
              <div className="text-sm text-primary-500">Completed</div>
            </div>
          </div>
          <div className="card p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {
                  responses.filter((r) => !r.status || r.status === "pending")
                    .length
                }
              </div>
              <div className="text-sm text-primary-500">Pending</div>
            </div>
          </div>
          <div className="card p-4 sm:col-span-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-primary-600">
                  Export Responses
                </h2>
                <p className="text-sm text-primary-500">
                  Download a full Excel report of all responses for this form.
                </p>
              </div>
              <button
                onClick={() => form && handleExport(form)}
                className="btn-secondary flex items-center self-start"
                disabled={!form || responses.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export as Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Responses by Date */}
      <div className="space-y-6">
        {Object.keys(groupedResponses)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
          .map((date) => (
            <div key={date} className="card p-6">
              {/* Date Header */}
              <div className="flex items-center mb-4 pb-2 border-b border-primary-100">
                <Calendar className="w-5 h-5 text-primary-600 mr-2" />
                <h3 className="text-lg font-medium text-primary-600">{date}</h3>
                <span className="ml-2 text-sm text-primary-500">
                  ({groupedResponses[date].length} responses)
                </span>
              </div>

              {/* Responses List */}
              <div className="space-y-3">
                {groupedResponses[date].map((response) => (
                  <div
                    key={response._id}
                    className="flex items-center justify-between p-4 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-white rounded-lg">
                        <FileText className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <div className="flex items-center text-sm text-primary-500">
                          <User className="w-4 h-4 mr-1" />
                          <span>
                            Submitted {formatTimestamp(response.createdAt)}
                          </span>
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              response.status === "verified"
                                ? "bg-green-500 text-white"
                                : response.status === "rejected"
                                ? "bg-red-500 text-white"
                                : "bg-yellow-500 text-white"
                            }`}
                          >
                            {response.status === "verified"
                              ? "Completed"
                              : response.status === "rejected"
                              ? "Closed"
                              : "Pending"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedResponse(response)}
                      className="btn-secondary flex items-center"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

        {responses.length === 0 && (
          <div className="text-center py-16 card">
            <div className="p-4 bg-primary-50 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <FileText className="w-10 h-10 text-primary-600" />
            </div>
            <h3 className="text-lg font-medium text-primary-600 mb-2">
              No Customer Responses
            </h3>
            <p className="text-primary-500 max-w-md mx-auto">
              There are currently no responses for this form. Responses will
              appear here once customers submit the form.
            </p>
          </div>
        )}
      </div>

      {/* Response Preview Modal */}
      {selectedResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-primary-200 sticky top-0 bg-white z-10">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-primary-700">
                    {form?.title}
                  </h3>
                  <p className="text-sm text-primary-500 mt-1">
                    Submitted on {formatTimestamp(selectedResponse.createdAt)}
                  </p>

                  {/* Status Update Section */}
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-sm font-medium text-primary-700">
                      Status:
                    </label>
                    <select
                      value={
                        selectedStatus || selectedResponse.status || "pending"
                      }
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="px-3 py-1.5 border border-primary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="verified">Completed</option>
                      <option value="rejected">Closed</option>
                    </select>
                    <button
                      onClick={handleStatusUpdate}
                      disabled={
                        updating ||
                        !selectedStatus ||
                        selectedStatus === selectedResponse.status
                      }
                      className="btn-primary flex items-center text-sm px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {updating ? "Updating..." : "Update"}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedResponse(null);
                    setSelectedStatus("");
                  }}
                  className="text-primary-500 hover:text-primary-700 ml-4"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <h4 className="text-lg font-semibold text-primary-700 mb-4">
                Response Details
              </h4>
              <div className="space-y-4">
                {Object.entries(selectedResponse.answers).map(
                  ([key, value]) => (
                    <div key={key} className="border-b border-primary-100 pb-4">
                      <div className="font-medium text-primary-700 mb-2">
                        {getQuestionText(key)}
                      </div>
                      <div className="text-primary-600 bg-primary-50 p-3 rounded-lg">
                        {Array.isArray(value)
                          ? value.join(", ")
                          : typeof value === "object"
                          ? JSON.stringify(value, null, 2)
                          : String(value)}
                      </div>
                    </div>
                  )
                )}

                {/* Location Information */}
                {selectedResponse.submissionMetadata?.capturedLocation && (
                  <div className="border-t border-primary-200 pt-4 mt-4">
                    <h5 className="text-md font-semibold text-primary-700 mb-2">
                      Location Information
                    </h5>
                    <div className="text-primary-600 bg-primary-50 p-3 rounded-lg space-y-1">
                      {selectedResponse.submissionMetadata.capturedLocation
                        .latitude &&
                        selectedResponse.submissionMetadata.capturedLocation
                          .longitude && (
                          <p>
                            <strong>Coordinates:</strong>{" "}
                            {selectedResponse.submissionMetadata.capturedLocation.latitude.toFixed(
                              5
                            )}
                            ,{" "}
                            {selectedResponse.submissionMetadata.capturedLocation.longitude.toFixed(
                              5
                            )}
                          </p>
                        )}
                      {selectedResponse.submissionMetadata.capturedLocation
                        .accuracy && (
                        <p>
                          <strong>Accuracy:</strong> ±
                          {
                            selectedResponse.submissionMetadata.capturedLocation
                              .accuracy
                          }{" "}
                          meters
                        </p>
                      )}
                      {selectedResponse.submissionMetadata.capturedLocation
                        .source && (
                        <p>
                          <strong>Source:</strong>{" "}
                          {
                            selectedResponse.submissionMetadata.capturedLocation
                              .source
                          }
                        </p>
                      )}
                      {selectedResponse.submissionMetadata.capturedLocation
                        .capturedAt && (
                        <p>
                          <strong>Captured At:</strong>{" "}
                          {formatTimestamp(
                            selectedResponse.submissionMetadata.capturedLocation
                              .capturedAt
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
