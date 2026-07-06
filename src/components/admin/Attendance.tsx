import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import { ArrowLeftRight } from "lucide-react";
import {

  Calendar,
  Download,
  Users,
  Clock,
  MapPin,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ChevronFirst,
  ChevronLast,
  Loader2,
  Activity,
  Wifi,
  WifiOff,
  Building,
  X,
  Edit,
  Plus,
} from "lucide-react";

interface AttendanceRecord {
  _id: string;
  inspector?: {
    _id: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    role: string;
  };
  userId?: {
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
  loginTime?: string | null;
  logoutTime?: string | null;
  checkInTime?: string | Date | null;
  checkOutTime?: string | Date | null;
  workingHours: number;
  workingMinutes?: number;
  isPresent: boolean;
  presentStatus: string;
  status?: string;
  location?: {
    city?: string;
    country?: string;
    address?: string;
  };
  checkInPlace?: string;
  checkOutPlace?: string;
  shiftName?: string;
  isActive: boolean;
  lastActiveTime: string | null;
  date?: string | Date;
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

const formatTime = (dateString: string | null | undefined) => {
  if (!dateString) return "-";
  if (
    typeof dateString === "string" &&
    dateString.match(/^\d{1,2}:\d{2}:\d{2}\s*(am|pm)$/i)
  ) {
    return dateString;
  }
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const calculateWorkingHours = (
  loginTime: string | null | undefined,
  logoutTime: string | null | undefined,
  storedHours: number,
) => {
  if (loginTime && !logoutTime) {
    const loginDate = new Date(loginTime);
    const now = new Date();
    return (
      Math.round(
        ((now.getTime() - loginDate.getTime()) / (1000 * 60 * 60)) * 10,
      ) / 10
    );
  }
  return storedHours > 0 ? storedHours : 0;
};

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
    monthName: firstDay.toLocaleString("default", { month: "long" }),
  };
};

const getDatesInMonth = (year: number, month: number) => {
  const dates = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const date = new Date(year, month - 1, day);
    dates.push({
      date: date,
      dateString: dateStr,
      day: day,
      dayOfWeek: date.toLocaleDateString("en-US", { weekday: "short" }),
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      isToday: date.toDateString() === today.toDateString(),
      isFuture: date > today,
    });
  }
  return dates;
};

const ITEMS_PER_PAGE = 10;

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const [yyyy, mm, dd] = parts;
  return `${dd}/${mm}/${yyyy}`;
};

const getMostFrequentShift = (attendance: { [date: string]: AttendanceRecord }) => {
  if (!attendance) return "No shift";
  const counts: Record<string, number> = {};
  Object.values(attendance).forEach(rec => {
    if (rec.shiftName) {
      counts[rec.shiftName] = (counts[rec.shiftName] || 0) + 1;
    }
  });
  let maxCount = 0;
  let mostFrequent = "No shift";
  Object.entries(counts).forEach(([shift, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostFrequent = shift;
    }
  });
  return mostFrequent;
};
let tempEditId: string | null = null;


