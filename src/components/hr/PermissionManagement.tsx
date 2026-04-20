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
          <div className="overflow-x-auto">
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
