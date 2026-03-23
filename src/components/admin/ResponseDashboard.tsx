import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Users, FileText, ChevronLeft, ChevronRight, Download, Search, CheckCircle, Clock, FolderOpen, XCircle, BarChart2, ThumbsUp, ThumbsDown, Minus, Activity } from 'lucide-react';
import { apiClient, ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

interface AdminPerformance {
  adminId: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
  metrics: {
    totalFormsProcessed: number;
    formsApproved: number;
    formsRejected: number;
    pendingForms: number;
    formsSubmitted: number;
    personallySubmitted: number;
    averageResponseTime: number;
    lastActive: string | null;
    lastActiveDate: string | null;
    lastActiveTime: string | null;
    totalCustomersAssigned: number;
    activeHours?: number;
    activeDurationMinutes?: number;
    sessionCount?: number;
    avgSessionDuration?: number;
  };
  recentActivity: Activity[];
  formsByUser?: {
    userId: string;
    userName: string;
    userEmail: string;
    formCount: number;
    forms: Array<{
      formId: string;
      formTitle: string;
      submittedAt: string;
      status: string;
    }>;
  }[];
}

interface Activity {
  id: string;
  type: 'approve' | 'reject' | 'review' | 'assign';
  formId: string;
  formName: string;
  customerName: string;
  timestamp: string;
  createdAt?: string;
  durationMinutes?: number;
}

interface ResponseDetails {
  totalResponses: number;
  statusBreakdown: { pending: number; verified: number; rejected: number };
  yesNoNA: { yes: number; no: number; na: number };
  formBreakdown: {
    formId: string;
    formTitle: string;
    yes: number;
    no: number;
    na: number;
    responseCount: number;
    avgTimeSpent?: number; // In seconds
    totalTimeSpent?: number; // In seconds
    sessionCount?: number;
  }[];
  personalSubmissions?: {
    id: string;
    formTitle: string;
    submittedAt: string;
    status: string;
  }[];
}

interface DateRange {
  start: string;
  end: string;
}

// ─── Enhanced Donut Chart Component ───────────────────────────────────────────
function DonutChart({ yes, no, na, showLabels = true }: { yes: number; no: number; na: number; showLabels?: boolean }) {
  const total = yes + no + na;
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48">
        <div className="w-32 h-32 rounded-full border-8 border-gray-200 dark:border-gray-600 flex items-center justify-center">
          <span className="text-xs text-gray-400 dark:text-gray-500 text-center">No data</span>
        </div>
      </div>
    );
  }

  const radius = 60;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { value: yes, color: '#22c55e', label: 'Yes' },
    { value: no, color: '#ef4444', label: 'No' },
    { value: na, color: '#94a3b8', label: 'N/A' },
  ].filter(s => s.value > 0);

  let offset = 0;
  const paths = segments.map((seg) => {
    const pct = seg.value / total;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const rotation = (offset / total) * 360 - 90;
    offset += seg.value;
    return { ...seg, dash, gap, rotation };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width="160" height="160" viewBox="0 0 160 160">
          {paths.map((seg, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="22"
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={0}
              transform={`rotate(${seg.rotation} ${cx} ${cy})`}
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          ))}
          {/* center hole */}
          <circle cx={cx} cy={cy} r={40} fill="white" className="dark:fill-gray-800" />
          <text x={cx} y={cy - 6} textAnchor="middle" className="fill-gray-700 dark:fill-gray-200" fontSize="18" fontWeight="700">{total}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" className="fill-gray-400" fontSize="10">answers</text>
        </svg>
      </div>
      {showLabels && (
        <div className="flex items-center gap-6 flex-wrap justify-center">
          {[
            { color: '#22c55e', label: 'Yes', value: yes },
            { color: '#ef4444', label: 'No', value: no },
            { color: '#94a3b8', label: 'N/A', value: na },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm text-gray-600 dark:text-gray-400">{item.label}</span>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{item.value}</span>
              <span className="text-xs text-gray-400">({total > 0 ? Math.round((item.value / total) * 100) : 0}%)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── Main Component ───────────────────────────────────────────────────────────
export default function ResponseDashboard() {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const [loading, setLoading] = useState(false);
  const [adminPerformances, setAdminPerformances] = useState<AdminPerformance[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminPerformance | null>(null);
  const [responseDetails, setResponseDetails] = useState<ResponseDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [totalTenantForms, setTotalTenantForms] = useState(0);
  const [totalTenantSubmissions, setTotalTenantSubmissions] = useState(0);
  const [userWiseSubmissions, setUserWiseSubmissions] = useState<{ userId: string | null; userName: string; userEmail: string; count: number; forms?: any[] }[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalStats, setTotalStats] = useState({
    totalAdmins: 0,
    totalFormsProcessed: 0,
    activeAdmins: 0,
    avgResponseTime: 0,
    totalTenantForms: 0,
    totalTenantSubmissions: 0,
    totalActiveHours: 0,
  });

  const [unassignedResponses, setUnassignedResponses] = useState<any[]>([]);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedResponses, setSelectedResponses] = useState<string[]>([]);
  const [availableAdmins, setAvailableAdmins] = useState<any[]>([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const fetchUnassignedResponses = useCallback(async () => {
    if (!tenant?._id) return;

    setLoadingUnassigned(true);
    try {
      const result = await apiClient.getUnassignedResponses({
        tenantId: tenant._id,
        startDate: dateRange.start,
        endDate: dateRange.end,
        limit: 20
      });
      setUnassignedResponses(result.responses || []);
    } catch (error) {
      console.error('Error fetching unassigned responses:', error);
    } finally {
      setLoadingUnassigned(false);
    }
  }, [tenant, dateRange]);

  const fetchAvailableAdmins = useCallback(async () => {
    if (!tenant?._id) return;

    try {
      const result = await apiClient.getUsers({
        tenantId: tenant._id,
        role: 'admin,subadmin'
      });
      setAvailableAdmins(result.users || []);
    } catch (error) {
      console.error('Error fetching available admins:', error);
    }
  }, [tenant]);

  const handleAutoAssign = async (responseId: string) => {
    if (!tenant?._id) return;

    try {
      await apiClient.autoAssignResponse(responseId, {
        tenantId: tenant._id
      });
      // Refresh data
      await Promise.all([fetchUnassignedResponses(), loadAdminPerformances()]);
      showSuccess('Response assigned automatically');
    } catch (error) {
      showError('Failed to auto-assign response');
    }
  };

  const handleBulkAssign = async (adminId: string) => {
    if (selectedResponses.length === 0) return;

    try {
      await apiClient.assignResponses({
        responseIds: selectedResponses,
        adminId
      });
      setSelectedResponses([]);
      setShowAssignmentModal(false);
      await Promise.all([fetchUnassignedResponses(), loadAdminPerformances()]);
      showSuccess(`${selectedResponses.length} responses assigned successfully`);
    } catch (error) {
      showError('Failed to assign responses');
    }
  };

  // Call these in useEffect
  useEffect(() => {
    if (tenant?._id) {
      fetchUnassignedResponses();
      fetchAvailableAdmins();
    }
  }, [tenant, dateRange, fetchUnassignedResponses, fetchAvailableAdmins]);

  // ── Fetch tenant stats ──────────────────────────────────────────────────────
  const fetchTotalTenantStats = useCallback(async () => {
    if (!tenant) return { totalForms: 0, totalSubmissions: 0, userWiseSubmissions: [] };
    try {
      const statsResponse = await apiClient.getTenantSubmissionStats(tenant._id);
      const totalForms = statsResponse.totalForms || 0;
      const totalSubmissions = statsResponse.totalSubmissions || 0;
      const userWise = statsResponse.userWiseSubmissions || [];
      setTotalTenantForms(totalForms);
      setTotalTenantSubmissions(totalSubmissions);
      setUserWiseSubmissions(userWise);
      return { totalForms, totalSubmissions, userWiseSubmissions: userWise };
    } catch (error) {
      console.error('Error fetching tenant submission stats:', error);
      setTotalTenantForms(0);
      setTotalTenantSubmissions(0);
      setUserWiseSubmissions([]);
      return { totalForms: 0, totalSubmissions: 0, userWiseSubmissions: [] };
    }
  }, [tenant]);

  // ── Load admin list + per-admin performance ─────────────────────────────────
  const loadAdminPerformances = useCallback(async () => {
    if (!user || !tenant) return;
    setLoading(true);
    try {
      const tenantStats = await fetchTotalTenantStats();
      const freshUserWise = tenantStats?.userWiseSubmissions || [];
      const freshTotalForms = tenantStats?.totalForms || 0;
      const freshTotalSubmissions = tenantStats?.totalSubmissions || 0;

      // Build lookup: userId -> submission count and details
      const submissionDetailsByEmail: Record<string, { count: number; forms: any[] }> = {};
      freshUserWise.forEach((entry: any) => {
        if (entry.userEmail) {
          submissionDetailsByEmail[entry.userEmail] = {
            count: entry.count,
            forms: entry.forms || []
          };
        }
      });
      const [adminData, subadminData] = await Promise.all([
        apiClient.getUsers({ role: 'admin', tenantId: tenant._id, limit: 100 }).catch(() => ({ users: [] })),
        apiClient.getUsers({ role: 'subadmin', tenantId: tenant._id, limit: 100 }).catch(() => ({ users: [] })),
      ]);

      const allAdmins = [
        ...(Array.isArray(adminData.users) ? adminData.users : []),
        ...(Array.isArray(subadminData.users) ? subadminData.users : []),
      ];

      const performancePromises = allAdmins.map(async (adminData: any) => {
        try {
          const [performance, activity] = await Promise.all([
            apiClient.getAdminPerformance(adminData._id, { startDate: dateRange.start, endDate: dateRange.end }),
            apiClient.getAdminActivity(adminData._id, { limit: 50, startDate: dateRange.start, endDate: dateRange.end }),
          ]);

          // Get personally submitted count by matching email
          const formsPersonallySubmitted = submissionDetailsByEmail[adminData.email]?.count || 0;
          const userForms = submissionDetailsByEmail[adminData.email]?.forms || [];

          console.log(`Admin ${adminData.firstName} (${adminData.email}):`, {
            personallySubmitted: formsPersonallySubmitted,
            fromPerformance: performance.formsSubmitted
          });

          // Use active minutes from backend
          const activeDurationMinutes = performance.activeDurationMinutes || 0;
          const lastActiveTime = performance.lastActive ? new Date(performance.lastActive).toLocaleTimeString() :
            (activity.recent?.length > 0 ? new Date(activity.recent[0].timestamp).toLocaleTimeString() : null);

          return {
            adminId: adminData._id,
            firstName: adminData.firstName,
            lastName: adminData.lastName,
            email: adminData.email,
            username: adminData.username,
            role: adminData.role,
            isActive: adminData.isActive,
            metrics: {
              totalFormsProcessed: performance.totalFormsProcessed || 0,
              formsApproved: performance.formsApproved || 0,
              formsRejected: performance.formsRejected || 0,
              pendingForms: performance.pendingForms || 0,
              formsSubmitted: formsPersonallySubmitted,
              personallySubmitted: formsPersonallySubmitted,
              averageResponseTime: performance.averageResponseTime || 0,
              lastActive: performance.lastActive || null,
              lastActiveDate: performance.lastActive ? new Date(performance.lastActive).toLocaleDateString() : null,
              lastActiveTime: lastActiveTime,
              activeHours: activeDurationMinutes, // We'll rename this to activeMinutes in the interface or just treat it as minutes
              activeDurationMinutes,
              totalCustomersAssigned: performance.totalCustomersAssigned || 0,
              sessionCount: performance.sessionCount || 0,
              avgSessionDuration: performance.avgSessionDuration || 0,
            },
            recentActivity: activity.recent || [],
            formsByUser: userForms.length > 0 ? [{
              userId: adminData._id,
              userName: `${adminData.firstName} ${adminData.lastName}`,
              userEmail: adminData.email,
              formCount: formsPersonallySubmitted,
              forms: userForms
            }] : []
          };
        } catch (error) {
          console.error(`Error fetching performance for admin ${adminData._id}:`, error);
          const formsPersonallySubmitted = submissionDetailsByEmail[adminData.email]?.count || 0;
          const userForms = submissionDetailsByEmail[adminData.email]?.forms || [];

          return {
            adminId: adminData._id,
            firstName: adminData.firstName,
            lastName: adminData.lastName,
            email: adminData.email,
            username: adminData.username,
            role: adminData.role,
            isActive: adminData.isActive,
            metrics: {
              totalFormsProcessed: 0,
              formsApproved: 0,
              formsRejected: 0,
              pendingForms: 0,
              formsSubmitted: formsPersonallySubmitted,
              personallySubmitted: formsPersonallySubmitted,
              averageResponseTime: 0,
              lastActive: null,
              lastActiveDate: null,
              lastActiveTime: null,
              activeHours: 0,
              activeMinutes: 0,
              totalCustomersAssigned: 0,
            },
            recentActivity: [],
            formsByUser: userForms.length > 0 ? [{
              userId: adminData._id,
              userName: `${adminData.firstName} ${adminData.lastName}`,
              userEmail: adminData.email,
              formCount: formsPersonallySubmitted,
              forms: userForms
            }] : []
          };
        }
      });

      const results = await Promise.all(performancePromises);

      const totalFormsProcessed = results.reduce((sum, r) => sum + r.metrics.totalFormsProcessed, 0);
      const activeAdmins = results.filter(r => r.isActive).length;
      const totalActiveMinutes = results.reduce((sum, r) => sum + (r.metrics.activeDurationMinutes || 0), 0);
      const avgResponseTime = results.length > 0
        ? results.reduce((sum, r) => sum + r.metrics.averageResponseTime, 0) / results.length
        : 0;

      setTotalStats({
        totalAdmins: results.length,
        totalFormsProcessed,
        activeAdmins,
        avgResponseTime: Math.round(avgResponseTime * 10) / 10,
        totalTenantForms: freshTotalForms,
        totalTenantSubmissions: freshTotalSubmissions,
        totalActiveHours: totalActiveMinutes,
      });

      setAdminPerformances(results);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load admin performances';
      showError(message, 'Error');
    } finally {
      setLoading(false);
    }
  }, [user, tenant, dateRange, showError, fetchTotalTenantStats]);

  useEffect(() => {
    loadAdminPerformances();
  }, [loadAdminPerformances]);

  // ── Open View Details modal and load response details ──────────────────────
  const openDetails = useCallback(async (admin: AdminPerformance) => {
    setSelectedAdmin(admin);
    setResponseDetails(null);
    setDetailsLoading(true);
    try {
      const details = await apiClient.getAdminResponseDetails(admin.adminId, {
        startDate: dateRange.start,
        endDate: dateRange.end
      });
      setResponseDetails(details);
    } catch (err) {
      console.error('Failed to load response details:', err);
      // Keep responseDetails as null; modal will show a fallback message
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const closeDetails = useCallback(() => {
    setSelectedAdmin(null);
    setResponseDetails(null);
  }, []);

  // ── Filtering & pagination ──────────────────────────────────────────────────
  const filteredPerformances = adminPerformances.filter(admin =>
    `${admin.firstName} ${admin.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admin.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedPerformances = filteredPerformances.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredPerformances.length / itemsPerPage);

  const exportToCSV = () => {
    const headers = ['Admin Name', 'Email', 'Role', 'Status', 'Forms Submitted', 'Approved', 'Rejected', 'Pending', 'Avg Response Time (hrs)', 'Active Hours', 'Last Active Date', 'Last Active Time'];
    const csvData = filteredPerformances.map(a => [
      `${a.firstName} ${a.lastName}`,
      a.email,
      a.role,
      a.isActive ? 'Active' : 'Inactive',
      a.metrics.formsSubmitted,
      a.metrics.formsApproved,
      a.metrics.formsRejected,
      a.metrics.pendingForms,
      a.metrics.averageResponseTime,
      a.metrics.activeHours ? a.metrics.activeHours.toFixed(1) : '0',
      a.metrics.lastActiveDate || 'Never',
      a.metrics.lastActiveTime || '-',
    ]);

    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-performance-${tenant?.name || 'tenant'}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatResponseTime = (minutes: number) => {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.round(minutes)} mins`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} hrs`;
    return `${Math.round(minutes / 1440)} days`;
  };

  const formatActiveHours = (minutes: number) => {
    const totalMinutes = Math.round(minutes);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hrs === 0) return `${mins} mins`;
    if (mins === 0) return `${hrs} hrs`;
    return `${hrs} hrs ${mins} mins`;
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">
            Admin Performance Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Track performance metrics of administrators under {tenant?.name || 'your tenant'}
          </p>
        </div>

        {/* Stats Cards - Enhanced with Active Hours */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: 'Total Admins', value: totalStats.totalAdmins, icon: <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />, bg: 'bg-blue-100 dark:bg-blue-900/30' },
            { label: 'Active Admins', value: totalStats.activeAdmins, icon: <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />, bg: 'bg-purple-100 dark:bg-purple-900/30' },
            /*{ label: 'Avg Response Time', value: formatResponseTime(totalStats.avgResponseTime), icon: <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />, bg: 'bg-yellow-100 dark:bg-yellow-900/30' },*/
            { label: 'Total Submissions', value: totalStats.totalTenantSubmissions, icon: <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />, bg: 'bg-green-100 dark:bg-green-900/30' },
            { label: 'Total Forms', value: totalStats.totalTenantForms, icon: <FolderOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />, bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
            { label: 'Total Active Hrs', value: formatActiveHours(totalStats.totalActiveHours), icon: <Activity className="w-5 h-5 text-orange-600 dark:text-orange-400" />, bg: 'bg-orange-100 dark:bg-orange-900/30' },
          ].map((card) => (
            <div key={card.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{card.value}</p>
                </div>
                <div className={`w-10 h-10 ${card.bg} rounded-full flex items-center justify-center`}>
                  {card.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* User-wise Submissions - Enhanced with Forms Submitted Count */}
        {userWiseSubmissions.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm mb-8">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Forms Submitted by User (Actual Submitters)
            </h3>
            <div className="space-y-3">
              {userWiseSubmissions.map((u, i) => (
                <div key={i} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded-lg transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {u.userName && u.userName !== 'Unassigned'
                          ? u.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                          : '?'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.userName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{u.userEmail || 'No email'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100">{u.count}</p>
                    <p className="text-xs text-gray-400">
                      {totalStats.totalTenantSubmissions > 0
                        ? `${Math.round((u.count / totalStats.totalTenantSubmissions) * 100)}%`
                        : '0%'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date Range</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <span className="text-gray-400 text-sm">to</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              <button
                onClick={loadAdminPerformances}
                className="mt-5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
              >
                Apply Filter
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search admins…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm w-56"
                />
              </div>
              <button
                onClick={exportToCSV}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Admin Table - Enhanced with Active Hours Column */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  {['Admin', 'Role', 'Forms Submitted', /* 'Approved / Rejected'*/, /* 'Pending'*/, /* 'Avg Response',*/ 'Active Hours', 'Last Active', 'Actions'].map((h, i) => (
                    <th
                      key={h}
                      className={`px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${i === 8 ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                      <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Loading admin data…</p>
                    </td>
                  </tr>
                ) : paginatedPerformances.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center">
                      <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-500 dark:text-gray-400 text-sm">No admin data found</p>
                    </td>
                  </tr>
                ) : (
                  paginatedPerformances.map((admin) => (
                    <tr
                      key={admin.adminId}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer"
                      onClick={() => openDetails(admin)}
                    >
                      {/* Admin */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                            {admin.firstName[0]}{admin.lastName[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{admin.firstName} {admin.lastName}</p>
                              {(() => {
                                if (!admin.metrics.lastActive) return null;
                                const lastActiveDate = new Date(admin.metrics.lastActive);
                                const isLive = (Date.now() - lastActiveDate.getTime()) < 5 * 60 * 1000;
                                return isLive ? (
                                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-[10px] font-bold text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    LIVE
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            <p className="text-xs text-gray-400">{admin.email}</p>
                          </div>
                        </div>
                      </td>
                      {/* Role */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${admin.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                          {admin.role}
                        </span>
                      </td>
                      {/* Forms Submitted */}
                      <td className="px-6 py-4 text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {admin.metrics.personallySubmitted}
                      </td>
                      {/* Approved / Rejected 
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-green-600 dark:text-green-400 font-medium">{admin.metrics.formsApproved}</span>
                          <span className="text-gray-300 dark:text-gray-600">/</span>
                          <span className="text-red-600 dark:text-red-400 font-medium">{admin.metrics.formsRejected}</span>
                        </div>
                      </td>
                      */}
                      {/* Pending 
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">{admin.metrics.pendingForms}</span>
                      </td>
                      */}
                      {/* Avg Response 
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {formatResponseTime(admin.metrics.averageResponseTime)}
                      </td>
                      {/* Active Hours - New Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-orange-500" />
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {formatActiveHours(admin.metrics.activeHours || 0)}
                          </span>
                        </div>
                      </td>
                      {/* Last Active - Enhanced with time */}
                      <td className="px-6 py-4">
                        {admin.metrics.lastActive ? (
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {admin.metrics.lastActiveDate}
                            </span>
                            {admin.metrics.lastActiveTime && (
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-400">
                                  {admin.metrics.lastActiveTime}
                                </span>
                                {admin.metrics.activeDurationMinutes !== undefined && admin.metrics.activeDurationMinutes > 0 && (
                                  <span className="text-[10px] text-blue-500 font-medium">
                                    Time spent: {admin.metrics.activeDurationMinutes} mins
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Never</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); openDetails(admin); }}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <BarChart2 className="w-4 h-4" />
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filteredPerformances.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredPerformances.length)} of {filteredPerformances.length} admins
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-300">Page {currentPage} of {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Enhanced View Details Modal ─────────────────────────────────────── */}
      {selectedAdmin && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-5 flex items-center justify-between z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                  {selectedAdmin.firstName[0]}{selectedAdmin.lastName[0]}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedAdmin.firstName} {selectedAdmin.lastName}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedAdmin.email} · <span className="capitalize">{selectedAdmin.role}</span>
                    {selectedAdmin.metrics.lastActiveDate && (
                      <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                        Last active: {selectedAdmin.metrics.lastActiveDate} {selectedAdmin.metrics.lastActiveTime}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button onClick={closeDetails} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                <XCircle className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-8 space-y-8">

              {/* Performance Summary Cards - Enhanced with Active Hours */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Performance Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  {[
                    { label: 'Total Forms Submitted', value: selectedAdmin.metrics.formsSubmitted, color: 'text-blue-600 dark:text-blue-400', icon: <FileText className="w-4 h-4" /> },
                    /*{ label: 'Approved', value: selectedAdmin.metrics.formsApproved, color: 'text-green-600 dark:text-green-400', icon: <CheckCircle className="w-4 h-4" /> },
                    { label: 'Rejected', value: selectedAdmin.metrics.formsRejected, color: 'text-red-600 dark:text-red-400', icon: <XCircle className="w-4 h-4" /> },
                    { label: 'Pending', value: selectedAdmin.metrics.pendingForms, color: 'text-yellow-600 dark:text-yellow-400', icon: <Clock className="w-4 h-4" /> },*/
                    { label: 'Active mins', value: selectedAdmin.metrics.activeDurationMinutes || 0, color: 'text-orange-600 dark:text-orange-400', icon: <Activity className="w-4 h-4" /> },
                    { 
                      label: 'Last Submission', 
                      value: selectedAdmin.formsByUser?.[0]?.forms?.[0]?.submittedAt 
                        ? new Date(selectedAdmin.formsByUser[0].forms[0].submittedAt).toLocaleString() 
                        : 'No submissions', 
                      color: 'text-green-500 dark:text-green-400 text-sm', 
                      icon: <Clock className="w-4 h-4" /> 
                    }
                  ].map((stat) => (
                    <div key={stat.label} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-gray-500 dark:text-gray-400 mb-1">
                        {stat.icon}
                        <p className="text-xs">{stat.label}</p>
                      </div>
                      <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Forms Submitted by this User 
              {selectedAdmin.formsByUser && selectedAdmin.formsByUser.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Forms Submitted by {selectedAdmin.firstName}
                  </h3>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {selectedAdmin.metrics.formsSubmitted} Total Forms Submitted
                    </p>
                    {selectedAdmin.formsByUser[0]?.forms && selectedAdmin.formsByUser[0].forms.length > 0 && (
                      <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                        Latest submission: {new Date(selectedAdmin.formsByUser[0].forms[0].submittedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              )}
                */}

              {/* Response Details from API */}
              {detailsLoading ? (
                <div className="flex flex-col items-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-sm text-gray-400 mt-2">Loading response details…</p>
                </div>
              ) : responseDetails ? (
                <>
                  {/* Status Breakdown */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Response Status Breakdown</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Total Responses', value: responseDetails.totalResponses, icon: <FileText className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
                        /* { label: 'Verified', value: responseDetails.statusBreakdown.verified, icon: <CheckCircle className="w-5 h-5 text-green-500" />, bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' },
                         { label: 'Rejected', value: responseDetails.statusBreakdown.rejected, icon: <XCircle className="w-5 h-5 text-red-500" />, bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },*/
                      ].map((item) => (
                        <div key={item.label} className={`${item.bg} border ${item.border} rounded-xl p-4 flex items-center gap-3`}>
                          <div className="flex-shrink-0">{item.icon}</div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{item.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Pending separately 
                    <div className="mt-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 flex items-center gap-3">
                      <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Pending Review</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{responseDetails.statusBreakdown.pending}</p>
                      </div>
                    </div>
                    */}
                  </div>


                  {/* Yes / No / N/A Chart */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6">Yes / No / N/A Answer Distribution</h3>
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                      <DonutChart
                        yes={responseDetails.yesNoNA.yes}
                        no={responseDetails.yesNoNA.no}
                        na={responseDetails.yesNoNA.na}
                      />

                      {/* Bar breakdown */}
                      {(responseDetails.yesNoNA.yes + responseDetails.yesNoNA.no + responseDetails.yesNoNA.na) > 0 && (
                        <div className="mt-6 space-y-3">
                          {[
                            { label: 'Yes', value: responseDetails.yesNoNA.yes, color: 'bg-green-500', icon: <ThumbsUp className="w-4 h-4 text-green-600" /> },
                            { label: 'No', value: responseDetails.yesNoNA.no, color: 'bg-red-500', icon: <ThumbsDown className="w-4 h-4 text-red-600" /> },
                            { label: 'N/A', value: responseDetails.yesNoNA.na, color: 'bg-slate-400', icon: <Minus className="w-4 h-4 text-slate-500" /> },
                          ].map((item) => {
                            const total = responseDetails.yesNoNA.yes + responseDetails.yesNoNA.no + responseDetails.yesNoNA.na;
                            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                            return (
                              <div key={item.label} className="flex items-center gap-3">
                                {item.icon}
                                <span className="text-sm w-8 text-gray-600 dark:text-gray-400">{item.label}</span>
                                <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 overflow-hidden">
                                  <div
                                    className={`h-2.5 rounded-full ${item.color} transition-all duration-700`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 w-8 text-right">{item.value}</span>
                                <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Per-Form Breakdown */}
                  {responseDetails.formBreakdown.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Per-Form Breakdown</h3>
                      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                              {['Form', 'Yes', 'No', 'N/A', 'Responses', 'Total time', 'Detail'].map(h => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {responseDetails.formBreakdown.map((row) => (
                              <tr key={row.formId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate" title={row.formTitle}>
                                  {row.formTitle}
                                </td>
                                <td className="px-4 py-3 text-green-600 dark:text-green-400 font-semibold">{row.yes}</td>
                                <td className="px-4 py-3 text-red-600 dark:text-red-400 font-semibold">{row.no}</td>
                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-semibold">{row.na}</td>
                                <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-bold">{row.responseCount}</td>
                                <td className="px-4 py-3 text-blue-600 dark:text-blue-400 font-medium">
                                  {row.totalTimeSpent ? (row.totalTimeSpent > 60 ? `${Math.floor(row.totalTimeSpent / 60)}m ${row.totalTimeSpent % 60}s` : `${row.totalTimeSpent}s`) : '-'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => navigate(`/forms/${row.formId}/analytics?view=responses`)}
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded-md transition-colors"
                                  >
                                    <BarChart2 className="w-3.5 h-3.5" />
                                    View
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Personal Submissions List 
                  {responseDetails.personalSubmissions && responseDetails.personalSubmissions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Recent Personal Submissions</h3>
                      <div className="space-y-3">
                        {responseDetails.personalSubmissions.map((sub) => (
                          <div key={sub.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-100 dark:border-gray-700/50">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{sub.formTitle}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(sub.submittedAt).toLocaleDateString()} at {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              sub.status === 'verified' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              sub.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                              {sub.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                    */}
                </>
              ) : (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-5 text-sm text-yellow-700 dark:text-yellow-300">
                  No response details available for this admin. They may not have any responses assigned or verified yet.
                </div>
              )}

              {/* Recent Activity 
              {selectedAdmin.recentActivity.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Recent Activity</h3>
                  <div className="space-y-2">
                    {selectedAdmin.recentActivity.map((activity, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${activity.type === 'approve' ? 'bg-green-100 dark:bg-green-900/30' : activity.type === 'reject' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
                          {activity.type === 'approve' && <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />}
                          {activity.type === 'reject' && <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />}
                          {activity.type === 'review' && <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {activity.type === 'approve' ? 'Approved' : activity.type === 'reject' ? 'Rejected' : 'Reviewed'}{' '}
                            <span className="text-gray-500 dark:text-gray-400 font-normal">form for</span>{' '}
                            {activity.customerName}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {activity.formName} · {new Date(activity.timestamp).toLocaleString()}
                            {activity.durationMinutes && activity.durationMinutes > 0 ? (
                              <span className="ml-2 font-semibold text-blue-500">
                                · Time taken: {activity.durationMinutes} mins
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                */}
              {/* Pending Assignments Section */}
              {unassignedResponses.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-orange-200 dark:border-orange-800 p-6 mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-500" />
                        Pending Assignments ({unassignedResponses.length})
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        These responses need to be assigned to an admin
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedResponses(unassignedResponses.map(r => r.id));
                          setShowAssignmentModal(true);
                        }}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold"
                      >
                        Assign All
                      </button>
                      <button
                        onClick={fetchUnassignedResponses}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  {loadingUnassigned ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {unassignedResponses.map((response: any) => (
                        <div
                          key={response.id}
                          className={`flex items-center justify-between p-4 rounded-lg border ${selectedResponses.includes(response.id)
                              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
                              : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedResponses.includes(response.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedResponses([...selectedResponses, response.id]);
                                } else {
                                  setSelectedResponses(selectedResponses.filter(id => id !== response.id));
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {response.submittedBy || 'Anonymous'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(response.createdAt).toLocaleString()}
                              </p>
                              {response.submitterContact?.email && (
                                <p className="text-xs text-gray-400">
                                  {response.submitterContact.email}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleAutoAssign(response.id)}
                            className="text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition"
                          >
                            Auto-assign
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedResponses.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedResponses.length} response{selectedResponses.length > 1 ? 's' : ''} selected
                      </span>
                      <button
                        onClick={() => setShowAssignmentModal(true)}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-semibold"
                      >
                        Assign Selected
                      </button>
                    </div>
                  )}
                </div>
              )}


            </div>
          </div>
        </div>
      )}
      {/* Assignment Modal */}
      {showAssignmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Assign {selectedResponses.length} Response{selectedResponses.length > 1 ? 's' : ''}
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Select an admin to assign these responses to:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto mb-6">
              {availableAdmins.map((admin) => (
                <button
                  key={admin._id}
                  onClick={() => handleBulkAssign(admin._id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                    {admin.firstName?.[0]}{admin.lastName?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {admin.firstName} {admin.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{admin.email}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAssignmentModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}