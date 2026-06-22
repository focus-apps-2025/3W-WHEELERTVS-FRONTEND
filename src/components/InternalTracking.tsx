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
  ChevronLeft,
  Shield,
  Lock,
  AlertTriangle,
  ArrowLeft,
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

export default function InternalTrackingPage() {
  const navigate = useNavigate();
  const { user, tenant: currentTenant } = useAuth();
  const { showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [allowedTenants, setAllowedTenants] = useState<TenantScore[]>([]);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    fetchAllowedTenantsPerformance();
  }, []);

  const fetchAllowedTenantsPerformance = async () => {
    setLoading(true);
    setNoAccess(false);
    try {
      const response = await apiClient.getInternalTrackingPerformance();
      // Backend returns { success, data: { tenants, users } }
      // apiClient may already unwrap to .data, handle both shapes
      const payload = response?.data ?? response;

      if (payload && Array.isArray(payload.tenants)) {
        const tenantList = payload.tenants as any[];
        // Empty list = enabled but no tenants assigned yet — NOT a 403 case
        if (tenantList.length === 0) {
          setAllowedTenants([]);
          return;
        }
        const users: any[] = payload.users || [];

        const tenantScores = tenantList.map((t: any) => {
          // Both tenantId and t._id are now plain strings from the fixed backend
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
                  <div>
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
                  <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-3.5 h-3.5 text-violet-500" />
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Forms
                      </p>
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                      {tenant.totalForms}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 font-semibold">
                      total forms
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart2 className="w-3.5 h-3.5 text-teal-500" />
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Responses
                      </p>
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                      {tenant.totalResponses}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 font-semibold">
                      total responses
                    </p>
                  </div>
                </div>

                {/* Read-only notice */}
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl">
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
