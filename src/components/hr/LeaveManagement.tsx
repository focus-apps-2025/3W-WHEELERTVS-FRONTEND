import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Calendar,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  Info,
  ChevronRight,
  Filter,
  Download,
  ChevronLeft,
  ChevronFirst,
  ChevronLast,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

const ITEMS_PER_PAGE = 10;

export default function LeaveManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "subadmin";
  const [activeTab, setActiveTab] = useState(isAdmin ? "all" : "my");

  const [myLeaves, setMyLeaves] = useState<any[]>([]);
  const [allLeaves, setAllLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    leaveType: "sick",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    reason: "",
  });

  const fetchData = async () => {
    setLoading(true);
    const page = currentPage;
    const limit = ITEMS_PER_PAGE;
    try {
      if (isAdmin) {
        const res = await apiClient.getAllLeaves({ page, limit, getAll: true });
        if (res && Array.isArray(res)) {
          setAllLeaves(res);
          setTotalItems(res.length);
        } else if (res?.data) {
          setAllLeaves(res.data);
          setTotalItems(res.pagination?.total || res.data.length);
        }
      }

      const myRes = await apiClient.getMyLeaves({ page, limit });
      console.log("My leaves response:", myRes);
      if (myRes && Array.isArray(myRes)) {
        setMyLeaves(myRes);
        setTotalItems(myRes.length);
      } else if (myRes?.data) {
        setMyLeaves(myRes.data);
        setTotalItems(myRes.pagination?.total || myRes.data.length);
      }
    } catch (error) {
      console.error("Failed to fetch leaves", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, [currentPage, isAdmin]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log("Applying leave with data:", formData);
      const res = await apiClient.applyLeave(formData);
      console.log("Leave apply response:", res);

      setStatusMessage({
        type: "success",
        text: "Leave request submitted successfully!",
      });
      setShowApplyModal(false);
      fetchData();
      setFormData({
        leaveType: "sick",
        startDate: format(new Date(), "yyyy-MM-dd"),
        endDate: format(new Date(), "yyyy-MM-dd"),
        reason: "",
      });
    } catch (error: any) {
      setStatusMessage({ type: "error", text: "Failed to apply for leave." });
    }
  };

  const handleUpdateStatus = async (
    id: string,
    status: "approved" | "rejected",
  ) => {
    //const comments = prompt(`Enter comnts for ${status}:`);
    try {
      await apiClient.updateLeaveStatus(id, status || "");
      setStatusMessage({
        type: "success",
        text: `Leave ${status} successfully!`,
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
            Leave Management
          </h1>
          <p className="text-gray-500 mt-1">
            Manage your leave requests and track approvals.
          </p>
        </div>

        {!isAdmin && (
          <button
            onClick={() => setShowApplyModal(true)}
            className="flex items-center justify-center gap-2 bg-[#1e3a8a] text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-800 transition-all shadow-lg shadow-blue-100 active:scale-95"
          >
            <Plus size={20} />
            Apply for Leave
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
          My Leaves
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-3xl shadow-xl shadow-gray-100 border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-20 text-center">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-[#1e3a8a] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400 font-medium">
              Loading leave records...
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
                    Duration
                  </th>
                  <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Reason
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
                {(activeTab === "all" ? allLeaves : myLeaves).length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 6 : 5}
                      className="px-6 py-20 text-center"
                    >
                      <div className="max-w-xs mx-auto">
                        <Calendar className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                        <p className="text-gray-400 font-bold mb-1">
                          No leave requests found
                        </p>
                        <p className="text-gray-300 text-sm">
                          When you or your team applies for leave, they will
                          appear here.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  ((activeTab === "all" ? allLeaves : myLeaves) || []).map(
                    (leave) => (
                      <tr
                        key={leave?._id}
                        className="hover:bg-gray-50/50 transition-colors group"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2.5 rounded-xl ${leave?.leaveType === "sick" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}
                            >
                              <Calendar size={18} />
                            </div>
                            <span className="font-bold text-gray-700 capitalize">
                              {leave.leaveType}
                            </span>
                          </div>
                        </td>
                        {activeTab === "all" && (
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">
                                {leave.inspector?.firstName}{" "}
                                {leave.inspector?.lastName}
                              </span>
                              <span className="text-xs text-gray-400">
                                {leave.inspector?.email}
                              </span>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-5 text-sm font-medium text-gray-600">
                          <div className="flex flex-col">
                            <span>
                              {format(new Date(leave.startDate), "MMM d, yyyy")}{" "}
                              - {format(new Date(leave.endDate), "MMM d, yyyy")}
                            </span>
                            <span className="text-xs text-blue-600 font-bold mt-1 bg-blue-50 w-fit px-2 py-0.5 rounded-full">
                              {leave.totalDays} Days
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm text-gray-600 max-w-xs line-clamp-2">
                            {leave.reason}
                          </p>
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`px-4 py-1.5 rounded-full text-xs font-bold border ${getStatusColor(leave?.status || "pending")}`}
                          >
                            {(leave?.status || "pending").toUpperCase()}
                          </span>
                        </td>
                        {isAdmin && activeTab === "all" && (
                          <td className="px-6 py-5">
                            {leave.status === "pending" ? (
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() =>
                                    handleUpdateStatus(leave._id, "approved")
                                  }
                                  className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                                >
                                  <CheckCircle size={20} />
                                </button>
                                <button
                                  onClick={() =>
                                    handleUpdateStatus(leave._id, "rejected")
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
                    ),
                  )
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
              <h2 className="text-2xl font-bold mb-2">Apply for Leave</h2>
              <p className="text-blue-100 opacity-80 font-light">
                Enter the details of your leave request.
              </p>
            </div>

            <form onSubmit={handleApply} className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Leave Type
                </label>
                <select
                  className="w-full bg-gray-50 border border-transparent rounded-2xl px-4 py-3 focus:bg-white focus:border-blue-100 transition-all outline-none text-gray-700 font-bold"
                  value={formData.leaveType}
                  onChange={(e) =>
                    setFormData({ ...formData, leaveType: e.target.value })
                  }
                >
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="annual">Annual Leave</option>
                  <option value="maternity">Maternity Leave</option>
                  <option value="paternity">Paternity Leave</option>
                  <option value="comp-off">Comp-Off</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full bg-gray-50 border border-transparent rounded-2xl px-4 py-3 focus:bg-white focus:border-blue-100 transition-all outline-none text-gray-700"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full bg-gray-50 border border-transparent rounded-2xl px-4 py-3 focus:bg-white focus:border-blue-100 transition-all outline-none text-gray-700"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
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
                  placeholder="Explain the reason for leave..."
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
