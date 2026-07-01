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
  Calendar,
  Moon,
  Sun,
  Database,
  Loader2,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  ChevronUp,
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

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

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

  // Reset date filter
  const resetDateFilter = () => {
    setDateFilter("all");
    setStartDate("");
    setEndDate("");
    setShowDateFilter(false);
  };

  // Apply date filter
  const applyDateFilter = () => {
    setShowDateFilter(false);
  };

  // Export to CSV
  const exportToCSV = async () => {
    try {
      const response = await apiClient.getFormInvites(id, {
        page: 1,
        limit: 10000,
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

  // Get status info
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
      <div className={`min-h-screen ${darkMode ? 'bg-slate-950' : 'bg-slate-50'} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-600"></div>
          <span className={`text-[11px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-700'} flex items-center justify-center p-6`}>
        <div className={`w-full max-w-md text-center p-8 rounded-2xl border ${darkMode ? 'border-red-500/20 bg-red-500/5' : 'border-red-100 bg-white shadow-xl shadow-red-500/5'}`}>
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className={`text-xl font-black tracking-tight mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            Data Load Failed
          </h2>
          <p className={`text-sm mb-8 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] uppercase tracking-widest rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-blue-500/25"
          >
            Return to Safety
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-700'} selection:bg-blue-500/30 text-[11px] transition-colors duration-300`}>
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-0 left-1/4 w-[400px] h-[400px] ${darkMode ? 'bg-blue-600/5' : 'bg-blue-600/10'} rounded-full blur-[100px] -translate-y-1/2`} />
        <div className={`absolute bottom-0 right-1/4 w-[400px] h-[400px] ${darkMode ? 'bg-indigo-600/5' : 'bg-indigo-600/10'} rounded-full blur-[100px] translate-y-1/2`} />
      </div>

      {/* Header Section */}
      <div className={`sticky top-0 z-40 border-b ${darkMode ? 'border-slate-800 bg-slate-950/80' : 'border-slate-200 bg-white/80'} backdrop-blur-xl transition-colors duration-300`}>
        <div className="mx-auto max-w-[95%] px-4 py-3">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <button
                onClick={() => navigate(-1)}
                className={`p-1.5 rounded-lg transition-all duration-300 ${
                  darkMode 
                    ? 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700' 
                    : 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex flex-col flex-1 min-w-0">
                <h1 className={`text-base font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'} truncate`}>
                  Form Invite Status
                </h1>
                <p className={`text-[10px] font-medium leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-400'} truncate`}>
                  {stats?.form?.title || "Form Analytics"} • <span className="font-mono opacity-60">{id}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                disabled={loading}
                className={`p-1.5 rounded-full transition-all duration-300 ${
                  darkMode 
                    ? 'bg-blue-500/10 text-blue-400 hover:text-white hover:bg-blue-500/20' 
                    : 'bg-blue-50 text-blue-600 hover:text-blue-700 hover:bg-blue-100'
                } ${loading ? 'animate-spin' : ''}`}
                title="Refresh Analytics"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              
              <button
                onClick={exportToCSV}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
                  darkMode 
                    ? 'bg-emerald-500/10 text-emerald-400 hover:text-white hover:bg-emerald-500/20' 
                    : 'bg-emerald-50 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <Download className="h-3 w-3" />
                <span>Export CSV</span>
              </button>

              <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 mx-1" />

              <button
                onClick={toggleDarkMode}
                className={`p-1.5 rounded-full transition-all duration-300 ${
                  darkMode 
                    ? 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50' 
                    : 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative py-8">
        <div className="mx-auto max-w-[95%] px-4 space-y-6">
          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Invites', value: stats.invites.total, icon: Users, color: 'blue' },
                { label: 'Responded', value: stats.invites.responded, icon: CheckCircle2, color: 'emerald' },
                { label: 'Invited Responses', value: stats.responses.invited, icon: Mail, color: 'indigo' },
                { label: 'Response Rate', value: `${stats.invites.responseRate}%`, icon: Filter, color: 'amber' },
              ].map((item, idx) => (
                <div key={idx} className={`rounded-xl border p-4 backdrop-blur-sm ${
                  darkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white shadow-sm'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                        {item.label}
                      </span>
                      <span className={`text-xl font-black mt-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                        {item.value}
                      </span>
                    </div>
                    <div className={`p-2 rounded-lg ${
                      item.color === 'blue' ? (darkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600') :
                      item.color === 'emerald' ? (darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') :
                      item.color === 'indigo' ? (darkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600') :
                      (darkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600')
                    }`}>
                      <item.icon className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Controls & Table Container */}
          <div className={`rounded-2xl border ${darkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white shadow-sm shadow-slate-200/50'} overflow-hidden backdrop-blur-sm`}>
            {/* Table Header/Filters */}
            <div className={`border-b ${darkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-100 bg-slate-50/50'} px-6 py-6`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex-1 max-w-xl">
                  <div className="relative group">
                    <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors duration-300 ${darkMode ? 'text-slate-600 group-focus-within:text-blue-400' : 'text-slate-400 group-focus-within:text-blue-500'}`} />
                    <input
                      type="text"
                      placeholder="Search recipient data..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-[11px] font-medium transition-all duration-300 outline-none ${
                        darkMode 
                          ? 'bg-slate-950/50 border-slate-800 focus:border-blue-500/50 text-white placeholder:text-slate-700' 
                          : 'bg-white border-slate-200 focus:border-blue-500 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setShowDateFilter(!showDateFilter)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                      darkMode 
                        ? 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-blue-400 hover:border-blue-500/30' 
                        : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-500'
                    } ${dateFilter !== 'all' ? (darkMode ? 'border-blue-500/50 text-blue-400' : 'border-blue-500 text-blue-600') : ''}`}
                  >
                    <Calendar className="h-3 w-3" />
                    <span>{dateFilter === 'all' ? 'Filter by Date' : 'Active Date Range'}</span>
                    {showDateFilter ? <ChevronUp className="h-3 w-3" /> : <ChevronUp className="h-3 w-3 rotate-180" />}
                  </button>

                  <div className="relative">
                    <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className={`pl-9 pr-8 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all duration-300 outline-none appearance-none ${
                        darkMode 
                          ? 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-blue-400 focus:border-blue-500/50' 
                          : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600 focus:border-blue-500'
                      }`}
                    >
                      <option value="all">All Status</option>
                      <option value="sent">Sent</option>
                      <option value="responded">Responded</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>

                  <button
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                      darkMode 
                        ? 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-blue-400' 
                        : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600'
                    }`}
                  >
                    {sortOrder === "asc" ? "A-Z ↓" : "Z-A ↑"}
                  </button>
                </div>
              </div>

              {/* Date Filter Panel */}
              {showDateFilter && (
                <div className={`mt-6 p-6 rounded-2xl border transition-all duration-500 animate-in fade-in slide-in-from-top-4 ${
                  darkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                      <label className={`block text-[8px] font-black uppercase tracking-widest mb-2 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>Filter Type</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['all', 'sentAt', 'respondedAt'].map((type) => (
                          <button
                            key={type}
                            onClick={() => setDateFilter(type as any)}
                            className={`px-3 py-2 rounded-lg text-[9px] font-bold uppercase transition-all ${
                              dateFilter === type
                                ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white')
                                : (darkMode ? 'bg-slate-900 text-slate-500 hover:text-slate-300' : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-300')
                            }`}
                          >
                            {type === 'all' ? 'Any Time' : type === 'sentAt' ? 'Sent' : 'Responded'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-[2] grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-[8px] font-black uppercase tracking-widest mb-2 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>Start Date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className={`w-full px-4 py-2 rounded-xl border text-[11px] outline-none transition-all ${
                            darkMode 
                              ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500/50' 
                              : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[8px] font-black uppercase tracking-widest mb-2 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>End Date</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className={`w-full px-4 py-2 rounded-xl border text-[11px] outline-none transition-all ${
                            darkMode 
                              ? 'bg-slate-900 border-slate-800 text-white focus:border-blue-500/50' 
                              : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500'
                          }`}
                        />
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        onClick={resetDateFilter}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                          darkMode ? 'bg-slate-900 text-slate-500 hover:text-white' : 'bg-white text-slate-400 border border-slate-200 hover:text-slate-900'
                        }`}
                      >
                        Reset
                      </button>
                      <button
                        onClick={applyDateFilter}
                        className="px-6 py-2 rounded-xl bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`${darkMode ? 'bg-slate-900/50' : 'bg-slate-50/50'}`}>
                    <th className={`px-6 py-4 text-[9px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>No.</th>
                    <th className={`px-6 py-4 text-[9px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>Recipient Info</th>
                    <th className={`px-6 py-4 text-[9px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>Contact</th>
                    <th className={`px-6 py-4 text-[9px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>Current Status</th>
                    <th className={`px-6 py-4 text-[9px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>Timeframes</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-slate-800/50' : 'divide-slate-100'}`}>
                  {invites.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
                            <Users className="w-6 h-6 text-slate-400" />
                          </div>
                          <h3 className={`text-sm font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>No invites found</h3>
                          <p className={`text-[10px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>Try adjusting your search or filters to find what you're looking for.</p>
                          {searchTerm && (
                            <button onClick={() => setSearchTerm("")} className="mt-2 text-blue-500 font-bold hover:underline">Clear Search</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    invites.map((invite, index) => {
                      const statusInfo = getStatusInfo(invite.status);
                      const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;

                      return (
                        <tr key={invite.inviteId} className={`group transition-colors duration-200 ${darkMode ? 'hover:bg-slate-900/40' : 'hover:bg-slate-50/50'}`}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-[10px] font-black font-mono ${darkMode ? 'text-slate-700' : 'text-slate-300'}`}>
                              {globalIndex.toString().padStart(2, '0')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                                darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {invite.email.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className={`text-[11px] font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{invite.email}</span>
                                <span className={`text-[9px] font-medium ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>{invite.inviteId}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-md ${darkMode ? 'bg-slate-900 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
                                <Phone className="h-3 w-3" />
                              </div>
                              <span className={`text-[11px] font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                {invite.phone || "---"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${
                              invite.status === 'responded' ? (darkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700') :
                              invite.status === 'sent' ? (darkMode ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-700') :
                              (darkMode ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-700')
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                                invite.status === 'responded' ? 'bg-emerald-500' :
                                invite.status === 'sent' ? 'bg-blue-500' : 'bg-red-500'
                              }`} />
                              {invite.status}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-[8px] font-black uppercase tracking-tighter ${darkMode ? 'text-slate-700' : 'text-slate-300'}`}>Sent</span>
                                <span className={`text-[10px] font-medium ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{formatDate(invite.sentAt)}</span>
                              </div>
                              {invite.respondedAt && (
                                <div className="flex items-center gap-2">
                                  <span className={`text-[8px] font-black uppercase tracking-tighter ${darkMode ? 'text-emerald-900/50' : 'text-emerald-200'}`}>Resp</span>
                                  <span className={`text-[10px] font-bold ${darkMode ? 'text-emerald-500' : 'text-emerald-600'}`}>{formatDate(invite.respondedAt)}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={`px-6 py-4 border-t ${darkMode ? 'border-slate-800 bg-slate-900/20' : 'border-slate-100 bg-slate-50/30'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-medium ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                    {getPaginationText()}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className={`p-2 rounded-lg border transition-all ${
                        darkMode 
                          ? 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white disabled:opacity-20' 
                          : 'bg-white border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30'
                      }`}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (currentPage <= 3) pageNum = i + 1;
                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = currentPage - 2 + i;

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                : (darkMode ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100')
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className={`p-2 rounded-lg border transition-all ${
                        darkMode 
                          ? 'bg-slate-900 border-slate-800 text-slate-500 hover:text-white disabled:opacity-20' 
                          : 'bg-white border-slate-200 text-slate-400 hover:text-slate-900 disabled:opacity-30'
                      }`}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status Legend Section */}
          <div className={`rounded-2xl border p-6 ${darkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white shadow-sm shadow-slate-200/50'} backdrop-blur-sm`}>
            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
              Platform Legend
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { status: 'responded', color: 'emerald', label: 'Form Completed', desc: 'The recipient has successfully received, filled, and submitted the response data.' },
                { status: 'sent', color: 'blue', label: 'Invitation Active', desc: 'The invitation has been dispatched to the recipient but no response has been recorded yet.' },
                { status: 'expired', color: 'red', label: 'Link Expired', desc: 'The invitation token has exceeded its validity period and can no longer be used for responses.' },
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className={`mt-1 h-2 w-2 rounded-full ring-4 ${
                    item.color === 'emerald' ? 'bg-emerald-500 ring-emerald-500/10' :
                    item.color === 'blue' ? 'bg-blue-500 ring-blue-500/10' :
                    'bg-red-500 ring-red-500/10'
                  }`} />
                  <div className="flex flex-col gap-1">
                    <span className={`text-[11px] font-black uppercase tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>{item.label}</span>
                    <p className={`text-[10px] leading-relaxed ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteStatusPage;
