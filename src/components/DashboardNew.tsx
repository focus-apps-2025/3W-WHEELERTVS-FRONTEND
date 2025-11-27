import React, { useState, useEffect } from "react";
import {
  Users,
  FileText,
  MessageSquare,
  TrendingUp,
  BarChart3,
  Calendar,
  Eye,
  Plus,
  CheckCircle,
  ExternalLink,
  Mail,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut, Area } from "react-chartjs-2";
import { useForms } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function DashboardNew() {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const { data: formsData, loading: formsLoading } = useForms();
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `http://localhost:5000/api/analytics/dashboard?period=${period}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setDashboardData(result.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      alert("Please enter an email address");
      return;
    }

    setSendingTestEmail(true);
    try {
      console.log("📨 Sending test email to:", testEmail);

      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        "http://localhost:5000/api/mail/test-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ to: testEmail }),
        }
      );

      const data = await response.json();
      console.log("Response:", data);

      if (response.ok && data.success) {
        alert("✅ Test email sent successfully to " + testEmail);
        setShowTestEmailDialog(false);
        setTestEmail("");
      } else {
        alert("❌ Failed to send email: " + (data.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      alert("❌ Error sending email: " + error.message);
    } finally {
      setSendingTestEmail(false);
    }
  };

  const recentForms =
    formsData?.forms?.filter((form: any) => form.isVisible).slice(0, 5) || [];

  const activeForms =
    formsData?.forms?.filter((form: any) => form.isVisible) || [];
  const totalForms = activeForms.length;
  const totalResponses =
    activeForms.reduce(
      (sum: number, form: any) => sum + (form.responseCount || 0),
      0
    ) || 0;
  const activeCustomers = activeForms.filter(
    (form: any) => (form.responseCount || 0) > 0
  ).length;
  const responseRate =
    totalForms > 0 ? ((totalResponses / totalForms) * 100).toFixed(1) : 0;

  const dailyResponsesData = dashboardData?.dailyResponses || {};
  const statusDistribution = dashboardData?.statusDistribution || {};
  const topForms = dashboardData?.topForms || [];

  const dailyResponsesArray = Object.entries(dailyResponsesData).map(
    ([date, count]: [string, any]) => ({
      date,
      count,
    })
  );

  const lineChartData = {
    labels: dailyResponsesArray.map((d) => d.date),
    datasets: [
      {
        label: "Daily Responses",
        data: dailyResponsesArray.map((d) => d.count),
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        tension: 0.4,
        fill: true,
        pointBackgroundColor: "rgb(59, 130, 246)",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  const topFormsData = {
    labels: topForms.slice(0, 5).map((f: any) => f.title),
    datasets: [
      {
        label: "Responses",
        data: topForms.slice(0, 5).map((f: any) => f.responseCount),
        backgroundColor: [
          "rgba(59, 130, 246, 0.8)",
          "rgba(34, 197, 94, 0.8)",
          "rgba(168, 85, 247, 0.8)",
          "rgba(249, 115, 22, 0.8)",
          "rgba(236, 72, 153, 0.8)",
        ],
        borderColor: [
          "rgb(59, 130, 246)",
          "rgb(34, 197, 94)",
          "rgb(168, 85, 247)",
          "rgb(249, 115, 22)",
          "rgb(236, 72, 153)",
        ],
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };

  const statusData = {
    labels: Object.keys(statusDistribution),
    datasets: [
      {
        data: Object.values(statusDistribution),
        backgroundColor: [
          "rgba(34, 197, 94, 0.8)",
          "rgba(59, 130, 246, 0.8)",
          "rgba(249, 115, 22, 0.8)",
          "rgba(236, 72, 153, 0.8)",
        ],
        borderColor: [
          "rgb(34, 197, 94)",
          "rgb(59, 130, 246)",
          "rgb(249, 115, 22)",
          "rgb(236, 72, 153)",
        ],
        borderWidth: 2,
      },
    ],
  };

  const statsCards = [
    {
      title: "Service Forms",
      value: dashboardData?.overview?.totalForms || totalForms,
      icon: FileText,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      iconColor: "text-blue-600 dark:text-blue-400",
      trend: dashboardData?.overview?.formsInPeriod || 0,
    },
    {
      title: "Customer Requests",
      value: dashboardData?.overview?.totalResponses || totalResponses,
      icon: MessageSquare,
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      iconColor: "text-green-600 dark:text-green-400",
      trend: dashboardData?.overview?.responsesInPeriod || 0,
    },
    {
      title: "Active Customers",
      value: activeCustomers,
      icon: Users,
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
      iconColor: "text-purple-600 dark:text-purple-400",
      trend: dashboardData?.overview?.totalUsers || 0,
    },
    {
      title: "Public Forms",
      value: dashboardData?.overview?.publicForms || 0,
      icon: Eye,
      color: "from-orange-500 to-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
      iconColor: "text-orange-600 dark:text-orange-400",
      trend: 0,
    },
  ];

  if (formsLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent"></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Loading Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Fetching your latest analytics...
          </p>
        </div>
      </div>
    );
  }

  const customerPortalUrl = tenant
    ? `https://forms.focusengineeringapp.com/${tenant.slug}`
    : null;

  console.log("Dashboard - Tenant:", tenant);
  console.log("Dashboard - Customer Portal URL:", customerPortalUrl);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 md:p-8">
      {/* Tenant Info Banner */}
      {tenant && (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Your Tenant Information
              </h3>
              <div className="flex items-center space-x-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Business Name:
                  </span>{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {tenant.businessName}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Tenant ID:
                  </span>{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {tenant.slug}
                  </span>
                </div>
              </div>
            </div>
            {customerPortalUrl && (
              <div className="text-right">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Customer Portal URL:
                </p>
                <a
                  href={customerPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 hover:underline"
                >
                  {customerPortalUrl}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header with Period Selector */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Welcome back! Here's your performance overview.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["7d", "30d", "90d", "1y"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  period === p
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-blue-400"
                }`}
              >
                {p === "7d" ? "7D" : p === "30d" ? "30D" : p === "90d" ? "90D" : "1Y"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsCards.map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-700 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-400 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bgColor} transition-all group-hover:scale-110`}>
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
              {stat.trend > 0 && (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm font-semibold">
                  <ArrowUp className="w-4 h-4" />
                  +{stat.trend}
                </div>
              )}
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">
                {stat.title}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Responses Chart */}
        <div className="bg-white dark:bg-gray-700 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-600">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              Response Trends
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Daily response count over the selected period
            </p>
          </div>
          <div className="h-80">
            {lineChartData.labels.length > 0 ? (
              <Line
                data={lineChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: true,
                      labels: {
                        color: document.documentElement.classList.contains("dark")
                          ? "#d1d5db"
                          : "#374151",
                        boxWidth: 12,
                      },
                    },
                  },
                  scales: {
                    y: {
                      ticks: {
                        color: document.documentElement.classList.contains("dark")
                          ? "#9ca3af"
                          : "#6b7280",
                      },
                      grid: {
                        color: document.documentElement.classList.contains("dark")
                          ? "rgba(55, 65, 81, 0.2)"
                          : "rgba(229, 231, 235, 0.5)",
                      },
                    },
                    x: {
                      ticks: {
                        color: document.documentElement.classList.contains("dark")
                          ? "#9ca3af"
                          : "#6b7280",
                      },
                      grid: {
                        display: false,
                      },
                    },
                  },
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white dark:bg-gray-700 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-600">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              Response Status Distribution
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Breakdown of responses by status
            </p>
          </div>
          <div className="h-80">
            {statusData.labels.length > 0 ? (
              <Doughnut
                data={statusData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom" as const,
                      labels: {
                        color: document.documentElement.classList.contains("dark")
                          ? "#d1d5db"
                          : "#374151",
                        padding: 15,
                        boxWidth: 12,
                      },
                    },
                  },
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Top Forms */}
        <div className="bg-white dark:bg-gray-700 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-600 lg:col-span-2">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              Top Forms by Responses
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Most popular forms based on response count
            </p>
          </div>
          <div className="h-80">
            {topFormsData.labels.length > 0 ? (
              <Bar
                data={topFormsData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: "y" as const,
                  plugins: {
                    legend: {
                      display: true,
                      labels: {
                        color: document.documentElement.classList.contains("dark")
                          ? "#d1d5db"
                          : "#374151",
                      },
                    },
                  },
                  scales: {
                    x: {
                      ticks: {
                        color: document.documentElement.classList.contains("dark")
                          ? "#9ca3af"
                          : "#6b7280",
                      },
                      grid: {
                        color: document.documentElement.classList.contains("dark")
                          ? "rgba(55, 65, 81, 0.2)"
                          : "rgba(229, 231, 235, 0.5)",
                      },
                    },
                    y: {
                      ticks: {
                        color: document.documentElement.classList.contains("dark")
                          ? "#9ca3af"
                          : "#6b7280",
                      },
                      grid: {
                        display: false,
                      },
                    },
                  },
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                No data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Forms and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Recent Forms */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-700 rounded-2xl border border-gray-100 dark:border-gray-600 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  Recent Service Forms
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Your latest created forms
                </p>
              </div>
              <button
                onClick={() => navigate("/forms/management")}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-all duration-200"
              >
                View All
              </button>
            </div>

            {formsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">
                  Loading forms...
                </p>
              </div>
            ) : recentForms.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No forms created yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Create your first service form to get started
                </p>
                <button
                  onClick={() => navigate("/forms/create")}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all duration-200 inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create First Form
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentForms.map((form: any) => (
                  <div
                    key={form._id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-300 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-600 transition-all duration-200 group"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300">
                        {form.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {form.description || "No description"}
                      </p>
                      <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="w-3 h-3 mr-2" />
                        {new Date(form.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() =>
                          navigate(`/forms/${form.id || form._id}/preview`)
                        }
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors duration-200"
                        title="Preview form"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          navigate(`/forms/${form.id || form._id}/analytics`)
                        }
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors duration-200"
                        title="View analytics"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions & Activity */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-700 rounded-2xl border border-gray-100 dark:border-gray-600 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Quick Actions
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Manage your forms and analytics
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => navigate("/forms/create")}
                className="w-full p-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center font-medium shadow-md hover:shadow-lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Form
              </button>
              <button
                onClick={() => navigate("/forms/management")}
                className="w-full p-3 bg-white dark:bg-gray-600 border-2 border-gray-200 dark:border-gray-500 text-gray-700 dark:text-gray-100 rounded-lg hover:border-blue-400 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-500 transition-all duration-200 flex items-center justify-center font-medium"
              >
                <FileText className="w-4 h-4 mr-2" />
                Manage Forms
              </button>
              <button
                onClick={() => navigate("/forms/analytics")}
                className="w-full p-3 bg-white dark:bg-gray-600 border-2 border-gray-200 dark:border-gray-500 text-gray-700 dark:text-gray-100 rounded-lg hover:border-blue-400 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-500 transition-all duration-200 flex items-center justify-center font-medium"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                View Analytics
              </button>
              <button
                onClick={() =>
                  customerPortalUrl && window.open(customerPortalUrl, "_blank")
                }
                disabled={!customerPortalUrl}
                className={`w-full p-3 rounded-lg transition-all duration-200 flex items-center justify-center font-medium ${
                  customerPortalUrl
                    ? "bg-white dark:bg-gray-600 border-2 border-gray-200 dark:border-gray-500 text-gray-700 dark:text-gray-100 hover:border-blue-400 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-500"
                    : "bg-gray-100 dark:bg-gray-600 border-2 border-gray-200 dark:border-gray-500 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50"
                }`}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Customer View
              </button>
              <button
                onClick={() => setShowTestEmailDialog(true)}
                className="w-full p-3 bg-white dark:bg-gray-600 border-2 border-gray-200 dark:border-gray-500 text-gray-700 dark:text-gray-100 rounded-lg hover:border-blue-400 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-500 transition-all duration-200 flex items-center justify-center font-medium"
              >
                <Mail className="w-4 h-4 mr-2" />
                Test Email
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Test Email Dialog */}
      {showTestEmailDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-700 rounded-2xl shadow-2xl max-w-sm w-full">
            <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-600">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                Send Test Email
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-2.5 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
                  disabled={sendingTestEmail}
                />
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  A test email will be sent from <strong>priyaraj@focusengineering.in</strong>
                </p>
              </div>
            </div>
            <div className="px-6 py-6 border-t border-gray-200 dark:border-gray-600 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowTestEmailDialog(false);
                  setTestEmail("");
                }}
                disabled={sendingTestEmail}
                className="px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTestEmail}
                disabled={sendingTestEmail || !testEmail.trim()}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 transition-all duration-200 flex items-center gap-2"
              >
                {sendingTestEmail ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