export default function Attendance() {
  const { user } = useAuth();
  const getInitialAttendance = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    const sDate = start.toISOString().split("T")[0];
    const eDate = end.toISOString().split("T")[0];
    const cacheKey = `/attendance/report?startDate=${sDate}&endDate=${eDate}`;

    const cached = apiClient.getCachedData<any>(cacheKey);
    const logs = cached?.detailedLogs || cached?.data?.detailedLogs || [];
    if (logs && logs.length > 0) {
      const userMap = new Map<string, UserAttendance>();
      const cachedInspectors = apiClient.getCachedData<any>("/attendance/inspectors") || [];
      const inspectorsList = Array.isArray(cachedInspectors) ? cachedInspectors : cachedInspectors?.data || [];
      const nameToInspector = new Map(
        inspectorsList.map((i: any) => [`${i.firstName} ${i.lastName}`.trim(), i])
      );

      logs.forEach((log: any) => {
        const userName = log.inspector;
        if (!userName) return;

        const nameParts = userName.split(" ");
        const matched = nameToInspector.get(userName.trim());
        const realUserId = matched?._id || "";

        if (!userMap.has(userName)) {
          userMap.set(userName, {
            userId: realUserId || userName,
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            username: matched?.username || "",
            role: matched?.role || "inspector",
            tenantId: log.tenant
              ? { _id: "", name: log.tenant, companyName: log.tenant }
              : undefined,
            attendance: {},
          });
        }

        const userObj = userMap.get(userName)!;
        const loginDate = log.date;

        if (loginDate) {
          userObj.attendance[loginDate] = {
            _id: log._id || "",
            userId: {
              _id: realUserId,
              firstName: nameParts[0] || "",
              lastName: nameParts.slice(1).join(" ") || "",
              username: matched?.username || "",
              email: matched?.email || "",
              role: matched?.role || "inspector",
            },
            tenantId: undefined,
            loginTime: log.checkIn,
            logoutTime: log.checkOut,
            workingHours: log.hours || 0,
            isPresent: log.status === "absent"
              ? false
              : (log.status === "present" || log.status === "late" || (log.hours || 0) > 0 || !!log.checkIn),
            presentStatus: log.status || "present",
            shiftName: log.shift || "No shift",
            checkInTime: log.checkIn,
            checkOutTime: log.checkOut,
            isActive: false,
            lastActiveTime: null,
            location: log.location ? { address: log.location } : undefined,
            date: loginDate,
          };
        }
      });

      return Array.from(userMap.values());
    }
    return [];
  };

  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const sDate = start.toISOString().split("T")[0];
  const eDate = end.toISOString().split("T")[0];
  const initialCacheKey = `/attendance/report?startDate=${sDate}&endDate=${eDate}`;

  const [loading, setLoading] = useState(() => !apiClient.getCachedData(initialCacheKey));
  const [userAttendance, setUserAttendance] = useState<UserAttendance[]>(() => getInitialAttendance());
  const [searchTerm, setSearchTerm] = useState("");
  const [hideSuperadmin, setHideSuperadmin] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedUserAttendance, setSelectedUserAttendance] = useState<UserAttendance | null>(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editStatus, setEditStatus] = useState<"present" | "absent" | "half-day">("present");
  const [editShiftName, setEditShiftName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createAttendanceDate, setCreateAttendanceDate] = useState<string | null>(null);
  const [createAttendanceUserId, setCreateAttendanceUserId] = useState<string | null>(null);
  const [createAttendanceStatus, setCreateAttendanceStatus] = useState<"present" | "absent" | "half-day">("present");
  const [createCheckIn, setCreateCheckIn] = useState("");
  const [createCheckOut, setCreateCheckOut] = useState("");
  const [createShiftName, setCreateShiftName] = useState("");
  const [creatingAttendance, setCreatingAttendance] = useState(false);

  const editingRecordIdRef = useRef<string | null>(null);
  const [saveTargetId, setSaveTargetId] = useState<string | null>(null);
  // Add this with your other state declarations
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);


  const [swapTargetDate, setSwapTargetDate] = useState("");



  // New Tab & Swapping state
  const [activeTab, setActiveTab] = useState<"attendance" | "report-response" | "calendar-grid" | "attendance-summary">("attendance");
  const [reportResponseData, setReportResponseData] = useState<any[]>([]);
  const [inspectorsList, setInspectorsList] = useState<any[]>(() => {
    const cached = apiClient.getCachedData<any>("/attendance/inspectors");
    return Array.isArray(cached) ? cached : cached?.data || [];
  });
  useEffect(() => {
    apiClient.getInspectors().then((res) => {
      const list = Array.isArray(res) ? res : res?.data || [];
      setInspectorsList(list);
    }).catch((err) => console.warn("Could not fetch inspectors:", err));
  }, []);
  const [loadingReportResponse, setLoadingReportResponse] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapSourceUser, setSwapSourceUser] = useState<any | null>(null);
  const [swapTargetUser, setSwapTargetUser] = useState("");
  const [swapDate, setSwapDate] = useState("");
  const [swapFormId, setSwapFormId] = useState("");
  const [swapQuantities, setSwapQuantities] = useState<Record<string, number>>({
    'Direct Ok': 0,
    'Rework QC Completed': 0,
    'Rework QC Pending': 0,
    'Rejected': 0
  });
  const [swapCheckedStates, setSwapCheckedStates] = useState<Record<string, boolean>>({
    'Direct Ok': false,
    'Rework QC Completed': false,
    'Rework QC Pending': false,
    'Rejected': false
  });
  const [swappingInProgress, setSwappingInProgress] = useState(false);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const startDate = useMemo(() => {
    return `${year}-${String(month).padStart(2, '0')}-01`;
  }, [year, month]);

  const endDate = useMemo(() => {
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }, [currentMonth, currentYear]);

  // ─── Status Configuration ──────────────────────────────────────────────
  const STATUS_CONFIG = [
    { key: 'Direct Ok', label: 'Direct Ok', color: 'text-green-600', bgColor: 'bg-green-50' },
    { key: 'Rework QC Completed', label: 'Rework QC Completed', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { key: 'Rework QC Pending', label: 'Rework QC Pending', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
    { key: 'Rejected', label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-50' }
  ];

  // Fetch Report Response monthly data and Inspectors list
  // ─── Fetch Report Response data ─────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "report-response") return;

    const fetchReportResponse = async () => {
      setLoadingReportResponse(true);
      try {
        console.log("🔍 [ReportResponse] Fetching data for:", { startDate, endDate });

        const response = await apiClient.getInspectorSummary({
          startDate,
          endDate
        });

        console.log("📊 [ReportResponse] Raw response:", response);

        let summaryData = [];

        // ✅ Check for different response formats
        if (response) {
          // Case 1: { summary: [...] }
          if (response.summary && Array.isArray(response.summary)) {
            summaryData = response.summary;
            console.log(`✅ Found ${summaryData.length} records in response.summary`);
          }
          // Case 2: { data: { summary: [...] } }
          else if (response.data && response.data.summary && Array.isArray(response.data.summary)) {
            summaryData = response.data.summary;
            console.log(`✅ Found ${summaryData.length} records in response.data.summary`);
          }
          // Case 3: response is the array directly
          else if (Array.isArray(response)) {
            summaryData = response;
            console.log(`✅ Found ${summaryData.length} records (direct array)`);
          }
          // Case 4: { data: [...] }
          else if (response.data && Array.isArray(response.data)) {
            summaryData = response.data;
            console.log(`✅ Found ${summaryData.length} records in response.data`);
          }
          // Case 5: Try to find any array property
          else {
            for (const key of Object.keys(response)) {
              if (Array.isArray(response[key])) {
                summaryData = response[key];
                console.log(`✅ Found ${summaryData.length} records in response.${key}`);
                break;
              }
            }
          }
        }

        console.log("📋 Final summaryData:", summaryData.length, "records");
        if (summaryData.length > 0) {
          console.log("📋 First record sample:", summaryData[0]);
        }

        setReportResponseData(summaryData);

        // Also fetch inspectors for the dropdown
        try {
          const inspectorsRes = await apiClient.getInspectors();
          console.log("👤 Inspectors response:", inspectorsRes);
          if (Array.isArray(inspectorsRes)) {
            setInspectorsList(inspectorsRes);
          } else if (inspectorsRes && (inspectorsRes as any).data) {
            setInspectorsList((inspectorsRes as any).data);
          }
        } catch (err) {
          console.warn("Could not fetch inspectors:", err);
        }

      } catch (error) {
        console.error("❌ [ReportResponse] Error fetching data:", error);
        setReportResponseData([]);
      } finally {
        setLoadingReportResponse(false);
      }
    };

    fetchReportResponse();
  }, [activeTab, startDate, endDate]);

  // Group report response data by user
  // ─── Helper: Normalize status names ─────────────────────────────────────
  const normalizeStatus = (status: string): string => {
    const s = status.toLowerCase().trim();

    // ✅ Accepted → Direct Ok
    if (s === 'accepted' || s === 'direct ok' || s === 'directok' || s === 'verified' || s === 'yes' || s === 'ok') {
      return 'Direct Ok';
    }
    // ✅ Rework Completed → Rework QC Completed
    if (s === 'rework completed' || s === 'rework accepted' || s === 'rework complete' || s === 'done') {
      return 'Rework QC Completed';
    }
    // ✅ Rework → Rework QC Pending
    if (s === 'rework' || s === 'rework pending' || s.includes('rework')) {
      return 'Rework QC Pending';
    }
    // ✅ Rejected
    if (s === 'rejected' || s === 'reject' || s === 'no' || s === 'nok' || s === 'fail' || s === 'failed') {
      return 'Rejected';
    }

    return status;
  };

  const groupedReportResponses = useMemo(() => {
    console.log("🔄 [ReportResponse] Grouping data:", reportResponseData.length, "records");

    if (!reportResponseData || reportResponseData.length === 0) {
      return [];
    }

    const userGroups: any = {};

    reportResponseData.forEach((item) => {
      const userName = item.qcInspector || item.username || 'Unknown';
      const userRole = item.role || 'inspector';
      const dateStr = item.date;
      const formTitle = item.formTitle || 'N/A';
      const statusCounts = item.statusCounts || {};
      const userId = item.userId || '';
      console.log(`📋 Processing: ${userName}, Date: ${dateStr}, Form: ${formTitle}, Statuses:`, statusCounts);

      if (!userGroups[userName]) {
        userGroups[userName] = {
          userId: userId,
          name: userName,
          username: item.username || userName,
          role: userRole,
          dealer: item.tenantName || 'N/A',
          dates: {}
        };
      }

      const user = userGroups[userName];
      if (!user.dates[dateStr]) {
        user.dates[dateStr] = [];
      }

      // ✅ Normalize status counts
      const normalizedCounts: Record<string, number> = {};
      Object.entries(statusCounts).forEach(([status, count]) => {
        const normalized = normalizeStatus(status);
        normalizedCounts[normalized] = (normalizedCounts[normalized] || 0) + count;
      });

      const existingForm = user.dates[dateStr].find(
        (f: any) => f.formTitle === formTitle
      );

      if (existingForm) {
        Object.keys(normalizedCounts).forEach(statusKey => {
          existingForm.statusCounts[statusKey] = (existingForm.statusCounts[statusKey] || 0) + normalizedCounts[statusKey];
        });
      } else {
        user.dates[dateStr].push({
          formId: item.formId || '',
          formTitle: formTitle,
          statusCounts: { ...normalizedCounts }
        });
      }
    });

    let list = Object.values(userGroups);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (u: any) =>
          u.name.toLowerCase().includes(term) ||
          u.username.toLowerCase().includes(term)
      );
    }

    console.log(`📋 [ReportResponse] Grouped into ${list.length} users`);
    return list;
  }, [reportResponseData, searchTerm]);

  const normalizeStatusForSwap = (status: string): string => {
    const s = status.toLowerCase().trim();

    // ✅ Accepted → Direct Ok
    if (s === 'accepted' || s === 'direct ok' || s === 'directok' || s === 'verified' || s === 'yes' || s === 'ok') {
      return 'Direct Ok';
    }
    // ✅ Rework Completed → Rework QC Completed
    if (s === 'rework completed' || s === 'rework accepted' || s === 'rework complete' || s === 'done') {
      return 'Rework QC Completed';
    }
    // ✅ Rework → Rework QC Pending
    if (s === 'rework' || s === 'rework pending' || s.includes('rework')) {
      return 'Rework QC Pending';
    }
    // ✅ Rejected
    if (s === 'rejected' || s === 'reject' || s === 'no' || s === 'nok' || s === 'fail' || s === 'failed') {
      return 'Rejected';
    }

    console.log(`⚠️ [SWAP] Unknown status: "${status}"`);
    return status;
  };

  // Available dates for source user
  const availableDates = useMemo(() => {
    if (!swapSourceUser) return [];
    return Object.keys(swapSourceUser.dates).sort();
  }, [swapSourceUser]);

  // Available forms on the selected date for source user
  const availableForms = useMemo(() => {
    if (!swapSourceUser || !swapDate) return [];
    const formsMap = new Map<string, string>();
    reportResponseData.forEach((item) => {
      if ((item.username === swapSourceUser.username || item.email === swapSourceUser.username) && item.date === swapDate) {
        if (item.formId && item.formTitle) {
          formsMap.set(item.formId, item.formTitle);
        }
      }
    });
    return Array.from(formsMap.entries()).map(([id, title]) => ({ id, title }));
  }, [swapSourceUser, swapDate, reportResponseData]);

  // Get dynamic available counts for status limits
  const availableCounts = useMemo(() => {
    if (!swapSourceUser || !swapDate || !swapFormId) {
      return { 'Direct Ok': 0, 'Rework QC Completed': 0, 'Rework QC Pending': 0, 'Rejected': 0 };
    }
    const userSummary = reportResponseData.find(
      (item) => (item.username === swapSourceUser.username || item.email === swapSourceUser.username) && item.date === swapDate && item.formId === swapFormId
    );
    return {
      'Direct Ok': userSummary?.statusCounts?.['Direct Ok'] || 0,
      'Rework QC Completed': userSummary?.statusCounts?.['Rework QC Completed'] || 0,
      'Rework QC Pending': userSummary?.statusCounts?.['Rework QC Pending'] || 0,
      'Rejected': userSummary?.statusCounts?.['Rejected'] || 0,
    };
  }, [swapSourceUser, swapDate, swapFormId, reportResponseData]);

  // Handlers for Swap Modal
  const handleOpenSwapModal = (user: any) => {
    console.log("🔄 [SWAP] Opening swap modal for user:", user);
    console.log("🔄 [SWAP] User data:", user);

    // ✅ Use the existing user data passed from the table
    // The user object already contains all the data we need
    const sourceUser = {
      userId: user.userId,
      name: user.name,
      username: user.username,
      role: user.role,
      dealer: user.dealer,
      dates: user.dates || {}
    };

    console.log("🔄 [SWAP] Source user data:", sourceUser);
    console.log("🔄 [SWAP] Available dates:", Object.keys(sourceUser.dates));

    setSwapSourceUser(sourceUser);

    // Set the first available date as default
    const dates = Object.keys(sourceUser.dates).sort();
    if (dates.length > 0) {
      setSwapDate(dates[0]);
    } else {
      setSwapDate("");
    }

    setSwapTargetUser("");
    setSwapTargetDate("");
    setSwapFormId("");
    setSwapQuantities({
      'Direct Ok': 0,
      'Rework QC Completed': 0,
      'Rework QC Pending': 0,
      'Rejected': 0
    });
    setSwapCheckedStates({
      'Direct Ok': false,
      'Rework QC Completed': false,
      'Rework QC Pending': false,
      'Rejected': false
    });
    setShowSwapModal(true);
  };
  const handleCloseSwapModal = () => {
    setShowSwapModal(false);
    setSwapSourceUser(null);
    setSwapTargetUser("");
    setSwapDate("");
    setSwapTargetDate("");  // ✅ Clear target date
    setSwapFormId("");
    setSwapQuantities({
      'Direct Ok': 0,
      'Rework QC Completed': 0,
      'Rework QC Pending': 0,
      'Rejected': 0
    });
    setSwapCheckedStates({
      'Direct Ok': false,
      'Rework QC Completed': false,
      'Rework QC Pending': false,
      'Rejected': false
    });
  };

  const handleConfirmSwap = async () => {
    console.log("🔄 [SWAP] Confirming swap...");
    console.log("🔄 [SWAP] Source User:", swapSourceUser);
    console.log("🔄 [SWAP] Target User ID:", swapTargetUser);
    console.log("🔄 [SWAP] Source Date:", swapDate);
    console.log("🔄 [SWAP] Target Date:", swapTargetDate);
    console.log("🔄 [SWAP] Form ID:", swapFormId);
    console.log("🔄 [SWAP] Quantities:", swapQuantities);
    console.log("🔄 [SWAP] Checked States:", swapCheckedStates);

    // Validation
    if (!swapSourceUser) {
      alert("Source user not selected");
      return;
    }

    if (!swapTargetUser) {
      alert("Please select a target user");
      return;
    }

    if (!swapDate) {
      alert("Please select a source date");
      return;
    }

    if (!swapTargetDate) {
      alert("Please select a target date");
      return;
    }

    if (!swapFormId) {
      alert("Please select a form");
      return;
    }

    // Get the actual source user ID
    const sourceUserId = swapSourceUser.userId || '';
    if (!sourceUserId) {
      alert("Source user ID not found");
      return;
    }

    // ✅ Map frontend status keys to backend field names
    const statusToBackendMap: Record<string, string> = {
      'Direct Ok': 'directOk',
      'Rework QC Completed': 'reworkCompleted',
      'Rework QC Pending': 'reworkPending',
      'Rejected': 'rejected'
    };

    // ✅ Build quantities for backend using the mapping
    const quantities: Record<string, number> = {};
    let totalQty = 0;

    Object.entries(swapCheckedStates).forEach(([statusKey, isChecked]) => {
      const backendKey = statusToBackendMap[statusKey] || statusKey;
      const qty = isChecked ? (swapQuantities[statusKey] || 0) : 0;
      quantities[backendKey] = qty;
      totalQty += qty;
      console.log(`🔄 [SWAP] ${statusKey} -> ${backendKey}: ${qty}`);
    });

    console.log("🔄 [SWAP] Final quantities for backend:", quantities);

    if (totalQty === 0) {
      alert("Please select at least one response type and enter a quantity > 0");
      return;
    }

    const payload = {
      sourceUserId: sourceUserId,
      targetUserId: swapTargetUser,
      sourceDate: swapDate,
      targetDate: swapTargetDate,
      formId: swapFormId,
      quantities: quantities
    };

    console.log("🔄 [SWAP] Sending payload:", payload);

    setSwappingInProgress(true);

    try {
      const response = await apiClient.swapResponses(payload);

      console.log("🔄 [SWAP] Response received:", response);

      if (response && response.success === true) {
        alert(response.message || "Responses swapped successfully!");
        handleCloseSwapModal();

        // Refresh the report response data
        try {
          const summaryRes = await apiClient.getInspectorSummary({
            startDate,
            endDate
          });
          console.log("🔄 [SWAP] Refreshed summary data:", summaryRes);
          if (summaryRes && summaryRes.summary) {
            setReportResponseData(summaryRes.summary);
          }
        } catch (refreshError) {
          console.warn("⚠️ [SWAP] Failed to refresh data:", refreshError);
        }
      } else {
        alert(response?.message || "Failed to swap responses");
      }
    } catch (error: any) {
      console.error("❌ [SWAP] Error caught:", error);
      console.error("❌ [SWAP] Error message:", error.message);
      alert(error?.message || "Failed to swap responses. Please try again.");
    } finally {
      setSwappingInProgress(false);
    }
  };




  // Generate month details for headings and export filename
  const monthDetails = useMemo(() => {
    const firstDay = new Date(year, currentMonth, 1);
    return {
      monthName: firstDay.toLocaleString("default", { month: "long" }),
      year: year,
    };
  }, [currentMonth, year]);

  // Compute dates to display for current month
  const visibleDates = useMemo(() => {
    const dates = [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, currentMonth, d);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dates.push({
        date,
        dateString: dateStr,
        day: d,
        dayOfWeek: date.toLocaleDateString("en-US", { weekday: "short" }),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isToday: date.toDateString() === today.toDateString(),
        isFuture: date > today,
      });
    }
    return dates;
  }, [year, currentMonth, month]);

  // Fetch attendance data using HR report endpoint
  useEffect(() => {
    const fetchAttendance = async () => {
      const cacheKey = `/attendance/report?startDate=${startDate}&endDate=${endDate}`;
      if (apiClient.isCacheFresh(cacheKey, 30)) {
        setLoading(false);
        return;
      }

      const hasCache = apiClient.getCachedData(cacheKey) !== null;
      if (!hasCache) {
        setLoading(true);
      }
      try {
        console.log(
          "Fetching HR attendance report from",
          startDate,
          "to",
          endDate,
        );
        const response = await apiClient.getHRAttendanceReport({
          startDate,
          endDate,
          forceNetwork: true,
        });

        console.log("HR Report full response:", response);
        console.log("HR Report keys:", Object.keys(response || {}));

        // API client returns data directly, check various formats
        const logs =
          response?.detailedLogs || response?.data?.detailedLogs || [];
        if (logs && logs.length > 0) {
          console.log("HR Report detailedLogs count:", logs.length);
          console.log("Sample log:", logs[0]);
          processAttendanceData(logs);
        } else {
          console.log(
            "No logs found. Response structure:",
            JSON.stringify(response).substring(0, 500),
          );
          setUserAttendance([]);
        }
      } catch (error: any) {
        console.error("Error fetching attendance:", error?.message || error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [startDate, endDate]);

  // Process raw attendance logs into user-based structure (HR Report format)
  // Process raw attendance logs into user-based structure (HR Report format)
  const processAttendanceData = (logs: any[]) => {
    const userMap = new Map<string, UserAttendance>();

    // build a lookup: "FirstName LastName" -> real inspector doc
    const nameToInspector = new Map(
      inspectorsList.map((i: any) => [`${i.firstName} ${i.lastName}`.trim(), i])
    );

    logs.forEach((log) => {
      // HR Report format: inspector is a string "FirstName LastName"
      const userName = log.inspector;
      if (!userName) return;

      const nameParts = userName.split(" ");
      const matched = nameToInspector.get(userName.trim());
      const realUserId = matched?._id || "";

      if (!userMap.has(userName)) {
        userMap.set(userName, {
          userId: realUserId || userName, // prefer real ID, fall back to name as key
          firstName: nameParts[0] || "",
          lastName: nameParts.slice(1).join(" ") || "",
          username: matched?.username || "",
          role: matched?.role || "inspector",
          tenantId: log.tenant
            ? { _id: "", name: log.tenant, companyName: log.tenant }
            : undefined,
          attendance: {},
        });
      }

      const user = userMap.get(userName)!;
      const loginDate = log.date; // Already in YYYY-MM-DD format

      if (loginDate) {
        user.attendance[loginDate] = {
          _id: log._id || "",
          userId: {
            _id: realUserId,
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            username: matched?.username || "",
            email: matched?.email || "",
            role: matched?.role || "inspector",
          },
          tenantId: undefined,
          loginTime:
            typeof log.checkIn === "string"
              ? log.checkIn
              : log.checkIn
                ? log.checkIn.toISOString()
                : null,
          logoutTime:
            typeof log.checkOut === "string"
              ? log.checkOut
              : log.checkOut
                ? log.checkOut.toISOString()
                : null,
          workingHours: log.hours || 0,
          isPresent: log.status === "absent"
            ? false                                   // explicit absent always wins
            : (log.status === "present" || log.status === "late" || (log.hours || 0) > 0 || !!log.checkIn),
          presentStatus: log.status || "present",
          shiftName: log.shift || "No shift",
          checkInTime: typeof log.checkIn === "string" ? log.checkIn : log.checkIn ? log.checkIn.toISOString() : null,
          checkOutTime: typeof log.checkOut === "string" ? log.checkOut : log.checkOut ? log.checkOut.toISOString() : null,
          isActive: false,
          lastActiveTime: null,
          location: log.location ? { address: log.location } : undefined,
          date: loginDate,
        };
      }
    });

    console.log("Processed attendance data:", userMap.size, "users");
    setUserAttendance(Array.from(userMap.values()));  // ← this was missing entirely
  };

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    let users = userAttendance;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      users = users.filter(
        (u) =>
          u.firstName.toLowerCase().includes(term) ||
          u.lastName.toLowerCase().includes(term) ||
          u.username.toLowerCase().includes(term),
      );
    }

    // Filter out superadmins if hideSuperadmin is true
    // Superadmins can still see other superadmins if they want
    if (hideSuperadmin && user?.role !== "superadmin") {
      users = users.filter((u) => u.role !== "superadmin");
    }

    return users;
  }, [userAttendance, searchTerm, hideSuperadmin, user?.role]);

  // Paginated users
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);

  const grandTotals = useMemo(() => {
    let totalPresent = 0;
    let totalHalfDay = 0;
    let totalAbsent = 0;
    let totalHoursDecimal = 0;

    filteredUsers.forEach((user) => {
      visibleDates.forEach((d) => {
        const record = user.attendance?.[d.dateString];
        if (record) {
          if (record.isPresent) {
            if (record.presentStatus === "half-day" || record.presentStatus === "halfday") {
              totalHalfDay += 1;
            } else {
              totalPresent += 1;
            }
          } else {
            if (record.presentStatus !== "weekly-off" && record.presentStatus !== "weekly_off") {
              totalAbsent += 1;
            }
          }
        }
      });

      Object.values(user.attendance || {}).forEach((rec) => {
        totalHoursDecimal += rec.workingHours || 0;
      });
    });

    const wholeHours = Math.floor(totalHoursDecimal);
    const minutes = Math.round((totalHoursDecimal - wholeHours) * 60);
    const formattedHours = `${wholeHours}h ${minutes}m`;

    return {
      present: totalPresent,
      halfDay: totalHalfDay,
      absent: totalAbsent,
      hours: formattedHours
    };
  }, [filteredUsers, visibleDates]);

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
    visibleDates.forEach((d) => {
      const weekendClass = d.isWeekend ? "weekend" : "";
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
    filteredUsers.forEach((user) => {
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
                        <span style="background: ${user.role === "admin" ? "#3b82f6" : user.role === "subadmin" ? "#10b981" : "#8b5cf6"}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px;">
                            ${user.role}
                        </span>
                    </td>
            `;

      // Add attendance for each date
      visibleDates.forEach((d) => {
        const record = user.attendance[d.dateString];
        const workingHours = record
          ? calculateWorkingHours(
            record.loginTime,
            record.logoutTime,
            record.workingHours,
          )
          : 0;
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
      return (
        sum +
        Object.values(user.attendance).filter((r) => r && r.loginTime).length
      );
    }, 0);
    const totalAbsent =
      filteredUsers.length * visibleDates.filter((d) => !d.isFuture).length -
      totalPresent;
    const totalHoursAll = filteredUsers.reduce((sum, user) => {
      return (
        sum +
        Object.values(user.attendance).reduce(
          (acc, r) =>
            acc +
            (r
              ? calculateWorkingHours(r.loginTime, r.logoutTime, r.workingHours)
              : 0),
          0,
        )
      );
    }, 0);

    html += `
                    <tr class="summary-row">
                        <td colspan="2" style="text-align: right; font-weight: bold;">TOTAL:</td>
                        ${visibleDates.map(() => "<td></td>").join("")}
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
      const blob = new Blob([htmlContent], {
        type: "application/vnd.ms-excel",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `attendance-${monthDetails.monthName}-${year}.xls`,
      );
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

  // ─── Status / Shift / Location resolver ───────────────────────────────────────
  const resolveDateCellData = (record: AttendanceRecord | undefined) => {
    if (!record || !record.loginTime) return { status: "Absent", dayType: "Full Day", shift: "No shift", location: "No location", hours: "-", checkIn: null, checkOut: null };

    const status = record.isPresent ? "Present" : "Absent";
    const dayType = "Full Day";
    const hours = record.workingHours > 0 ? `${Math.round(record.workingHours * 60)}m` : "-";

    return {
      status,
      dayType,
      shift: record.shiftName || "No shift",
      location: record.checkInPlace || "No location",
      hours,
      checkIn: record.loginTime,
      checkOut: record.logoutTime
    };
  };

  // Render date cell with Table 1 format: Status | Day Type | Shift | Location | Hours
  const renderDateCell = (
    record: AttendanceRecord | undefined,
    isFuture: boolean,
    userId?: string,
    dateString?: string,
  ) => {
    if (isFuture) {
      return (
        <div className="text-gray-400 text-xs relative">
          {canEditAttendanceTime && userId && dateString && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCreateClick(userId, dateString);
              }}
              className="absolute top-0 right-0 p-1 text-gray-400 hover:text-primary-600 rounded"
              title="Add attendance"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
          <span>-</span>
        </div>
      );
    }

    if (!record || !record.loginTime) {
      return (
        <div className="text-gray-400 text-xs relative">
          {canEditAttendanceTime && userId && dateString && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCreateClick(userId, dateString);
              }}
              className="absolute top-0 right-15.5 p-1 text-gray-400 hover:text-primary-600 rounded align-center"
              title="Add attendance"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
      );
    }
    const resolved = resolveDateCellData(record);
    const isAbsent = resolved.status === "Absent";

    return (
      <div className="flex flex-col gap-0.5 p-1 text-xs relative">
        {canEditAttendanceTime && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditClick(record);
            }}
            className="absolute top-0 right-0 p-1 text-gray-400 hover:text-primary-600 rounded"
            title="Edit attendance time"
          >
            <Edit className="w-3 h-3" />
          </button>
        )}
        <div className="text-left space-y-0.5">
          <div className="flex items-center gap-1">
            <span className={`font-bold ${record.isPresent ? "text-green-600" : "text-red-600"}`}>
              {resolved.status}
            </span>
          </div>

          {/* Only show shift + times + hours when NOT absent */}
          {!isAbsent && (
            <>
              <div className="text-[10px] text-gray-500">
                {resolved.dayType} | {resolved.shift}
              </div>
              <div className="text-[10px] text-gray-500 flex flex-col">
                <span>In: {formatTime(resolved.checkIn)}</span>
                <span>Out: {resolved.checkOut ? formatTime(resolved.checkOut) : "--"}</span>
              </div>
              <div className="text-[10px] font-semibold text-gray-700">
                {record.workingHours > 0 ? `${record.workingHours}h` : "-"}
              </div>
            </>
          )}
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

  // Check if user can edit attendance time
  const canEditAttendanceTime = user?.role === 'admin' && user?.granularPermissions?.canEditAttendanceTime === true;

  const handleEditClick = (record: AttendanceRecord) => {
    if (!canEditAttendanceTime) return;

    console.log("📝 [Edit] Opening edit for record:", record);

    // Extract date
    let recordDate = '';
    if (record.date instanceof Date) {
      recordDate = record.date.toISOString().split('T')[0];   // same bug
    } else if (typeof record.date === 'string') {
      recordDate = record.date;
    } else if (record.loginTime) {
      const date = new Date(record.loginTime);
      recordDate = date.toISOString().split('T')[0];
    }

    // Get userId
    let userId = '';
    if (record.userId?._id) userId = record.userId._id;
    else if (record.inspector?._id) userId = record.inspector._id;

    const formatToDateTimeLocal = (timeStr: string | null | undefined) => {
      if (!timeStr) return `${recordDate}T09:00`;
      const matches = String(timeStr).match(/(\d{1,2}):(\d{2})/);
      if (matches) {
        const hours = matches[1].padStart(2, '0');
        return `${recordDate}T${hours}:${matches[2]}`;
      }
      return "";
    };

    // ✅ Store ALL data in state
    setEditingId(record._id || null);
    setEditingDate(recordDate || null);
    setEditingUserId(userId || null);

    // Store in localStorage as backup
    const editData = {
      id: record._id || '',
      date: recordDate || '',
      userId: userId || '',
      checkIn: formatToDateTimeLocal(record.loginTime),
      checkOut: formatToDateTimeLocal(record.logoutTime),
      status: record.isPresent ? "present" : "absent",
      shift: record.shiftName || "",
    };
    localStorage.setItem('edit_attendance_data', JSON.stringify(editData));

    setEditingRecord(record);
    setEditCheckIn(editData.checkIn);
    setEditCheckOut(editData.checkOut);
    setEditStatus(editData.status as "present" | "absent" | "half-day");
    setEditShiftName(editData.shift);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingRecord(null);
    setEditingId(null);
    setEditingDate(null);
    setEditingUserId(null);
    localStorage.removeItem('edit_attendance_data');
    setEditCheckIn("");
    setEditCheckOut("");
    setEditStatus("present");
    setEditShiftName("");
  };

  const handleCreateClick = (userId: string, dateString: string) => {
    if (!canEditAttendanceTime) return;
    localStorage.removeItem('edit_attendance_data');
    setCreateAttendanceUserId(userId);
    setCreateAttendanceDate(dateString);
    setCreateAttendanceStatus("present");
    setCreateCheckIn(`${dateString}T09:00`);
    setCreateCheckOut(`${dateString}T18:00`);
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setCreateAttendanceDate(null);
    setCreateAttendanceUserId(null);
    setCreateAttendanceStatus("present");
    setCreateCheckIn("");
    setCreateCheckOut("");
    setCreateShiftName("");
  };

  const handleCreateAttendance = async () => {
    if (!createAttendanceUserId || !createAttendanceDate) return;

    setCreatingAttendance(true);
    try {
      // Convert datetime-local values to ISO strings for API
      const checkInISO = createAttendanceStatus === "absent"
        ? null
        : (createCheckIn ? new Date(createCheckIn).toISOString() : null);
      const checkOutISO = createAttendanceStatus === "absent"
        ? null
        : (createCheckOut ? new Date(createCheckOut).toISOString() : null);

      const payload: any = {
        userId: createAttendanceUserId,
        date: createAttendanceDate,
        status: createAttendanceStatus,
      };

      // Add shift times
      if (checkInISO && checkOutISO) {
        payload.checkIn = checkInISO;
        payload.checkOut = checkOutISO;
      }

      // Add shift name
      if (createShiftName) {
        payload.shift = createShiftName;
      }

      await apiClient.createAttendance(payload);
      // alert("Attendance created successfully");
      handleCloseCreateModal();
      await fetchAttendance();
      // Refresh attendance data
      setCurrentDate(new Date(currentDate));
    } catch (error: any) {
      console.error("Error creating attendance:", error);
      alert(error.response?.message || error.message || "Failed to create attendance");
    } finally {
      setCreatingAttendance(false);
    }
  };

  // Move fetchAttendance out of useEffect so it can be called on-demand
  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getHRAttendanceReport({ startDate, endDate });
      const logs = response?.detailedLogs || response?.data?.detailedLogs || [];
      if (logs && logs.length > 0) {
        processAttendanceData(logs);
      } else {
        setUserAttendance([]);
      }
    } catch (error: any) {
      console.error("Error fetching attendance:", error?.message || error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [startDate, endDate, inspectorsList]);
  const handleSaveAttendanceEdit = async () => {
    console.log("🟢 [Edit Attendance] Save Changes button clicked!");

    // ✅ Try ALL possible sources for the ID
    let recordId = editingId || editingRecord?._id || null;

    // If still no ID, try localStorage
    if (!recordId) {
      try {
        const stored = localStorage.getItem('edit_attendance_data');
        if (stored) {
          const parsed = JSON.parse(stored);
          recordId = parsed.id;
          console.log("🟢 Found in localStorage:", parsed);
        }
      } catch (e) { }
    }

    console.log("🟢 [Edit Attendance] recordId from state:", editingId);
    console.log("🟢 [Edit Attendance] recordId from editingRecord:", editingRecord?._id);
    console.log("🟢 [Edit Attendance] final recordId:", recordId);

    // ✅ If still no ID, try to find by date and user
    if (!recordId || recordId === '') {
      console.warn("⚠️ No ID found, trying to find by date and user...");

      const date = editingDate || editingRecord?.date || null;
      const userId = editingUserId || editingRecord?.userId?._id || editingRecord?.inspector?._id || null;

      if (date && userId) {
        try {
          const dateStr = typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0];
          console.log("🔍 [Fallback] Querying getAttendance with:", { startDate: dateStr, endDate: dateStr, userId });

          const response = await apiClient.getAttendance({
            startDate: dateStr,
            endDate: dateStr,
            userId: userId
          });

          console.log("🔍 [Fallback] getAttendance raw response:", response);
          console.log("🔍 [Fallback] logs count:", response?.logs?.length ?? "no .logs field");
          if (response?.logs?.length > 0) {
            console.log("🔍 [Fallback] sample log:", response.logs[0]);
          }
          const toLocalDateStr = (d: string | Date): string => {
            const date = typeof d === 'string' ? new Date(d) : d;
            if (isNaN(date.getTime())) return '';
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };

          if (response?.logs?.length > 0) {
            const found = response.logs.find((log: any) => {
              const logDate = toLocalDateStr(log.date);
              const logUserId = log.inspector?._id || log.userId?._id || log.userId;
              return logDate === dateStr && logUserId === userId;
            });
            if (found?._id) {
              recordId = found._id;
              console.log("✅ Found record by date and user:", recordId);
            } else {
              console.warn("⚠️ [Fallback] No log matched date+userId in response.logs");
            }
          } else {
            console.warn("⚠️ [Fallback] response.logs was empty or missing entirely");
          }
        } catch (error) {
          console.error("❌ [Fallback] getAttendance threw:", error);
        }
      } else {
        console.warn("⚠️ [Fallback] Skipped — missing date or userId:", { date, userId });
      }
    }

    if (!recordId || recordId === '') {
      console.warn("❌ No editing record ID found");
      alert("No attendance record selected for editing");
      return;
    }

    const checkInISO = editCheckIn ? new Date(editCheckIn).toISOString() : null;
    const checkOutISO = editCheckOut ? new Date(editCheckOut).toISOString() : null;

    setSavingEdit(true);

    try {
      const response = await apiClient.updateAttendanceTime(recordId, {
        checkIn: checkInISO,
        checkOut: checkOutISO,
        status: editStatus,
        shift: editShiftName || undefined,
      });

      console.log("✅ [Edit Attendance] Response:", response);
      setCurrentDate(new Date(currentDate));
      handleCloseEditModal();
      await fetchAttendance();
      //alert("Attendance updated successfully!");
    } catch (error: any) {
      console.error("❌ [Edit Attendance] Error:", error);
      alert(error?.message || "Failed to save attendance");
    } finally {
      setSavingEdit(false);
    }
  };

  // For subadmins, show their own attendance only
  if (user?.role === "subadmin") {
    return <SubAdminAttendanceNew />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <div className="w-full">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Attendance Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track user login/logout times and working hours by date
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("attendance")}
              className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-all ${activeTab === "attendance"
                ? "border-primary-600 text-primary-600 dark:text-primary-400 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
            >
              Attendance
            </button>
            <button
              onClick={() => setActiveTab("report-response")}
              className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-all ${activeTab === "report-response"
                ? "border-primary-600 text-primary-600 dark:text-primary-400 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
            >
              Report Response
            </button>
            <button
              onClick={() => setActiveTab("calendar-grid")}
              className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-all ${activeTab === "calendar-grid"
                ? "border-primary-600 text-primary-600 dark:text-primary-400 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
            >
              Attendance Calendar
            </button>
            <button
              onClick={() => setActiveTab("attendance-summary")}
              className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-all ${activeTab === "attendance-summary"
                ? "border-primary-600 text-primary-600 dark:text-primary-400 font-bold"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
            >
              Attendance Summary
            </button>
          </nav>
        </div>

        {/* Month Selector and Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center flex-wrap gap-2">
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 rounded-md hover:bg-white dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2 px-4 min-w-[160px] justify-center">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-base font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                    {monthDetails.monthName} {year}
                  </span>
                </div>

                <button
                  onClick={handleNextMonth}
                  className="p-2 rounded-md hover:bg-white dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-primary-400 dark:hover:bg-gray-700"
              >
                Current Month
              </button>
            </div>

            {(activeTab === "attendance" || activeTab === "calendar-grid" || activeTab === "attendance-summary") && (
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
            )}
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
        {/* ─── TABLE CONTENT ────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {activeTab === "attendance" ? (
            // ═══════════════════════════════════════════════════════════════
            // ATTENDANCE TABLE
            // ═══════════════════════════════════════════════════════════════
            loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
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
                            className={`px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[140px] ${d.isToday ? "bg-primary-50 dark:bg-primary-900/20" : ""}`}
                          >
                            <div className="flex flex-col">
                              <span className={d.isWeekend ? "text-red-500" : ""}>
                                {d.dayOfWeek}
                              </span>
                              <span className={`font-bold ${d.isToday ? "text-primary-600" : ""}`}>
                                {d.day}/{month}
                              </span>
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
                        paginatedUsers.map((user) => (
                          <tr key={user.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            {/* User Name Column */}
                            <td className="px-3 py-3 sticky left-0 bg-white dark:bg-gray-800 z-10">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                  <span className="text-primary-600 dark:text-primary-400 text-sm font-medium">
                                    {user.firstName?.[0]}
                                    {user.lastName?.[0]}
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
                                {user.tenantId?.companyName || user.tenantId?.name || "-"}
                              </div>
                            </td>


                            {/* Attendance Tab - Date Columns */}
                            {visibleDates.map((d) => {
                              const record = user.attendance?.[d.dateString] || null;

                              return (
                                <td
                                  key={d.dateString}
                                  className={`px-2 py-2 text-center ${d.isToday ? "bg-primary-50/50 dark:bg-primary-900/10" : ""}`}
                                >
                                  {renderDateCell(record, d.isFuture, user.userId, d.dateString)}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No records found</div>
                  ) : (
                    paginatedUsers.map((user) => {
                      const monthAttendance = Object.values(user.attendance);
                      const presentCount = monthAttendance.filter(r => r.isPresent).length;
                      const todayStr = new Date().toISOString().split('T')[0];
                      const todayRecord = user.attendance[todayStr];

                      return (
                        <div
                          key={user.userId}
                          className="p-4 space-y-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedUserAttendance(user);
                            setShowAttendanceModal(true);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                <span className="text-primary-600 dark:text-primary-400 font-bold">
                                  {user.firstName?.[0]}{user.lastName?.[0]}
                                </span>
                              </div>
                              <div className="ml-3">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                  {user.firstName} {user.lastName}
                                </h3>
                                <p className="text-xs text-gray-500">@{user.username}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase ${getRoleBadgeColor(user.role)}`}>
                                {user.role}
                              </span>
                              <ChevronRight size={16} className="text-gray-400" />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50">
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">Today's Status</p>
                              <div className="mt-1">{renderDateCell(todayRecord, false)}</div>
                            </div>
                            <div className="bg-green-50/50 dark:bg-green-900/10 p-3 rounded-xl border border-green-100 dark:border-green-800/50">
                              <p className="text-[10px] text-green-600 dark:text-green-400 font-bold uppercase mb-1">Month Summary</p>
                              <div className="flex flex-col gap-1 mt-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Present</span>
                                  <span className="text-xs font-bold text-green-600">{presentCount}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-500">Working</span>
                                  <span className="text-xs font-bold text-blue-600">
                                    {Math.round(monthAttendance.reduce((acc, r) => acc + (r.workingHours || 0), 0) * 60)}m
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {user.tenantId && (
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 text-gray-500">
                                <Building size={14} />
                                <span>{user.tenantId.companyName || user.tenantId.name}</span>
                              </div>
                              <span className="text-primary-600 font-medium text-[10px] uppercase">View Full Log</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )
          ) : activeTab === "calendar-grid" ? (
            // ═══════════════════════════════════════════════════════════════
            // CALENDAR GRID TABLE
            // ═══════════════════════════════════════════════════════════════
            loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full min-w-[1400px] border-collapse border border-gray-200 dark:border-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th rowSpan={2} className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700/50 z-20 min-w-[180px]">
                          Employee Name
                        </th>
                        <th rowSpan={2} className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky left-[180px] bg-gray-50 dark:bg-gray-700/50 z-20 min-w-[150px]">
                          Role
                        </th>
                        {visibleDates.map((d) => (
                          <th
                            key={d.dateString}
                            className={`px-1 py-1 border border-gray-200 dark:border-gray-700 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 min-w-[40px] ${d.isToday ? "bg-primary-50 dark:bg-primary-900/20" : ""}`}
                          >
                            {d.day}
                          </th>
                        ))}
                        <th rowSpan={2} className="px-2 py-3 border border-gray-200 dark:border-gray-700 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider bg-green-50 dark:bg-green-900/20 sticky right-[160px] z-10 min-w-[40px]">
                          P
                        </th>
                        <th rowSpan={2} className="px-2 py-3 border border-gray-200 dark:border-gray-700 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider bg-orange-50 dark:bg-orange-900/20 sticky right-[120px] z-10 min-w-[40px]">
                          HA
                        </th>
                        <th rowSpan={2} className="px-2 py-3 border border-gray-200 dark:border-gray-700 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider bg-red-50 dark:bg-red-900/20 sticky right-[80px] z-10 min-w-[40px]">
                          A
                        </th>
                        <th rowSpan={2} className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky right-0 bg-gray-50 dark:bg-gray-700/50 z-20 min-w-[80px]">
                          Hours
                        </th>
                      </tr>
                      <tr>
                        {visibleDates.map((d) => (
                          <th
                            key={`wk-${d.dateString}`}
                            className={`px-1 py-0.5 border border-gray-200 dark:border-gray-700 text-center text-[9px] font-medium text-gray-500 dark:text-gray-400 ${d.isWeekend ? "text-red-500" : ""} ${d.isToday ? "bg-primary-50 dark:bg-primary-900/20" : ""}`}
                          >
                            {d.dayOfWeek}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={visibleDates.length + 6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                            No attendance records found for this month
                          </td>
                        </tr>
                      ) : (
                        paginatedUsers.map((user) => {
                          let pCount = 0;
                          let haCount = 0;
                          let aCount = 0;
                          let totalHoursDecimal = 0;

                          visibleDates.forEach((d) => {
                            const record = user.attendance?.[d.dateString];
                            if (record) {
                              if (record.isPresent) {
                                if (record.presentStatus === "half-day" || record.presentStatus === "halfday") {
                                  haCount += 1;
                                } else {
                                  pCount += 1;
                                }
                              } else {
                                if (record.presentStatus !== "weekly-off" && record.presentStatus !== "weekly_off") {
                                  aCount += 1;
                                }
                              }
                            }
                          });

                          Object.values(user.attendance || {}).forEach((rec) => {
                            totalHoursDecimal += rec.workingHours || 0;
                          });

                          const wholeHours = Math.floor(totalHoursDecimal);
                          const minutes = Math.round((totalHoursDecimal - wholeHours) * 60);
                          const formattedHours = `${wholeHours}h ${minutes}m`;

                          return (
                            <tr key={user.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                              <td className="px-3 py-3 border border-gray-200 dark:border-gray-700 sticky left-0 bg-white dark:bg-gray-800 z-10 font-bold text-sm text-gray-900 dark:text-white">
                                {user.firstName} {user.lastName}
                              </td>
                              <td className="px-3 py-3 border border-gray-200 dark:border-gray-700 sticky left-[180px] bg-white dark:bg-gray-800 z-10 text-xs text-gray-600 dark:text-gray-400 font-medium">
                                {user.role}
                              </td>
                              {visibleDates.map((d) => {
                                const record = user.attendance?.[d.dateString];
                                let symbol = "-";
                                let cellClass = "text-gray-400 dark:text-gray-600";

                                if (record) {
                                  if (record.isPresent) {
                                    if (record.presentStatus === "half-day" || record.presentStatus === "halfday") {
                                      symbol = "HA";
                                      cellClass = "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 font-bold";
                                    } else {
                                      symbol = "P";
                                      cellClass = "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 font-bold";
                                    }
                                  } else {
                                    if (record.presentStatus === "weekly-off" || record.presentStatus === "weekly_off") {
                                      symbol = "W";
                                      cellClass = "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 font-bold";
                                    } else {
                                      symbol = "A";
                                      cellClass = "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 font-bold";
                                    }
                                  }
                                } else {
                                  if (d.date.getDay() === 0) {
                                    symbol = "S";
                                    cellClass = "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/20 font-bold";
                                  }
                                }

                                return (
                                  <td
                                    key={d.dateString}
                                    className={`px-1 py-1 border border-gray-200 dark:border-gray-700 text-center text-xs ${cellClass}`}
                                  >
                                    {symbol}
                                  </td>
                                );
                              })}
                              <td className="px-2 py-3 border border-gray-200 dark:border-gray-700 text-center text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/10 sticky right-[160px] z-10">
                                {pCount}
                              </td>
                              <td className="px-2 py-3 border border-gray-200 dark:border-gray-700 text-center text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/10 sticky right-[120px] z-10">
                                {haCount}
                              </td>
                              <td className="px-2 py-3 border border-gray-200 dark:border-gray-700 text-center text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/10 sticky right-[80px] z-10">
                                {aCount}
                              </td>
                              <td className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-center text-xs font-bold text-gray-900 dark:text-white sticky right-0 bg-white dark:bg-gray-800 z-10">
                                {formattedHours}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Table View */}
                <div className="lg:hidden p-4 space-y-4">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No records found</div>
                  ) : (
                    paginatedUsers.map((user) => {
                      let pCount = 0;
                      let haCount = 0;
                      let aCount = 0;
                      let totalHoursDecimal = 0;

                      visibleDates.forEach((d) => {
                        const record = user.attendance?.[d.dateString];
                        if (record) {
                          if (record.isPresent) {
                            if (record.presentStatus === "half-day" || record.presentStatus === "halfday") {
                              haCount += 1;
                            } else {
                              pCount += 1;
                            }
                          } else {
                            if (record.presentStatus !== "weekly-off" && record.presentStatus !== "weekly_off") {
                              aCount += 1;
                            }
                          }
                        }
                      });

                      Object.values(user.attendance || {}).forEach((rec) => {
                        totalHoursDecimal += rec.workingHours || 0;
                      });

                      const wholeHours = Math.floor(totalHoursDecimal);
                      const minutes = Math.round((totalHoursDecimal - wholeHours) * 60);
                      const formattedHours = `${wholeHours}h ${minutes}m`;

                      return (
                        <div key={user.userId} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3 shadow-sm">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-gray-900 dark:text-white">{user.firstName} {user.lastName}</h4>
                              <p className="text-xs text-gray-500">@{user.username} | {user.role}</p>
                            </div>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{formattedHours}</span>
                          </div>
                          
                          <div className="grid grid-cols-4 gap-2 text-center text-xs">
                            <div className="bg-green-50 dark:bg-green-950/20 p-2 rounded-lg">
                              <span className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase">P</span>
                              <span className="font-bold text-green-600 dark:text-green-400">{pCount}</span>
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-950/20 p-2 rounded-lg">
                              <span className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase">HA</span>
                              <span className="font-bold text-orange-600 dark:text-orange-400">{haCount}</span>
                            </div>
                            <div className="bg-red-50 dark:bg-red-950/20 p-2 rounded-lg">
                              <span className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase">A</span>
                              <span className="font-bold text-red-600 dark:text-red-400">{aCount}</span>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-950/20 p-2 rounded-lg">
                              <span className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase">Days</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">{visibleDates.length}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )
          ) : activeTab === "attendance-summary" ? (
            // ═══════════════════════════════════════════════════════════════
            // ATTENDANCE SUMMARY TABLE
            // ═══════════════════════════════════════════════════════════════
            loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              </div>
            ) : (
              <>
                {/* Desktop Summary View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200 dark:border-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[60px]">
                          S.No
                        </th>
                        <th className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Vendor Name
                        </th>
                        <th className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Shift Allotment
                        </th>
                        <th className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          From
                        </th>
                        <th className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          To
                        </th>
                        <th className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Actual Org Working Days
                        </th>
                        <th className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider bg-green-50 dark:bg-green-900/10">
                          Present
                        </th>
                        <th className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider bg-orange-50 dark:bg-orange-900/10">
                          Half Day
                        </th>
                        <th className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider bg-red-50 dark:bg-red-900/10">
                          Absent
                        </th>
                        <th className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Hours
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                            No records found for this period
                          </td>
                        </tr>
                      ) : (
                        <>
                          {paginatedUsers.map((user, idx) => {
                            let pCount = 0;
                            let haCount = 0;
                            let aCount = 0;
                            let totalHoursDecimal = 0;

                            visibleDates.forEach((d) => {
                              const record = user.attendance?.[d.dateString];
                              if (record) {
                                if (record.isPresent) {
                                  if (record.presentStatus === "half-day" || record.presentStatus === "halfday") {
                                    haCount += 1;
                                  } else {
                                    pCount += 1;
                                  }
                                } else {
                                  if (record.presentStatus !== "weekly-off" && record.presentStatus !== "weekly_off") {
                                    aCount += 1;
                                  }
                                }
                              }
                            });

                            Object.values(user.attendance || {}).forEach((rec) => {
                              totalHoursDecimal += rec.workingHours || 0;
                            });

                            const wholeHours = Math.floor(totalHoursDecimal);
                            const minutes = Math.round((totalHoursDecimal - wholeHours) * 60);
                            const formattedHours = `${wholeHours}h ${minutes}m`;
                            const shiftAllotment = getMostFrequentShift(user.attendance);

                            const formattedFrom = formatDate(startDate);
                            const formattedTo = formatDate(endDate);

                            return (
                              <tr key={user.userId} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                <td className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white">
                                  {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                                </td>
                                <td className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white font-medium">
                                  {user.tenantId?.companyName || user.tenantId?.name || "No Vendor"}
                                </td>
                                <td className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white font-semibold">
                                  {user.firstName} {user.lastName}
                                </td>
                                <td className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                                  {shiftAllotment}
                                </td>
                                <td className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                                  {formattedFrom}
                                </td>
                                <td className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                                  {formattedTo}
                                </td>
                                <td className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
                                  {visibleDates.length}
                                </td>
                                <td className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-center text-sm text-green-600 dark:text-green-400 font-bold bg-green-50/10">
                                  {pCount}
                                </td>
                                <td className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-center text-sm text-orange-600 dark:text-orange-400 font-bold bg-orange-50/10">
                                  {haCount}
                                </td>
                                <td className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-center text-sm text-red-600 dark:text-red-400 font-bold bg-red-50/10">
                                  {aCount}
                                </td>
                                <td className="px-3 py-3 border border-gray-200 dark:border-gray-700 text-center text-sm text-gray-900 dark:text-white font-bold">
                                  {formattedHours}
                                </td>
                              </tr>
                            );
                          })}

                          {/* GRAND TOTAL ROW */}
                          <tr className="bg-blue-50 dark:bg-blue-900/20 font-bold border-t-2 border-blue-300 dark:border-blue-700">
                            <td colSpan={7} className="px-3 py-4 border border-gray-200 dark:border-gray-700 text-right text-sm text-blue-700 dark:text-blue-300 uppercase tracking-wider font-extrabold">
                              TOTAL:
                            </td>
                            <td className="px-3 py-4 border border-gray-200 dark:border-gray-700 text-center text-sm text-green-600 dark:text-green-400 font-extrabold bg-green-50/10">
                              {grandTotals.present}
                            </td>
                            <td className="px-3 py-4 border border-gray-200 dark:border-gray-700 text-center text-sm text-orange-600 dark:text-orange-400 font-extrabold bg-orange-50/10">
                              {grandTotals.halfDay}
                            </td>
                            <td className="px-3 py-4 border border-gray-200 dark:border-gray-700 text-center text-sm text-red-600 dark:text-red-400 font-extrabold bg-red-50/10">
                              {grandTotals.absent}
                            </td>
                            <td className="px-3 py-4 border border-gray-200 dark:border-gray-700 text-center text-sm text-gray-900 dark:text-white font-extrabold">
                              {grandTotals.hours}
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Summary View */}
                <div className="lg:hidden p-4 space-y-4">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No records found</div>
                  ) : (
                    <>
                      {paginatedUsers.map((user, idx) => {
                        let pCount = 0;
                        let haCount = 0;
                        let aCount = 0;
                        let totalHoursDecimal = 0;

                        visibleDates.forEach((d) => {
                          const record = user.attendance?.[d.dateString];
                          if (record) {
                            if (record.isPresent) {
                              if (record.presentStatus === "half-day" || record.presentStatus === "halfday") {
                                haCount += 1;
                              } else {
                                pCount += 1;
                              }
                            } else {
                              if (record.presentStatus !== "weekly-off" && record.presentStatus !== "weekly_off") {
                                aCount += 1;
                              }
                            }
                          }
                        });

                        Object.values(user.attendance || {}).forEach((rec) => {
                          totalHoursDecimal += rec.workingHours || 0;
                        });

                        const wholeHours = Math.floor(totalHoursDecimal);
                        const minutes = Math.round((totalHoursDecimal - wholeHours) * 60);
                        const formattedHours = `${wholeHours}h ${minutes}m`;
                        const shiftAllotment = getMostFrequentShift(user.attendance);

                        return (
                          <div key={user.userId} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2 shadow-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[10px] font-bold text-gray-400 block">#{ (currentPage - 1) * ITEMS_PER_PAGE + idx + 1 }</span>
                                <h4 className="font-bold text-gray-900 dark:text-white">{user.firstName} {user.lastName}</h4>
                                <p className="text-xs text-gray-500">{user.tenantId?.companyName || user.tenantId?.name || "No Vendor"}</p>
                              </div>
                              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{formattedHours}</span>
                            </div>
                            
                            <div className="border-t border-gray-100 dark:border-gray-700 pt-2 mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                              <div>
                                <span className="text-gray-400 block text-[10px]">Shift</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">{shiftAllotment}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block text-[10px]">Period</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">{formatDate(startDate)} - {formatDate(endDate)}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2">
                              <div className="bg-green-50 dark:bg-green-950/20 p-1.5 rounded-lg">
                                <span className="text-gray-400 block text-[9px] uppercase">P</span>
                                <span className="font-bold text-green-600 dark:text-green-400">{pCount}</span>
                              </div>
                              <div className="bg-orange-50 dark:bg-orange-950/20 p-1.5 rounded-lg">
                                <span className="text-gray-400 block text-[9px] uppercase">HA</span>
                                <span className="font-bold text-orange-600 dark:text-orange-400">{haCount}</span>
                              </div>
                              <div className="bg-red-50 dark:bg-red-950/20 p-1.5 rounded-lg">
                                <span className="text-gray-400 block text-[9px] uppercase">A</span>
                                <span className="font-bold text-red-600 dark:text-red-400">{aCount}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800 space-y-2 shadow-sm">
                        <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm">GRAND TOTALS</h4>
                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                          <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm">
                            <span className="text-gray-400 block text-[10px] uppercase font-semibold">P</span>
                            <span className="font-bold text-green-600 dark:text-green-400 text-sm">{grandTotals.present}</span>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm">
                            <span className="text-gray-400 block text-[10px] uppercase font-semibold">HA</span>
                            <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">{grandTotals.halfDay}</span>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm">
                            <span className="text-gray-400 block text-[10px] uppercase font-semibold">A</span>
                            <span className="font-bold text-red-600 dark:text-red-400 text-sm">{grandTotals.absent}</span>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm">
                            <span className="text-gray-400 block text-[10px] uppercase font-semibold">Hours</span>
                            <span className="font-bold text-gray-900 dark:text-white text-xs">{grandTotals.hours}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )
          ) : (
            // ═══════════════════════════════════════════════════════════════
            // REPORT RESPONSE TABLE
            // ═══════════════════════════════════════════════════════════════
            loadingReportResponse ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                {/* Report Response Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full min-w-[1400px]">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700/50 z-10 min-w-[150px]">
                          User Name
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-[150px] bg-gray-50 dark:bg-gray-700/50 z-10 min-w-[150px]">
                          Status
                        </th>
                        {visibleDates.map((d) => (
                          <th
                            key={d.dateString}
                            className={`px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px] ${d.isToday ? "bg-primary-50 dark:bg-primary-900/20" : ""}`}
                          >
                            <div className="flex flex-col">
                              <span className={d.isWeekend ? "text-red-500" : ""}>
                                {d.dayOfWeek}
                              </span>
                              <span className={`font-bold ${d.isToday ? "text-primary-600" : ""}`}>
                                {d.day}
                              </span>
                            </div>
                          </th>
                        ))}
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky right-0 bg-gray-50 dark:bg-gray-700/50 z-10 min-w-[80px]">
                          SWAP
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {groupedReportResponses.length === 0 ? (
                        <tr>
                          <td colSpan={visibleDates.length + 3} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                            No response records found for this month
                          </td>
                        </tr>
                      ) : (
                        <>
                          {groupedReportResponses.map((user, userIdx) => (
                            <tr key={userIdx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                              {/* User Name */}
                              <td className="px-3 py-3 sticky left-0 bg-white dark:bg-gray-800 z-10">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                    <span className="text-primary-600 dark:text-primary-400 text-sm font-medium">
                                      {user.name?.split(" ").map((n: string) => n[0]).join("") || "U"}
                                    </span>
                                  </div>
                                  <div className="ml-3">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                      {user.name}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {user.username}
                                    </div>
                                    <div>
                                      <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${getRoleBadgeColor(user.role)}`}>
                                        {user.role}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Status Summary Column */}
                              <td className="px-2 py-1 sticky left-[150px] bg-white dark:bg-gray-800 z-10">
                                <div className="text-[10px] font-medium space-y-0">
                                  {STATUS_CONFIG.map(({ key, label, color }) => (
                                    <div key={key} className={`${color}`}>
                                      {label}
                                    </div>
                                  ))}
                                </div>
                              </td>

                              {/* Date Columns */}
                              {visibleDates.map((d) => {
                                const dayData = user.dates?.[d.dateString] || [];

                                const counts: Record<string, number> = {};
                                let total = 0;

                                dayData.forEach((item: any) => {
                                  if (item.statusCounts) {
                                    STATUS_CONFIG.forEach(({ key }) => {
                                      const count = item.statusCounts[key] || 0;
                                      counts[key] = (counts[key] || 0) + count;
                                      total += count;
                                    });
                                  }
                                });

                                const hasData = total > 0;

                                return (
                                  <td
                                    key={d.dateString}
                                    className={`px-2 py-2 text-center text-xs ${d.isToday ? "bg-primary-50/50 dark:bg-primary-900/10" : ""}`}
                                  >
                                    {d.isFuture ? (
                                      <span className="text-gray-400">-</span>
                                    ) : hasData ? (
                                      <div className="space-y-0.5">
                                        {STATUS_CONFIG.map(({ key, color }) => (
                                          <div key={key} className={`font-bold ${color}`}>
                                            {counts[key] || 0}
                                          </div>
                                        ))}
                                        <div className="border-t border-gray-200 pt-0.5 mt-0.5 font-bold text-gray-900 dark:text-white">
                                          {total}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-gray-300">-</span>
                                    )}
                                  </td>
                                );
                              })}

                              {/* SWAP Button */}
                              <td className="px-3 py-3 text-center sticky right-0 bg-white dark:bg-gray-800 z-10">
                                {canEditAttendanceTime ? (
                                  <button
                                    onClick={() => handleOpenSwapModal(user)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors text-xs font-medium"
                                  >
                                    <ArrowLeftRight className="w-4 h-4" />
                                    Swap
                                  </button>
                                ) : (
                                  <span className="text-gray-300 text-xs">-</span>
                                )}
                              </td>
                            </tr>
                          ))}

                          {/* ✅ TOTAL ROW */}
                          <tr className="bg-blue-50 dark:bg-blue-900/30 font-bold border-t-2 border-blue-300 dark:border-blue-600">
                            <td className="px-3 py-3 sticky left-0 bg-blue-50 dark:bg-blue-900/30 z-10 text-blue-700 dark:text-blue-300">
                              <span className="text-sm">TOTAL</span>
                            </td>
                            <td className="px-2 py-2 sticky left-[150px] bg-blue-50 dark:bg-blue-900/30 z-10">
                              {/* Empty or show "All Users" */}
                              <span className="text-[10px] text-blue-600 dark:text-blue-400">All Users</span>
                            </td>
                            {visibleDates.map((d) => {
                              // Calculate totals for this date across all users
                              const totalCounts: Record<string, number> = {};
                              let grandTotal = 0;

                              groupedReportResponses.forEach((user) => {
                                const dayData = user.dates?.[d.dateString] || [];
                                dayData.forEach((item: any) => {
                                  if (item.statusCounts) {
                                    STATUS_CONFIG.forEach(({ key }) => {
                                      const count = item.statusCounts[key] || 0;
                                      totalCounts[key] = (totalCounts[key] || 0) + count;
                                      grandTotal += count;
                                    });
                                  }
                                });
                              });

                              const hasData = grandTotal > 0;

                              return (
                                <td
                                  key={d.dateString}
                                  className={`px-2 py-2 text-center text-xs ${d.isToday ? "bg-blue-100 dark:bg-blue-800/30" : ""}`}
                                >
                                  {d.isFuture ? (
                                    <span className="text-gray-400">-</span>
                                  ) : hasData ? (
                                    <div className="space-y-0.5">
                                      {STATUS_CONFIG.map(({ key, color }) => (
                                        <div key={key} className={`font-bold ${color}`}>
                                          {totalCounts[key] || 0}
                                        </div>
                                      ))}
                                      <div className="border-t border-blue-300 dark:border-blue-700 pt-0.5 mt-0.5 font-bold text-blue-700 dark:text-blue-300">
                                        {grandTotal}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-3 py-3 text-center sticky right-0 bg-blue-50 dark:bg-blue-900/30 z-10">
                              <span className="text-blue-600 dark:text-blue-400 text-xs font-bold">—</span>
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Report Response View */}
                <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
                  {/* Report Response Mobile View */}
                  {groupedReportResponses.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No records found</div>
                  ) : (
                    groupedReportResponses.map((user, idx) => {
                      // Calculate totals for this user
                      const totalCounts: Record<string, number> = {};
                      let grandTotal = 0;

                      Object.values(user.dates || {}).forEach((dateData: any) => {
                        dateData.forEach((item: any) => {
                          if (item.statusCounts) {
                            STATUS_CONFIG.forEach(({ key }) => {
                              const count = item.statusCounts[key] || 0;
                              totalCounts[key] = (totalCounts[key] || 0) + count;
                              grandTotal += count;
                            });
                          }
                        });
                      });

                      return (
                        <div key={idx} className="p-4 space-y-4">
                          {/* User Info */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                <span className="text-primary-600 dark:text-primary-400 font-bold">
                                  {user.name?.split(" ").map((n: string) => n[0]).join("") || "U"}
                                </span>
                              </div>
                              <div className="ml-3">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">{user.name}</h3>
                                <p className="text-xs text-gray-500">@{user.username}</p>
                              </div>
                            </div>
                            {canEditAttendanceTime && (
                              <button
                                onClick={() => handleOpenSwapModal(user)}
                                className="px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg text-xs font-medium flex items-center gap-1"
                              >
                                <ArrowLeftRight className="w-3 h-3" />
                                Swap
                              </button>
                            )}
                          </div>

                          {/* Status Summary for Mobile */}
                          <div className="flex flex-wrap gap-2 text-xs">
                            {STATUS_CONFIG.map(({ key, label, color }) => (
                              <div key={key} className={`flex items-center gap-1 ${color}`}>
                                <span className="text-gray-500">{label}:</span>
                                <span className="font-bold">{totalCounts[key] || 0}</span>
                              </div>
                            ))}
                            <div className="flex items-center gap-1 font-bold text-gray-900 dark:text-white">
                              <span className="text-gray-500">Total:</span>
                              <span>{grandTotal}</span>
                            </div>
                          </div>

                          {/* Date Grid */}
                          <div className="grid grid-cols-3 gap-2">
                            {visibleDates.filter(d => !d.isFuture).slice(0, 6).map((d) => {
                              const dayData = user.dates?.[d.dateString] || [];
                              const counts: Record<string, number> = {};
                              let total = 0;

                              dayData.forEach((item: any) => {
                                if (item.statusCounts) {
                                  STATUS_CONFIG.forEach(({ key }) => {
                                    const count = item.statusCounts[key] || 0;
                                    counts[key] = (counts[key] || 0) + count;
                                    total += count;
                                  });
                                }
                              });

                              const hasData = total > 0;

                              return (
                                <div key={d.dateString} className={`text-center p-2 rounded-lg border ${d.isToday ? 'bg-primary-50/50 dark:bg-primary-900/10 border-primary-200' : 'border-gray-100 dark:border-gray-800'}`}>
                                  <div className="text-[10px] text-gray-400">{d.dayOfWeek}</div>
                                  <div className="text-[10px] font-bold">{d.day}</div>
                                  {hasData ? (
                                    <div className="text-[10px] mt-1 space-y-0.5">
                                      {STATUS_CONFIG.map(({ key, color }) => (
                                        <div key={key} className={`font-bold ${color}`}>
                                          {counts[key] || 0}
                                        </div>
                                      ))}
                                      <div className="border-t border-gray-200 pt-0.5 mt-0.5 font-bold text-gray-900 dark:text-white">
                                        {total}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300 text-xs">-</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )
          )}
        </div>

        {/* Pagination */}
        {filteredUsers.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="text-sm text-gray-500">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} of{" "}
              {filteredUsers.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronFirst size={18} />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-medium px-3">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage >= totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLast size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span className="font-medium">Legend:</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-blue-600 font-medium">Check In</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-orange-600">Check Out</span>
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

        {/* User Attendance Details Modal */}
        {showAttendanceModal && selectedUserAttendance && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <span className="text-primary-600 dark:text-primary-400 font-bold uppercase">
                      {selectedUserAttendance.firstName?.[0]}{selectedUserAttendance.lastName?.[0]}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      {selectedUserAttendance.firstName} {selectedUserAttendance.lastName}
                    </h3>
                    <p className="text-xs text-gray-500">Monthly Attendance Log</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X size={20} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                {visibleDates.slice().reverse().map((d) => {
                  const record = selectedUserAttendance.attendance[d.dateString];
                  if (d.isFuture) return null;

                  return (
                    <div
                      key={d.dateString}
                      className={`p-3 rounded-xl border ${d.isToday ? 'bg-primary-50/50 border-primary-100 dark:bg-primary-900/10 dark:border-primary-900/30' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${d.isWeekend ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                            {d.day} {monthDetails.monthName}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase">{d.dayOfWeek}</span>
                        </div>
                        {d.isToday && <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-[10px] font-bold rounded-full uppercase">Today</span>}
                      </div>

                      {record && record.loginTime ? (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 uppercase">Check In</span>
                            <span className="text-xs font-bold text-blue-600">{formatTime(record.loginTime)}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 uppercase">Check Out</span>
                            <span className="text-xs font-bold text-orange-600">{formatTime(record.logoutTime)}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 uppercase">Duration</span>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                              {Math.round((record.workingMinutes || record.workingHours * 60))}m
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-1 text-xs text-gray-400 italic">No attendance record</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="w-full py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Attendance Modal */}
        {showEditModal && editingRecord && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Edit Attendance
                </h3>
                <button
                  onClick={handleCloseEditModal}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X size={20} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-4">
                {/* Status Selection */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    Status
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setEditStatus("present")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${editStatus === "present"
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                        }`}
                    >
                      Present
                    </button>
                    <button
                      onClick={() => setEditStatus("half-day")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${editStatus === "half-day"
                        ? "bg-orange-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                        }`}
                    >
                      Half Day
                    </button>
                    <button
                      onClick={() => setEditStatus("absent")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${editStatus === "absent"
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                        }`}
                    >
                      Absent
                    </button>
                  </div>
                </div>

                {/* Check In Time */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Check In Time
                  </label>
                  <input
                    type="datetime-local"
                    value={editCheckIn}
                    onChange={(e) => setEditCheckIn(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Check Out Time */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Check Out Time
                  </label>
                  <input
                    type="datetime-local"
                    value={editCheckOut}
                    onChange={(e) => setEditCheckOut(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Shift Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Shift Required*
                  </label>
                  <input
                    type="text"
                    value={editShiftName}
                    onChange={(e) => setEditShiftName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g., General Shift"
                  />
                </div>
              </div>

              {/* Footer with Buttons */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex gap-2">
                  <button
                    onClick={handleCloseEditModal}
                    disabled={savingEdit}
                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAttendanceEdit}  // ← VERIFY THIS IS CORRECT
                    disabled={savingEdit}
                    className="flex-1 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingEdit ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Attendance Modal */}
        {
          showCreateModal && createAttendanceDate && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Create Attendance - {createAttendanceDate}
                  </h3>
                  <button
                    onClick={handleCloseCreateModal}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <X size={20} className="text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {/* Status Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                      Status
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setCreateAttendanceStatus("present")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${createAttendanceStatus === "present"
                          ? "bg-green-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                          }`}
                      >
                        Present
                      </button>
                      <button
                        onClick={() => setCreateAttendanceStatus("half-day")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${createAttendanceStatus === "half-day"
                          ? "bg-orange-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                          }`}
                      >
                        Half Day
                      </button>
                      <button
                        onClick={() => setCreateAttendanceStatus("absent")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${createAttendanceStatus === "absent"
                          ? "bg-red-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                          }`}
                      >
                        Absent
                      </button>
                    </div>
                  </div>

                  {/* Check In Time */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Check In Time
                    </label>
                    <input
                      type="datetime-local"
                      value={createCheckIn}
                      onChange={(e) => setCreateCheckIn(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Check Out Time */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Check Out Time
                    </label>
                    <input
                      type="datetime-local"
                      value={createCheckOut}
                      onChange={(e) => setCreateCheckOut(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  {/* Shift Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Shift (optional)
                    </label>
                    <input
                      type="text"
                      value={createShiftName}
                      onChange={(e) => setCreateShiftName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., General Shift"
                    />
                  </div>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex gap-2">
                    <button
                      onClick={handleCloseCreateModal}
                      disabled={creatingAttendance}
                      className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateAttendance}
                      disabled={creatingAttendance}
                      className="flex-1 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {creatingAttendance ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Create
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }
        {/* ─── SWAP MODAL ────────────────────────────────────────────────── */}
        {/* ─── SWAP MODAL ────────────────────────────────────────────────── */}
        {showSwapModal && swapSourceUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Swap Responses
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Transfer responses from one user/date to another user/date
                  </p>
                </div>
                <button
                  onClick={handleCloseSwapModal}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* ─── SOURCE USER ─────────────────────────────────────────── */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Source</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-sm">
                      {swapSourceUser?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">
                        {swapSourceUser?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {swapSourceUser?.username || ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ─── SOURCE DATE ─────────────────────────────────────────── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    Source Date <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={swapDate}
                    onChange={(e) => {
                      setSwapDate(e.target.value);
                      setSwapFormId("");
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select source date...</option>
                    {swapSourceUser && Object.keys(swapSourceUser.dates).sort().reverse().map((date) => (
                      <option key={date} value={date}>{date}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">Date where source user has responses</p>
                </div>

                {/* ─── TARGET USER ──────────────────────────────────────────── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    Transfer to <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={swapTargetUser}
                    onChange={(e) => setSwapTargetUser(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select inspector...</option>
                    {inspectorsList
                      .filter((inspector: any) => inspector._id !== swapSourceUser?.userId)
                      .map((inspector: any) => (
                        <option key={inspector._id} value={inspector._id}>
                          {inspector.firstName} {inspector.lastName} ({inspector.username})
                        </option>
                      ))}
                  </select>
                </div>

                {/* ─── TARGET DATE - DATE PICKER ───────────────────────────── */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    Target Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={swapTargetDate}
                    onChange={(e) => setSwapTargetDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Select any date where responses should be moved to
                    <span className="text-amber-500 ml-1"></span>
                    Existing responses on this date will be replaced
                  </p>
                </div>

                {/* ─── FORM SELECTION ───────────────────────────────────────── */}
                {swapDate && swapSourceUser && swapSourceUser.dates[swapDate] && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                      Form <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={swapFormId}
                      onChange={(e) => setSwapFormId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select form...</option>
                      {swapSourceUser.dates[swapDate].map((item: any, idx: number) => {
                        const formValue = item.formId || item.formTitle || `form-${idx}`;
                        const counts = item.statusCounts || {};
                        // ✅ Show actual available statuses with counts
                        const statusSummary = Object.entries(counts)
                          .filter(([_, count]) => count > 0)
                          .map(([status, count]) => `${status}: ${count}`)
                          .join(' ');

                        return (
                          <option key={idx} value={formValue}>
                            {item.formTitle || 'Unknown Form'}
                            {statusSummary && (
                              <span className="text-gray-400 ml-1">({statusSummary})</span>
                            )}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {/* ─── STATUS COUNTS ────────────────────────────────────────── */}



                {/* Status Counts */}
                {swapDate && swapFormId && swapSourceUser && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                        Responses to Transfer
                      </h4>
                      <span className="text-[10px] text-gray-400">Select which ones to move</span>
                    </div>

                    {(() => {
                      const dateData = swapSourceUser.dates[swapDate] || [];
                      const formData = dateData.find((item: any) => {
                        const itemId = item.formId || item.formTitle;
                        return itemId === swapFormId || item.formTitle === swapFormId;
                      });

                      if (!formData) {
                        return (
                          <div className="text-center py-4 text-sm text-gray-500 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                            No data found for this form on this date
                          </div>
                        );
                      }

                      // ✅ Normalize status counts
                      const rawCounts = formData.statusCounts || {};
                      const normalizedCounts: Record<string, number> = {};
                      Object.entries(rawCounts).forEach(([status, count]) => {
                        const normalized = normalizeStatusForSwap(status);
                        normalizedCounts[normalized] = (normalizedCounts[normalized] || 0) + count;
                      });

                      // ✅ Only show statuses that have counts > 0
                      const statusTypes = [
                        { key: 'Direct Ok', label: 'Direct Ok', color: 'text-green-600' },
                        { key: 'Rework QC Completed', label: 'Rework QC Completed', color: 'text-blue-600' },
                        { key: 'Rework QC Pending', label: 'Rework QC Pending', color: 'text-yellow-600' },
                        { key: 'Rejected', label: 'Rejected', color: 'text-red-600' }
                      ];

                      const availableStatuses = statusTypes.filter(s => (normalizedCounts[s.key] || 0) > 0);

                      if (availableStatuses.length === 0) {
                        return (
                          <div className="text-center py-4 text-sm text-gray-500 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                            No responses to transfer for this form
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-2 bg-gray-50 dark:bg-gray-700/20 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                          {availableStatuses.map(({ key, label, color }) => {
                            const maxCount = normalizedCounts[key] || 0;
                            const isChecked = swapCheckedStates[key] || false;
                            const quantity = swapQuantities[key] || 0;

                            return (
                              <div key={key} className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    setSwapCheckedStates(prev => ({
                                      ...prev,
                                      [key]: e.target.checked
                                    }));
                                    if (!e.target.checked) {
                                      setSwapQuantities(prev => ({
                                        ...prev,
                                        [key]: 0
                                      }));
                                    } else if (maxCount > 0) {
                                      setSwapQuantities(prev => ({
                                        ...prev,
                                        [key]: Math.min(1, maxCount)
                                      }));
                                    }
                                  }}
                                  disabled={maxCount === 0}
                                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className={`text-sm font-medium flex-1 ${maxCount === 0 ? 'text-gray-400' : color}`}>
                                  {label}
                                </span>
                                <span className="text-xs text-gray-500">({maxCount} available)</span>
                                <input
                                  type="number"
                                  min="0"
                                  max={maxCount}
                                  value={quantity}
                                  onChange={(e) => {
                                    const val = Math.min(Math.max(0, parseInt(e.target.value) || 0), maxCount);
                                    setSwapQuantities(prev => ({
                                      ...prev,
                                      [key]: val
                                    }));
                                    if (val > 0) {
                                      setSwapCheckedStates(prev => ({
                                        ...prev,
                                        [key]: true
                                      }));
                                    }
                                  }}
                                  disabled={!isChecked || maxCount === 0}
                                  className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ─── SELECTED SUMMARY ────────────────────────────────────── */}
                {Object.values(swapQuantities).some(v => v > 0) && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-300">Selected for Transfer:</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Object.entries(swapQuantities).map(([status, count]) =>
                        count > 0 ? (
                          <span key={status} className="px-2 py-1 bg-green-100 dark:bg-green-800/40 text-green-700 dark:text-green-300 rounded-lg text-xs font-medium">
                            {status}: {count}
                          </span>
                        ) : null
                      )}
                    </div>
                    <p className="text-[10px] text-green-600 dark:text-green-400 mt-2">
                      ⚠️ This will replace any existing responses for the target user on the target date
                    </p>
                  </div>
                )}

                {/* ─── SWAP PREVIEW ──────────────────────────────────────────── */}
                {swapDate && swapTargetDate && swapTargetUser && swapFormId && Object.values(swapQuantities).some(v => v > 0) && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Swap Preview:</p>
                    <div className="text-xs text-amber-700 dark:text-amber-300 mt-1 space-y-0.5">
                      <p>From: <strong>{swapSourceUser?.name}</strong> on <strong>{swapDate}</strong></p>
                      <p>To: <strong>{inspectorsList.find(i => i._id === swapTargetUser)?.firstName} {inspectorsList.find(i => i._id === swapTargetUser)?.lastName}</strong> on <strong>{swapTargetDate}</strong></p>
                      <p>Form: <strong>{swapSourceUser?.dates?.[swapDate]?.find((f: any) => f.formId === swapFormId || f.formTitle === swapFormId)?.formTitle || swapFormId}</strong></p>
                      <p className="font-bold">Total: {Object.values(swapQuantities).reduce((a, b) => a + b, 0)} responses</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── FOOTER ──────────────────────────────────────────────────── */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex gap-2">
                  <button
                    onClick={handleCloseSwapModal}
                    disabled={swappingInProgress}
                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmSwap}
                    disabled={
                      swappingInProgress ||
                      !swapTargetUser ||
                      !swapDate ||
                      !swapTargetDate ||
                      !swapFormId ||
                      Object.values(swapQuantities).every(v => v === 0)
                    }
                    className="flex-1 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {swappingInProgress ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Swapping...
                      </>
                    ) : (
                      <>
                        <ArrowLeftRight className="w-4 h-4" />
                        Confirm Swap
                      </>
                    )}
                  </button>
                </div>
                {swapTargetUser && swapTargetDate && (
                  <p className="text-[10px] text-gray-400 text-center mt-2">
                    {inspectorsList.find(i => i._id === swapTargetUser)?.firstName} {inspectorsList.find(i => i._id === swapTargetUser)?.lastName}
                    's existing responses on {swapTargetDate} will be replaced
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div >
    </div >
  );
}

// Search Icon Component
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
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
  const datesInMonth = useMemo(
    () => getDatesInMonth(year, month),
    [year, month],
  );

  const visibleDates = datesInMonth;
  const startDate = useMemo(
    () => new Date(year, month - 1, 1).toISOString().split("T")[0],
    [year, month],
  );
  const endDate = useMemo(
    () => new Date(year, month, 0).toISOString().split("T")[0],
    [year, month],
  );
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();


  useEffect(() => {
    const fetchMyAttendance = async () => {
      setLoading(true);
      try {
        const response = await apiClient.getMyAttendance({
          startDate,
          endDate,
          limit: 100,
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
    attendanceData.forEach((record) => {
      if (record.loginTime) {
        const dateStr = new Date(record.loginTime).toISOString().split("T")[0];
        if (
          !map[dateStr] ||
          calculateWorkingHours(
            record.loginTime,
            record.logoutTime,
            record.workingHours,
          ) >
          calculateWorkingHours(
            map[dateStr].loginTime,
            map[dateStr].logoutTime,
            map[dateStr].workingHours,
          )
        ) {
          map[dateStr] = record;
        }
      }
    });
    return map;
  }, [attendanceData]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 2, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month, 1));

  const renderDateCell = (
    record: AttendanceRecord | undefined,
    isFuture: boolean,
  ) => {
    if (isFuture) {
      return <span className="text-gray-400 text-xs">-</span>;
    }

    if (!record || !record.loginTime) {
      return <span className="text-gray-400 text-xs">-</span>;
    }

    const workingHours = calculateWorkingHours(
      record.loginTime,
      record.logoutTime,
      record.workingHours,
    );
    const isActive = !record.logoutTime && record.isActive;

    return (
      <div className="space-y-1 text-xs">
        <div className="text-blue-600">{formatTime(record.loginTime)}</div>
        <div className="text-orange-600">{formatTime(record.logoutTime)}</div>
        <div className="text-gray-500">
          {record.workingHours > 0 ? `${Math.round(record.workingHours * 60)}m` : "-"}
        </div>
        {isActive ? (
          <span className="text-green-500">● Active</span>
        ) : (
          record.isPresent && (
            <span className="text-green-600 font-bold">P</span>
          )
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Attendance
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            View your login/logout times and working hours
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-md hover:bg-white dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 px-4 min-w-[160px] justify-center">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-base font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                  {monthDetails.monthName} {year}
                </span>
              </div>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-md hover:bg-white dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-primary-400 dark:hover:bg-gray-700"
            >
              Current Month
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Day
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Check In
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Check Out
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {visibleDates.slice().reverse().map((d) => {
                      const record = attendanceByDate[d.dateString];
                      const hours = record
                        ? calculateWorkingHours(
                          record.loginTime,
                          record.logoutTime,
                          record.workingHours,
                        )
                        : 0;
                      const isActive =
                        record && !record.logoutTime && record.isActive;

                      return (
                        <tr
                          key={d.dateString}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${d.isToday ? "bg-primary-50/30 dark:bg-primary-900/10" : ""}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {d.day} {monthDetails.monthName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {d.dayOfWeek}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400 font-medium">
                            {record ? formatTime(record.loginTime) : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 dark:text-orange-400 font-medium">
                            {record ? formatTime(record.logoutTime) : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                            {hours > 0 ? `${Math.round(hours * 60)}m` : "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isActive ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                                Active
                              </span>
                            ) : record && record.isPresent ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                Present
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-700">
                {visibleDates.slice().reverse().map((d) => {
                  const record = attendanceByDate[d.dateString];
                  if (d.isFuture) return null;

                  const hours = record
                    ? calculateWorkingHours(
                      record.loginTime,
                      record.logoutTime,
                      record.workingHours,
                    )
                    : 0;
                  const isActive = record && !record.logoutTime && record.isActive;

                  return (
                    <div
                      key={d.dateString}
                      className={`p-4 space-y-3 ${d.isToday ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${d.isWeekend ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                            {d.day} {monthDetails.monthName}
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase font-bold">{d.dayOfWeek}</span>
                        </div>
                        {isActive ? (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-full uppercase flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></span>
                            Active
                          </span>
                        ) : d.isToday ? (
                          <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-[10px] font-bold rounded-full uppercase">Today</span>
                        ) : null}
                      </div>

                      {record && record.loginTime ? (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-blue-50/50 dark:bg-blue-900/10 p-2 rounded-xl border border-blue-100/50 dark:border-blue-900/30">
                            <span className="text-[9px] text-blue-600 dark:text-blue-400 uppercase font-bold block mb-1">In</span>
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{formatTime(record.loginTime)}</span>
                          </div>
                          <div className="bg-orange-50/50 dark:bg-orange-900/10 p-2 rounded-xl border border-orange-100/50 dark:border-orange-900/30">
                            <span className="text-[9px] text-orange-600 dark:text-orange-400 uppercase font-bold block mb-1">Out</span>
                            <span className="text-xs font-bold text-orange-700 dark:text-orange-300">{formatTime(record.logoutTime)}</span>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700">
                            <span className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Work</span>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{Math.round(hours * 60)}m</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 italic py-1">No record for this day</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white p-4 rounded-lg border text-center">
            <p className="text-sm text-gray-500">Total Days</p>
            <p className="text-2xl font-bold">{visibleDates.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border text-center">
            <p className="text-sm text-gray-500">Present</p>
            <p className="text-2xl font-bold text-green-600">
              {
                Object.values(attendanceByDate).filter((r) => r && r.loginTime)
                  .length
              }
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg border text-center">
            <p className="text-sm text-gray-500">Total Hours</p>
            <p className="text-2xl font-bold text-blue-600">
              {Math.round(
                Object.values(attendanceByDate).reduce(
                  (sum, r) =>
                    sum +
                    (r
                      ? calculateWorkingHours(
                        r.loginTime,
                        r.logoutTime,
                        r.workingHours,
                      )
                      : 0),
                  0,
                ) * 60,
              )}
              m
            </p>
          </div>
        </div>
      </div>
    </div>

  );
}