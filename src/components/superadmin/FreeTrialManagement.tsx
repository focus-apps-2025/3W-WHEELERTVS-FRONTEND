import React, { useState, useEffect } from "react";
import {
  Building2,
  Search,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Users,
  FileText,
} from "lucide-react";
import { useNotification } from "../../context/NotificationContext";
import { apiClient } from "../../api/client";

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  companyName: string;
  isActive: boolean;
  adminId?: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
    lastLogin?: string;
  }>;
  subscription: {
    plan: string;
    startDate: string;
    endDate: string;
    maxUsers: number;
    maxForms: number;
  };
  createdAt: string;
}

export default function FreeTrialManagement() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { showError } = useNotification();

  useEffect(() => {
    fetchFreeTrialTenants();
  }, [searchTerm]);

  const fetchFreeTrialTenants = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getTenants(searchTerm, "all", "free");
      setTenants(data.tenants);
    } catch (error: any) {
      showError(error.response?.message || "Failed to fetch free trial tenants");
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysLeft = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const isExpired = (endDate: string) => {
    return new Date(endDate) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Free Trial Management</h1>
          <p className="text-gray-500 text-sm">Monitor and manage tenants on 30-day free trial</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-50 rounded-lg">
              <Clock className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Trials</p>
              <p className="text-2xl font-bold text-gray-900">
                {tenants.filter(t => !isExpired(t.subscription.endDate)).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Expired Trials</p>
              <p className="text-2xl font-bold text-gray-900">
                {tenants.filter(t => isExpired(t.subscription.endDate)).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <Building2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Signups</p>
              <p className="text-2xl font-bold text-gray-900">{tenants.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name, slug or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Tenants List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Tenant Info</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Admin</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Trial Period</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-4">
                      <div className="h-12 bg-gray-100 rounded-lg"></div>
                    </td>
                  </tr>
                ))
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No free trial tenants found
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => {
                  const daysLeft = calculateDaysLeft(tenant.subscription.endDate);
                  const expired = isExpired(tenant.subscription.endDate);
                  const admin = tenant.adminId?.[0];

                  return (
                    <tr key={tenant._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold">
                            {tenant.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{tenant.name}</p>
                            <p className="text-xs text-gray-500">{tenant.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {admin ? (
                          <div>
                            <p className="text-sm text-gray-900 font-medium">
                              {admin.firstName} {admin.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{admin.email}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No admin</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(tenant.subscription.startDate).toLocaleDateString()} - {new Date(tenant.subscription.endDate).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {expired ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3" />
                            Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Active Trial
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex flex-col items-end">
                          <span className={`text-lg font-bold ${daysLeft <= 5 ? 'text-red-600' : 'text-gray-900'}`}>
                            {daysLeft}
                          </span>
                          <span className="text-xs text-gray-500">Days left</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
