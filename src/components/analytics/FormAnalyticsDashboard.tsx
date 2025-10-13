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
import { apiClient } from "../../api/client";
import ResponseQuestion from "./ResponseQuestion";

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

    return {
      total,
      pending,
      verified,
      rejected,
      recentResponses,
      responseTrend,
      last7Days,
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-50 rounded-lg mr-4">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary-600">
                {analytics.total}
              </div>
              <div className="text-sm text-primary-500">Total Responses</div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-50 rounded-lg mr-4">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary-600">
                {analytics.pending}
              </div>
              <div className="text-sm text-primary-500">Pending</div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-50 rounded-lg mr-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary-600">
                {analytics.verified}
              </div>
              <div className="text-sm text-primary-500">Completed</div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-red-50 rounded-lg mr-4">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary-600">
                {analytics.rejected}
              </div>
              <div className="text-sm text-primary-500">Closed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Pie Chart */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-primary-800 mb-4 flex items-center">
            <PieChart className="w-5 h-5 mr-2" />
            Response Status Distribution
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-yellow-500 rounded mr-3"></div>
                <span className="text-sm text-primary-600">Pending</span>
              </div>
              <span className="font-medium">{analytics.pending}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-500 rounded mr-3"></div>
                <span className="text-sm text-primary-600">Completed</span>
              </div>
              <span className="font-medium">{analytics.verified}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-500 rounded mr-3"></div>
                <span className="text-sm text-primary-600">Closed</span>
              </div>
              <span className="font-medium">{analytics.rejected}</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-primary-800 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            {analytics.recentResponses.length === 0 ? (
              <p className="text-primary-500 text-sm">No responses yet</p>
            ) : (
              analytics.recentResponses.map((response) => (
                <div
                  key={response.id}
                  className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-b-0"
                >
                  <div className="flex items-center">
                    <div
                      className={`w-2 h-2 rounded-full mr-3 ${
                        response.status === "verified"
                          ? "bg-green-500"
                          : response.status === "rejected"
                          ? "bg-red-500"
                          : "bg-yellow-500"
                      }`}
                    ></div>
                    <div>
                      <p className="text-sm font-medium text-primary-800">
                        Response #{response.id.slice(-6)}
                      </p>
                      <p className="text-xs text-primary-500">
                        {getResponseTimestamp(response)
                          ? new Date(
                              getResponseTimestamp(response)!
                            ).toLocaleString()
                          : "No date"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      response.status === "verified"
                        ? "bg-green-100 text-green-800"
                        : response.status === "rejected"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {response.status || "pending"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Response Trend Chart */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-primary-800 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2" />
          Response Trend (Last 7 Days)
        </h3>
        <div className="flex items-end space-x-2 h-32">
          {analytics.last7Days.map((date) => {
            const count = analytics.responseTrend[date] || 0;
            const maxCount = Math.max(
              ...Object.values(analytics.responseTrend)
            );
            const height = maxCount > 0 ? (count / maxCount) * 100 : 0;

            return (
              <div key={date} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-primary-500 rounded-t transition-all duration-300 hover:bg-primary-600"
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${count} responses on ${new Date(
                    date
                  ).toLocaleDateString()}`}
                ></div>
                <span className="text-xs text-primary-500 mt-2 transform -rotate-45 origin-top">
                  {new Date(date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

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
