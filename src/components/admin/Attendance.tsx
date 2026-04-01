import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import {
    Calendar,
    Download,
    Users,
    Clock,
    MapPin,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Activity,
    Wifi,
    WifiOff
} from "lucide-react";

interface AttendanceRecord {
    _id: string;
    userId: {
        _id: string;
        firstName: string;
        lastName: string;
        username: string;
        email: string;
        role: string;
    };
    tenantId?: {
        _id: string;
        name: string;
        companyName: string;
    };
    loginTime: string | null;
    logoutTime: string | null;
    workingHours: number;
    workingMinutes?: number; 
    isPresent: boolean;
    presentStatus: string;
    location?: {
        city?: string;
        country?: string;
        address?: string;
    };
    isActive: boolean;
    lastActiveTime: string | null;
}

interface UserAttendance {
    userId: string;
    firstName: string;
    lastName: string;
    username: string;
    role: string;
    tenantId?: {
        _id: string;
        name: string;
        companyName: string;
    };
    attendance: {
        [date: string]: AttendanceRecord;
    };
}

const formatTime = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
};

// Calculate working hours (real-time for active sessions)
const calculateWorkingHours = (loginTime: string | null, logoutTime: string | null, storedHours: number) => {
    if (loginTime && !logoutTime) {
        const loginDate = new Date(loginTime);
        const now = new Date();
        return Math.round((now.getTime() - loginDate.getTime()) / (1000 * 60 * 60) * 10) / 10;
    }
    return storedHours > 0 ? storedHours : 0;
};

// Get month details
const getMonthDetails = (year: number, month: number) => {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    return {
        year,
        month,
        daysInMonth,
        startDayOfWeek,
        monthName: firstDay.toLocaleString("default", { month: "long" })
    };
};

// Generate array of dates for the selected month
const getDatesInMonth = (year: number, month: number) => {
    const dates = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
        // Use local date to avoid timezone issues
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const date = new Date(year, month - 1, day);
        dates.push({
            date: date,
            dateString: dateStr,
            day: day,
            dayOfWeek: date.toLocaleDateString("en-US", { weekday: "short" }),
            isWeekend: date.getDay() === 0 || date.getDay() === 6,
            isToday: date.toDateString() === today.toDateString(),
            isFuture: date > today
        });
    }

    return dates;
};

