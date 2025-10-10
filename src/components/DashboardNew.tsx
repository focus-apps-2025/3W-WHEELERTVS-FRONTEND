import React from "react";
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
} from "lucide-react";
import { useForms } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function DashboardNew() {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const { data: formsData, loading: formsLoading } = useForms();

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
      <div className="min-h-screen bg-white p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Loading Dashboard
          </h2>
          <p className="text-gray-600 text-sm">Fetching your latest data...</p>
        </div>
      </div>
    );
  }

  const customerPortalUrl = tenant
    ? `https://servicerequests.netlify.app/${tenant.slug}`
    : null;

  return (
    <div className="min-h-screen bg-white p-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsCards.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-50 rounded-lg">
                <stat.icon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold text-gray-900">
                  {stat.value}
                </p>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
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
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
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
                <p className="mt-2 text-gray-600 text-sm">Loading forms...</p>
              </div>
            ) : recentForms.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-base font-medium text-gray-900 mb-1">
                  No forms created yet
                </h3>
                <p className="text-gray-500 text-sm mb-4">
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
                    className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {form.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {form.description}
                      </p>
                      <div className="flex items-center mt-2 text-xs text-gray-500">
                        <div className="flex items-center mr-3">
                          <Calendar className="w-3 h-3 mr-1 text-gray-400" />
                          {new Date(form.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center">
                          <Users className="w-3 h-3 mr-1 text-gray-400" />
                          {form.responseCount || 0} responses
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() =>
                          navigate(`/forms/${form.id || form._id}/preview`)
                        }
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors duration-200"
                        title="Preview form"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          navigate(`/forms/${form.id || form._id}/analytics`)
                        }
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors duration-200"
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
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Plus className="w-4 h-4 text-blue-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
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
                className="w-full p-3 bg-white border border-gray-200 text-gray-700 rounded-md hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 flex items-center justify-center font-medium"
              >
                <FileText className="w-4 h-4 mr-2" />
                Manage Forms
              </button>
              <button
                onClick={() => navigate("/forms/analytics")}
                className="w-full p-3 bg-white border border-gray-200 text-gray-700 rounded-md hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 flex items-center justify-center font-medium"
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
                    ? "bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    : "bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Customer View
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
