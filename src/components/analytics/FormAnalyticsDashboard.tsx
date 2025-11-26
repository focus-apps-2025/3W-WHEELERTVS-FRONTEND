import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Users,
  CheckCircle,
  Clock,
  XCircle,
  BarChart3,
  Calendar,
  FileText,
  ArrowLeft,
  TrendingUp,
  PieChart,
} from "lucide-react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from "chart.js";
import { Line } from "react-chartjs-2";
import { apiClient } from "../../api/client";
import ResponseQuestion from "./ResponseQuestion";
import LocationHeatmap from "./LocationHeatmap";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface Response {
  id: string;
  questionId: string;
  answers: Record<string, any>;
  timestamp?: string;
  createdAt?: string; // MongoDB timestamp field
  parentResponseId?: string;
  assignedTo?: string;
  assignedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  status?: "pending" | "verified" | "rejected";
  notes?: string;
}

// Helper function to get the timestamp from response (handles both timestamp and createdAt)
const getResponseTimestamp = (response: Response): string | undefined => {
  return response.timestamp || response.createdAt;
};

interface Section {
  id: string;
  title: string;
  description?: string;
  questions: FollowUpQuestion[];
}

interface FollowUpQuestion {
  id: string;
  text: string;
  type: string;
  required?: boolean;
  options?: string[];
  description?: string;
  followUpQuestions?: FollowUpQuestion[];
}

interface Form {
  _id: string;
  id?: string;
  title: string;
  description?: string;
  createdAt?: string;
  isVisible?: boolean;
  logoUrl?: string;
  imageUrl?: string;
  sections?: Section[];
  followUpQuestions?: FollowUpQuestion[];
  parentFormId?: string;
  parentFormTitle?: string;
}

