import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { apiClient } from "../api/client";
import {
  Building2,
  TrendingUp,
  FileText,
  Users,
  ArrowLeft,
  Shield,
  Lock,
  AlertTriangle,
  ChevronLeft,
  UserCheck,
  Eye,
  ChevronDown,
  BarChart2,
} from "lucide-react";

interface TenantScore {
  _id: string;
  name: string;
  companyName: string;
  slug: string;
  performanceScore: number;
  totalForms: number;
  totalResponses: number;
  userCount: number;
}

interface PerformanceUser {
  _id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  role: string;
  performanceScore: number;
  isActive: boolean;
}

export default function InternalTrackingPage() {
  const navigate = useNavigate();
  const { user, tenant: currentTenant } = useAuth();
  const { showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [allowedTenants, setAllowedTenants] = useState<TenantScore[]>([]);
  const [noAccess, setNoAccess] = useState(false);

  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [tenantData, setTenantData] = useState<{
    tenant: any;
    users: PerformanceUser[];
  } | null>(null);

  useEffect(() => {
    fetchAllowedTenantsPerformance();
  }, []);

  const fetchAllowedTenantsPerformance = async () => {
    setLoading(true);
    setNoAccess(false);
    try {
      const response = await apiClient.getInternalTrackingPerformance();
      const payload = response?.data ?? response;

      if (payload && Array.isArray(payload.tenants)) {
        const tenantList = payload.tenants as any[];
        if (tenantList.length === 0) {
          setAllowedTenants([]);
          return;
        }
        const users: any[] = payload.users || [];

        const tenantScores = tenantList.map((t: any) => {
          const tenantUsers = users.filter((u: any) => u.tenantId === t._id);
          const avgPerformance =
            tenantUsers.length > 0
              ? Math.round(
                  tenantUsers.reduce(
                    (sum: number, u: any) => sum + (u.performanceScore || 0),
                    0,
                  ) / tenantUsers.length,
                )
              : 0;

          return {
            _id: t._id,
            name: t.name,
            companyName: t.companyName,
            slug: t.slug,
            performanceScore: avgPerformance,
            totalForms: 0,
            totalResponses: 0,
            userCount: tenantUsers.length,
          };
        });

        setAllowedTenants(tenantScores);
      }
    } catch (error: any) {
      console.error("Error fetching internal tracking data:", error);
      if (error.status === 403 || error.response?.status === 403) {
        setNoAccess(true);
        setAllowedTenants([]);
      } else {
        showError(error.message || "Failed to load Internal Tracking data");
        setAllowedTenants([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewTenant = async (tenantId: string) => {
    if (expandedTenantId === tenantId) {
      setExpandedTenantId(null);
      setTenantData(null);
      return;
    }

    setExpandedTenantId(tenantId);
    setTenantLoading(true);
    setLoadingProgress(0);
    setTenantData(null);

    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.floor(Math.random() * 15) + 5;
      });
    }, 300);

    try {
      const response = await apiClient.getTenantPerformanceDetails(tenantId);
      const payload = response?.data ?? response;

      if (payload) {
        setTenantData({
          tenant: payload.tenant || {},
          users: payload.users || [],
        });
      }
    } catch (error: any) {
      console.error("Error fetching tenant performance details:", error);
      showError(error.message || "Failed to load tenant performance data");
      setExpandedTenantId(null);
    } finally {
      clearInterval(progressInterval);
      setLoadingProgress(100);
      setTimeout(() => {
        setTenantLoading(false);
      }, 300);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "subadmin":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "inspector":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80)
      return "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30";
    if (score >= 50)
      return "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30";
    return "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30";
  };

  const getPerformanceCategory = (score: number) => {
    if (score >= 90) return "Exemplary performer";
    if (score >= 80) return "Exceeded Performance";
    if (score >= 70) return "Met expectation";
    if (score >= 60) return "Partially met performer";
    return "Not met performer";
  };

  const getCategoryBadgeColor = (score: number) => {
    if (score >= 90)
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    if (score >= 80)
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    if (score >= 70)
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    if (score >= 60)
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400 font-semibold">
              Loading Internal Tracking data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (noAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
        <div className="max-w-2xl mx-auto mt-20">
          <div className="bg-white dark:bg-gray-800 rounded-3xl border border-red-200 dark:border-red-800 shadow-xl p-12 text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
              Access Restricted
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Internal Tracking has not been enabled for your tenant. Please
              contact your Super Admin to grant access.
            </p>
            <button
              onClick={() => navigate("/overall")}
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                Internal Tracking
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Performance overview for granted tenants
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/overall")}
            className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>

      {/* Access Granted Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 mb-8 flex items-center gap-4">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
            Access Granted by Super Admin
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
            You can view data from {allowedTenants.length} tenant
            {allowedTenants.length !== 1 ? "s" : ""}. This is read-only access.
          </p>
        </div>
      </div>

      {/* No allowed tenants */}
      {allowedTenants.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-16 text-center">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            No Tenants Assigned
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            No tenants have been granted for Internal Tracking yet. Please
            contact your Super Admin.
          </p>
        </div>
      ) : (
        /* Tenant Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {allowedTenants.map((tenant) => (
            <div
              key={tenant._id}
              className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:shadow-primary-500/5 hover:-translate-y-1 transition-all duration-300 overflow-hidden group"
            >
              {/* Card Top Bar */}
              <div className="h-1.5 w-full bg-gradient-to-r from-primary-500 to-primary-600" />

              <div className="p-6">
                {/* Tenant Header */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-950/30 border border-primary-100 dark:border-primary-900 flex items-center justify-center shadow-sm">
                    <Building2 className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight group-hover:text-primary-600 transition-colors line-clamp-2">
                      {tenant.companyName}
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest mt-0.5">
                      {tenant.name}
                    </p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-3.5 h-3.5 text-primary-500" />
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Performance
                      </p>
                    </div>
                    <p
                      className={`text-2xl font-black tabular-nums ${
                        tenant.performanceScore >= 80
                          ? "text-emerald-600 dark:text-emerald-400"
                          : tenant.performanceScore >= 50
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {tenant.performanceScore}%
                    </p>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          tenant.performanceScore >= 80
                            ? "bg-emerald-500"
                            : tenant.performanceScore >= 50
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${tenant.performanceScore}%` }}
                      />
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Users
                      </p>
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                      {tenant.userCount}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 font-semibold">
                      inspectors/admins
                    </p>
                  </div>
                </div>

                {/* View Button */}
                <button
                  onClick={() => handleViewTenant(tenant._id)}
                  className={`
                    w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all duration-300
                    ${
                      expandedTenantId === tenant._id
                        ? "bg-primary-600 text-white shadow-lg shadow-primary-500/30"
                        : "bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-400 hover:border-primary-200 dark:hover:border-primary-800"
                    }
                  `}
                >
                  <Eye className="w-4 h-4" />
                  {expandedTenantId === tenant._id ? "Hide Details" : "View Details"}
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-300 ${expandedTenantId === tenant._id ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Inline Performance Table */}
                {expandedTenantId === tenant._id && (
                  <div className="mt-4">
                    {tenantLoading ? (
                      /* Loading State with Percentage */
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                        <div className="relative w-20 h-20 mx-auto mb-4">
                          <svg className="w-20 h-20 transform -rotate-90">
                            <circle
                              cx="40"
                              cy="40"
                              r="36"
                              stroke="currentColor"
                              strokeWidth="6"
                              fill="transparent"
                              className="text-gray-200 dark:text-gray-700"
                            />
                            <circle
                              cx="40"
                              cy="40"
                              r="36"
                              stroke="currentColor"
                              strokeWidth="6"
                              fill="transparent"
                              strokeDasharray={`${2 * Math.PI * 36}`}
                              strokeDashoffset={`${2 * Math.PI * 36 * (1 - loadingProgress / 100)}`}
                              strokeLinecap="round"
                              className="text-primary-600 transition-all duration-300"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-black text-primary-600 dark:text-primary-400">
                              {loadingProgress}%
                            </span>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                          Loading Performance Data...
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Fetching user performance for{" "}
                          {tenant.companyName}
                        </p>
                      </div>
                    ) : tenantData && tenantData.users.length > 0 ? (
                      /* Performance Table */
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {/* Table Header */}
                        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 max-h-[400px]">
                          <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-gray-100/80 dark:bg-gray-700/80 backdrop-blur-md sticky top-0 z-10 text-gray-700 dark:text-gray-300 uppercase text-[10px] font-black tracking-widest">
                              <tr>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 whitespace-nowrap">
                                  User
                                </th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 whitespace-nowrap">
                                  Role
                                </th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 whitespace-nowrap text-center">
                                  Performance
                                </th>
                                <th className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 whitespace-nowrap text-center">
                                  Performance Category
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                              {tenantData.users.map((user) => (
                                <tr
                                  key={user._id}
                                  className="hover:bg-white dark:hover:bg-gray-800 transition-colors"
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                                        <span className="text-[10px] font-black text-primary-700 dark:text-primary-300 uppercase">
                                          {(() => {
                                            const fullName = user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "?";
                                            return fullName
                                              .split(" ")
                                              .map((n: string) => n[0])
                                              .join("")
                                              .slice(0, 2);
                                          })()}
                                        </span>
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                          {user.name
                                            ? user.name
                                            : `${user.firstName || ""} ${user.lastName || ""}`.trim()}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getRoleBadgeColor(
                                        user.role,
                                      )}`}
                                    >
                                      {user.role}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex flex-col items-center">
                                      <span
                                        className={`px-2.5 py-1 rounded-full text-xs font-black tabular-nums ${getScoreColor(
                                          user.performanceScore,
                                        )}`}
                                      >
                                        {user.performanceScore}%
                                      </span>
                                      <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-1.5">
                                        <div
                                          className={`h-full rounded-full transition-all duration-700 ${
                                            user.performanceScore >= 80
                                              ? "bg-emerald-500"
                                              : user.performanceScore >= 50
                                                ? "bg-amber-500"
                                                : "bg-red-500"
                                          }`}
                                          style={{
                                            width: `${user.performanceScore}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getCategoryBadgeColor(
                                        user.performanceScore,
                                      )}`}
                                    >
                                      {getPerformanceCategory(user.performanceScore)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            {/* Summary Row */}
                            <tfoot>
                              <tr className="bg-gray-100/80 dark:bg-gray-700/50">
                                <td
                                  colSpan={2}
                                  className="px-4 py-3 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest"
                                >
                                  Average
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-xs font-black tabular-nums ${getScoreColor(
                                      tenant.performanceScore,
                                    )}`}
                                  >
                                    {tenant.performanceScore}%
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getCategoryBadgeColor(
                                      tenant.performanceScore,
                                    )}`}
                                  >
                                    {getPerformanceCategory(tenant.performanceScore)}
                                  </span>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    ) : (
                      /* Empty State */
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                        <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <Users className="w-7 h-7 text-gray-400" />
                        </div>
                        <p className="text-sm font-bold text-gray-600 dark:text-gray-400">
                          No Users Found
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          There are no users with performance data for this
                          tenant.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Read-only notice */}
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl mt-4">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                    Read-only access — Super Admin controlled
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
