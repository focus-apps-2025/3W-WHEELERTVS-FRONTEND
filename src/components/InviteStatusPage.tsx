import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  Mail,
  Phone,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar, // Added Calendar icon
} from "lucide-react";
import { apiClient } from "../api/client";

interface Invite {
  _id?: string;
  email: string;
  phone?: string;
  inviteId: string;
  status: "sent" | "responded" | "expired";
  sentAt: string;
  respondedAt?: string;
  createdAt?: string;
  name?: string; // We'll extract from email
}

interface InviteStats {
  form: {
    id: string;
    title: string;
  };
  invites: {
    total: number;
    sent: number;
    responded: number;
    expired: number;
    responseRate: number;
  };
  responses: {
    total: number;
    invited: number;
    public: number;
  };
}

const InviteStatusPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // State for invites list (already paginated from server)
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for stats
  const [stats, setStats] = useState<InviteStats | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0); // Add total count

  // Filter and search state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"email" | "status" | "sentAt">("sentAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Date filter state
  const [dateFilter, setDateFilter] = useState<
    "all" | "sentAt" | "respondedAt"
  >("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [showDateFilter, setShowDateFilter] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);

      // 1. Fetch invites with filters (server-side)
      const invitesResponse = await apiClient.getFormInvites(id, {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
        status: statusFilter !== "all" ? statusFilter : undefined,
        dateFilter: dateFilter !== "all" ? dateFilter : undefined,
        startDate,
        endDate,
        sortBy,
        sortOrder,
      });

      // Server returns already paginated and filtered data
      setInvites(invitesResponse.invites || []);
      setTotalPages(invitesResponse.pagination?.totalPages || 1);
      setTotalCount(invitesResponse.pagination?.totalCount || 0);

      // 2. Fetch stats separately
      const statsData = await apiClient.getInviteStats(id);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [
    id,
    currentPage,
    searchTerm,
    statusFilter,
    dateFilter,
    startDate,
    endDate,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 500); // 500ms delay for search

    return () => clearTimeout(timer);
  }, [searchTerm, fetchData]);

  useEffect(() => {
    fetchData();
  }, [
    currentPage,
    statusFilter,
    dateFilter,
    startDate,
    endDate,
    sortBy,
    sortOrder,
    fetchData,
  ]);

  // Helper function to check if a date is within range
  const toYMD = (d: string) => new Date(d).toISOString().slice(0, 10);

  const isDateInRange = (dateString?: string): boolean => {
    if (!dateString) return false;

    const d = toYMD(dateString);

    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;

    return true;
  };

  // Filter and sort invites

  // Reset date filter
  const resetDateFilter = () => {
    setDateFilter("all");
    setStartDate("");
    setEndDate("");
    setShowDateFilter(false);
  };

  // Apply date filter
  const applyDateFilter = () => {
    // Just setting showDateFilter to false to collapse the filter
    setShowDateFilter(false);
  };

  // Paginate filtered invites

  // Update total pages when filtered invites change

  // Export to CSV
  const exportToCSV = async () => {
    try {
      // Fetch ALL invites for CSV export
      const response = await apiClient.getFormInvites(id, {
        page: 1,
        limit: 10000, // Large number to get all
        search: searchTerm,
        status: statusFilter !== "all" ? statusFilter : undefined,
        dateFilter: dateFilter !== "all" ? dateFilter : undefined,
        startDate,
        endDate,
        sortBy,
        sortOrder,
      });

      const headers = [
        "S.No",
        "Email",
        "Phone",
        "Status",
        "Sent At",
        "Responded At",
      ];
      const csvData = (response.invites || []).map((invite, index) => [
        index + 1,

        invite.email,
        invite.phone || "",
        invite.status,
        new Date(invite.sentAt).toLocaleString(),
        invite.respondedAt ? new Date(invite.respondedAt).toLocaleString() : "",
      ]);

      const csvContent = [
        headers.join(","),
        ...csvData.map((row) => row.join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `invites_${id}_${
        new Date().toISOString().split("T")[0]
      }.csv`;
      link.click();
    } catch (err) {
      alert("Failed to export CSV: " + (err as Error).message);
    }
  };

  // Get status icon and color
  const getStatusInfo = (status: string) => {
    switch (status) {
      case "responded":
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
        };
      case "sent":
        return {
          icon: <Clock className="w-4 h-4" />,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
        };
      case "expired":
        return {
          icon: <XCircle className="w-4 h-4" />,
          color: "text-red-600",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
        };
      default:
        return {
          icon: <Clock className="w-4 h-4" />,
          color: "text-gray-600",
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
        };
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const getPaginationText = () => {
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalCount);
    return `Showing ${start} to ${end} of ${totalCount} invites`;
  };

  if (loading && !invites.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Failed to load
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4">
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Email Invite Status
                </h1>
                <p className="text-sm text-gray-600">
                  {stats?.form?.title || "Form"} • {id}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={exportToCSV}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-300 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Combined Stats and Controls */}
      {stats && (
        <div className="w-full px-4 sm:px-6 lg:px-8 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {/* Main container with flex layout */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left Section - Statistics */}
              <div className="lg:w-1/2">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-lg font-semibold text-gray-900">
                    Invite Statistics
                  </h1>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">
                      {stats.invites.total}
                    </div>
                    <div className="text-sm text-blue-600">Total Invites</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">
                      {stats.invites.responded}
                    </div>
                    <div className="text-sm text-green-600">Responded</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-700">
                      {stats.responses.invited}
                    </div>
                    <div className="text-sm text-purple-600">
                      Invited Responses
                    </div>
                  </div>
                  <div className="text-center p-4 bg-amber-50 rounded-lg">
                    <div className="text-2xl font-bold text-amber-700">
                      {stats.invites.responseRate}%
                    </div>
                    <div className="text-sm text-amber-600">Response Rate</div>
                  </div>
                </div>
              </div>

              {/* Right Section - Controls */}
              <div className="lg:w-1/2">
                <div className="h-full flex flex-col justify-center">
                  {/* Search */}
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by email, name, or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Date Filter Toggle */}
                  <div className="mb-3">
                    <button
                      onClick={() => setShowDateFilter(!showDateFilter)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                      <Calendar className="w-4 h-4" />
                      {dateFilter === "all"
                        ? "Add Date Filter"
                        : "Date Filter Active"}
                      {showDateFilter ? " ↑" : " ↓"}
                    </button>
                  </div>

                  {/* Date Filter Panel */}
                  {showDateFilter && (
                    <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-700">
                          Date Filter
                        </h3>
                        <button
                          onClick={resetDateFilter}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Reset
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Filter By
                          </label>
                          <select
                            value={dateFilter}
                            onChange={(e) =>
                              setDateFilter(e.target.value as any)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="all">All Dates</option>
                            <option value="sentAt">Sent Date</option>
                            <option value="respondedAt">Responded Date</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              From Date
                            </label>
                            <input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              To Date
                            </label>
                            <input
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={applyDateFilter}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                          >
                            Apply Filter
                          </button>
                        </div>

                        {(startDate || endDate) && (
                          <div className="text-xs text-gray-500">
                            Filtering{" "}
                            {dateFilter === "sentAt"
                              ? "Sent Date"
                              : "Responded Date"}
                            {startDate && ` from ${startDate}`}
                            {endDate && ` to ${endDate}`}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Filters Row */}
                  <div className="flex flex-wrap gap-3">
                    {/* Status Filter */}
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                      >
                        <option value="all">All Status</option>
                        <option value="sent">Sent</option>
                        <option value="responded">Responded</option>
                        <option value="expired">Expired</option>
                      </select>
                    </div>

                    {/* Sort By 
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                    >
                      <option value="sentAt">Sort by Sent Date</option>
                      <option value="email">Sort by Email</option>
                      <option value="status">Sort by Status</option>
                    </select>*/}

                    {/* Sort Order */}
                    <button
                      onClick={() =>
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                      }
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                      {sortOrder === "asc" ? "A-Z" : "Z-A"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="w-full px-4 sm:px-6 lg:px-8 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    S.No
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Responded At
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invites.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Users className="w-12 h-12 text-gray-400 mb-4" />
                        <p className="text-gray-500">No invites found</p>
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm("")}
                            className="mt-2 text-blue-600 hover:text-blue-700"
                          >
                            Clear search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  invites.map((invite, index) => {
                    const statusInfo = getStatusInfo(invite.status);
                    const globalIndex =
                      (currentPage - 1) * itemsPerPage + index + 1;

                    return (
                      <tr key={invite.inviteId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                          {globalIndex}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            {invite.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            {invite.phone || "Not provided"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color} border ${statusInfo.borderColor}`}
                          >
                            {statusInfo.icon}
                            {invite.status.charAt(0).toUpperCase() +
                              invite.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(invite.sentAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {invite.respondedAt
                            ? formatDate(invite.respondedAt)
                            : "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-700 mb-4 sm:mb-0">
                  {getPaginationText()}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 text-sm font-medium rounded-md ${
                            currentPage === pageNum
                              ? "bg-blue-600 text-white"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <>
                        <span className="px-2">...</span>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          className="px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Status Legend */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Status Legend
          </h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-600">
                Responded - Recipient has submitted the form
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-gray-600">
                Sent - Email sent, awaiting response
              </span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-gray-600">
                Expired - Link has expired
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteStatusPage;
