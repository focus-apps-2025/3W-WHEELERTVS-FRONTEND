import React, { useState } from "react";
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
} from "lucide-react";
import { useForms } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function DashboardNew() {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const { data: formsData, loading: formsLoading } = useForms();
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

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

  // Calculate real-time stats from active forms data
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

  const statsCards = [
    {
      title: "Service Forms",
      value: totalForms,
      icon: FileText,
      gradient: "from-blue-500 to-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Customer Requests",
      value: totalResponses,
      icon: MessageSquare,
      gradient: "from-green-500 to-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Active Customers",
      value: activeCustomers,
      icon: Users,
      gradient: "from-purple-500 to-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Response Rate",
      value: `${responseRate}%`,
      icon: TrendingUp,
      gradient: "from-orange-500 to-orange-600",
      bg: "bg-orange-50",
    },
  ];

  if (formsLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Loading Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Fetching your latest data...
          </p>
        </div>
      </div>
    );
  }

  const customerPortalUrl = tenant
    ? `https://forms.focusengineeringapp.com/${tenant.slug}`
    : null;

  // Debug logging
  console.log("Dashboard - Tenant:", tenant);
  console.log("Dashboard - Customer Portal URL:", customerPortalUrl);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-6">
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

      {/* Test Email Button */}
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setShowTestEmailDialog(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Mail className="w-4 h-4" />
          Send Test Email
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsCards.map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-800"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <stat.icon className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {stat.value}
                </p>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wide">
                  {stat.title}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Forms */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Recent Service Forms
                </h2>
              </div>
              <button
                onClick={() => navigate("/forms/management")}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors duration-200"
              >
                View All
              </button>
            </div>

            {formsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
                  Loading forms...
                </p>
              </div>
            ) : recentForms.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">
                  No forms created yet
                </h3>
                <p className="text-gray-500 dark:text-gray-500 text-sm mb-4">
                  Get started by creating your first service form
                </p>
                <button
                  onClick={() => navigate("/forms/create")}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors duration-200"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Form
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentForms.map((form: any) => (
                  <div
                    key={form._id}
                    className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800 transition-colors duration-200"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {form.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {form.description}
                      </p>
                      <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-500">
                        <div className="flex items-center mr-3">
                          <Calendar className="w-3 h-3 mr-1 text-gray-400" />
                          {new Date(form.createdAt).toLocaleDateString()}
                        </div>
                        {/* <div className="flex items-center">
                          <Users className="w-3 h-3 mr-1 text-gray-400" />
                          {form.responseCount || 0} responses
                        </div> */}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() =>
                          navigate(`/forms/${form.id || form._id}/preview`)
                        }
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-md transition-colors duration-200"
                        title="Preview form"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          navigate(`/forms/${form.id || form._id}/analytics`)
                        }
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-md transition-colors duration-200"
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
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Plus className="w-4 h-4 text-blue-600 dark:text-blue-300" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Quick Actions
              </h2>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => navigate("/forms/create")}
                className="w-full p-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center font-medium"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Form
              </button>
              <button
                onClick={() => navigate("/forms/management")}
                className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-200 transition-colors duration-200 flex items-center justify-center font-medium"
              >
                <FileText className="w-4 h-4 mr-2" />
                Manage Forms
              </button>
              <button
                onClick={() => navigate("/forms/analytics")}
                className="w-full p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-200 transition-colors duration-200 flex items-center justify-center font-medium"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                View Analytics
              </button>
              <button
                onClick={() =>
                  customerPortalUrl && window.open(customerPortalUrl, "_blank")
                }
                disabled={!customerPortalUrl}
                className={`w-full p-3 rounded-md transition-colors duration-200 flex items-center justify-center font-medium ${
                  customerPortalUrl
                    ? "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-200"
                    : "bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                }`}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Customer View
              </button>
            </div>
          </div>
        </div>

        {/* Test Email Dialog */}
        {showTestEmailDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full m-4">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Send Test Email
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    disabled={sendingTestEmail}
                  />
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-200">
                    A test email will be sent from{" "}
                    <strong>priyaraj@focusengineering.in</strong>
                  </p>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowTestEmailDialog(false);
                    setTestEmail("");
                  }}
                  disabled={sendingTestEmail}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendTestEmail}
                  disabled={sendingTestEmail || !testEmail.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {sendingTestEmail ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Send Test Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
