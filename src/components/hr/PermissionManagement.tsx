import React, { useState, useEffect } from "react";
import {
  Clock,
  Plus,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  MapPin,
  ChevronRight,
  Filter,
  ChevronLeft,
  ChevronFirst,
  ChevronLast,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { apiClient } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const ITEMS_PER_PAGE = 10;

export default function PermissionManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "subadmin";
  const [activeTab, setActiveTab] = useState(isAdmin ? "all" : "my");

  const [myPermissions, setMyPermissions] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [selectedPermission, setSelectedPermission] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    permissionType: "short-leave",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "11:00",
    reason: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const res = await apiClient.getAllPermissions();
        if (res && Array.isArray(res)) setAllPermissions(res);
      }

      const myRes = await apiClient.getMyPermissions();
      if (myRes && Array.isArray(myRes)) setMyPermissions(myRes);
    } catch (error) {
      console.error("Failed to fetch permissions", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();

    // Calculate duration
    const start = new Date(`2000-01-01T${formData.startTime}`);
    const end = new Date(`2000-01-01T${formData.endTime}`);
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    if (duration <= 0) {
      setStatusMessage({
        type: "error",
        text: "End time must be after start time",
      });
      return;
    }

    try {
      const baseDate = formData.date;
      const startDateTime = new Date(
        `${baseDate}T${formData.startTime}:00`,
      ).toISOString();
      const endDateTime = new Date(
        `${baseDate}T${formData.endTime}:00`,
      ).toISOString();

      await apiClient.applyPermission({
        ...formData,
        startTime: startDateTime,
        endTime: endDateTime,
        duration,
      });

      setStatusMessage({
        type: "success",
        text: "Permission request submitted successfully!",
      });
      setShowApplyModal(false);
      fetchData();
      setFormData({
        permissionType: "short-leave",
        date: format(new Date(), "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "11:00",
        reason: "",
      });
    } catch (error: any) {
      setStatusMessage({
        type: "error",
        text: "Request failed. Please try again.",
      });
    }
  };

  const handleUpdateStatus = async (
    id: string,
    status: "approved" | "rejected",
  ) => {
    try {
      await apiClient.updatePermissionStatus(id, status);
      setStatusMessage({
        type: "success",
        text: `Permission ${status} successfully!`,
      });
      fetchData();
    } catch (error: any) {
      setStatusMessage({ type: "error", text: "Update failed" });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-700 border-green-200";
      case "rejected":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-amber-100 text-amber-700 border-amber-200";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Short Permission
          </h1>
          <p className="text-gray-500 mt-1">
            Request short leave, gate pass, or late arrival.
          </p>
        </div>

        {!isAdmin && (
          <button
            onClick={() => setShowApplyModal(true)}
            className="flex items-center justify-center gap-2 bg-[#1e3a8a] text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-100 active:scale-95"
          >
            <Plus size={20} />
            Request Permission
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100/50 p-1 rounded-2xl mb-8 w-fit border border-gray-100">
        {isAdmin && (
          <button
            onClick={() => setActiveTab("all")}
            className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "all" ? "bg-white text-[#1e3a8a] shadow-md" : "text-gray-500 hover:text-gray-700"}`}
          >
            All Requests
          </button>
        )}
        <button
          onClick={() => setActiveTab("my")}
          className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "my" ? "bg-white text-[#1e3a8a] shadow-md" : "text-gray-500 hover:text-gray-700"}`}
        >
          My Requests
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-20 text-center">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-[#1e3a8a] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400 font-medium">
              Loading permission records...
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Type
                    </th>
                    {activeTab === "all" && (
                      <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Employee
                      </th>
                    )}
                    <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Timing
                    </th>
                    <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">
                      Status
                    </th>
                    {isAdmin && activeTab === "all" && (
                      <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(activeTab === "all" ? allPermissions : myPermissions)
                    .length === 0 ? (
                    <tr>
                      <td
                        colSpan={isAdmin ? 5 : 4}
                        className="px-6 py-20 text-center"
                      >
                        <div className="max-w-xs mx-auto">
                          <Clock className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                          <p className="text-gray-400 font-bold mb-1">
                            No requests found
                          </p>
                          <p className="text-gray-300 text-sm">
                            Permission requests will appear here after submission.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    (
                      (activeTab === "all" ? allPermissions : myPermissions) || []
                    ).map((perm) => (
                      <tr
                        key={perm._id}
                        className="hover:bg-gray-50/50 transition-colors group"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2.5 rounded-xl ${perm.permissionType === "short-leave" ? "bg-purple-50 text-purple-600" : "bg-amber-50 text-amber-600"}`}
                            >
                              <Clock size={18} />
                            </div>
                            <span className="font-bold text-gray-700 capitalize">
                              {perm.permissionType.replace("-", " ")}
                            </span>
                          </div>
                        </td>
                        {activeTab === "all" && (
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">
                                {perm.inspector?.firstName}{" "}
                                {perm.inspector?.lastName}
                              </span>
                              <span className="text-xs text-gray-400">
                                {perm.inspector?.email}
                              </span>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-5 text-sm font-medium text-gray-600">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-700">
                              {format(new Date(perm.date), "MMM d, yyyy")}
                            </span>
                            <span className="text-xs text-blue-600 font-bold mt-1">
                              {format(new Date(perm.startTime), "hh:mm a")} -{" "}
                              {format(new Date(perm.endTime), "hh:mm a")} (
                              {perm.duration}h)
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`px-4 py-1.5 rounded-full text-xs font-bold border ${getStatusColor(perm.status)}`}
                          >
                            {perm.status.toUpperCase()}
                          </span>
                        </td>
                        {isAdmin && activeTab === "all" && (
                          <td className="px-6 py-5">
                            {perm.status === "pending" ? (
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() =>
                                    handleUpdateStatus(perm._id, "approved")
                                  }
                                  className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                                >
                                  <CheckCircle size={20} />
                                </button>
                                <button
                                  onClick={() =>
                                    handleUpdateStatus(perm._id, "rejected")
                                  }
                                  className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                  <XCircle size={20} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">
                                Actioned
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-100">
              {(activeTab === "all" ? allPermissions : myPermissions).length === 0 ? (
                <div className="px-6 py-20 text-center">
                  <Clock className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold">No requests found</p>
                </div>
              ) : (
                (activeTab === "all" ? allPermissions : myPermissions).map((perm) => (
                  <div 
                    key={perm._id} 
                    className="p-5 space-y-4 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedPermission(perm);
                      setShowDetailModal(true);
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${perm.permissionType === "short-leave" ? "bg-purple-100 text-purple-600" : "bg-amber-100 text-amber-600"}`}>
                          <Clock size={18} />
                        </div>
                        <div>
                          <span className="font-bold text-gray-900 capitalize block">
                            {perm.permissionType.replace("-", " ")}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Type</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(perm.status)}`}>
                          {perm.status.toUpperCase()}
                        </span>
                        <ChevronRight size={14} className="text-gray-300" />
                      </div>
                    </div>

                    {activeTab === "all" && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
                          {perm.inspector?.firstName?.[0]}{perm.inspector?.lastName?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{perm.inspector?.firstName} {perm.inspector?.lastName}</p>
                          <p className="text-[10px] text-gray-500">Employee</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</p>
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{format(new Date(perm.date), "MMM d, yyyy")}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Duration</p>
                        <p className="text-xs text-blue-600 font-bold">
                          {format(new Date(perm.startTime), "hh:mm a")} - {format(new Date(perm.endTime), "hh:mm a")}
                          <span className="ml-1 text-gray-400 font-medium">({perm.duration}h)</span>
                        </p>
                      </div>
                    </div>

                    {perm.reason && (
                      <div className="p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-700 italic text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        "{perm.reason}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalItems > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
              {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of{" "}
              {totalItems}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronFirst size={18} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-medium px-3">
                Page {currentPage}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage * ITEMS_PER_PAGE >= totalItems}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage(Math.ceil(totalItems / ITEMS_PER_PAGE))
                }
                disabled={currentPage * ITEMS_PER_PAGE >= totalItems}
                className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLast size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

        {/* Detail Modal */}
        {showDetailModal && selectedPermission && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${selectedPermission.permissionType === "short-leave" ? "bg-purple-100 text-purple-600" : "bg-amber-100 text-amber-600"}`}>
                    <Clock size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white capitalize">
                      {selectedPermission.permissionType.replace("-", " ")}
                    </h3>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Permission Details</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto no-scrollbar">
                {activeTab === "all" && (
                  <div className="flex items-center gap-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-lg">
                      {selectedPermission.inspector?.firstName?.[0]}{selectedPermission.inspector?.lastName?.[0]}
                    </div>
                    <div>
                      <p className="text-base font-black text-gray-900 dark:text-white">{selectedPermission.inspector?.firstName} {selectedPermission.inspector?.lastName}</p>
                      <p className="text-xs text-gray-500 font-bold">{selectedPermission.inspector?.email}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</p>
                    <p className="text-sm font-black text-gray-900 dark:text-white">{format(new Date(selectedPermission.date), "MMMM d, yyyy")}</p>
                  </div>
                  <div className="space-y-1 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black border ${getStatusColor(selectedPermission.status)}`}>
                      {selectedPermission.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/30 dark:bg-blue-900/5 rounded-2xl border border-blue-50 dark:border-blue-900/20">
                  <p className="text-[10px] font-black text-blue-400 dark:text-blue-500 uppercase tracking-widest mb-3">Time Window</p>
                  <div className="flex items-center justify-between">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">From</p>
                      <p className="text-base font-black text-blue-600 dark:text-blue-400">{format(new Date(selectedPermission.startTime), "hh:mm a")}</p>
                    </div>
                    <div className="h-px flex-1 bg-blue-100 dark:bg-blue-900/30 mx-4 mt-4 relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 px-2 text-[10px] font-black text-blue-400">
                        {selectedPermission.duration}h
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">To</p>
                      <p className="text-base font-black text-blue-600 dark:text-blue-400">{format(new Date(selectedPermission.endTime), "hh:mm a")}</p>
                    </div>
                  </div>
                </div>

                {selectedPermission.reason && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reason</p>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                      {selectedPermission.reason}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                {isAdmin && activeTab === "all" && selectedPermission.status === "pending" ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        handleUpdateStatus(selectedPermission._id, "rejected");
                        setShowDetailModal(false);
                      }}
                      className="flex-1 py-4 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-2xl font-black text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => {
                        handleUpdateStatus(selectedPermission._id, "approved");
                        setShowDetailModal(false);
                      }}
                      className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black text-sm hover:bg-green-700 shadow-lg shadow-green-100 dark:shadow-none transition-all active:scale-95"
                    >
                      Approve
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="w-full py-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-black text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
            onClick={() => setShowApplyModal(false)}
          ></div>
          <div className="relative bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 bg-[#1e3a8a] text-white">
              <h2 className="text-2xl font-bold mb-2">Request Permission</h2>
              <p className="text-blue-100 opacity-80 font-light">
                Short duration permissions for today or upcoming dates.
              </p>
            </div>

            <form onSubmit={handleApply} className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Permission Type
                </label>
                <select
                  className="w-full bg-gray-50 border border-transparent rounded-2xl px-4 py-3 focus:bg-white focus:border-blue-100 transition-all outline-none text-gray-700 font-bold"
                  value={formData.permissionType}
                  onChange={(e) =>
                    setFormData({ ...formData, permissionType: e.target.value })
                  }
                >
                  <option value="short-leave">Short Leave (1-2 Hours)</option>
                  <option value="half-day">Half Day</option>
                  <option value="late-arrival">Late Arrival</option>
                  <option value="early-departure">Early Departure</option>
                  <option value="break-extension">Break Extension</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Date
                </label>
                <input
                  type="date"
                  required
                  className="w-full bg-gray-50 border border-transparent rounded-2xl px-4 py-3 focus:bg-white focus:border-blue-100 transition-all outline-none text-gray-700"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    className="w-full bg-gray-50 border border-transparent rounded-2xl px-4 py-3 focus:bg-white focus:border-blue-100 transition-all outline-none text-gray-700 font-bold"
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    className="w-full bg-gray-50 border border-transparent rounded-2xl px-4 py-3 focus:bg-white focus:border-blue-100 transition-all outline-none text-gray-700 font-bold"
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Reason
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Why do you need this permission?"
                  className="w-full bg-gray-50 border border-transparent rounded-2xl px-4 py-3 focus:bg-white focus:border-blue-100 transition-all outline-none text-gray-700 font-medium placeholder:text-gray-300"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                ></textarea>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-50 rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-[#1e3a8a] text-white font-bold rounded-2xl hover:bg-blue-800 shadow-lg shadow-blue-100 transition-all active:scale-95"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
