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
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { apiClient } from "../../api/client";
import ResponseQuestion from "./ResponseQuestion";
import SectionAnalytics from "./SectionAnalytics";
import LocationHeatmap from "./LocationHeatmap";


ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

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
  weightage(weightage: any): unknown;
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

type SectionPerformanceStat = {
  id: string;
  title: string;
  yes: number;
  no: number;
  na: number;
  total: number;
  weightage: number;
};

const formatSectionLabel = (label: string, maxLength = 20): string => {
  if (!label) {
    return "";
  }
  const parts = label.match(/[A-Za-z0-9]+/g) || [];
  if (!parts.length) {
    return "";
  }
  const camel = parts
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
  if (!camel) {
    return "";
  }
  const formatted = camel.charAt(0).toUpperCase() + camel.slice(1);
  return formatted.length > maxLength
    ? `${formatted.slice(0, maxLength - 3)}...`
    : formatted;
};

const extractYesNoValues = (value: any): string[] => {
  if (value === null || value === undefined) {
    return [];
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized ? [normalized] : [];
  }
  if (typeof value === "boolean") {
    return [value ? "yes" : "no"];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractYesNoValues(item));
  }
  if (typeof value === "object") {
    return Object.values(value).flatMap((item) => extractYesNoValues(item));
  }
  return [];
};

const recognizedYesNoValues = ["yes", "no", "n/a", "na", "not applicable"];

const computeSectionPerformanceStats = (
  form: Form | null,
  responses: Response[]
): SectionPerformanceStat[] => {
  if (!form?.sections || !responses.length) {
    return [];
  }

  const stats =
    form.sections?.map((section) => {
      const counts = { yes: 0, no: 0, na: 0, total: 0 };
      const weightageNumber = Number(section.weightage) || 0;
      const weightage = Number.isFinite(weightageNumber) ? weightageNumber : 0;

      const processQuestion = (question: any) => {
        if (!question) {
          return;
        }
        if (question.type === "yesNoNA" && question.id) {
          responses.forEach((response) => {
            const normalizedValues = extractYesNoValues(
              response.answers?.[question.id]
            );
            const hasRecognizedValue = normalizedValues.some((value) =>
              recognizedYesNoValues.includes(value)
            );
            if (!hasRecognizedValue) {
              return;
            }
            counts.total += 1;
            if (normalizedValues.includes("yes")) {
              counts.yes += 1;
            }
            if (normalizedValues.includes("no")) {
              counts.no += 1;
            }
            if (
              normalizedValues.includes("n/a") ||
              normalizedValues.includes("na") ||
              normalizedValues.includes("not applicable")
            ) {
              counts.na += 1;
            }
          });
        }
        question.followUpQuestions?.forEach(processQuestion);
      };

      section.questions?.forEach(processQuestion);

      if (!counts.total) {
        return null;
      }

      return {
        id: section.id,
        title: section.title || "Untitled Section",
        yes: counts.yes,
        no: counts.no,
        na: counts.na,
        total: counts.total,
        weightage,
      };
    }) ?? [];

  return stats.filter((stat): stat is SectionPerformanceStat => Boolean(stat));
};

