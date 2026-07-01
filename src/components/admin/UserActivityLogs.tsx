import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import {
  Clock,
  Search,
  Download,
  MapPin,
  Users as UsersIcon,
  Building,
} from "lucide-react";
import * as XLSX from "xlsx";

interface UserActivityLog {
  _id: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  tenantId?: {
    _id: string;
    name: string;
  };
  loginTime: string;
  logoutTime?: string;
  location?: {
    status: string;
    latitude?: number;
    longitude?: number;
    address?: string;
  };
}

interface UserHierarchy {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  tenantId?: {
    _id: string;
    name: string;
  };
}

export default function UserActivityLogs() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"logs" | "hierarchy">("logs");
  const [logs, setLogs] = useState<UserActivityLog[]>([]);
  const [hierarchyData, setHierarchyData] = useState<UserHierarchy[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isSuperAdmin = user?.role === "superadmin";

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "logs") {
        const res = await apiClient.getUserActivityLogs({ limit: 200 }); // fetch more for local search
        if (res && res.logs) {
          setLogs(res.logs);
        }
      } else {
        const res = await apiClient.getUsersHierarchy();
        if (res && res.users) {
          setHierarchyData(res.users);
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name =
      `${log.userId?.firstName} ${log.userId?.lastName}`.toLowerCase();
    const email = log.userId?.email?.toLowerCase() || "";
    return name.includes(q) || email.includes(q);
  });

  const filteredHierarchy = hierarchyData.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = `${u.firstName} ${u.lastName}`.toLowerCase();
    const email = u.email.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const exportToExcel = () => {
    if (activeTab === "logs") {
      const exportData = filteredLogs.map((log) => ({
        "User Name": `${log.userId?.firstName || ""} ${log.userId?.lastName || ""}`,
        Email: log.userId?.email || "",
        Role: log.userId?.role || "",
        Tenant: log.tenantId?.name || "N/A",
        "Login Time": new Date(log.loginTime).toLocaleString(),
        "Logout Time": log.logoutTime
          ? new Date(log.logoutTime).toLocaleString()
          : "Active Session",
        "Location Status": log.location?.status || "unknown",
        Coordinates: log.location?.latitude
          ? `${log.location.latitude}, ${log.location.longitude}`
          : "N/A",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Activity Logs");
      XLSX.writeFile(wb, "user_activity_logs.xlsx");
    } else {
      const exportData = filteredHierarchy.map((u) => ({
        "User Name": `${u.firstName} ${u.lastName}`,
        Email: u.email,
        Role: u.role,
        Tenant: u.tenantId?.name || "N/A",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Users Hierarchy");
      XLSX.writeFile(wb, "users_hierarchy.xlsx");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            User Monitoring
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track user logins, locations, and view hierarchy.
          </p>
        </div>

        <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3">
          <div className="relative flex-1 xs:min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm"
            />
          </div>
          <button
            onClick={exportToExcel}
            className="flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-all active:scale-95 shadow-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl w-fit shadow-inner">
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === "logs"
              ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Activity Logs
        </button>
        {/* <button
          onClick={() => setActiveTab("hierarchy")}
          className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "hierarchy"
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Users & Hierarchy
        </button> */}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : activeTab === "logs" ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                      User
                    </th>
                    {isSuperAdmin && (
                      <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                        Tenant
                      </th>
                    )}
                    <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Login Time
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Logout Time
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Location
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isSuperAdmin ? 5 : 4}
                        className="py-8 text-center text-gray-500"
                      >
                        No logs found.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr
                        key={log._id}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {log.userId?.firstName} {log.userId?.lastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {log.userId?.role}
                          </div>
                        </td>
                        {isSuperAdmin && (
                          <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                            {log.tenantId?.name || "System"}
                          </td>
                        )}
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                          {new Date(log.loginTime).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {log.logoutTime ? (
                            <span className="text-gray-600 dark:text-gray-300">
                              {new Date(log.logoutTime).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full text-xs font-medium">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {log.location &&
                          log.location.status === "granted" &&
                          log.location.latitude ? (
                            <div className="flex items-center text-gray-600 dark:text-gray-300">
                              <MapPin className="w-4 h-4 mr-1 text-blue-500" />
                              <a
                                href={`https://www.google.com/maps?q=${log.location.latitude},${log.location.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 hover:underline"
                              >
                                View Map
                              </a>
                            </div>
                          ) : (
                            <span className="text-gray-400">Unavailable</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-800">
              {filteredLogs.length === 0 ? (
                <div className="p-12 text-center text-gray-500 italic">No activity logs found.</div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log._id} className="p-4 space-y-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <span className="text-blue-600 dark:text-blue-400 font-bold uppercase">
                            {log.userId?.firstName?.[0]}{log.userId?.lastName?.[0]}
                          </span>
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white leading-tight">
                            {log.userId?.firstName} {log.userId?.lastName}
                          </div>
                          <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-0.5">
                            {log.userId?.role}
                          </div>
                        </div>
                      </div>
                      {!log.logoutTime && (
                        <span className="inline-flex items-center px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-full uppercase">
                           <span className="w-1 h-1 rounded-full bg-green-500 mr-1 animate-pulse"></span>
                           Active
                        </span>
                      )}
                    </div>

                    {isSuperAdmin && (
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg">
                        <Building className="w-3.5 h-3.5 mr-2 text-gray-400" />
                        <span className="font-medium">Tenant:</span>
                        <span className="ml-1 text-gray-700 dark:text-gray-300 font-semibold">{log.tenantId?.name || "System"}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50/50 dark:bg-blue-900/10 p-2.5 rounded-xl border border-blue-100/50 dark:border-blue-900/20">
                        <p className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-1 flex items-center gap-1">
                          <Clock size={10} /> Login
                        </p>
                        <p className="text-xs text-blue-900 dark:text-blue-200 font-medium">
                          {new Date(log.loginTime).toLocaleDateString()}
                        </p>
                        <p className="text-[10px] text-blue-500 dark:text-blue-400 font-bold">
                          {new Date(log.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {log.logoutTime ? (
                        <div className="bg-orange-50/50 dark:bg-orange-900/10 p-2.5 rounded-xl border border-orange-100/50 dark:border-orange-900/20">
                          <p className="text-[9px] font-bold text-orange-600 dark:text-orange-400 uppercase mb-1 flex items-center gap-1">
                            <Clock size={10} /> Logout
                          </p>
                          <p className="text-xs text-orange-900 dark:text-orange-200 font-medium">
                            {new Date(log.logoutTime).toLocaleDateString()}
                          </p>
                          <p className="text-[10px] text-orange-500 dark:text-orange-400 font-bold">
                            {new Date(log.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-green-50/50 dark:bg-green-900/10 p-2.5 rounded-xl border border-green-100/50 dark:border-green-900/20 flex flex-col justify-center">
                          <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase text-center">In Progress</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      {log.location &&
                      log.location.status === "granted" &&
                      log.location.latitude ? (
                        <a
                          href={`https://www.google.com/maps?q=${log.location.latitude},${log.location.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5 mr-1.5" />
                          View Location
                        </a>
                      ) : (
                        <div className="flex items-center px-3 py-1.5 text-gray-400 text-xs italic">
                          <MapPin className="w-3.5 h-3.5 mr-1.5 opacity-50" />
                          Location unavailable
                        </div>
                      )}
                      
                      <span className="text-[10px] text-gray-400 font-medium">ID: {log._id.slice(-6).toUpperCase()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                      User
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Email
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                      Role
                    </th>
                    {isSuperAdmin && (
                      <th className="py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                        Tenant
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredHierarchy.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isSuperAdmin ? 4 : 3}
                        className="py-8 text-center text-gray-500"
                      >
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredHierarchy.map((u) => (
                      <tr
                        key={u._id}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {u.firstName} {u.lastName}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                          {u.email}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              u.role === "admin"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                : u.role === "subadmin"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                  : u.role === "inspector"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            }`}
                          >
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        {isSuperAdmin && (
                          <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300">
                            {u.tenantId?.name || "System"}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {filteredHierarchy.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No users found.</div>
              ) : (
                filteredHierarchy.map((u) => (
                  <div key={u._id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">
                          {u.firstName} {u.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {u.email}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          u.role === "admin"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            : u.role === "subadmin"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : u.role === "inspector"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {u.role}
                      </span>
                    </div>

                    {isSuperAdmin && (
                      <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                        <Building className="w-3.5 h-3.5 mr-1.5" />
                        <span className="font-medium">Tenant:</span>
                        <span className="ml-1">{u.tenantId?.name || "System"}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
