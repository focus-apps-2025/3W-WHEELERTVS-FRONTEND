import React, { useState, useEffect } from "react";
import {
  Eye,
  Calendar,
  FileText,
  User,
  X,
  CheckCircle,
  Clock,
  XCircle,
  Mail,
} from "lucide-react";
import { apiClient } from "../api/client";
import { formatTimestamp } from "../utils/dateUtils";
import { useNotification } from "../context/NotificationContext";

interface Form {
  _id: string;
  title: string;
  sections: any[];
  followUpQuestions?: any[];
}

interface Response {
  _id: string;
  id: string;
  questionId: string;
  answers: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  status?: string;
}

interface GroupedResponses {
  [date: string]: (Response & { formTitle: string })[];
}

export default function AllResponses() {
  const { showSuccess, showError, showInfo } = useNotification();
  const [responses, setResponses] = useState<
    (Response & { formTitle: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<
    (Response & { formTitle: string }) | null
  >(null);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const handleViewDetails = async (
    response: Response & { formTitle: string }
  ) => {
    setSelectedResponse(response);
    setFormLoading(true);
    try {
      const formData = await apiClient.getForm(response.questionId);
      setSelectedForm(formData.form);
    } catch (err) {
      console.error("Failed to load form details:", err);
      setSelectedForm(null);
    } finally {
      setFormLoading(false);
    }
  };

  const handleStatusUpdate = async (responseId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await apiClient.updateResponse(responseId, { status: newStatus });
      // Update the local state
      setResponses((prev) =>
        prev.map((r) =>
          r._id === responseId ? { ...r, status: newStatus } : r
        )
      );
      if (selectedResponse && selectedResponse._id === responseId) {
        setSelectedResponse({ ...selectedResponse, status: newStatus });
        setShowStatusUpdate(false); // Hide the update options after successful update
      }
      showSuccess(`Status updated to ${getStatusInfo(newStatus).label}`);
    } catch (err) {
      console.error("Failed to update status:", err);
      showError("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSendToMail = () => {
    showInfo("This feature is coming soon!", "Coming Soon");
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [responsesData, formsData] = await Promise.all([
        apiClient.getResponses(),
        apiClient.getForms(),
      ]);

      // Create a map using both _id and id for compatibility
      const formsMap = formsData.forms.reduce(
        (map: Record<string, string>, form: any) => {
          // Map both _id and id to the title for maximum compatibility
          if (form._id) map[form._id] = form.title;
          if (form.id) map[form.id] = form.title;
          return map;
        },
        {}
      );

      const responsesWithTitles = responsesData.responses.map(
        (response: Response) => ({
          ...response,
          formTitle: formsMap[response.questionId] || "Unknown Form",
        })
      );

      setResponses(responsesWithTitles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load responses");
    } finally {
      setLoading(false);
    }
  };

  const groupResponsesByDate = (
    responses: (Response & { formTitle: string })[]
  ): GroupedResponses => {
    return responses.reduce((groups, response) => {
      const date = new Date(response.createdAt).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(response);
      return groups;
    }, {} as GroupedResponses);
  };

  const groupedResponses = groupResponsesByDate(responses);

  const getAllQuestions = (form: Form) => {
    const questions: Record<string, any> = {};

    // Add questions from sections
    form.sections?.forEach((section) => {
      section.questions?.forEach((question: any) => {
        questions[question.id] = question;
        // Add follow-up questions
        question.followUpQuestions?.forEach((followUp: any) => {
          questions[followUp.id] = followUp;
        });
      });
    });

    // Add form-level follow-up questions
    form.followUpQuestions?.forEach((question: any) => {
      questions[question.id] = question;
    });

    return questions;
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "pending":
        return {
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          icon: Clock,
          label: "Pending",
        };
      case "confirmed":
        return {
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          icon: CheckCircle,
          label: "Confirmed",
        };
      case "verified":
        return {
          color: "text-green-600",
          bgColor: "bg-green-50",
          icon: CheckCircle,
          label: "Verified",
        };
      case "rejected":
        return {
          color: "text-red-600",
          bgColor: "bg-red-50",
          icon: XCircle,
          label: "Rejected",
        };
      default:
        return {
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          icon: Clock,
          label: "Unknown",
        };
    }
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
        <h1 className="text-2xl font-medium text-primary-600 mb-2">
          Customer Requests
        </h1>
        <p className="text-primary-500">
          View all customer service requests and responses
        </p>
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
                  ({groupedResponses[date].length} requests)
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
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-primary-700">
                            {response.formTitle}
                          </h4>
                          {response.status &&
                            (() => {
                              const statusInfo = getStatusInfo(response.status);
                              const IconComponent = statusInfo.icon;
                              return (
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color} ${statusInfo.bgColor}`}
                                >
                                  <IconComponent className="w-3 h-3 mr-1" />
                                  {statusInfo.label}
                                </span>
                              );
                            })()}
                        </div>
                        <div className="flex items-center text-sm text-primary-500 mt-1">
                          <User className="w-4 h-4 mr-1" />
                          <span>
                            Submitted {formatTimestamp(response.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewDetails(response)}
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
              No Customer Requests
            </h3>
            <p className="text-primary-500 max-w-md mx-auto">
              There are currently no customer service requests. Requests will
              appear here once customers submit forms.
            </p>
          </div>
        )}
      </div>

      {/* Response Preview Modal */}
      {selectedResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-primary-200 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-semibold text-primary-700">
                  {selectedResponse.formTitle}
                </h3>
                <p className="text-sm text-primary-500">
                  Submitted on {formatTimestamp(selectedResponse.createdAt)}
                </p>
                {selectedResponse.status && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      Status:
                    </span>
                    {(() => {
                      const statusInfo = getStatusInfo(selectedResponse.status);
                      const IconComponent = statusInfo.icon;
                      return (
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color} ${statusInfo.bgColor}`}
                        >
                          <IconComponent className="w-4 h-4 mr-2" />
                          {statusInfo.label}
                        </span>
                      );
                    })()}
                    <button
                      onClick={() => setShowStatusUpdate(!showStatusUpdate)}
                      className="px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-md hover:bg-primary-200 transition-colors"
                    >
                      Update
                    </button>
                  </div>
                )}
                {showStatusUpdate && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() =>
                        handleStatusUpdate(selectedResponse.id, "pending")
                      }
                      disabled={
                        updatingStatus ||
                        selectedResponse.status.toLowerCase() === "pending"
                      }
                      className="px-3 py-1 text-sm rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Pending
                    </button>
                    <button
                      onClick={() =>
                        handleStatusUpdate(selectedResponse.id, "confirmed")
                      }
                      disabled={
                        updatingStatus ||
                        selectedResponse.status.toLowerCase() === "confirmed"
                      }
                      className="px-3 py-1 text-sm rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirmed
                    </button>
                    <button
                      onClick={() =>
                        handleStatusUpdate(selectedResponse.id, "verified")
                      }
                      disabled={
                        updatingStatus ||
                        selectedResponse.status.toLowerCase() === "verified"
                      }
                      className="px-3 py-1 text-sm rounded-md text-green-700 bg-green-100 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Verified
                    </button>
                    <button
                      onClick={() =>
                        handleStatusUpdate(selectedResponse.id, "rejected")
                      }
                      disabled={
                        updatingStatus ||
                        selectedResponse.status.toLowerCase() === "rejected"
                      }
                      className="px-3 py-1 text-sm rounded-md text-red-700 bg-red-100 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Rejected
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <button
                    onClick={() =>
                      handleStatusUpdate(selectedResponse._id, "confirmed")
                    }
                    disabled={
                      updatingStatus || selectedResponse.status === "confirmed"
                    }
                    className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Mark as Confirmed"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      handleStatusUpdate(selectedResponse._id, "verified")
                    }
                    disabled={
                      updatingStatus || selectedResponse.status === "verified"
                    }
                    className="p-2 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Mark as Verified"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={handleSendToMail}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  title="Send to Mail"
                >
                  <Mail className="w-4 h-4" />
                  Send to Mail
                </button>
                <button
                  onClick={() => {
                    setSelectedResponse(null);
                    setSelectedForm(null);
                  }}
                  className="text-primary-500 hover:text-primary-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {formLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                </div>
              ) : selectedForm ? (
                <div className="space-y-4">
                  {(() => {
                    const questions = getAllQuestions(selectedForm);
                    return Object.entries(selectedResponse.answers).map(
                      ([key, value]) => {
                        const question = questions[key];
                        return (
                          <div
                            key={key}
                            className="border-b border-primary-100 pb-2"
                          >
                            <div className="font-medium text-primary-700">
                              {question?.text || key}
                            </div>
                            <div className="text-primary-600 mt-1">
                              {Array.isArray(value)
                                ? value.join(", ")
                                : typeof value === "object"
                                ? JSON.stringify(value, null, 2)
                                : String(value)}
                            </div>
                          </div>
                        );
                      }
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(selectedResponse.answers).map(
                    ([key, value]) => (
                      <div
                        key={key}
                        className="border-b border-primary-100 pb-2"
                      >
                        <div className="font-medium text-primary-700">
                          {key}
                        </div>
                        <div className="text-primary-600 mt-1">
                          {Array.isArray(value)
                            ? value.join(", ")
                            : typeof value === "object"
                            ? JSON.stringify(value, null, 2)
                            : String(value)}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