export default function FormAnalyticsDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [responses, setResponses] = useState<Response[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsView, setAnalyticsView] = useState<"question" | "section">(
    "section"
  );
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);

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
      .filter((r) => getResponseTimestamp(r))
      .sort((a, b) => {
        const timestampA = getResponseTimestamp(a);
        const timestampB = getResponseTimestamp(b);
        const dateA = timestampA ? new Date(timestampA).getTime() : 0;
        const dateB = timestampB ? new Date(timestampB).getTime() : 0;
        if (isNaN(dateA) && isNaN(dateB)) return 0;
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateB - dateA;
      })
      .slice(0, 5);

    const responseTrend = responses.reduce(
      (acc: Record<string, number>, response) => {
        const timestamp = getResponseTimestamp(response);
        if (timestamp) {
          const dateObj = new Date(timestamp);
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

    const maxCount = Math.max(
      ...last7Days.map((date) => responseTrend[date] || 0),
      1
    );
    const percentageData = last7Days.map((date) =>
      Math.round(((responseTrend[date] || 0) / maxCount) * 100)
    );

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

  const sectionPerformanceStats = useMemo(
    () => computeSectionPerformanceStats(form, responses),
    [form, responses]
  );

  const filteredSectionStats = useMemo(
    () =>
      sectionPerformanceStats.filter(
        (stat) =>
          stat.yes > 0 || stat.no > 0 || stat.na > 0 || stat.weightage > 0
      ),
    [sectionPerformanceStats]
  );

  useEffect(() => {
    const availableIds = filteredSectionStats.map((stat) => stat.id);
    setSelectedSectionIds((prev) => {
      if (!availableIds.length) {
        return [];
      }
      if (!prev.length) {
        return availableIds;
      }
      const next = prev.filter((id) => availableIds.includes(id));
      return next.length ? next : availableIds;
    });
  }, [filteredSectionStats]);

  const visibleSectionStats = useMemo(
    () =>
      filteredSectionStats.filter((stat) =>
        selectedSectionIds.includes(stat.id)
      ),
    [filteredSectionStats, selectedSectionIds]
  );

  const handleSelectAllSections = () => {
    setSelectedSectionIds(filteredSectionStats.map((stat) => stat.id));
  };

  const toggleSectionSelection = (sectionId: string) => {
    setSelectedSectionIds((prev) => {
      if (prev.includes(sectionId)) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((id) => id !== sectionId);
      }
      return [...prev, sectionId];
    });
  };

  const sectionChartData = useMemo(() => {
    const calculatePercentage = (value: number, total: number) =>
      total ? parseFloat(((value / total) * 100).toFixed(1)) : 0;

    return {
      labels: visibleSectionStats.map((stat) =>
        formatSectionLabel(stat.title)
      ),
      datasets: [
        {
          label: "Yes",
          data: visibleSectionStats.map((stat) =>
            calculatePercentage(stat.yes, stat.total)
          ),
          backgroundColor: "#1d4ed8",
          borderRadius: 4,
        },
        {
          label: "No",
          data: visibleSectionStats.map((stat) =>
            calculatePercentage(stat.no, stat.total)
          ),
          backgroundColor: "#3b82f6",
          borderRadius: 4,
        },
        {
          label: "N/A",
          data: visibleSectionStats.map((stat) =>
            calculatePercentage(stat.na, stat.total)
          ),
          backgroundColor: "#93c5fd",
          borderRadius: 4,
        },
      ],
    };
  }, [filteredSectionStats]);

  const sectionChartOptions = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 16, right: 32, bottom: 16, left: 8 },
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#374151",
            generateLabels: (chart: any) => {
              const labels =
                ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
              labels.forEach((label: any) => {
                label.color = document.documentElement.classList.contains(
                  "dark"
                )
                  ? "#d1d5db"
                  : "#374151";
              });
              return labels;
            },
          },
        },
        tooltip: {
          callbacks: {
            title: (items: any[]) => {
              const index = items?.[0]?.dataIndex;
              if (index === undefined) {
                return "";
              }
              return visibleSectionStats[index]?.title || "";
            },
            label: (context: any) => {
              const value = context.parsed?.x ?? 0;
              return `${context.dataset.label}: ${value.toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          stacked: true,
          ticks: {
            callback: (value: any) => `${value}%`,
            color: "#374151",
          },
          title: {
            display: true,
            text: "Percentage",
            color: "#374151",
          },
          grid: {
            color: "#e5e7eb",
          },
        },
        y: {
          stacked: true,
          ticks: {
            autoSkip: false,
            color: "#374151",
          },
          title: {
            display: true,
            text: "Sections",
            color: "#374151",
          },
          grid: {
            color: "#e5e7eb",
          },
        },
      },
    }),
    [visibleSectionStats]
  );

  const sectionSummaryRows = useMemo(
    () =>
      visibleSectionStats.map((stat) => {
        let weightage = stat.weightage;
        if (weightage > 0 && weightage <= 1) {
          weightage = weightage * 100;
        }

        const yesPercent = stat.total ? (stat.yes / stat.total) * 100 : 0;
        const noPercent = stat.total ? (stat.no / stat.total) * 100 : 0;
        const naPercent = stat.total ? (stat.na / stat.total) * 100 : 0;
        const yesWeighted = (yesPercent * weightage) / 100;
        const noWeighted = (noPercent * weightage) / 100;
        const naWeighted = (naPercent * weightage) / 100;

        return {
          id: stat.id,
          title: stat.title,
          weightage,
          yesPercent,
          yesWeighted,
          yesCount: stat.yes,
          noPercent,
          noWeighted,
          noCount: stat.no,
          naPercent,
          naWeighted,
          naCount: stat.na,
          total: stat.total,
        };
      }),
    [visibleSectionStats]
  );

  const weightedPercentageChartData = useMemo(() => {
    return {
      labels: sectionSummaryRows.map((row) => formatSectionLabel(row.title)),
      datasets: [
        {
          label: "Yes % × Weightage",
          data: sectionSummaryRows.map((row) =>
            parseFloat(row.yesWeighted.toFixed(1))
          ),
          borderColor: "#1d4ed8",
          backgroundColor: "rgba(29, 78, 216, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#1d4ed8",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
        {
          label: "No % × Weightage",
          data: sectionSummaryRows.map((row) =>
            parseFloat(row.noWeighted.toFixed(1))
          ),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#3b82f6",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
        {
          label: "N/A % × Weightage",
          data: sectionSummaryRows.map((row) =>
            parseFloat(row.naWeighted.toFixed(1))
          ),
          borderColor: "#93c5fd",
          backgroundColor: "rgba(147, 197, 253, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#93c5fd",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
      ],
    };
  }, [sectionSummaryRows]);

  const weightedPercentageChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 16, right: 32, bottom: 16, left: 8 },
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#374151",
            generateLabels: (chart: any) => {
              const labels =
                ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
              labels.forEach((label: any) => {
                label.color = document.documentElement.classList.contains(
                  "dark"
                )
                  ? "#d1d5db"
                  : "#374151";
              });
              return labels;
            },
          },
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.parsed?.y ?? 0;
              return `${context.dataset.label}: ${value.toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: any) => `${value}%`,
            color: "#374151",
          },
          title: {
            display: true,
            text: "Weighted Percentage",
            color: "#374151",
          },
          grid: {
            color: "#e5e7eb",
          },
        },
        x: {
          ticks: {
            autoSkip: false,
            color: "#374151",
          },
          title: {
            display: true,
            text: "Sections",
            color: "#374151",
          },
          grid: {
            color: "#e5e7eb",
          },
        },
      },
    }),
    []
  );

  const sectionChartHeight = Math.max(320, visibleSectionStats.length * 56);
  const weightedChartHeight = Math.max(320, sectionSummaryRows.length * 32);

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
          <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
            Highest
          </div>
          <div className="text-xl font-bold text-blue-900 dark:text-blue-200 mt-2">
            {Math.max(...Object.values(analytics.responseTrend), 0)}
          </div>
        </div>

        <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg card">
          <div className="text-xs text-green-600 dark:text-green-400 font-semibold">
            Average
          </div>
          <div className="text-xl font-bold text-green-900 dark:text-green-200 mt-2">
            {Math.round(
              Object.values(analytics.responseTrend).reduce(
                (a, b) => a + b,
                0
              ) / analytics.last7Days.length
            )}
          </div>
        </div>

        <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg card">
          <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold">
            Days Active
          </div>
          <div className="text-xl font-bold text-purple-900 dark:text-purple-200 mt-2">
            {Object.values(analytics.responseTrend).filter((v) => v > 0).length}
          </div>
        </div>

        <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg card">
          <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold">
            Trend
          </div>
          <div className="text-xl font-bold text-orange-900 dark:text-orange-200 mt-2">
            <TrendingUp className="w-6 h-6 inline" />
          </div>
        </div>
      </div>

      {/* Response Trend and Location Heatmap - 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Location Heatmap */}
        <div>
          <LocationHeatmap
            responses={responses}
            title="Response Locations Heatmap"
          />
        </div>


        {/* Response Trend Chart */}
        <div className="card p-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg mr-3">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-primary-900 dark:text-white">
                  Response Trend
                </h3>
                <p className="text-xs text-primary-500 dark:text-primary-400">
                  Last 7 days activity
                </p>
              </div>
            </div>
          </div>

          {Object.keys(analytics.responseTrend).length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="mb-3">
                  <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
                </div>
                <p className="text-primary-500 dark:text-primary-400 font-medium">
                  No responses yet
                </p>
                <p className="text-xs text-primary-400 dark:text-primary-500 mt-1">
                  Responses will appear here
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div style={{ height: "450px" }}>
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
                    maintainAspectRatio: false,
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
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analytics View Toggle */}
      {form && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setAnalyticsView("question")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${analyticsView === "question"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
            >
              <BarChart3 className="w-4 h-4" />
              Question Based Analytics
            </button>
            <button
              onClick={() => setAnalyticsView("section")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${analyticsView === "section"
                  ? "bg-indigo-600 text-white shadow-lg"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
            >
              <FileText className="w-4 h-4" />
              Section Based Analytics
            </button>
          </div>

          {/* Question-wise Analytics */}
          {analyticsView === "question" && (
            <div className="card p-6">
              <ResponseQuestion question={form} responses={responses} />
            </div>
          )}

          {/* Section-wise Analytics */}
          {analyticsView === "section" && (
            <div className="space-y-6">
              {filteredSectionStats.length > 0 ? (
                <>
                  <div className="card p-6 space-y-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <PieChart className="w-5 h-5 text-indigo-600" />
                          Section Summary with Visualization
                        </h3>
                        {/*<p className="text-sm text-gray-500 dark:text-gray-400">
                Overview of Yes / No / N.A responses with in-line visualizations
              </p>*/}
                      </div>
                      <button
                        onClick={handleSelectAllSections}
                        className="px-4 py-2 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-700"
                      >
                        Select All Sections
                      </button>
                    </div>



                    <div className="flex flex-wrap gap-2">
                      {filteredSectionStats.map((stat) => {
                        const selected = selectedSectionIds.includes(stat.id);
                        return (
                          <label
                            key={stat.id}
                            className={`flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium cursor-pointer transition-colors ${selected
                                ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-100"
                                : "bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
                              }`}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              checked={selected}
                              onChange={() => toggleSectionSelection(stat.id)}
                            />
                            <span className="truncate max-w-[160px]">{stat.title}</span>
                          </label>
                        );
                      })}
                    </div>
                    {/* Color Legend */}
                    <div className="flex flex-wrap items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Color Legend:
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Yes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">No</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-400 rounded-sm"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">N/A</span>
                      </div>
                    </div>

                    {/* Combined Table with Visualization */}
                    <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg">
                      <table className="min-w-full text-sm">
                        <thead className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 sticky top-0">
                          <tr>
                            <th className="text-left px-6 py-4">Section</th>
                            <th className="text-center px-6 py-4">Total</th>
                            <th className="text-center px-6 py-4"> Yes</th>
                            <th className="text-center px-6 py-4">No</th>
                            <th className="text-center px-6 py-4">N/A</th>
                            <th className="text-center px-6 py-4">Weightage</th>
                            <th className="text-center px-6 py-4">Yes × W</th>
                            <th className="text-center px-6 py-4">No × W</th>
                            <th className="text-center px-6 py-4">N/A × W</th>
                            <th className="text-center px-6 py-4">Visualization</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sectionSummaryRows.map((row, index) => {
                            const rowBgColor = index % 2 === 0
                              ? "bg-white dark:bg-gray-900"
                              : "bg-gray-50 dark:bg-gray-800/50";

                            // Helper function to generate the exact bar chart from your example
                            const generateTableBarChart = (yesPercent: number, noPercent: number, naPercent: number) => {
                              const totalWidth = 200; // Slightly wider to accommodate labels
                              const yesWidth = (yesPercent / 100) * totalWidth;
                              const noWidth = (noPercent / 100) * totalWidth;
                              const naWidth = (naPercent / 100) * totalWidth;

                              return (
                                <div className="relative" style={{ width: `${totalWidth}px`, height: "20px" }}>
                                  {/* Background bar */}
                                  <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 rounded-sm border border-gray-300 dark:border-gray-600"></div>

                                  {/* Yes segment */}
                                  {yesPercent > 0 && (
                                    <div
                                      className="absolute left-0 h-full bg-green-500"
                                      style={{ width: `${yesWidth}px` }}
                                    >
                                      {yesPercent >= 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <span className="text-xs font-bold text-white" style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>
                                            {yesPercent.toFixed(0)}%
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* No segment */}
                                  {noPercent > 0 && (
                                    <div
                                      className="absolute h-full bg-red-500"
                                      style={{ left: `${yesWidth}px`, width: `${noWidth}px` }}
                                    >
                                      {noPercent >= 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <span className="text-xs font-bold text-white" style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>
                                            {noPercent.toFixed(0)}%
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* N/A segment */}
                                  {naPercent > 0 && (
                                    <div
                                      className="absolute h-full bg-gray-400"
                                      style={{ left: `${yesWidth + noWidth}px`, width: `${naWidth}px` }}
                                    >
                                      {naPercent >= 0 && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <span className="text-xs font-bold text-white" style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>
                                            {naPercent.toFixed(0)}%
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Fallback labels for small segments */}
                                  {yesPercent > 0 && yesPercent < 0 && (
                                    <div className="absolute" style={{ left: '2px', top: '1px' }}>
                                      <span className="text-[7px] font-bold text-green-700 bg-white/80 px-0.5 rounded">
                                        {yesPercent.toFixed(0)}%
                                      </span>
                                    </div>
                                  )}
                                  {noPercent > 0 && noPercent < 0 && (
                                    <div className="absolute" style={{ left: `${yesWidth + 2}px`, top: '1px' }}>
                                      <span className="text-[7px] font-bold text-red-700 bg-white/80 px-0.5 rounded">
                                        {noPercent.toFixed(0)}%
                                      </span>
                                    </div>
                                  )}
                                  {naPercent > 0 && naPercent < 0 && (
                                    <div className="absolute" style={{ left: `${yesWidth + noWidth + 2}px`, top: '1px' }}>
                                      <span className="text-[7px] font-bold text-gray-700 bg-white/80 px-0.5 rounded">
                                        {naPercent.toFixed(0)}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            };

                            return (
                              <tr
                                key={row.id}
                                className={`border-t border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors duration-150 ${rowBgColor}`}
                              >
                                {/* Section Column */}
                                <td className="px-6 py-4">
                                  <div className="font-bold text-gray-900 dark:text-white text-sm">
                                    {row.title}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                    Weightage: {Number.isFinite(row.weightage) ? row.weightage.toFixed(1) : "0.0"}%
                                  </div>
                                </td>

                                {/* Total Column */}
                                <td className="px-6 py-4 text-center">
                                  <div className="font-bold text-blue-600 dark:text-blue-400">
                                    {row.total}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-semibold">
                                    Responses
                                  </div>
                                </td>

                                {/* Yes Column */}
                                <td className="px-6 py-4 text-center">
                                  <div className="font-bold text-green-600 dark:text-green-400">
                                    {row.yesCount}
                                  </div>
                                  <div className="text-xs text-green-700 dark:text-green-300 mt-1 font-semibold">
                                    {Number.isFinite(row.yesPercent) ? row.yesPercent.toFixed(1) : "0.0"}%
                                  </div>
                                </td>

                                {/* No Column */}
                                <td className="px-6 py-4 text-center">
                                  <div className="font-bold text-red-500 dark:text-red-400">
                                    {row.noCount}
                                  </div>
                                  <div className="text-xs text-red-600 dark:text-red-300 mt-1 font-semibold">
                                    {Number.isFinite(row.noPercent) ? row.noPercent.toFixed(1) : "0.0"}%
                                  </div>
                                </td>

                                {/* N/A Column */}
                                <td className="px-6 py-4 text-center">
                                  <div className="font-bold text-slate-500 dark:text-slate-300">
                                    {row.naCount}
                                  </div>
                                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-semibold">
                                    {Number.isFinite(row.naPercent) ? row.naPercent.toFixed(1) : "0.0"}%
                                  </div>
                                </td>

                                {/* Weightage Column */}
                                <td className="px-6 py-4 text-center">
                                  <div className="font-bold text-indigo-600 dark:text-indigo-400">
                                    {Number.isFinite(row.weightage) ? row.weightage.toFixed(1) : "0.0"}%
                                  </div>
                                </td>

                                {/* Yes × Weightage Column */}
                                <td className="px-6 py-4 text-center">
                                  <div className="font-bold text-green-700 dark:text-green-300">
                                    {Number.isFinite(row.yesWeighted) ? row.yesWeighted.toFixed(1) : "0.0"}
                                  </div>
                                </td>

                                {/* No × Weightage Column */}
                                <td className="px-6 py-4 text-center">
                                  <div className="font-bold text-red-700 dark:text-red-300">
                                    {Number.isFinite(row.noWeighted) ? row.noWeighted.toFixed(1) : "0.0"}
                                  </div>
                                </td>

                                {/* N/A × Weightage Column */}
                                <td className="px-6 py-4 text-center">
                                  <div className="font-bold text-slate-700 dark:text-slate-400">
                                    {Number.isFinite(row.naWeighted) ? row.naWeighted.toFixed(1) : "0.0"}
                                  </div>
                                </td>

                                {/* Visualization Column with Bar Chart */}
                                <td className="px-6 py-4">
                                  <div className="flex justify-center">
                                    {generateTableBarChart(
                                      Number.isFinite(row.yesPercent) ? row.yesPercent : 0,
                                      Number.isFinite(row.noPercent) ? row.noPercent : 0,
                                      Number.isFinite(row.naPercent) ? row.naPercent : 0
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Keep the separate large chart if needed, or remove it */}
                  {/*{visibleSectionStats.length > 0 && (
          <div className="bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 dark:from-gray-800 dark:via-blue-900/10 dark:to-indigo-900/10 p-8 rounded-3xl shadow-2xl border border-blue-200/50 dark:border-blue-700/50 transform hover:scale-[1.02] transition-all duration-500 hover:shadow-3xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                <div className="p-2 bg-blue-500/20 rounded-lg mr-4">
                  <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                Section Performance Overview
              </h3>
              <div className="flex items-center space-x-3 bg-white/50 dark:bg-gray-700/50 rounded-full px-4 py-2">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Yes
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    No
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-blue-300 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    N/A
                  </span>
                </div>
              </div>
            </div>
            <div
              className="w-full"
              style={{ height: sectionChartHeight }}
              id="section-performance-chart"
            >
              <Bar data={sectionChartData} options={sectionChartOptions} />
            </div>
          </div>
        )}*/}
                </>
              ) : (
                <div className="card p-6 text-center text-primary-500">
                  No section performance data available yet
                </div>
              )}

              <div className="card p-6">
                <SectionAnalytics question={form} responses={responses} />
              </div>
            </div>
          )}
        </>
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
                    className={`font-medium ${form.isVisible ? "text-green-600" : "text-yellow-600"
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
