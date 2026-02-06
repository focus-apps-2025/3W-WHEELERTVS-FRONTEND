import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Table,
  BarChart3,
  PieChart,
  Check,
  X as XIcon,
} from "lucide-react";
import { apiClient } from "../api/client";
import { formatTimestamp } from "../utils/dateUtils";
import { useNotification } from "../context/NotificationContext";
import { exportResponsesToExcel } from "../utils/exportUtils";
import { exportResponseToPDF, exportAllResponsesToPDF, exportAllResponsesToZip } from "../utils/pdfExportUtils";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface Response {
  _id: string;
  id: string;
  questionId: string;
  answers: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  status?: string;
  parentResponseId?: string;
  childResponses?: Response[];
  score?: {
    correct: number;
    total: number;
  };
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
  correctAnswer?: any;
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
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<Response | null>(
    null
  );
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [showTableView, setShowTableView] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");

  const questionColumns = useMemo(() => {
    if (!form) return [] as Array<{ id: string; text: string }>;

    const sectionQuestions = (form.sections ?? []).flatMap(
      (section) => section.questions ?? []
    );
    const followUpQuestions = form.followUpQuestions ?? [];

    const uniqueQuestions = new Map<string, Question>();

    [...sectionQuestions, ...followUpQuestions].forEach((questionItem) => {
      if (questionItem && !uniqueQuestions.has(questionItem.id)) {
        uniqueQuestions.set(questionItem.id, questionItem);
      }
    });

    return Array.from(uniqueQuestions.values()).map(({ id, text }) => ({
      id,
      text,
    }));
  }, [form]);

  const quizQuestions = useMemo(() => {
    return allQuestions.filter((q) => q.correctAnswer !== undefined);
  }, [allQuestions]);

  const getQuestionDistribution = useCallback(
    (questionId: string) => {
      const distribution: Record<string, number> = {};
      responses.forEach((response) => {
        const answer = response.answers?.[questionId];
        const answerStr = Array.isArray(answer)
          ? answer.join(", ")
          : String(answer || "No Answer");
        distribution[answerStr] = (distribution[answerStr] || 0) + 1;
      });
      return distribution;
    },
    [responses]
  );

  const getAnswerDisplay = useCallback(
    (response: Response, questionId: string) => {
      const answer = response.answers?.[questionId];

      if (answer === undefined || answer === null || answer === "") {
        return "--";
      }

      if (Array.isArray(answer)) {
        return answer.join(", ");
      }

      if (typeof answer === "object") {
        // Special handling for Product NPS Buckets (Hierarchy)
        if (answer.level1 || answer.level2 || answer.level3) {
          return [
            answer.level1,
            answer.level2,
            answer.level3,
            answer.level4,
            answer.level5,
            answer.level6,
          ]
            .filter(Boolean)
            .join(" > ");
        }
        try {
          return JSON.stringify(answer, null, 2);
        } catch (error) {
          return String(answer);
        }
      }

      return String(answer);
    },
    []
  );

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

      // Collect all questions from sections and followUpQuestions
      const allQs: Question[] = [];
      if (formData.form.sections) {
        formData.form.sections.forEach((section) => {
          if (section.questions) allQs.push(...section.questions);
        });
      }
      if (formData.form.followUpQuestions)
        allQs.push(...formData.form.followUpQuestions);
      setAllQuestions(allQs);

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

  const handleExport = (targetForm: Form) => {
    exportResponsesToExcel(responses, {
      id: targetForm.id,
      title: targetForm.title,
      description: targetForm.description,
      sections: targetForm.sections,
    } as any);
  };

  const groupedResponses = useMemo(
    () => groupResponsesByDate(responses),
    [responses]
  );

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
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
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
              <div className="text-2xl font-bold text-primary-600">
                {responses.filter((r) => r.score).length}
              </div>
              <div className="text-sm text-primary-500">Scored Responses</div>
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
          <div className="card p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {(() => {
                  const scoredResponses = responses.filter((r) => r.score);
                  if (scoredResponses.length === 0) return "0%";
                  const totalScore = scoredResponses.reduce(
                    (sum, r) => sum + r.score.correct / r.score.total,
                    0
                  );
                  const average = Math.round(
                    (totalScore / scoredResponses.length) * 100
                  );
                  return `${average}%`;
                })()}
              </div>
              <div className="text-sm text-primary-500">Average Score</div>
            </div>
          </div>
          <div className="card p-4 sm:col-span-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-primary-600">
                  Export Responses
                </h2>
                <p className="text-sm text-primary-500">
                  Download a full Excel report of all responses for this form.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => form && handleExport(form)}
                  className="btn-secondary flex items-center"
                  disabled={!form || responses.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export as Excel
                </button>
                <button
                  onClick={() => form && exportAllResponsesToZip(responses as any, form as any)}
                  className="btn-secondary flex items-center"
                  disabled={!form || responses.length === 0}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Bulk Download (PDF ZIP)
                </button>
                <button
                  onClick={() => setShowTableView(true)}
                  className="btn-tertiary flex items-center"
                  disabled={responses.length === 0}
                >
                  <Table className="w-4 h-4 mr-2" />
                  View as Table
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Response Distribution by Question */}
      {/* {quizQuestions.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary-600">
              Response Distribution by Question
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setChartType("bar")}
                className={`btn-secondary flex items-center ${
                  chartType === "bar" ? "bg-primary-600 text-white" : ""
                }`}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Bar
              </button>
              <button
                onClick={() => setChartType("pie")}
                className={`btn-secondary flex items-center ${
                  chartType === "pie" ? "bg-primary-600 text-white" : ""
                }`}
              >
                <PieChart className="w-4 h-4 mr-2" />
                Pie
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {quizQuestions.map((question) => {
              const distribution = getQuestionDistribution(question.id);
              const labels = Object.keys(distribution);
              const data = Object.values(distribution);
              const correctAnswerStr = Array.isArray(question.correctAnswer)
                ? question.correctAnswer.join(", ")
                : String(question.correctAnswer || "");
              const correctIndex = labels.findIndex(
                (label) =>
                  label.toLowerCase() === correctAnswerStr.toLowerCase()
              );

              const backgroundColors = labels.map((_, index) =>
                index === correctIndex ? "#10B981" : "#6B7280"
              );
              const borderColors = labels.map((_, index) =>
                index === correctIndex ? "#059669" : "#4B5563"
              );

              const chartData = {
                labels,
                datasets: [
                  {
                    label: "Responses",
                    data,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1,
                  },
                ],
              };

              const options = {
                responsive: true,
                plugins: {
                  legend: {
                    position: "top" as const,
                  },
                  title: {
                    display: true,
                    text: question.text,
                  },
                },
              };

              return (
                <div key={question.id} className="card p-6">
                  <h3 className="text-lg font-medium text-primary-600 mb-2">
                    {question.text}
                  </h3>
                  <p className="text-sm text-green-600 font-medium mb-4">
                    Correct Answer: {correctAnswerStr}
                  </p>
                  <p className="text-sm text-primary-500 mb-4">
                    {responses.length} responses
                  </p>
                  <div className="h-64">
                    {chartType === "bar" ? (
                      <Bar data={chartData} options={options} />
                    ) : (
                      <Pie data={chartData} options={options} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )} */}

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
                      <div className="p-2 bg-white dark:bg-gray-900 rounded-lg">
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
                          {response.score && (
                            <div className="mt-1 text-xs text-primary-600">
                              Score: {response.score.correct}/
                              {response.score.total} (
                              {Math.round(
                                (response.score.correct /
                                  response.score.total) *
                                  100
                              )}
                              %)
                            </div>
                          )}
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
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-primary-200 sticky top-0 bg-white dark:bg-gray-900 z-10">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-primary-700">
                    {form?.title}
                  </h3>
                  <p className="text-sm text-primary-500 mt-1">
                    Submitted on {formatTimestamp(selectedResponse.createdAt)}
                  </p>
                  {(() => {
                    let correctCount = 0;
                    allQuestions.forEach((q) => {
                      if (q.correctAnswer) {
                        const ans = selectedResponse.answers[q.id];
                        if (ans !== undefined && ans !== null) {
                          const ansStr = Array.isArray(ans)
                            ? ans.join(", ")
                            : String(ans);
                          const corrStr = Array.isArray(q.correctAnswer)
                            ? q.correctAnswer.join(", ")
                            : String(q.correctAnswer);
                          if (ansStr.toLowerCase() === corrStr.toLowerCase())
                            correctCount++;
                        }
                      }
                    });
                    const score = correctCount * 10;
                    const percentage = Math.round((score / 110) * 100);
                    return (
                      <p className="text-sm text-primary-500 mt-1">
                        Quiz Score: {score}/110 ({percentage}%)
                      </p>
                    );
                  })()}

                  {/* Status Update Section */}
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-sm font-medium text-primary-700">
                      Status:
                    </label>
                    <select
                      value={
                        selectedStatus || selectedResponse.status || "pending"
                      }
                      onChange={(event) =>
                        setSelectedStatus(event.target.value)
                      }
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      form && exportResponseToPDF(selectedResponse as any, form as any)
                    }
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-full transition-colors"
                    title="Download as PDF"
                  >
                    <FileText className="w-5 h-5" />
                  </button>
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
                      {(() => {
                        const question = allQuestions.find((q) => q.id === key);
                        const isQuiz = question && question.correctAnswer;
                        const answerStr = Array.isArray(value)
                          ? value.join(", ")
                          : typeof value === "object"
                          ? JSON.stringify(value, null, 2)
                          : String(value);
                        const correct = isQuiz
                          ? (() => {
                              const corrStr = Array.isArray(
                                question.correctAnswer
                              )
                                ? question.correctAnswer.join(", ")
                                : String(question.correctAnswer);
                              return (
                                answerStr.toLowerCase() ===
                                corrStr.toLowerCase()
                              );
                            })()
                          : null;
                        return (
                          <div
                            className={`p-3 rounded-lg ${
                              isQuiz
                                ? correct
                                  ? "bg-green-50 text-green-700"
                                  : "bg-red-50 text-red-700"
                                : "bg-primary-50 text-primary-600"
                            }`}
                          >
                            {answerStr}
                          </div>
                        );
                      })()}
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

                {selectedResponse.childResponses && selectedResponse.childResponses.length > 0 && (
                  <div className="mt-8 pt-8 border-t-2 border-primary-200">
                    <h4 className="text-lg font-semibold text-primary-700 mb-4 flex items-center">
                      <span className="text-purple-600 mr-2">📄</span>
                      Follow-up Form Responses ({selectedResponse.childResponses.length})
                    </h4>
                    <div className="space-y-6">
                      {selectedResponse.childResponses.map((childResponse, idx) => (
                        <div key={childResponse.id} className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                          <div className="mb-4 pb-3 border-b border-purple-200">
                            <h5 className="font-semibold text-purple-900">
                              Follow-up Form Response {idx + 1}
                            </h5>
                            <div className="text-sm text-purple-700 mt-1">
                              {formatTimestamp(childResponse.createdAt)}
                            </div>
                          </div>
                          <div className="space-y-3">
                            {Object.entries(childResponse.answers).map(
                              ([key, value]) => (
                                <div key={key}>
                                  <div className="text-sm font-medium text-purple-800 mb-1">
                                    {getQuestionText(key)}
                                  </div>
                                  <div className="text-sm text-purple-700 bg-white dark:bg-gray-900 p-2 rounded border border-purple-100">
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
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table View Modal */}
      {showTableView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-primary-200 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-primary-700">
                  {form?.title} Responses
                </h3>
                <p className="text-sm text-primary-500">
                  Viewing {responses.length} replies in table view
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTableView(false)}
                className="text-primary-500 hover:text-primary-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-primary-100">
                <thead className="bg-primary-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-500 uppercase tracking-wider">
                      Submitted By
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary-500 uppercase tracking-wider">
                      Location
                    </th>
                    {questionColumns.map((column) => (
                      <th
                        key={column.id}
                        className="px-4 py-3 text-left text-xs font-medium text-primary-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {column.text}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-primary-100">
                  {responses.map((responseItem) => {
                    const location =
                      responseItem.submissionMetadata?.location ?? undefined;
                    const locationText = location
                      ? [location.city, location.region, location.country]
                          .filter(Boolean)
                          .join(", ")
                      : "--";

                    return (
                      <React.Fragment key={responseItem._id}>
                        <tr className="bg-primary-25">
                          <td className="px-4 py-3 text-sm text-primary-600 align-top">
                            {formatTimestamp(responseItem.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-primary-600 align-top">
                            {responseItem.status ?? "Pending"}
                          </td>
                          <td className="px-4 py-3 text-sm text-primary-600 align-top">
                            {responseItem.submissionMetadata?.ipAddress ?? "--"}
                          </td>
                          <td className="px-4 py-3 text-sm text-primary-600 align-top">
                            {locationText}
                          </td>
                          {questionColumns.map((column) => (
                            <td
                              key={`${responseItem._id}-${column.id}-value`}
                              className="px-4 py-3 text-sm text-primary-600 align-top whitespace-pre-wrap"
                            >
                              {getAnswerDisplay(responseItem, column.id)}
                            </td>
                          ))}
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  {responses.length === 0 && (
                    <tr>
                      <td
                        colSpan={4 + questionColumns.length}
                        className="px-4 py-6 text-center text-sm text-primary-500"
                      >
                        No responses to display yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