export default function FormAnalyticsDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [responses, setResponses] = useState<Response[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch form details
        const formData = await apiClient.getForm(id);
        setForm(formData.form);

        // Fetch responses for this form
        const responsesData = await apiClient.getFormResponses(id);
        setResponses(responsesData.responses || []);
      } catch (err) {
        console.error("Error fetching analytics data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load analytics"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const analytics = useMemo(() => {
    const total = responses.length;
    const pending = responses.filter(
      (r) => r.status === "pending" || !r.status
    ).length;
    const verified = responses.filter((r) => r.status === "verified").length;
    const rejected = responses.filter((r) => r.status === "rejected").length;

    const recentResponses = responses
      .filter((r) => getResponseTimestamp(r)) // Filter out responses without timestamps
      .sort((a, b) => {
        const timestampA = getResponseTimestamp(a);
        const timestampB = getResponseTimestamp(b);
        const dateA = timestampA ? new Date(timestampA).getTime() : 0;
        const dateB = timestampB ? new Date(timestampB).getTime() : 0;
        // Handle invalid dates
        if (isNaN(dateA) && isNaN(dateB)) return 0;
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateB - dateA;
      })
      .slice(0, 5);

    const responseTrend = responses.reduce(
      (acc: Record<string, number>, response) => {
        // Validate timestamp before processing
        const timestamp = getResponseTimestamp(response);
        if (timestamp) {
          const dateObj = new Date(timestamp);
          // Check if date is valid
          if (!isNaN(dateObj.getTime())) {
            const date = dateObj.toISOString().split("T")[0];
            acc[date] = (acc[date] || 0) + 1;
          }
        }
        return acc;
      },
      {}
    );

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split("T")[0];
    }).reverse();

    const maxCount = Math.max(...last7Days.map((date) => responseTrend[date] || 0), 1);
    const percentageData = last7Days.map((date) => Math.round(((responseTrend[date] || 0) / maxCount) * 100));

    return {
      total,
      pending,
      verified,
      rejected,
      recentResponses,
      responseTrend,
      last7Days,
      percentageData,
    };
  }, [responses]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-primary-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-600">Error loading analytics: {error}</p>
          <button onClick={() => navigate(-1)} className="mt-4 btn-primary">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-primary-800">
              Form Analytics
            </h1>
            <p className="text-primary-600">
              {form?.title || "Form"} - Response Analytics
            </p>
          </div>
        </div>
        <div className="text-sm text-primary-500">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-50 rounded-lg mr-4">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary-600">
                {analytics.total}
              </div>
              <div className="text-xs text-primary-500">Total Responses</div>
            </div>
          </div>
        </div>

        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg card">
          <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Highest</div>
          <div className="text-xl font-bold text-blue-900 dark:text-blue-200 mt-2">
            {Math.max(...Object.values(analytics.responseTrend), 0)}
          </div>
        </div>

        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg card">
          <div className="text-xs text-green-600 dark:text-green-400 font-semibold">Average</div>
          <div className="text-xl font-bold text-green-900 dark:text-green-200 mt-2">
            {Math.round(
              Object.values(analytics.responseTrend).reduce((a, b) => a + b, 0) /
                analytics.last7Days.length
            )}
          </div>
        </div>

        <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg card">
          <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold">Days Active</div>
          <div className="text-xl font-bold text-purple-900 dark:text-purple-200 mt-2">
            {Object.values(analytics.responseTrend).filter((v) => v > 0).length}
          </div>
        </div>

        <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg card">
          <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold">Trend</div>
          <div className="text-xl font-bold text-orange-900 dark:text-orange-200 mt-2">
            <TrendingUp className="w-6 h-6 inline" />
          </div>
        </div>
      </div>

      {/* Response Trend Chart */}
      <div className="card p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg mr-3">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-primary-900 dark:text-white">Response Trend</h3>
              <p className="text-xs text-primary-500 dark:text-primary-400">Last 7 days activity</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary-800 dark:text-white">
              {Object.values(analytics.responseTrend).reduce((a, b) => a + b, 0)}
            </div>
            <p className="text-xs text-primary-500 dark:text-primary-400">Total responses</p>
          </div>
        </div>

        {Object.keys(analytics.responseTrend).length === 0 ? (
          <div className="text-center py-12">
            <div className="mb-3">
              <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
            </div>
            <p className="text-primary-500 dark:text-primary-400 font-medium">No responses yet</p>
            <p className="text-xs text-primary-400 dark:text-primary-500 mt-1">Responses will appear here</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <Line
                data={{
                  labels: analytics.last7Days.map((date) =>
                    new Date(date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  ),
                  datasets: [
                    {
                      label: "Responses %",
                      data: analytics.percentageData,
                      borderColor: "rgb(59, 130, 246)",
                      backgroundColor: "rgba(59, 130, 246, 0.1)",
                      fill: true,
                      tension: 0.4,
                      pointRadius: 5,
                      pointHoverRadius: 7,
                      pointBackgroundColor: "rgb(59, 130, 246)",
                      pointBorderColor: "#fff",
                      pointBorderWidth: 2,
                      borderWidth: 2,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      backgroundColor: "rgba(0, 0, 0, 0.8)",
                      titleColor: "#fff",
                      bodyColor: "#fff",
                      cornerRadius: 8,
                      padding: 12,
                      titleFont: { size: 12, weight: "bold" },
                      bodyFont: { size: 12 },
                      callbacks: {
                        label: function (context) {
                          return `${context.parsed.y}%`;
                        },
                      },
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100,
                      grid: {
                        color: "rgba(0, 0, 0, 0.05)",
                        drawBorder: false,
                      },
                      ticks: {
                        color: "rgb(107, 114, 128)",
                        font: { size: 11 },
                        callback: function (value) {
                          return value + "%";
                        },
                      },
                    },
                    x: {
                      grid: {
                        display: false,
                        drawBorder: false,
                      },
                      ticks: {
                        color: "rgb(107, 114, 128)",
                        font: { size: 11 },
                      },
                    },
                  },
                }}
                height={60}
              />
            </div>
          </>
        )}
      </div>

      {/* Location Heatmap */}
      <LocationHeatmap responses={responses} title="Response Locations Heatmap" />

      {/* Question-wise Analytics */}
      {form && (
        <div className="card p-6">
          <ResponseQuestion question={form} responses={responses} />
        </div>
      )}

      {/* Form Details */}
      {form && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-primary-800 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Form Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-primary-800 mb-2">
                Form Information
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-primary-600">Title:</span>
                  <span className="font-medium">{form.title}</span>
                </div>
                {form.description && (
                  <div className="flex justify-between">
                    <span className="text-primary-600">Description:</span>
                    <span className="font-medium">{form.description}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-primary-600">Status:</span>
                  <span
                    className={`font-medium ${
                      form.isVisible ? "text-green-600" : "text-yellow-600"
                    }`}
                  >
                    {form.isVisible ? "Public" : "Private"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-600">Created:</span>
                  <span className="font-medium">
                    {form.createdAt
                      ? new Date(form.createdAt).toLocaleDateString()
                      : "Unknown"}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium text-primary-800 mb-2">
                Response Summary
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-primary-600">Total Responses:</span>
                  <span className="font-medium">{analytics.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-600">Completion Rate:</span>
                  <span className="font-medium">
                    {analytics.total > 0
                      ? Math.round((analytics.verified / analytics.total) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-600">Average per Day:</span>
                  <span className="font-medium">
                    {analytics.total > 0
                      ? (analytics.total / 7).toFixed(1)
                      : "0"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
