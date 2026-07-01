import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Users, FileText, ChevronLeft, ChevronRight, Download, Search, BarChart2, Activity, X } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useNotification } from '../../context/NotificationContext';

import XLSXStyle from 'xlsx-js-style';




interface SuperAdminUserPerformance {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    username: string;
    role: string;
    isActive: boolean;
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    metrics: {
        formsSubmitted: number;
        personallySubmitted: number;
        activeHours: number;
        activeDurationMinutes?: number;
        lastActive: string | null;
        lastLogin: string | null;
        lastLogout: string | null;
    };
}

interface DateRange {
    start: string;
    end: string;
}

// ─── Helper Functions ───────────────────────────────────────────────────────────
function formatActiveHours(minutes: number): string {
    // Always treat input as minutes (the frontend passes activeDurationMinutes which is in minutes)
    const mins = Math.round(minutes);

    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;

    if (hrs === 0) return `${remainingMins} mins`;
    if (remainingMins === 0) return `${hrs} hrs`;
    return `${hrs} hrs ${remainingMins} mins`;
}

function formatLastActive(dateStr: string | null): { date: string; time: string } | null {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return {
        date: date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SuperAdminUserResponseDashboard() {
    const navigate = useNavigate();
    const { showError } = useNotification();
    const [loading, setLoading] = useState(false);
    const [userPerformances, setUserPerformances] = useState<SuperAdminUserPerformance[]>([]);
    const [dateRange, setDateRange] = useState<DateRange>({
        start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [totalStats, setTotalStats] = useState({
        totalUsers: 0,
        totalFormsSubmitted: 0,
        activeUsers: 0,
        totalActiveHours: 0,
    });
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalUsers: 0,
        hasNextPage: false,
        hasPrevPage: false,
    });

    // Selected user for details modal
    const [selectedUser, setSelectedUser] = useState<SuperAdminUserPerformance | null>(null);
    const [userResponseDetails, setUserResponseDetails] = useState<any>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);


    const [exporting, setExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState('');


    // ── Load users across all tenants ─────────────────────────────────
    const loadUserPerformances = useCallback(async () => {
        setLoading(true);
        try {
            const result = await apiClient.getAllTenantsPerformance({
                startDate: dateRange.start,
                endDate: dateRange.end,
                search: searchTerm,
                page: currentPage,
                limit: itemsPerPage,
            });

            console.log('API Response:', result);

            if (result.users) {
                // Transform the user data to handle both formats
                const transformedUsers = result.users.map((user: any) => ({
                    ...user,
                    metrics: {
                        ...user.metrics,
                        // Store both formats for flexibility
                        activeHours: user.metrics.activeDurationMinutes
                            ? user.metrics.activeDurationMinutes / 60
                            : (user.metrics.activeHours || 0),
                        activeDurationMinutes: user.metrics.activeDurationMinutes || (user.metrics.activeHours * 60) || 0
                    }
                }));
                setUserPerformances(result.users);
                setPagination(result.pagination || {
                    currentPage: 1,
                    totalPages: 1,
                    totalUsers: 0,
                    hasNextPage: false,
                    hasPrevPage: false,
                });

                // Calculate active users (active within 24 hours) for stats card
                const activeCount = transformedUsers.filter((u: SuperAdminUserPerformance) => {
                    if (!u.metrics.lastActive) return false;
                    const lastActiveDate = new Date(u.metrics.lastActive);
                    return (Date.now() - lastActiveDate.getTime()) < 24 * 60 * 60 * 1000;
                }).length;

                // Calculate total active hours from minutes
                const totalActiveMinutes = transformedUsers.reduce((sum: number, u: SuperAdminUserPerformance) => {
                    const minutes = u.metrics.activeDurationMinutes || (u.metrics.activeHours * 60) || 0;
                    return sum + minutes;
                }, 0);

                setTotalStats({
                    totalUsers: result.pagination?.totalUsers || 0,
                    totalFormsSubmitted: transformedUsers.reduce((sum: number, u: SuperAdminUserPerformance) => sum + u.metrics.formsSubmitted, 0),
                    activeUsers: activeCount,
                    totalActiveHours: totalActiveMinutes, // Store as minutes for better accuracy
                });
            }
        } catch (error) {
            console.error('Error loading user performances:', error);
            showError('Failed to load user data');
        } finally {
            setLoading(false);
        }
    }, [dateRange, searchTerm, currentPage, itemsPerPage, showError]);

    // ── Open user details modal and load response details ──────────────────────
    const openUserDetails = useCallback(async (user: SuperAdminUserPerformance) => {
        setSelectedUser(user);
        setUserResponseDetails(null);
        setDetailsLoading(true);
        try {
            const details = await apiClient.getTenantResponseDetails(user.tenantId, {
                startDate: dateRange.start,
                endDate: dateRange.end
            });
            setUserResponseDetails(details);
        } catch (err) {
            console.error('Failed to load response details:', err);
        } finally {
            setDetailsLoading(false);
        }
    }, [dateRange]);

    const closeUserDetails = useCallback(() => {
        setSelectedUser(null);
        setUserResponseDetails(null);
    }, []);

    useEffect(() => {
        loadUserPerformances();
    }, [loadUserPerformances]);

    // ── Handle search ─────────────────────────────────────────────────
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setCurrentPage(1);
        loadUserPerformances();
    };

    // ── Export to Excel with enhanced styling using xlsx ─────────────────────────────────
    const formatDateLabel = (iso: string): string => {
        const [y, m, d] = iso.split('-');
        return `${d}-${m}-${y}`;
    };

    const exportToExcel = async () => {
        if (!dateRange.start || !dateRange.end) {
            showError('Invalid date range');
            return;
        }

        const getDatesInRange = (start: string, end: string): string[] => {
            const startDate = new Date(start);
            const endDate = new Date(end);
            const dates: string[] = [];
            const current = new Date(startDate);
            while (current <= endDate) {
                dates.push(current.toISOString().split('T')[0]);
                current.setDate(current.getDate() + 1);
            }
            return dates;
        };

        const dates = getDatesInRange(dateRange.start, dateRange.end);
        if (dates.length === 0) {
            showError('No dates in range');
            return;
        }

        setExporting(true);
        setExportProgress(`Preparing to export ${dates.length} days...`);
        try {
            // Fetch in batches to avoid too many concurrent requests
            const batchSize = 5;
            const dailyResults: any[] = [];
            for (let i = 0; i < dates.length; i += batchSize) {
                const batch = dates.slice(i, i + batchSize);
                setExportProgress(`Fetching data for days ${i + 1} of ${dates.length}`);
                const batchPromises = batch.map(date =>
                    apiClient.getAllTenantsPerformance({
                        startDate: date,
                        endDate: date,
                        search: searchTerm,
                        page: 1,
                        limit: 10000,
                    })
                );
                const batchResults = await Promise.all(batchPromises);
                dailyResults.push(...batchResults);
            }

            // Build worksheet data (same as before)
            const wsData: any[][] = [];
            const STRIDE = 4; // Name | Forms | Active Hrs | Separator
            let currentRow = 0;

            for (let dayIdx = 0; dayIdx < dates.length; dayIdx++) {
                const date = dates[dayIdx];
                const result = dailyResults[dayIdx];
                if (!result.users || result.users.length === 0) continue;

                // Group by tenant
                const tenantMap = new Map<string, SuperAdminUserPerformance[]>();
                result.users.forEach((user: SuperAdminUserPerformance) => {
                    const tenant = user.tenantName || 'Unknown Tenant';
                    if (!tenantMap.has(tenant)) tenantMap.set(tenant, []);
                    tenantMap.get(tenant)!.push(user);
                });
                const groups = Array.from(tenantMap.entries());
                const numTenants = groups.length;
                const maxUsers = Math.max(...groups.map(([, u]) => u.length));

                // Date row
                const dateRow = currentRow++;
                if (!wsData[dateRow]) wsData[dateRow] = [];
                for (let i = 0; i < numTenants * STRIDE; i++) wsData[dateRow][i] = '';
                wsData[dateRow][0] = formatDateLabel(date);

                // Tenant row
                const tenantRow = currentRow++;
                if (!wsData[tenantRow]) wsData[tenantRow] = [];
                groups.forEach(([tenantName], idx) => {
                    const startCol = idx * STRIDE;
                    wsData[tenantRow][startCol] = tenantName;
                });

                // Header row
                const headerRow = currentRow++;
                if (!wsData[headerRow]) wsData[headerRow] = [];
                groups.forEach((_, idx) => {
                    const startCol = idx * STRIDE;
                    wsData[headerRow][startCol] = 'Admin Name';
                    wsData[headerRow][startCol + 1] = 'Forms';
                    wsData[headerRow][startCol + 2] = 'Active Hours';
                    wsData[headerRow][startCol + 3] = '';
                });

                // User rows
                for (let r = 0; r < maxUsers; r++) {
                    const userRow = currentRow++;
                    if (!wsData[userRow]) wsData[userRow] = [];
                    groups.forEach(([, users], idx) => {
                        const startCol = idx * STRIDE;
                        if (r < users.length) {
                            const u = users[r];
                            const activeMin = u.metrics.activeDurationMinutes ?? Math.round((u.metrics.activeHours ?? 0) * 60);
                            const hrs = Math.floor(activeMin / 60);
                            const mins = activeMin % 60;
                            const hrsLabel = hrs === 0 ? `${mins} mins` : mins === 0 ? `${hrs} hrs` : `${hrs} hrs ${mins} mins`;

                            wsData[userRow][startCol] = `${r + 1}. ${u.firstName} ${u.lastName}`;
                            wsData[userRow][startCol + 1] = u.metrics.personallySubmitted;
                            wsData[userRow][startCol + 2] = hrsLabel;
                            wsData[userRow][startCol + 3] = '';
                        } else {
                            wsData[userRow][startCol] = '';
                            wsData[userRow][startCol + 1] = '';
                            wsData[userRow][startCol + 2] = '';
                            wsData[userRow][startCol + 3] = '';
                        }
                    });
                }

                // Gap row
                const gapRow = currentRow++;
                if (!wsData[gapRow]) wsData[gapRow] = [];
                for (let i = 0; i < numTenants * STRIDE; i++) wsData[gapRow][i] = '';

                // Total row
                const totalRow = currentRow++;
                if (!wsData[totalRow]) wsData[totalRow] = [];
                groups.forEach(([, users], idx) => {
                    const startCol = idx * STRIDE;
                    const total = users.reduce((sum, u) => sum + (u.metrics.personallySubmitted ?? 0), 0);
                    wsData[totalRow][startCol] = 'Total';
                    wsData[totalRow][startCol + 1] = total;
                    wsData[totalRow][startCol + 2] = '';
                    wsData[totalRow][startCol + 3] = '';
                });

                // Blank row between days
                if (dayIdx < dates.length - 1) {
                    const blankRow = currentRow++;
                    if (!wsData[blankRow]) wsData[blankRow] = [];
                    for (let i = 0; i < numTenants * STRIDE; i++) wsData[blankRow][i] = '';
                }
            }

            if (wsData.length === 0) {
                showError('No data to export');
                return;
            }

            const ws = XLSXStyle.utils.aoa_to_sheet(wsData);
            const totalCols = Math.max(...wsData.map(row => row.length));
            const colWidths: { wch: number }[] = [];
            for (let i = 0; i < totalCols; i++) {
                if (i % STRIDE === 0) colWidths[i] = { wch: 22 };
                else if (i % STRIDE === 1) colWidths[i] = { wch: 9 };
                else if (i % STRIDE === 2) colWidths[i] = { wch: 14 };
                else colWidths[i] = { wch: 1 };
            }
            ws['!cols'] = colWidths;

            // Styling and merges
            const merges: any[] = [];
            const range = XLSXStyle.utils.decode_range(ws['!ref'] || 'A1');

            for (let row = range.s.r; row <= range.e.r; row++) {
                const firstCell = wsData[row]?.[0];
                // Date row detection (first cell matches DD-MM-YYYY)
                if (typeof firstCell === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(firstCell)) {
                    let maxCols = 0;
                    for (let r = row; r < wsData.length; r++) {
                        if (r > row && typeof wsData[r]?.[0] === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(wsData[r][0])) break;
                        maxCols = Math.max(maxCols, wsData[r]?.length || 0);
                    }
                    if (maxCols > 0) {
                        merges.push({ s: { r: row, c: 0 }, e: { r: row, c: maxCols - 1 } });
                    }
                    for (let col = 0; col < maxCols; col++) {
                        const cellRef = XLSXStyle.utils.encode_cell({ r: row, c: col });
                        if (ws[cellRef]) {
                            ws[cellRef].s = {
                                font: { bold: true, sz: 12 },
                                fill: { fgColor: { rgb: 'FFFF00' } },
                                alignment: { horizontal: 'center', vertical: 'center' },
                                border: {
                                    top: { style: 'thin' },
                                    bottom: { style: 'thin' },
                                    left: { style: 'thin' },
                                    right: { style: 'thin' },
                                },
                            };
                        }
                    }
                    continue;
                }

                // Header row detection (contains "Admin Name")
                let isHeaderRow = false;
                for (let col = 0; col < wsData[row]?.length; col++) {
                    if (wsData[row][col] === 'Admin Name') {
                        isHeaderRow = true;
                        break;
                    }
                }
                if (isHeaderRow) {
                    for (let col = 0; col < wsData[row]?.length; col++) {
                        const cellRef = XLSXStyle.utils.encode_cell({ r: row, c: col });
                        if (ws[cellRef]) {
                            ws[cellRef].s = {
                                font: { bold: true, color: { rgb: 'FFFFFF' } },
                                fill: { fgColor: { rgb: '2563EB' } },
                                alignment: { horizontal: 'center', vertical: 'center' },
                                border: {
                                    top: { style: 'thin' },
                                    bottom: { style: 'thin' },
                                    left: { style: 'thin' },
                                    right: { style: 'thin' },
                                },
                            };
                        }
                    }
                    continue;
                }

                // Total row detection (first cell is "Total")
                if (firstCell === 'Total') {
                    for (let col = 0; col < wsData[row]?.length; col++) {
                        const cellRef = XLSXStyle.utils.encode_cell({ r: row, c: col });
                        if (ws[cellRef]) {
                            ws[cellRef].s = {
                                font: { bold: true },
                                fill: { fgColor: { rgb: '92D050' } },
                                alignment: { horizontal: 'center', vertical: 'center' },
                                border: {
                                    top: { style: 'thin' },
                                    bottom: { style: 'thin' },
                                    left: { style: 'thin' },
                                    right: { style: 'thin' },
                                },
                            };
                        }
                    }
                    continue;
                }

                // Tenant row detection: first cell not empty, second cell is empty or undefined
                if (typeof firstCell === 'string' && (wsData[row]?.length === 1 || wsData[row]?.[1] === undefined || wsData[row]?.[1] === '')) {
                    const cellRef = XLSXStyle.utils.encode_cell({ r: row, c: 0 });
                    if (ws[cellRef]) {
                        ws[cellRef].s = {
                            font: { bold: false },
                        };
                    }
                    continue;
                }
            }

            ws['!merges'] = merges;

            const wb = XLSXStyle.utils.book_new();
            XLSXStyle.utils.book_append_sheet(wb, ws, 'Daily Performance');
            XLSXStyle.writeFile(wb, `daily-performance-${new Date().toISOString().split('T')[0]}.xlsx`);

        } catch (error) {
            console.error('Export failed:', error);
            showError(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setExporting(false);
            setExportProgress('');
        }
    };




    // ── Pagination ────────────────────────────────────────────────────
    const paginatedUsers = userPerformances;

    const totalPages = pagination.totalPages;

    return (
        <div className="space-y-6">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Admins</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalStats.totalUsers}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Forms Submitted</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalStats.totalFormsSubmitted}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Active (24h)</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalStats.activeUsers}</p>
                        </div>
                    </div>
                </div>

                {/* Active Hours Stats Card - Show formatted hours */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                            <Activity className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Active Hours</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {formatActiveHours(totalStats.totalActiveHours)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2.5 w-64 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
                            />
                            <span className="text-gray-400">to</span>
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
                            />
                        </div>
                        <button
                            type="submit"
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                        >
                            Filter
                        </button>
                    </form>

                    <button
                        onClick={exportToExcel}
                        disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                    >
                        {exporting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{exportProgress || 'Exporting...'}</span>
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                <span>Export CSV</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Admin Table with Tenant Column */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                                {['Admin', 'Role', 'Tenant', 'Forms Submitted', 'Active Hours', 'Login', 'Logout', 'Actions'].map((h, i) => (
                                    <th
                                        key={h}
                                        className={`px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${i === 7 ? 'text-right' : 'text-left'}`}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                                        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Loading admin data…</p>
                                    </td>
                                </tr>
                            ) : paginatedUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                                        <p className="text-gray-500 dark:text-gray-400 text-sm">No admin data found</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedUsers.map((user) => {
                                    const lastActive = formatLastActive(user.metrics.lastActive);
                                    const isActive = user.metrics.lastActive ? (Date.now() - new Date(user.metrics.lastActive).getTime()) < 24 * 60 * 60 * 1000 : false;

                                    return (
                                        <tr key={user.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                                            {/* Admin */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                        {user.firstName} {user.lastName}
                                                    </p>
                                                    {(() => {
                                                        if (!user.metrics.lastActive) return null;
                                                        const lastActiveDate = new Date(user.metrics.lastActive);
                                                        const isLive = (Date.now() - lastActiveDate.getTime()) < 5 * 60 * 1000;
                                                        return isLive ? (
                                                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-[10px] font-bold text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50 animate-pulse">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                                LIVE
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            </td>
                                            {/* Role */}
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                    {user.role}
                                                </span>
                                            </td>
                                            {/* Tenant */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.tenantName}</span>
                                                    <span className="text-xs text-gray-400">({user.tenantSlug})</span>
                                                </div>
                                            </td>
                                            {/* Forms Submitted */}
                                            <td className="px-6 py-4 text-sm font-semibold text-blue-600 dark:text-blue-400">
                                                {user.metrics.personallySubmitted}
                                            </td>
                                            {/* Active Hours */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <Activity className="w-4 h-4 text-orange-500" />
                                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                        {formatActiveHours(user.metrics.activeDurationMinutes ?? (user.metrics.activeHours * 60))}
                                                    </span>
                                                </div>
                                            </td>
                                            {/* Login Time */}
                                            <td className="px-6 py-4">
                                                {user.metrics.lastLogin ? (
                                                    <span className="text-sm text-blue-600 dark:text-blue-400">
                                                        {new Date(user.metrics.lastLogin).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                            </td>
                                            {/* Logout Time */}
                                            <td className="px-6 py-4">
                                                {user.metrics.lastLogout ? (
                                                    <span className="text-sm text-orange-600 dark:text-orange-400">
                                                        {new Date(user.metrics.lastLogout).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                            </td>
                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => openUserDetails(user)}
                                                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                                >
                                                    <BarChart2 className="w-4 h-4" />
                                                    View Details
                                                </button>
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
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Showing {((pagination.currentPage - 1) * itemsPerPage) + 1} to {Math.min(pagination.currentPage * itemsPerPage, pagination.totalUsers)} of {pagination.totalUsers} results
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={!pagination.hasPrevPage}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                                Page {pagination.currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={!pagination.hasNextPage}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* User Details Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                    {selectedUser.firstName} {selectedUser.lastName}
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {selectedUser.tenantName} • {selectedUser.role}
                                </p>
                            </div>
                            <button
                                onClick={closeUserDetails}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                            {detailsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                </div>
                            ) : userResponseDetails ? (
                                <div className="space-y-6">
                                    {/* Summary Stats */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                                            <p className="text-sm text-blue-600 dark:text-blue-400">Total Responses</p>
                                            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{userResponseDetails.totalResponses}</p>
                                        </div>
                                        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                                            <p className="text-sm text-green-600 dark:text-green-400">Verified</p>
                                            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{userResponseDetails.statusBreakdown?.verified || 0}</p>
                                        </div>
                                        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4">
                                            <p className="text-sm text-yellow-600 dark:text-yellow-400">Pending</p>
                                            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{userResponseDetails.statusBreakdown?.pending || 0}</p>
                                        </div>
                                        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                                            <p className="text-sm text-red-600 dark:text-red-400">Rejected</p>
                                            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{userResponseDetails.statusBreakdown?.rejected || 0}</p>
                                        </div>
                                    </div>

                                    {/* Forms Breakdown */}
                                    {userResponseDetails.formBreakdown && userResponseDetails.formBreakdown.length > 0 ? (
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Forms Breakdown</h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Form</th>
                                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Yes</th>
                                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">No</th>
                                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">N/A</th>
                                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Responses</th>
                                                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Avg Time</th>
                                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                                        {userResponseDetails.formBreakdown.map((row: any) => (
                                                            <tr key={row.formId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                                                                    {row.formTitle}
                                                                </td>
                                                                <td className="px-4 py-3 text-center text-sm text-green-600 dark:text-green-400 font-semibold">{row.yes}</td>
                                                                <td className="px-4 py-3 text-center text-sm text-red-600 dark:text-red-400 font-semibold">{row.no}</td>
                                                                <td className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400 font-semibold">{row.na}</td>
                                                                <td className="px-4 py-3 text-center text-sm text-gray-900 dark:text-gray-100 font-bold">{row.responseCount}</td>
                                                                <td className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                                                                    {row.avgTimeSpent ? (row.avgTimeSpent > 60 ? `${Math.floor(row.avgTimeSpent / 60)}m ${row.avgTimeSpent % 60}s` : `${row.avgTimeSpent}s`) : '-'}
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
                                    ) : (
                                        <p className="text-center text-gray-500 dark:text-gray-400 py-8">No form responses found for this tenant in the selected date range.</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No response details available.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