export default function Attendance() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [userAttendance, setUserAttendance] = useState<UserAttendance[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [exporting, setExporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const monthDetails = getMonthDetails(year, month);
    const datesInMonth = useMemo(() => getDatesInMonth(year, month), [year, month]);


    const [hideSuperadmin, setHideSuperadmin] = useState(true);


    // Show all dates of the selected month for the UI
    const visibleDates = useMemo(() => {
        return datesInMonth;
    }, [datesInMonth]);

    const startDate = useMemo(() => {
        return new Date(year, month - 1, 1).toISOString().split("T")[0];
    }, [year, month]);

    const endDate = useMemo(() => {
        return new Date(year, month, 0).toISOString().split("T")[0];
    }, [year, month]);

    // Fetch attendance data for the month
    useEffect(() => {
        const fetchAttendance = async () => {
            setLoading(true);
            try {
                const response = await apiClient.getAttendance({
                    startDate,
                    endDate,
                    limit: 1000
                });

                if (response && response.logs) {
                    processAttendanceData(response.logs);
                }
            } catch (error) {
                console.error("Error fetching attendance:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAttendance();
    }, [startDate, endDate]);

    // Process raw attendance logs into user-based structure
    const processAttendanceData = (logs: AttendanceRecord[]) => {
        const userMap = new Map<string, UserAttendance>();

        logs.forEach((log) => {
            if (!log.userId) return;

            const userId = log.userId._id;
            // Use local date format to match visibleDates
            let loginDate: string | null = null;
            if (log.loginTime) {
                const loginDateObj = new Date(log.loginTime);
                loginDate = `${loginDateObj.getFullYear()}-${String(loginDateObj.getMonth() + 1).padStart(2, '0')}-${String(loginDateObj.getDate()).padStart(2, '0')}`;
            }

            if (!userMap.has(userId)) {
                userMap.set(userId, {
                    userId,
                    firstName: log.userId.firstName,
                    lastName: log.userId.lastName,
                    username: log.userId.username,
                    role: log.userId.role,
                    tenantId: log.tenantId ? {
                        _id: log.tenantId._id,
                        name: log.tenantId.name,
                        companyName: log.tenantId.companyName
                    } : undefined,
                    attendance: {}
                });
            }

            const user = userMap.get(userId)!;
            if (loginDate) {
                if (!user.attendance[loginDate] ||
                    calculateWorkingHours(log.loginTime, log.logoutTime, log.workingHours) >
                    calculateWorkingHours(user.attendance[loginDate].loginTime, user.attendance[loginDate].logoutTime, user.attendance[loginDate].workingHours)) {
                    user.attendance[loginDate] = log;
                }
            }
        });

        // Filter out superadmin users from the attendance table
        const filteredUsers = Array.from(userMap.values()).filter(
            user => user.role !== 'superadmin'
        );
        setUserAttendance(filteredUsers);
    };

    // Filter users based on search
    const filteredUsers = useMemo(() => {
        let users = userAttendance;

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            users = users.filter(
                u => u.firstName.toLowerCase().includes(term) ||
                    u.lastName.toLowerCase().includes(term) ||
                    u.username.toLowerCase().includes(term)
            );
        }

        // Filter out superadmins if hideSuperadmin is true
        // Superadmins can still see other superadmins if they want
        if (hideSuperadmin && user?.role !== 'superadmin') {
            users = users.filter(u => u.role !== 'superadmin');
        }

        return users;
    }, [userAttendance, searchTerm, hideSuperadmin, user?.role]);

    // Handle month navigation
    const handlePrevMonth = () => {
        setCurrentDate(new Date(year, month - 2, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month, 1));
    };

    // Generate simple Excel HTML with just P/A/Live
    const generateStyledExcelHTML = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let html = `
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Attendance - ${monthDetails.monthName} ${year}</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Arial, sans-serif;
                        margin: 20px;
                        background: white;
                    }
                    .main-header {
                        background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                        color: white;
                        padding: 20px;
                        text-align: center;
                        font-size: 24px;
                        font-weight: bold;
                        margin-bottom: 20px;
                        border-radius: 8px;
                    }
                    .sub-header {
                        text-align: center;
                        color: #6b7280;
                        margin-bottom: 15px;
                        font-size: 12px;
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        margin-top: 20px;
                    }
                    th {
                        background-color: #1f2937;
                        color: white;
                        padding: 12px 8px;
                        text-align: center;
                        border: 1px solid #374151;
                        font-size: 12px;
                        font-weight: bold;
                    }
                    td {
                        padding: 10px 8px;
                        text-align: center;
                        border: 1px solid #e5e7eb;
                        font-size: 12px;
                    }
                    .user-cell {
                        text-align: left;
                        font-weight: 500;
                        background-color: #f9fafb;
                    }
                    .role-cell {
                        text-align: center;
                    }
                    .present {
                        color: #059669;
                        font-weight: bold;
                        font-size: 14px;
                    }
                    .absent {
                        color: #dc2626;
                        font-weight: bold;
                        font-size: 14px;
                    }
                    .active {
                        color: #10b981;
                        font-weight: bold;
                        font-size: 12px;
                    }
                    .future {
                        color: #9ca3af;
                        font-size: 14px;
                    }
                    .weekend {
                        background-color: #fef2f2;
                    }
                    .today {
                        background-color: #eff6ff;
                    }
                    .summary-row {
                        background-color: #f3f4f6;
                        font-weight: bold;
                    }
                    .footer {
                        margin-top: 30px;
                        text-align: center;
                        padding: 15px;
                        background-color: #f9fafb;
                        font-size: 10px;
                        color: #6b7280;
                        border-top: 1px solid #e5e7eb;
                    }
                    .legend {
                        margin-top: 20px;
                        padding: 12px;
                        background-color: #f9fafb;
                        border: 1px solid #e5e7eb;
                        font-size: 11px;
                        display: flex;
                        gap: 20px;
                        justify-content: center;
                    }
                    .legend-item {
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                    }
                    .green-dot {
                        width: 10px;
                        height: 10px;
                        background-color: #10b981;
                        border-radius: 50%;
                        display: inline-block;
                    }
                </style>
            </head>
            <body>
                <div class="main-header">
                    📋 ${monthDetails.monthName} ${year} - Attendance Report
                </div>
                <div class="sub-header">
                    Generated on: ${new Date().toLocaleString()} | Total Employees: ${filteredUsers.length}
                </div>
        `;

        // Table
        html += `
            <table>
                <thead>
                    <tr>
                        <th style="min-width: 180px;">Employee Name</th>
                        <th style="min-width: 100px;">Role</th>
        `;

        // Add date columns
        visibleDates.forEach(d => {
            const weekendClass = d.isWeekend ? 'weekend' : '';
            html += `
                <th class="${weekendClass}" style="min-width: 60px;">
                    ${d.day}<br>
                    <span style="font-size: 10px;">${d.dayOfWeek}</span>
                </th>
            `;
        });

        // Add summary columns
        html += `
                        <th style="min-width: 70px; background-color: #059669;">P</th>
                        <th style="min-width: 70px; background-color: #dc2626;">A</th>
                        <th style="min-width: 80px;">Hours</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Data rows
        filteredUsers.forEach(user => {
            let presentCount = 0;
            let absentCount = 0;
            let totalHours = 0;

            html += `
                <tr>
                    <td class="user-cell">
                        <strong>${user.firstName} ${user.lastName}</strong><br>
                        <span style="font-size: 10px; color: #6b7280;">${user.username}</span>
                    </td>
                    <td class="role-cell">
                        <span style="background: ${user.role === 'admin' ? '#3b82f6' : user.role === 'subadmin' ? '#10b981' : '#8b5cf6'}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px;">
                            ${user.role}
                        </span>
                    </td>
            `;

            // Add attendance for each date
            visibleDates.forEach(d => {
                const record = user.attendance[d.dateString];
                const workingHours = record ? calculateWorkingHours(record.loginTime, record.logoutTime, record.workingHours) : 0;
                const isActive = record && !record.logoutTime && record.isActive;

                // For future dates, show "-"
                if (d.isFuture) {
                    html += `<td class="future">-</td>`;
                } else if (record && (record.loginTime || workingHours > 0)) {
                    if (record.loginTime) presentCount++;
                    totalHours += workingHours;

                    if (isActive) {
                        html += `<td class="active">● Live</td>`;
                    } else if (record.isPresent || workingHours > 0) {
                        html += `<td class="present">P</td>`;
                    } else {
                        absentCount++;
                        html += `<td class="absent">A</td>`;
                    }
                } else {
                    absentCount++;
                    html += `<td class="absent">A</td>`;
                }
            });

            // Add summary columns
            html += `
                    <td style="text-align: center; background-color: #d1fae5; font-weight: bold; font-size: 16px;">${presentCount}</td>
                    <td style="text-align: center; background-color: #fee2e2; font-weight: bold; font-size: 16px;">${absentCount}</td>
                    <td style="text-align: center; background-color: #eff6ff; font-weight: bold;">${Math.round(totalHours * 60)}m</td>
                </tr>
            `;
        });

        // Add totals row
        const totalPresent = filteredUsers.reduce((sum, user) => {
            return sum + Object.values(user.attendance).filter(r => r && r.loginTime).length;
        }, 0);
        const totalAbsent = filteredUsers.length * visibleDates.filter(d => !d.isFuture).length - totalPresent;
        const totalHoursAll = filteredUsers.reduce((sum, user) => {
            return sum + Object.values(user.attendance).reduce((acc, r) => acc + (r ? calculateWorkingHours(r.loginTime, r.logoutTime, r.workingHours) : 0), 0);
        }, 0);

        html += `
                    <tr class="summary-row">
                        <td colspan="2" style="text-align: right; font-weight: bold;">TOTAL:</td>
                        ${visibleDates.map(() => '<td></td>').join('')}
                        <td style="text-align: center; background-color: #d1fae5; font-weight: bold; font-size: 18px;">${totalPresent}</td>
                        <td style="text-align: center; background-color: #fee2e2; font-weight: bold; font-size: 18px;">${totalAbsent}</td>
                        <td style="text-align: center; background-color: #eff6ff; font-weight: bold; font-size: 18px;">${Math.round(totalHoursAll * 60)}m</td>
                    </tr>
                </tbody>
            </table>
        `;

        // Legend
        html += `
            <div class="legend">
                <div class="legend-item"><span class="green-dot"></span> <strong>P</strong> = Present</div>
                <div class="legend-item"><span style="color: #dc2626;">●</span> <strong>A</strong> = Absent</div>
                <div class="legend-item"><span style="color: #10b981;">●</span> <strong>Live</strong> = Currently Active</div>
                <div class="legend-item"><span style="color: #9ca3af;">-</span> = Future Date (No data)</div>
                <div class="legend-item"><span style="color: #059669;">📊</span> Minutes = Total Working Minutes</div>
            </div>
            <div class="footer">
                Attendance Report for ${monthDetails.monthName} ${year} | Generated by Attendance Management System
            </div>
            </body>
            </html>
        `;

        return html;
    };

    // Handle Export
    const handleExport = async () => {
        setExporting(true);
        try {
            const htmlContent = generateStyledExcelHTML();
            const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `attendance-${monthDetails.monthName}-${year}.xls`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export error:", error);
        } finally {
            setExporting(false);
        }
    };

    // Render date cell with detailed stats for UI (keeping original UI)
    const renderDateCell = (record: AttendanceRecord | undefined, isFuture: boolean) => {
  if (isFuture) {
    return <div className="text-gray-400 text-xs">-</div>;
  }

  if (!record || !record.loginTime) {
    return <div className="text-gray-400 text-xs">-</div>;
  }

  // Use workingMinutes if available, otherwise calculate from workingHours
  let workingMinutes = record.workingMinutes || Math.round(record.workingHours * 60);
  
  // For active sessions, calculate real-time minutes
  if (!record.logoutTime && record.isActive) {
    const loginDate = new Date(record.loginTime);
    const now = new Date();
    const isToday = loginDate.toDateString() === now.toDateString();
    
    if (isToday) {
      workingMinutes = Math.floor((now.getTime() - loginDate.getTime()) / (1000 * 60));
    }
  }

  const formatMinutes = (minutes: number): string => {
    if (!minutes || minutes <= 0) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="flex flex-col gap-0.5 p-1 text-xs">
      <div className="flex items-center gap-1">
        <span className="text-blue-600 font-medium">{formatTime(record.loginTime)}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-orange-600">{formatTime(record.logoutTime)}</span>
      </div>
      <div className="flex items-center gap-1">
        <Clock className="w-2.5 h-2.5 text-gray-400" />
        <span className="text-gray-600">{formatMinutes(workingMinutes)}</span>
      </div>
      {!record.logoutTime && record.isActive && (
        <div className="mt-0.5">
          <div className="flex items-center gap-1">
            <Wifi className="w-3 h-3 text-green-500 animate-pulse" />
            <span className="text-green-600 text-xs font-medium">Active</span>
          </div>
        </div>
      )}
    </div>
  );
};

    // Get role badge color
    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case "superadmin":
                return "bg-purple-100 text-purple-700";
            case "admin":
                return "bg-blue-100 text-blue-700";
            case "subadmin":
                return "bg-green-100 text-green-700";
            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    // For subadmins, show their own attendance only
    if (user?.role === "subadmin") {
        return <SubAdminAttendanceNew />;
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
            <div className="max-w-[95vw] mx-auto">
                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Attendance Management
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Track user login/logout times and working hours by date
                    </p>
                </div>

                {/* Month Selector and Controls */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrevMonth}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-2 min-w-[180px] justify-center">
                                <Calendar className="w-5 h-5 text-gray-400" />
                                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {monthDetails.monthName} {year}
                                </span>
                            </div>

                            <button
                                onClick={handleNextMonth}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>

                            <button
                                onClick={() => setCurrentDate(new Date())}
                                className="ml-2 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-50"
                            >
                                Current Month
                            </button>
                        </div>

                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                        >
                            {exporting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            Export Excel
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder="Search by name or username..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                            />
                            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        </div>

                        {/* Hide Superadmin Toggle Button 
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setHideSuperadmin(!hideSuperadmin)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${hideSuperadmin
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-700'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
                                    }`}
                            >
                                {hideSuperadmin ? (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Hide Superadmin
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        Show Superadmin
                                    </>
                                )}
                            </button>
                        </div>*/}
                    </div>
                </div>
                {/* Attendance Table with Date Columns */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1400px]">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700/50 z-10 min-w-[150px]">
                                            User Name
                                        </th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-[150px] bg-gray-50 dark:bg-gray-700/50 z-10 min-w-[100px]">
                                            Role
                                        </th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-[250px] bg-gray-50 dark:bg-gray-700/50 z-10 min-w-[120px]">
                                            Dealer
                                        </th>
                                        {visibleDates.map((d) => (
                                            <th
                                                key={d.dateString}
                                                className={`px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[140px] ${d.isToday ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className={d.isWeekend ? 'text-red-500' : ''}>{d.dayOfWeek}</span>
                                                    <span className={`font-bold ${d.isToday ? 'text-primary-600' : ''}`}>{d.day}/{month}</span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={visibleDates.length + 3} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                No attendance records found for this month
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((user) => (
                                            <tr key={user.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                {/* User Name Column */}
                                                <td className="px-3 py-3 sticky left-0 bg-white dark:bg-gray-800 z-10">
                                                    <div className="flex items-center">
                                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                                            <span className="text-primary-600 dark:text-primary-400 text-sm font-medium">
                                                                {user.firstName?.[0]}{user.lastName?.[0]}
                                                            </span>
                                                        </div>
                                                        <div className="ml-3">
                                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                                {user.firstName} {user.lastName}
                                                            </div>
                                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                                {user.username}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Role Column */}
                                                <td className="px-3 py-3 sticky left-[150px] bg-white dark:bg-gray-800 z-10">
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getRoleBadgeColor(user.role)}`}>
                                                        {user.role}
                                                    </span>
                                                </td>

                                                {/* Dealer Column */}
                                                <td className="px-3 py-3 sticky left-[250px] bg-white dark:bg-gray-800 z-10">
                                                    <div className="text-sm text-gray-900 dark:text-white">
                                                        {user.tenantId?.companyName || user.tenantId?.name || '-'}
                                                    </div>
                                                </td>

                                                {/* Date Columns */}
                                                {visibleDates.map((d) => {
                                                    const record = user.attendance[d.dateString];
                                                    return (
                                                        <td
                                                            key={d.dateString}
                                                            className={`px-2 py-2 text-center ${d.isToday ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}
                                                        >
                                                            {renderDateCell(record, d.isFuture)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                        <span className="font-medium">Legend:</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-blue-600 font-medium">Login Time</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-orange-600">Logout Time</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">Working Minutes</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-green-600 font-bold text-xs">P</span>
                        <span className="text-xs">Present</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Wifi className="w-3 h-3 text-green-500" />
                        <span className="text-xs">Active Now</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-400 text-xs">-</span>
                        <span className="text-xs">Future Date / No Data</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Search Icon Component
function SearchIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
    );
}

// SubAdmin View - Personal attendance history (keeping original UI)
function SubAdminAttendanceNew() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const monthDetails = getMonthDetails(year, month);
    const datesInMonth = useMemo(() => getDatesInMonth(year, month), [year, month]);

    const visibleDates = datesInMonth;
    const startDate = useMemo(() => new Date(year, month - 1, 1).toISOString().split("T")[0], [year, month]);
    const endDate = useMemo(() => new Date(year, month, 0).toISOString().split("T")[0], [year, month]);

    useEffect(() => {
        const fetchMyAttendance = async () => {
            setLoading(true);
            try {
                const response = await apiClient.getMyAttendance({
                    startDate,
                    endDate,
                    limit: 100
                });

                if (response && response.logs) {
                    setAttendanceData(response.logs);
                }
            } catch (error) {
                console.error("Error fetching attendance:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchMyAttendance();
    }, [startDate, endDate]);

    // Group by date
    const attendanceByDate = useMemo(() => {
        const map: { [date: string]: AttendanceRecord } = {};
        attendanceData.forEach(record => {
            if (record.loginTime) {
                const dateStr = new Date(record.loginTime).toISOString().split("T")[0];
                if (!map[dateStr] || calculateWorkingHours(record.loginTime, record.logoutTime, record.workingHours) >
                    calculateWorkingHours(map[dateStr].loginTime, map[dateStr].logoutTime, map[dateStr].workingHours)) {
                    map[dateStr] = record;
                }
            }
        });
        return map;
    }, [attendanceData]);

    const handlePrevMonth = () => setCurrentDate(new Date(year, month - 2, 1));
    const handleNextMonth = () => setCurrentDate(new Date(year, month, 1));

    const renderDateCell = (record: AttendanceRecord | undefined, isFuture: boolean) => {
        if (isFuture) {
            return <span className="text-gray-400 text-xs">-</span>;
        }

        if (!record || !record.loginTime) {
            return <span className="text-gray-400 text-xs">-</span>;
        }

        const workingHours = calculateWorkingHours(record.loginTime, record.logoutTime, record.workingHours);
        const isActive = !record.logoutTime && record.isActive;

        return (
            <div className="space-y-1 text-xs">
                <div className="text-blue-600">{formatTime(record.loginTime)}</div>
                <div className="text-orange-600">{formatTime(record.logoutTime)}</div>
                <div className="text-gray-500">{workingHours > 0 ? `${Math.round(workingHours * 60)}m` : '-'}</div>
                {isActive ? <span className="text-green-500">● Active</span> : record.isPresent && <span className="text-green-600 font-bold">P</span>}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Attendance</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View your login/logout times and working hours</p>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
                    <div className="flex items-center justify-center gap-4">
                        <button onClick={handlePrevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-gray-400" />
                            <span className="text-lg font-semibold text-gray-900 dark:text-white">
                                {monthDetails.monthName} {year}
                            </span>
                        </div>
                        <button onClick={handleNextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                        <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-sm font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50">
                            Current Month
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1200px]">
                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Day</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Login</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Logout</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Hours</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleDates.map((d) => {
                                        const record = attendanceByDate[d.dateString];
                                        const hours = record ? calculateWorkingHours(record.loginTime, record.logoutTime, record.workingHours) : 0;
                                        const isActive = record && !record.logoutTime && record.isActive;

                                        return (
                                            <tr key={d.dateString} className={`border-t ${d.isToday ? 'bg-primary-50' : ''}`}>
                                                <td className="px-4 py-3">{d.day}/{month}/{year}</td>
                                                <td className="px-4 py-3">{d.dayOfWeek}</td>
                                                <td className="px-4 py-3 text-blue-600">{record ? formatTime(record.loginTime) : '-'}</td>
                                                <td className="px-4 py-3 text-orange-600">{record ? formatTime(record.logoutTime) : '-'}</td>
                                                <td className="px-4 py-3">{hours > 0 ? `${Math.round(hours * 60)}m` : '-'}</td>
                                                <td className="px-4 py-3">
                                                    {isActive ? (
                                                        <span className="text-green-500 flex items-center gap-1"><Wifi className="w-3 h-3" /> Active</span>
                                                    ) : record && record.isPresent ? (
                                                        <span className="text-green-600 font-bold">P</span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-white p-4 rounded-lg border text-center">
                        <p className="text-sm text-gray-500">Total Days</p>
                        <p className="text-2xl font-bold">{visibleDates.length}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border text-center">
                        <p className="text-sm text-gray-500">Present</p>
                        <p className="text-2xl font-bold text-green-600">{Object.values(attendanceByDate).filter(r => r && r.loginTime).length}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border text-center">
                        <p className="text-sm text-gray-500">Total Hours</p>
                        <p className="text-2xl font-bold text-blue-600">
                            {Math.round(Object.values(attendanceByDate).reduce((sum, r) => sum + (r ? calculateWorkingHours(r.loginTime, r.logoutTime, r.workingHours) : 0), 0) * 60)}m
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}