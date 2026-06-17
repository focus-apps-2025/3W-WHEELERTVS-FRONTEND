import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useForms, useResponses } from "../hooks/useApi";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Smile,
  Frown,
  Meh,
  Search,
  Users,
  Building,
  ArrowLeft,
  Eye,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { apiClient } from "../api/client";
import { LAYOUT_CONFIG } from "../config/layoutConfig";

ChartJS.register(ArcElement, Tooltip, Legend);

interface Tenant {
  _id: string;
  name: string;
  companyName: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  settings?: {
    logo?: string;
    primaryColor?: string;
    companyEmail?: string;
    companyPhone?: string;
    showCustomerPortal?: boolean;
  };
}

interface TenantStats {
  totalForms: number;
  totalResponses: number;
  performanceScore: number;
}

const MyReviewBreakdownChart = ({ myReviewStats }: { myReviewStats: any }) => {
  if (!myReviewStats) return null;

  const data = {
    labels: ["Accepted", "Rejected", "Rework"],
    datasets: [
      {
        data: [
          myReviewStats.accepted,
          myReviewStats.rejected,
          myReviewStats.rework,
        ],
        backgroundColor: ["#22c55e", "#ef4444", "#f59e0b"],
        hoverBackgroundColor: ["#16a34a", "#dc2626", "#d97706"],
        borderWidth: 0,
      },
    ],
  };

  const options = {
    cutout: "70%",
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.raw;
            const total = context.dataset.data.reduce(
              (a: number, b: number) => a + b,
              0,
            );
            const percentage =
              total > 0 ? Math.round((value / total) * 100) : 0;
            return `${context.label}: ${value} (${percentage}%)`;
          },
        },
      },
      datalabels: {
        display: false,
      },
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm mb-8">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <Smile className="w-5 h-5 text-indigo-500" />
        My Review Performance Breakdown
      </h3>

      <div className="flex flex-col lg:flex-row items-center gap-8">
        <div className="relative w-full max-w-[280px] aspect-square sm:w-72 sm:h-72 flex-shrink-0">
          <Doughnut data={data} options={options} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-black text-gray-900 dark:text-white">
              {myReviewStats.reviewed}
            </span>
            <span className="text-[15px] font-bold text-gray-400 uppercase tracking-widest blend-in">
              Performance
            </span>
          </div>
        </div>

        <div className="flex flex-col flex-1 gap-8">
          <div className="flex justify-center lg:justify-start gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                Accepted
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                Rejected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div>
              <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                Rework
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800/30">
              <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">
                Accepted
              </p>
              <p className="text-2xl font-black text-green-700 dark:text-green-300">
                {myReviewStats.accepted}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <div className="flex-1 h-1 bg-green-200 dark:bg-green-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${myReviewStats.reviewed > 0 ? (myReviewStats.accepted / myReviewStats.reviewed) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
                <span className="text-[20px] font-bold text-green-600/70 dark:text-green-400/70">
                  {myReviewStats.reviewed > 0
                    ? Math.round(
                        (myReviewStats.accepted / myReviewStats.reviewed) * 100,
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800/30">
              <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">
                Rejected
              </p>
              <p className="text-2xl font-black text-red-700 dark:text-red-300">
                {myReviewStats.rejected}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <div className="flex-1 h-1 bg-red-200 dark:bg-red-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500"
                    style={{
                      width: `${myReviewStats.reviewed > 0 ? (myReviewStats.rejected / myReviewStats.reviewed) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
                <span className="text-[20px] font-bold text-red-600/70 dark:text-red-400/70">
                  {myReviewStats.reviewed > 0
                    ? Math.round(
                        (myReviewStats.rejected / myReviewStats.reviewed) * 100,
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/30">
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">
                Rework
              </p>
              <p className="text-2xl font-black text-amber-700 dark:text-amber-300">
                {myReviewStats.rework}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <div className="flex-1 h-1 bg-amber-200 dark:bg-amber-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500"
                    style={{
                      width: `${myReviewStats.reviewed > 0 ? (myReviewStats.rework / myReviewStats.reviewed) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
                <span className="text-[20px] font-bold text-amber-600/70 dark:text-amber-400/70">
                  {myReviewStats.reviewed > 0
                    ? Math.round(
                        (myReviewStats.rework / myReviewStats.reviewed) * 100,
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            Current Performance Score
          </p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {myReviewStats.performanceScore}%
            </p>
            <div
              className={`w-2 h-2 rounded-full ${myReviewStats.performanceScore >= 80 ? "bg-green-500" : myReviewStats.performanceScore >= 50 ? "bg-amber-500" : "bg-red-500"}`}
            ></div>
          </div>
        </div>
        <div className="flex gap-8">
          <div className="text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Total Reviews
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white">
              {myReviewStats.reviewed}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Total Submissions
            </p>
            <p className="text-2xl font-black text-gray-900 dark:text-white">
              {myReviewStats.totalResponses}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function DashboardNew() {
  const navigate = useNavigate();
  const { user, tenant: currentTenant } = useAuth();
  const [userPerformanceScore, setUserPerformanceScore] = useState(100);
  const {
    data: formsData,
    loading: formsLoading,
    error: formsError,
  } = useForms();
  const {
    data: responsesData,
    loading: responsesLoading,
    error: responsesError,
  } = useResponses();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // New states for tenant management
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [tenantsError, setTenantsError] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantStats, setTenantStats] = useState<Record<string, TenantStats>>(
    {},
  );
  const [viewMode, setViewMode] = useState<"tenants" | "forms">("tenants");
  const [inspectorSummary, setInspectorSummary] = useState<any[]>([]);
  const [summaryStatuses, setSummaryStatuses] = useState<string[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryStartDate, setSummaryStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [summaryEndDate, setSummaryEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [myReviewStats, setMyReviewStats] = useState<any>(null);
  const [myReviewStatsLoading, setMyReviewStatsLoading] = useState(false);
  const [performanceTableData, setPerformanceTableData] = useState<any[]>([]);
  const [performanceTableLoading, setPerformanceTableLoading] = useState(false);
  const [perfStartDate, setPerfStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [perfEndDate, setPerfEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [perfInspectorSummary, setPerfInspectorSummary] = useState<any[]>([]);
  const [activeUserNames, setActiveUserNames] = useState<Set<string>>(
    new Set(),
  );

  // Pagination states
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryPageSize, setSummaryPageSize] = useState(10);
  const [performancePage, setPerformancePage] = useState(1);
  const [performancePageSize, setPerformancePageSize] = useState(10);
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set());

  // Check user role
  const isSuperAdmin = user?.role === "superadmin";
  const isInspector = user?.role === "inspector";

  const isUserActive = useCallback((user: any) => {
    if (user?.isActive !== undefined) return user.isActive !== false;
    if (user?.status) return String(user.status).toLowerCase() !== "inactive";
    return true;
  }, []);

  const getUserNameAliases = useCallback((user: any) => {
    const aliases = new Set<string>();
    const addAlias = (value: string | undefined | null) => {
      if (!value) return;
      const trimmed = String(value).trim();
      if (!trimmed) return;
      aliases.add(trimmed);
      aliases.add(trimmed.toLowerCase());
      aliases.add(trimmed.replace(/^@/, ""));
      aliases.add(trimmed.replace(/^@/, "").toLowerCase());
    };

    const firstName = user?.firstName || "";
    const lastName = user?.lastName || "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    addAlias(fullName);
    addAlias(user?.name);
    addAlias(user?.username);
    addAlias(user?.email);
    addAlias(user?._id);

    return aliases;
  }, []);

  const buildActiveUserNames = useCallback(
    (users: any[]) => {
      const activeNames = new Set<string>();
      users.filter(isUserActive).forEach((user) => {
        getUserNameAliases(user).forEach((alias) => activeNames.add(alias));
      });
      return activeNames;
    },
    [isUserActive, getUserNameAliases],
  );

  const getInspectorName = useCallback((item: any) => {
    return (
      item?.qcInspector ||
      item?.qcInspectorName ||
      item?.inspectorName ||
      item?.name ||
      item?.username ||
      item?.email ||
      item?.userId ||
      ""
    );
  }, []);

  const isInspectorActive = (item: any) => {
    if (!isUserActive(item)) return false;
    const inspectorName = getInspectorName(item);
    if (!inspectorName || activeUserNames.size === 0) return true;
    const aliases = getUserNameAliases({ username: inspectorName });
    return Array.from(aliases).some((alias) => activeUserNames.has(alias));
  };

  // Calculate trial days left
  const getTrialDaysLeft = () => {
    if (
      !currentTenant?.subscription ||
      currentTenant.subscription.plan !== "free"
    )
      return null;
    if (!currentTenant.subscription.endDate) return null;

    const end = new Date(currentTenant.subscription.endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const trialDaysLeft = getTrialDaysLeft();

  console.log("Auth Data:", {
    user,
    currentTenant,
    isSuperAdmin,
    currentTenantId: currentTenant?._id,
    currentTenantSlug: currentTenant?.slug,
    showCustomerPortal: currentTenant?.settings?.showCustomerPortal,
    fullSettings: currentTenant?.settings,
    storedTenant: localStorage.getItem("tenant_info"),
  });
  console.log("Forms Data:", formsData);
  console.log("Responses Data:", responsesData);

  // Determine initial view mode based on user role
  useEffect(() => {
    if (user && currentTenant) {
      console.log("Setting up tenant view for user:", user.role);

      // Create tenant object from currentTenant
      const tenantObj: Tenant = {
        _id: currentTenant.id,
        name: currentTenant.name,
        companyName: currentTenant.companyName,
        slug: currentTenant.slug,
        isActive: currentTenant.isActive !== false,
        createdAt: currentTenant.createdAt || new Date().toISOString(),
      };

      console.log("Created tenant object:", tenantObj);

      // Always set selected tenant for admin users
      setSelectedTenant(tenantObj);

      if (isSuperAdmin) {
        // Superadmin sees tenants first
        setViewMode("tenants");
      } else {
        // Admin and other users see forms directly for their tenant
        setViewMode("forms");
      }

      // For all users, set current tenant in tenants array
      setTenants([tenantObj]);
    }
  }, [user, currentTenant, isSuperAdmin]);

  // Fetch all tenants (only for superadmin)
  useEffect(() => {
    const fetchTenants = async () => {
      // Only fetch tenants if user is superadmin
      if (!isSuperAdmin) {
        console.log("Not superadmin, skipping tenant fetch");
        return;
      }

      setTenantsLoading(true);
      setTenantsError(null);
      try {
        console.log("Fetching tenants for superadmin...");
        const response = await apiClient.getTenants();
        console.log("Tenants API response:", response);

        if (response && response.tenants) {
          setTenants(response.tenants);

          // If current tenant is not in the list, add it
          if (
            currentTenant &&
            !response.tenants.some((t: any) => t._id === currentTenant._id)
          ) {
            const currentTenantObj: Tenant = {
              _id: currentTenant._id,
              name: currentTenant.name,
              companyName: currentTenant.companyName,
              slug: currentTenant.slug,
              isActive: currentTenant.isActive !== false,
              createdAt: currentTenant.createdAt || new Date().toISOString(),
            };
            setTenants((prev) => [currentTenantObj, ...prev]);
          }
        } else {
          setTenants([]);
          setTenantsError("No tenants data received from API");
        }
      } catch (error: any) {
        console.error("Error fetching tenants:", error);
        setTenantsError(error.message || "Failed to fetch tenants");

        // Fallback to current tenant if fetch fails
        if (currentTenant) {
          const tenantObj: Tenant = {
            _id: currentTenant._id,
            name: currentTenant.name,
            companyName: currentTenant.companyName,
            slug: currentTenant.slug,
            isActive: currentTenant.isActive !== false,
            createdAt: currentTenant.createdAt || new Date().toISOString(),
          };
          setTenants([tenantObj]);
        }
      } finally {
        setTenantsLoading(false);
      }
    };

    if (isSuperAdmin) {
      fetchTenants();
    }
  }, [currentTenant, isSuperAdmin]);

  useEffect(() => {
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return;
    }

    let cancelled = false;

    const fetchActiveUsers = async () => {
      try {
        const [adminData, subadminData, inspectorData] = await Promise.all([
          apiClient.getUsers({ role: "admin", limit: 100 }),
          apiClient.getUsers({ role: "subadmin", limit: 100 }),
          apiClient.getUsers({ role: "inspector", limit: 100 }),
        ]);

        const allUsers = [
          ...(Array.isArray(adminData.users) ? adminData.users : []),
          ...(Array.isArray(subadminData.users) ? subadminData.users : []),
          ...(Array.isArray(inspectorData.users) ? inspectorData.users : []),
        ];

        if (!cancelled) {
          setActiveUserNames(buildActiveUserNames(allUsers));
        }
      } catch (error) {
        console.error("Error fetching active users:", error);
        if (!cancelled) {
          setActiveUserNames(new Set());
        }
      }
    };

    fetchActiveUsers();

    return () => {
      cancelled = true;
    };
  }, [user?._id, user?.role]);

  // Fetch inspector summary data
  useEffect(() => {
    const fetchSummary = async () => {
      setSummaryLoading(true);
      try {
        let url = "/analytics/inspector-summary";
        const params = new URLSearchParams();
        if (summaryStartDate) params.append("startDate", summaryStartDate);
        if (summaryEndDate) params.append("endDate", summaryEndDate);

        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

        const response = await apiClient.get<any>(url);
        if (response.data) {
          const summary = response.data.summary || [];
          setInspectorSummary(summary);
          setSummaryStatuses(response.data.allStatuses || []);
        }
      } catch (error) {
        console.error("Error fetching inspector summary:", error);
      } finally {
        setSummaryLoading(false);
      }
    };

    if (user) {
      fetchSummary();
    }
  }, [user, summaryStartDate, summaryEndDate]);

  const activeInspectorSummary = useMemo(() => {
    return inspectorSummary.filter(isInspectorActive);
  }, [inspectorSummary, activeUserNames]);

  const activeSummaryStatuses = useMemo(() => {
    const statuses = Array.from(
      new Set(
        activeInspectorSummary.flatMap((item: any) =>
          Object.keys(item.statusCounts || {}),
        ),
      ),
    );
    return statuses.length > 0 ? statuses : summaryStatuses;
  }, [activeInspectorSummary, summaryStatuses]);

  // Performance table statuses: derived from perfInspectorSummary (its own date range)
  const performanceStatuses = useMemo(() => {
    const statuses = Array.from(
      new Set(
        perfInspectorSummary.flatMap((item: any) =>
          Object.keys(item.statusCounts || {}),
        ),
      ),
    );
    return statuses.length > 0 ? statuses : summaryStatuses;
  }, [perfInspectorSummary, summaryStatuses]);

  const groupedSummary = useMemo(() => {
    const groups: Record<string, any> = {};
    activeInspectorSummary.forEach((item) => {
      const title = item.formTitle || "N/A";
      if (!groups[title]) {
        groups[title] = {
          formTitle: title,
          tenantName: item.tenantName,
          totalInspection: 0,
          statusCounts: {},
          subItems: [],
        };
      }
      groups[title].totalInspection += item.totalInspection;
      Object.entries(item.statusCounts || {}).forEach(([status, count]) => {
        groups[title].statusCounts[status] =
          (groups[title].statusCounts[status] || 0) + (count as number);
      });
      groups[title].subItems.push(item);
    });
    return Object.values(groups);
  }, [activeInspectorSummary]);

  // Fetch my review stats
  useEffect(() => {
    const fetchMyStats = async () => {
      setMyReviewStatsLoading(true);
      try {
        const response = await apiClient.getMyReviewStats();
        if (response.success) {
          setMyReviewStats(response.data);
        }
      } catch (error) {
        console.error("Error fetching my review stats:", error);
      } finally {
        setMyReviewStatsLoading(false);
      }
    };

    if (user) {
      fetchMyStats();
    }
  }, [user]);

  // Fetch inspector summary specifically for the Performance Table (independent dates)
  useEffect(() => {
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) return;
    let cancelled = false;
    const fetchPerfSummary = async () => {
      try {
        let url = "/analytics/inspector-summary";
        const params = new URLSearchParams();
        if (perfStartDate) params.append("startDate", perfStartDate);
        if (perfEndDate) params.append("endDate", perfEndDate);
        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;
        const response = await apiClient.get<any>(url);
        if (!cancelled && response.data) {
          setPerfInspectorSummary(response.data.summary || []);
        }
      } catch (error) {
        console.error("Error fetching perf inspector summary:", error);
        if (!cancelled) setPerfInspectorSummary([]);
      }
    };
    fetchPerfSummary();
    return () => { cancelled = true; };
  }, [user, perfStartDate, perfEndDate]);

  // Fetch performance table data
  useEffect(() => {
    const fetchPerformanceTable = async () => {
      if (!user || (user.role !== "admin" && user.role !== "superadmin"))
        return;

      setPerformanceTableLoading(true);
      try {
        const response = await apiClient.getPerformanceTable({
          startDate: perfStartDate,
          endDate: perfEndDate,
        });
        if (response.success) {
          const dispatchMap = new Map<string, number>();

          perfInspectorSummary.forEach((item: any) => {
            const userName = item.qcInspector;
            if (userName && item.statusCounts?.Dispatched) {
              const currentCount = dispatchMap.get(userName) || 0;
              dispatchMap.set(
                userName,
                currentCount + (item.statusCounts.Dispatched || 0),
              );
            }
          });

          const filteredRows = response.data.filter(
            (row: any) => isUserActive(row) && isInspectorActive(row),
          );

          const mergedData = filteredRows.map((row: any) => ({
            ...row,
            dispatched: dispatchMap.get(row.name) || row.dispatched || 0,
          }));

          setPerformanceTableData(mergedData);
        }
      } catch (error) {
        console.error("Error fetching performance table:", error);
      } finally {
        setPerformanceTableLoading(false);
      }
    };

    fetchPerformanceTable();
  }, [
    user,
    perfStartDate,
    perfEndDate,
    perfInspectorSummary,
    activeUserNames,
  ]);
  // Calculate tenant statistics
  useEffect(() => {
    if (formsData?.forms && responsesData?.responses && tenants.length > 0) {
      console.log("Calculating tenant stats...");
      // Use the loaded user performance score
      const currentUserScore = userPerformanceScore;
      const stats: Record<string, TenantStats> = {};

      tenants.forEach((tenant) => {
        // Filter forms by tenant - check multiple possible tenant ID fields
        const tenantForms = formsData.forms.filter((form: any) => {
          const formTenantId =
            typeof form.tenantId === "object"
              ? form.tenantId?._id
              : form.tenantId;
          const matches =
            formTenantId === tenant._id || formTenantId === tenant.slug;
          if (matches) {
            console.log(
              `✓ Form ${form.title} matches tenant ${tenant.companyName}`,
            );
          }
          return matches;
        });

        console.log(
          `Tenant ${tenant.companyName} has ${tenantForms.length} forms`,
        );

        // Get all responses for this tenant's forms
        const tenantFormIds = tenantForms.map(
          (form: any) => form.id || form._id,
        );
        const tenantResponses = responsesData.responses.filter(
          (response: any) =>
            tenantFormIds.includes(response.formId || response.questionId),
        );

        // Calculate promoter percentage
        let yesCount = 0;
        let totalResponses = 0;

        tenantResponses.forEach((response: any) => {
          if (response.answers) {
            Object.values(response.answers).forEach((answer: any) => {
              const answerStr = String(answer).toLowerCase();
              if (answerStr === "yes") {
                yesCount++;
              }
              if (
                answerStr === "yes" ||
                answerStr === "no" ||
                answerStr === "n/a" ||
                answerStr === "na"
              ) {
                totalResponses++;
              }
            });
          }
        });

        stats[tenant._id] = {
          totalForms: tenantForms.length,
          totalResponses: tenantResponses.length,
          performanceScore: currentUserScore,
        };

        console.log(`Stats for ${tenant.companyName}:`, stats[tenant._id]);
      });

      setTenantStats(stats);
    }
  }, [formsData, responsesData, tenants]);

  // Load user performance score
  useEffect(() => {
    const loadScore = async () => {
      if (user?._id) {
        try {
          const response = await apiClient.getPerformanceScores();
          if (response && response.data?.[user._id]) {
            setUserPerformanceScore(response.data[user._id]);
          }
        } catch (error) {
          console.error("Failed to load user performance score:", error);
          // Fallback to localStorage if API fails
          try {
            const scores = JSON.parse(
              localStorage.getItem("performanceScores") || "{}",
            );
            setUserPerformanceScore(scores[user._id] || 100);
          } catch (localError) {
            console.error("Failed to load from localStorage:", localError);
            setUserPerformanceScore(100);
          }
        }
      }
    };
    loadScore();
  }, [user?._id]);

  // Filter forms by selected tenant
  const filteredForms = React.useMemo(() => {
    if (!formsData?.forms) {
      console.log("No forms data available");
      return [];
    }

    console.log("Total forms in system:", formsData.forms.length);
    console.log(
      "All forms:",
      formsData.forms.map((f: any) => ({
        title: f.title,
        tenantId: f.tenantId,
        tenant: f.tenant,
      })),
    );

    // If in forms view and tenant is selected, filter by tenant
    if (viewMode === "forms" && selectedTenant) {
      console.log("Filtering forms for tenant:", {
        tenantName: selectedTenant.companyName,
        tenantId: selectedTenant._id,
        tenantSlug: selectedTenant.slug,
      });

      const tenantForms = formsData.forms.filter((form: any) => {
        const formTenantId =
          typeof form.tenantId === "object"
            ? form.tenantId?._id
            : form.tenantId;
        const sharedWithTenants = Array.isArray(form.sharedWithTenants)
          ? form.sharedWithTenants
          : [];

        const isDirectMatch =
          formTenantId === selectedTenant._id ||
          formTenantId === selectedTenant.slug;
        const isSharedMatch = sharedWithTenants.some(
          (t: any) =>
            (t._id || t) === selectedTenant._id || t === selectedTenant.slug,
        );

        const matches = isDirectMatch || isSharedMatch;
        console.log(
          `  Matches: ${matches} (Direct: ${isDirectMatch}, Shared: ${isSharedMatch})`,
        );
        return matches;
      });

      console.log(
        `Forms for tenant ${selectedTenant.companyName}:`,
        tenantForms.length,
      );
      console.log(
        "Matched forms:",
        tenantForms.map((f: any) => f.title),
      );

      // Apply search filter on top of tenant filter
      const filtered = tenantForms.filter(
        (form: any) =>
          form.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (form.description &&
            form.description.toLowerCase().includes(searchQuery.toLowerCase())),
      );

      console.log(`After search filter:`, filtered.length);
      return filtered;
    }

    // In tenants view or no tenant selected, return empty
    return [];
  }, [formsData?.forms, selectedTenant, viewMode, searchQuery]);

  const statsCache = React.useMemo(() => {
    const cache = new Map<
      string,
      { yesCount: number; noCount: number; naCount: number; total: number }
    >();

    if (responsesData?.responses) {
      responsesData.responses.forEach((response: any) => {
        if (response.answers) {
          const formId = response.questionId || response.formId;
          if (!cache.has(formId)) {
            cache.set(formId, {
              yesCount: 0,
              noCount: 0,
              naCount: 0,
              total: 0,
            });
          }
          const stats = cache.get(formId)!;
          Object.values(response.answers).forEach((answer: any) => {
            const answerStr = String(answer).toLowerCase();
            if (answerStr === "yes") {
              stats.yesCount++;
            } else if (answerStr === "no") {
              stats.noCount++;
            } else if (answerStr === "n/a" || answerStr === "na") {
              stats.naCount++;
            }
          });
          stats.total = stats.yesCount + stats.noCount + stats.naCount;
        }
      });
    }

    return cache;
  }, [responsesData?.responses]);

  const getFormResponseStats = (formId: string) => {
    return (
      statsCache.get(formId) || {
        yesCount: 0,
        noCount: 0,
        naCount: 0,
        total: 0,
      }
    );
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleTenantClick = (tenant: Tenant) => {
    console.log("Tenant clicked:", tenant);
    setSelectedTenant(tenant);
    setViewMode("forms");
    setSearchQuery(""); // Reset search when switching to forms view
  };

  const handleBackToTenants = () => {
    setSelectedTenant(null);
    setViewMode("tenants");
    setSearchQuery(""); // Reset search when going back
  };

  // Render tenant cards - only for superadmin
  const renderTenantCards = () => {
    // If user is not superadmin, don't show tenant cards at all
    if (!isSuperAdmin) {
      return null;
    }

    if (tenantsLoading) {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading tenants...</p>
        </div>
      );
    }

    const paidTenants = tenants.filter(
      (t) => (t as any).subscription?.plan !== "free",
    );
    const freeTrialTenants = tenants.filter(
      (t) => (t as any).subscription?.plan === "free",
    );

    const renderTenantSection = (
      title: string,
      tenantList: Tenant[],
      accentColor: string,
    ) => (
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-1.5 h-8 rounded-full ${accentColor}`}></div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {title}
          </h3>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700">
            {tenantList.length}
          </span>
        </div>

        <div className="relative">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {tenantList.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <Building className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No tenants in this category</p>
              </div>
            ) : (
              tenantList.map((tenant) => {
                const stats = tenantStats[tenant._id] || {
                  totalForms: 0,
                  totalResponses: 0,
                  performanceScore: 0,
                };
                const isFree = (tenant as any).subscription?.plan === "free";

                return (
                  <div
                    key={tenant._id}
                    className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col relative overflow-hidden shadow-sm"
                    onClick={() => handleTenantClick(tenant)}
                  >
                    {isFree && (
                      <div className="absolute top-0 right-0 px-4 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-2xl shadow-sm z-10">
                        Free Trial
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-6">
                      <div
                        className={`p-4 rounded-2xl ${isFree ? "bg-blue-50 dark:bg-blue-900/30" : "bg-primary-50 dark:bg-primary-900/30"} group-hover:scale-110 transition-transform duration-500`}
                      >
                        <Building
                          className={`w-8 h-8 ${isFree ? "text-blue-600" : "text-primary-600"}`}
                        />
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          tenant.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                        }`}
                      >
                        {tenant.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="mb-8">
                      <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1 group-hover:text-primary-600 transition-colors line-clamp-2">
                        {tenant.companyName || tenant.name}
                      </h3>
                      <p className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-widest">
                        {tenant.slug}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-8">
                      <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                          Forms
                        </p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">
                          {stats.totalForms}
                        </p>
                      </div>
                      <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                          Responses
                        </p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">
                          {stats.totalResponses}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-gray-50 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          Quality Score
                        </span>
                        <span className="text-sm font-black text-primary-600 dark:text-primary-400">
                          {stats.performanceScore}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden shadow-inner">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${isFree ? "bg-blue-600" : "bg-primary-600"}`}
                          style={{ width: `${stats.performanceScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );

    return (
      <div className="py-4">
        {renderTenantSection(
          "Active Paid Tenants",
          paidTenants,
          "bg-green-500",
        )}
        {renderTenantSection(
          "Free Trial Signups",
          freeTrialTenants,
          "bg-blue-600",
        )}
      </div>
    );
  };

  // Render form cards (your existing code with modifications)
  const renderFormCards = () => {
    console.log("Rendering form cards...");
    console.log("Forms loading:", formsLoading);
    console.log("Responses loading:", responsesLoading);
    console.log("Forms data:", formsData);
    console.log("Filtered forms:", filteredForms.length);
    console.log("Selected tenant:", selectedTenant);

    if (formsLoading) {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading forms...</p>
        </div>
      );
    }

    if (formsError || responsesError) {
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Error loading data
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {formsError || responsesError}
          </p>
        </div>
      );
    }

    if (!formsData?.forms || formsData.forms.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No forms available
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Create your first form to get started
          </p>
        </div>
      );
    }

    if (filteredForms.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No forms found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery
              ? "No forms match your search criteria"
              : selectedTenant
                ? `No forms found for ${selectedTenant.companyName}`
                : "No forms available"}
          </p>
          {!searchQuery && selectedTenant && (
            <div className="mt-4 text-sm text-gray-500">
              <p>Make sure forms have the correct tenant ID:</p>
              <p className="font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded mt-1">
                tenantId should be: "{selectedTenant._id}" or "
                {selectedTenant.slug}"
              </p>
              <p className="mt-2">Available forms in system:</p>
              <div className="mt-1 max-h-40 overflow-y-auto">
                {formsData.forms.map((form: any, index: number) => (
                  <div key={index} className="p-2 border-b text-left">
                    <p>
                      <strong>{form.title}</strong>
                    </p>
                    <p className="text-xs">
                      tenantId:{" "}
                      {typeof form.tenantId === "object"
                        ? form.tenantId?._id
                        : form.tenantId || "null"}
                    </p>
                    {typeof form.tenantId === "object" && (
                      <p className="text-xs">
                        tenant name:{" "}
                        {form.tenantId?.companyName || form.tenantId?.name}
                      </p>
                    )}
                    <p className="text-xs">
                      shared: {JSON.stringify(form.sharedWithTenants || [])}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="relative">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
          {filteredForms.map((form: any) => {
            const stats = getFormResponseStats(form.id);
            const promoterPercentage =
              stats.total > 0
                ? ((stats.yesCount / stats.total) * 100).toFixed(1)
                : "0";
            return (
              <div
                key={form._id}
                className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 lg:p-8 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 group flex flex-col shadow-sm"
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-2xl group-hover:scale-110 transition-transform duration-500">
                    <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      form.isVisible
                        ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {form.isVisible ? "Published" : "Draft"}
                  </span>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight">
                    {form.title}
                  </h3>
                  {form.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {form.description}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8 pt-6 border-t border-gray-50 dark:border-gray-700">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                      Total Responses
                    </p>
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                      {form.responseCount || 0}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                      Success Rate
                    </p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {promoterPercentage}%
                    </p>
                  </div>
                </div>

                <div className="mt-auto space-y-6">
                  {stats.total > 0 ? (
                    <>
                      <div className="grid grid-cols-3 gap-4 py-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <div className="text-center">
                          <Smile className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Yes
                          </p>
                          <p className="text-sm font-black text-gray-900 dark:text-white">
                            {stats.yesCount}
                          </p>
                        </div>
                        <div className="text-center border-x border-gray-100 dark:border-gray-700">
                          <Frown className="w-5 h-5 text-rose-500 mx-auto mb-1" />
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            No
                          </p>
                          <p className="text-sm font-black text-gray-900 dark:text-white">
                            {stats.noCount}
                          </p>
                        </div>
                        <div className="text-center">
                          <Meh className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            N/A
                          </p>
                          <p className="text-sm font-black text-gray-900 dark:text-white">
                            {stats.naCount}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-700">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        No response data yet
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => navigate(`/forms/${form.id}/analytics`)}
                    className="w-full bg-[#1e3a8a] hover:bg-blue-800 text-white py-4 px-6 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-blue-900/10 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center group/btn"
                  >
                    View Full Analytics
                    <ChevronRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const toggleFormExpansion = (formTitle: string) => {
    setExpandedForms((prev) => {
      const next = new Set(prev);
      if (next.has(formTitle)) {
        next.delete(formTitle);
      } else {
        next.add(formTitle);
      }
      return next;
    });
  };

  const renderSummaryTable = () => {
    if (summaryLoading) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Loading summary...</p>
        </div>
      );
    }

    if (groupedSummary.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500 text-sm">
          No inspection data available for the current summary.
        </div>
      );
    }

    // Pagination logic
    const totalSummaryItems = groupedSummary.length;
    const totalSummaryPages = Math.ceil(totalSummaryItems / summaryPageSize);
    const startIndex = (summaryPage - 1) * summaryPageSize;
    const endIndex = startIndex + summaryPageSize;
    const paginatedSummary = groupedSummary.slice(startIndex, endIndex);

    return (
      <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-2 h-8 bg-blue-600 rounded-full shadow-sm shadow-blue-500/20"></div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white leading-none mb-1">
                Inspection Summary
              </h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Real-time inspection data
              </p>
            </div>
          </div>

          {/* Date Filters - Responsive */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-2xl px-4 py-2 border border-gray-200 dark:border-gray-700 shadow-sm focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
              <span className="text-[10px] font-black text-gray-400 mr-3 uppercase tracking-wider">
                From
              </span>
              <input
                type="date"
                value={summaryStartDate}
                onChange={(e) => {
                  setSummaryStartDate(e.target.value);
                  setSummaryPage(1);
                }}
                className="bg-transparent text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none w-full"
              />
            </div>
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-2xl px-4 py-2 border border-gray-200 dark:border-gray-700 shadow-sm focus-within:ring-4 focus-within:ring-blue-500/10 transition-all">
              <span className="text-[10px] font-black text-gray-400 mr-3 uppercase tracking-wider">
                To
              </span>
              <input
                type="date"
                value={summaryEndDate}
                onChange={(e) => {
                  setSummaryEndDate(e.target.value);
                  setSummaryPage(1);
                }}
                className="bg-transparent text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none w-full"
              />
            </div>
            {(summaryStartDate || summaryEndDate) && (
              <button
                onClick={() => {
                  setSummaryStartDate("");
                  setSummaryEndDate("");
                  setSummaryPage(1);
                }}
                className="px-4 py-2 text-xs font-black text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-900/20 rounded-xl transition-colors uppercase tracking-widest"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="relative bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/50 dark:shadow-none overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-md sticky top-16 z-10 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-black tracking-[0.15em]">
                <tr>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                    Tenant Name
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                    Date
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                    Shift
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                    Form Title
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap">
                    QC Inspector
                  </th>
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    Total
                  </th>
                  {/* Dynamic Status Columns */}
                  {activeSummaryStatuses.map((status) => (
                    <th
                      key={status}
                      className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center"
                    >
                      {status}
                    </th>
                  ))}
                  <th className="px-4 sm:px-6 py-5 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {paginatedSummary.map((group, groupIdx) => {
                  const isExpanded = expandedForms.has(group.formTitle);
                  // Collect all inspectors for this form
                  const inspectors = Array.from(
                    new Set(group.subItems.map((i: any) => i.qcInspector)),
                  );

                  return (
                    <React.Fragment key={groupIdx}>
                      {/* Main Group Row */}
                      <tr
                        className={`transition-colors cursor-pointer ${isExpanded ? "bg-blue-50/50 dark:bg-blue-900/20" : "hover:bg-blue-50/30 dark:hover:bg-blue-900/10"}`}
                        onClick={() => toggleFormExpansion(group.formTitle)}
                      >
                        <td className="px-4 sm:px-6 py-5 font-bold text-gray-900 dark:text-white whitespace-nowrap">
                          {group.tenantName}
                        </td>
                        <td className="px-4 sm:px-6 py-5 text-gray-400 whitespace-nowrap text-xs">
                          {isExpanded
                            ? "—"
                            : group.subItems.length > 1
                              ? `${new Date(Math.min(...group.subItems.map((i: any) => new Date(i.date).getTime()))).toLocaleDateString()} - ...`
                              : new Date(
                                  group.subItems[0].date,
                                ).toLocaleDateString()}
                        </td>
                        <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                          {!isExpanded && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              {Array.from(
                                new Set(
                                  group.subItems.map(
                                    (i: any) => i.shift || "N/A",
                                  ),
                                ),
                              ).join(", ")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-5 text-gray-900 dark:text-white whitespace-nowrap max-w-xs truncate font-black">
                          {group.formTitle}
                        </td>
                        <td className="px-4 sm:px-6 py-5 whitespace-nowrap">
                          <div className="flex items-center -space-x-2">
                            {inspectors.slice(0, 3).map((inspector: any, i) => (
                              <div
                                key={i}
                                className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 border-2 border-white dark:border-gray-800 flex items-center justify-center text-blue-700 dark:text-blue-300 font-black text-[10px] z-[i]"
                                title={inspector}
                              >
                                {inspector
                                  ?.split(" ")
                                  .map((n: string) => n[0])
                                  .join("")}
                              </div>
                            ))}
                            {inspectors.length > 3 && (
                              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 font-bold text-[10px] z-10">
                                +{inspectors.length - 3}
                              </div>
                            )}
                            {inspectors.length <= 1 && inspectors[0] && (
                              <span className="ml-3 font-bold text-gray-700 dark:text-gray-200 text-xs">
                                {inspectors[0]}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-5 text-center">
                          <span className="text-base font-black text-gray-900 dark:text-white tabular-nums">
                            {group.totalInspection}
                          </span>
                        </td>
                        {/* Dynamic Status Cells */}
                        {activeSummaryStatuses.map((status) => {
                          const count = group.statusCounts?.[status] || 0;
                          const isZero = count === 0;
                          return (
                            <td
                              key={status}
                              className={`px-4 sm:px-6 py-5 text-center font-black tabular-nums transition-opacity ${
                                isZero
                                  ? "opacity-20 text-gray-400"
                                  : status === "Direct Ok" ||
                                      status === "Rework Accepted"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : status.startsWith("Rework")
                                      ? "text-amber-600 dark:text-amber-400"
                                      : status === "Rejected"
                                        ? "text-rose-600 dark:text-rose-400"
                                        : "text-blue-600 dark:text-blue-400"
                              }`}
                            >
                              {count}
                            </td>
                          );
                        })}
                        <td className="px-4 sm:px-6 py-5 text-center">
                          <button className="p-2 hover:bg-white/50 dark:hover:bg-white/10 rounded-full transition-colors">
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Sub Items (QC Inspectors for this Form) */}
                      {isExpanded &&
                        group.subItems.map((row: any, subIdx: number) => (
                          <tr
                            key={`${groupIdx}-${subIdx}`}
                            className="bg-gray-50/30 dark:bg-gray-900/20 border-l-4 border-l-blue-500"
                          >
                            <td className="px-4 sm:px-6 py-4 opacity-50">
                              {/* Empty or same tenant */}
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap tabular-nums font-medium text-xs italic">
                              {new Date(row.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-200/50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400">
                                {row.shift || "N/A"}
                              </span>
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-gray-400 whitespace-nowrap text-xs italic">
                              {/* Same form title, usually empty or dimmed */}
                            </td>
                            <td className="px-4 sm:px-6 py-4 whitespace-nowrap pl-10">
                              <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-[8px]">
                                  {row.qcInspector
                                    ?.split(" ")
                                    .map((n: string) => n[0])
                                    .join("")}
                                </div>
                                <span className="font-bold text-gray-600 dark:text-gray-300 text-xs">
                                  {row.qcInspector}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 sm:px-6 py-4 text-center">
                              <span className="text-sm font-bold text-gray-700 dark:text-gray-200 tabular-nums">
                                {row.totalInspection}
                              </span>
                            </td>
                            {activeSummaryStatuses.map((status) => {
                              const count = row.statusCounts?.[status] || 0;
                              const isZero = count === 0;
                              return (
                                <td
                                  key={status}
                                  className={`px-4 sm:px-6 py-4 text-center font-bold text-xs tabular-nums ${isZero ? "opacity-10 text-gray-400" : "opacity-70"}`}
                                >
                                  {count}
                                </td>
                              );
                            })}
                            <td></td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Improved Responsive Pagination */}
          {totalSummaryPages > 1 && (
            <div className="bg-gray-50/50 dark:bg-gray-900/30 px-6 py-6 border-t border-gray-100 dark:border-gray-700">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 order-2 lg:order-1">
                  <div className="flex items-center bg-white dark:bg-gray-800 rounded-xl px-3 py-1.5 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mr-3">
                      Show
                    </span>
                    <select
                      value={summaryPageSize}
                      onChange={(e) => {
                        setSummaryPageSize(Number(e.target.value));
                        setSummaryPage(1);
                      }}
                      className="bg-transparent text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none"
                    >
                      {[5, 10, 20, 50].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Showing{" "}
                    <span className="text-gray-900 dark:text-white tabular-nums">
                      {startIndex + 1}-{Math.min(endIndex, totalSummaryItems)}
                    </span>{" "}
                    of{" "}
                    <span className="text-gray-900 dark:text-white tabular-nums">
                      {totalSummaryItems}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 order-1 lg:order-2">
                  <button
                    onClick={() =>
                      setSummaryPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={summaryPage === 1}
                    className="p-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm group"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-600" />
                  </button>

                  <div className="flex items-center gap-1.5 overflow-x-auto px-2 max-w-[200px] sm:max-w-none">
                    {Array.from({ length: totalSummaryPages }, (_, i) => i + 1)
                      .filter(
                        (num) =>
                          totalSummaryPages <= 5 ||
                          Math.abs(num - summaryPage) <= 1 ||
                          num === 1 ||
                          num === totalSummaryPages,
                      )
                      .map((pageNum, idx, arr) => (
                        <React.Fragment key={pageNum}>
                          {idx > 0 && arr[idx - 1] !== pageNum - 1 && (
                            <span className="text-gray-300">...</span>
                          )}
                          <button
                            onClick={() => setSummaryPage(pageNum)}
                            className={`min-w-[40px] h-10 text-xs font-black rounded-xl transition-all ${
                              summaryPage === pageNum
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm"
                            }`}
                          >
                            {pageNum}
                          </button>
                        </React.Fragment>
                      ))}
                  </div>

                  <button
                    onClick={() =>
                      setSummaryPage((prev) =>
                        Math.min(totalSummaryPages, prev + 1),
                      )
                    }
                    disabled={summaryPage === totalSummaryPages}
                    className="p-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm group"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-600" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPerformanceTable = () => {
    if (user?.role !== "admin" && user?.role !== "superadmin") return null;

    if (performanceTableLoading) {
      return (
        <div className="mt-12 text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Loading performance data...</p>
        </div>
      );
    }

    if (performanceTableData.length === 0) return null;

    // Build a map of inspectorName -> { [status]: count } from perfInspectorSummary
    const inspectorStatusMap: Record<string, Record<string, number>> = {};
    perfInspectorSummary.forEach((item: any) => {
      const name = item.qcInspector;
      if (!name) return;
      if (!inspectorStatusMap[name]) inspectorStatusMap[name] = {};
      Object.entries(item.statusCounts || {}).forEach(([status, count]) => {
        inspectorStatusMap[name][status] =
          (inspectorStatusMap[name][status] || 0) + (count as number);
      });
    });

    // Pagination logic
    const totalPerformanceItems = performanceTableData.length;
    const totalPerformancePages = Math.ceil(
      totalPerformanceItems / performancePageSize,
    );
    const startIndex = (performancePage - 1) * performancePageSize;
    const endIndex = startIndex + performancePageSize;
    const paginatedPerformance = performanceTableData.slice(
      startIndex,
      endIndex,
    );

    return (
      <div className="mt-12 border-t border-gray-100 dark:border-gray-600 pt-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-purple-600 rounded-full"></div>
            <div>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white leading-none mb-1">
                Performance Table
              </h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Per-user performance data
              </p>
            </div>
          </div>

          {/* Independent date filters for Performance Table */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-2xl px-4 py-2 border border-gray-200 dark:border-gray-700 shadow-sm focus-within:ring-4 focus-within:ring-purple-500/10 transition-all">
              <span className="text-[10px] font-black text-gray-400 mr-3 uppercase tracking-wider">
                From
              </span>
              <input
                type="date"
                value={perfStartDate}
                onChange={(e) => {
                  setPerfStartDate(e.target.value);
                  setPerformancePage(1);
                }}
                className="bg-transparent text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none w-full"
              />
            </div>
            <div className="flex items-center bg-white dark:bg-gray-800 rounded-2xl px-4 py-2 border border-gray-200 dark:border-gray-700 shadow-sm focus-within:ring-4 focus-within:ring-purple-500/10 transition-all">
              <span className="text-[10px] font-black text-gray-400 mr-3 uppercase tracking-wider">
                To
              </span>
              <input
                type="date"
                value={perfEndDate}
                onChange={(e) => {
                  setPerfEndDate(e.target.value);
                  setPerformancePage(1);
                }}
                className="bg-transparent text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none w-full"
              />
            </div>
            {(perfStartDate || perfEndDate) && (
              <button
                onClick={() => {
                  setPerfStartDate("");
                  setPerfEndDate("");
                  setPerformancePage(1);
                }}
                className="px-4 py-2 text-xs font-black text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-900/20 rounded-xl transition-colors uppercase tracking-widest"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 max-h-[600px]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-md sticky top-0 z-10 text-gray-700 dark:text-gray-300 uppercase text-[10px] font-black tracking-widest">
                <tr>
                  {isSuperAdmin && (
                    <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap">
                      Tenant
                    </th>
                  )}
                  <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap">
                    User Name
                  </th>

                  {/* NEW: dynamic status columns from Inspection Summary (Dispatched rendered separately) */}
                  {performanceStatuses
                    .filter((status) => status !== "Dispatched")
                    .map((status) => (
                      <th
                        key={status}
                        className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-indigo-600"
                      >
                        {status}
                      </th>
                    ))}

                  {/* Dispatch Pending column (before Dispatched) */}
                  <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-violet-600">
                    Dispatch Pending
                  </th>

                  {/* Dispatched column */}
                  {performanceStatuses.includes("Dispatched") && (
                    <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-indigo-600">
                      Dispatched
                    </th>
                  )}

                  <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">
                    Total Submitted
                  </th>
                  <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">
                    Total Reviewed
                  </th>
                  <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-amber-600">
                    Review Pending
                  </th>
                  <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-green-600">
                    Accepted
                  </th>
                  <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-red-600">
                    Rejected
                  </th>
                  <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-orange-600">
                    Reworked
                  </th>
                  <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">
                    Performance Score
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {paginatedPerformance.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    {isSuperAdmin && (
                      <td className="px-4 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {row.tenantName}
                      </td>
                    )}
                    <td className="px-4 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {row.name}
                    </td>

                    {/* NEW: dynamic status counts from Inspection Summary (Dispatched rendered separately) */}
                    {performanceStatuses
                      .filter((status) => status !== "Dispatched")
                      .map((status) => {
                        const count =
                          inspectorStatusMap[row.name]?.[status] || 0;
                        const isZero = count === 0;
                        const colorClass =
                          status === "Direct Ok" || status === "Rework Accepted"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : status.startsWith("Rework")
                              ? "text-amber-600 dark:text-amber-400"
                              : status === "Rejected"
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-blue-600 dark:text-blue-400";
                        return (
                          <td
                            key={status}
                            className={`px-4 py-4 font-bold text-center tabular-nums transition-opacity ${isZero ? "opacity-20 text-gray-400" : colorClass}`}
                          >
                            {count}
                          </td>
                        );
                      })}

                    {/* Dispatch Pending = (Direct Ok + Rework QC Completed) - Dispatched */}
                    {(() => {
                      const directOk =
                        inspectorStatusMap[row.name]?.["Direct Ok"] || 0;
                      const reworkQCCompleted =
                        inspectorStatusMap[row.name]?.["Rework QC Completed"] ||
                        0;
                      const dispatched =
                        inspectorStatusMap[row.name]?.["Dispatched"] || 0;
                      const dispatchPending = Math.max(
                        0,
                        directOk + reworkQCCompleted - dispatched,
                      );
                      const isZero = dispatchPending === 0;
                      return (
                        <td
                          className={`px-4 py-4 font-bold text-center tabular-nums transition-opacity ${isZero ? "opacity-20 text-gray-400" : "text-violet-600 dark:text-violet-400"}`}
                        >
                          {dispatchPending}
                        </td>
                      );
                    })()}

                    {/* Dispatched column */}
                    {performanceStatuses.includes("Dispatched") &&
                      (() => {
                        const count =
                          inspectorStatusMap[row.name]?.["Dispatched"] || 0;
                        const isZero = count === 0;
                        return (
                          <td
                            className={`px-4 py-4 font-bold text-center tabular-nums transition-opacity ${isZero ? "opacity-20 text-gray-400" : "text-blue-600 dark:text-blue-400"}`}
                          >
                            {count}
                          </td>
                        );
                      })()}

                    <td className="px-4 py-4 font-bold text-center tabular-nums">
                      {row.totalSubmitted}
                    </td>
                    <td className="px-4 py-4 font-bold text-center tabular-nums">
                      {row.totalReviewed}
                    </td>
                    {/* Review Pending = Dispatched - Total Reviewed */}
                    <td
                      className={`px-4 py-4 font-bold text-center tabular-nums ${(() => {
                        const dispatched =
                          inspectorStatusMap[row.name]?.["Dispatched"] || 0;
                        const pending = Math.max(
                          0,
                          dispatched - (row.totalReviewed || 0),
                        );
                        return pending === 0
                          ? "opacity-20 text-gray-400"
                          : "text-amber-600 dark:text-amber-400";
                      })()}`}
                    >
                      {Math.max(
                        0,
                        (inspectorStatusMap[row.name]?.["Dispatched"] || 0) -
                          (row.totalReviewed || 0),
                      )}
                    </td>
                    <td className="px-4 py-4 font-bold text-center text-green-600 tabular-nums">
                      {row.accepted}
                    </td>
                    <td className="px-4 py-4 font-bold text-center text-red-600 tabular-nums">
                      {row.rejected}
                    </td>
                    <td className="px-4 py-4 font-bold text-center text-orange-600 tabular-nums">
                      {row.rework}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-black tabular-nums ${
                          row.performanceScore >= 80
                            ? "bg-green-100 text-green-700"
                            : row.performanceScore >= 50
                              ? "bg-orange-100 text-orange-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {row.performanceScore}%
                      </span>
                    </td>
                  </tr>
                ))}

                {/* ── TOTALS ROW ── */}
                {(() => {
                  const totalDispatched = performanceTableData.reduce(
                    (sum, row) =>
                      sum + (inspectorStatusMap[row.name]?.["Dispatched"] || 0),
                    0,
                  );
                  const totalTotalSubmitted = performanceTableData.reduce(
                    (sum, row) => sum + (row.totalSubmitted || 0),
                    0,
                  );
                  const totalTotalReviewed = performanceTableData.reduce(
                    (sum, row) => sum + (row.totalReviewed || 0),
                    0,
                  );
                  const totalAccepted = performanceTableData.reduce(
                    (sum, row) => sum + (row.accepted || 0),
                    0,
                  );
                  const totalRejected = performanceTableData.reduce(
                    (sum, row) => sum + (row.rejected || 0),
                    0,
                  );
                  const totalRework = performanceTableData.reduce(
                    (sum, row) => sum + (row.rework || 0),
                    0,
                  );
                  const avgPerformance =
                    performanceTableData.length > 0
                      ? Math.round(
                          performanceTableData.reduce(
                            (sum, row) => sum + (row.performanceScore || 0),
                            0,
                          ) / performanceTableData.length,
                        )
                      : 0;

                  // Totals per dynamic status (excluding Dispatched)
                  const statusTotals: Record<string, number> = {};
                  performanceStatuses
                    .filter((s) => s !== "Dispatched")
                    .forEach((status) => {
                      statusTotals[status] = performanceTableData.reduce(
                        (sum, row) =>
                          sum + (inspectorStatusMap[row.name]?.[status] || 0),
                        0,
                      );
                    });

                  const totalDirectOk = performanceTableData.reduce(
                    (sum, row) =>
                      sum + (inspectorStatusMap[row.name]?.["Direct Ok"] || 0),
                    0,
                  );
                  const totalReworkQCCompleted = performanceTableData.reduce(
                    (sum, row) =>
                      sum +
                      (inspectorStatusMap[row.name]?.["Rework QC Completed"] ||
                        0),
                    0,
                  );
                  const totalDispatchPending = Math.max(
                    0,
                    totalDirectOk + totalReworkQCCompleted - totalDispatched,
                  );
                  const totalReviewPending = Math.max(
                    0,
                    totalDispatched - totalTotalReviewed,
                  );

                  return (
                    <tr className="bg-gray-100 dark:bg-gray-700 border-t-2 border-gray-300 dark:border-gray-500 font-black text-gray-900 dark:text-white">
                      {isSuperAdmin && (
                        <td className="px-4 py-4 whitespace-nowrap text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
                          —
                        </td>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-200">
                        Total
                      </td>

                      {performanceStatuses
                        .filter((s) => s !== "Dispatched")
                        .map((status) => (
                          <td
                            key={status}
                            className={`px-4 py-4 text-center tabular-nums font-black ${
                              status === "Direct Ok" ||
                              status === "Rework Accepted"
                                ? "text-emerald-700 dark:text-emerald-300"
                                : status.startsWith("Rework")
                                  ? "text-amber-700 dark:text-amber-300"
                                  : status === "Rejected"
                                    ? "text-rose-700 dark:text-rose-300"
                                    : "text-blue-700 dark:text-blue-300"
                            }`}
                          >
                            {statusTotals[status] || 0}
                          </td>
                        ))}

                      <td className="px-4 py-4 text-center tabular-nums font-black text-violet-700 dark:text-violet-300">
                        {totalDispatchPending}
                      </td>

                      {performanceStatuses.includes("Dispatched") && (
                        <td className="px-4 py-4 text-center tabular-nums font-black text-blue-700 dark:text-blue-300">
                          {totalDispatched}
                        </td>
                      )}

                      <td className="px-4 py-4 text-center tabular-nums font-black">
                        {totalTotalSubmitted}
                      </td>
                      <td className="px-4 py-4 text-center tabular-nums font-black">
                        {totalTotalReviewed}
                      </td>
                      <td className="px-4 py-4 text-center tabular-nums font-black text-amber-700 dark:text-amber-300">
                        {totalReviewPending}
                      </td>
                      <td className="px-4 py-4 text-center tabular-nums font-black text-green-700 dark:text-green-300">
                        {totalAccepted}
                      </td>
                      <td className="px-4 py-4 text-center tabular-nums font-black text-red-700 dark:text-red-300">
                        {totalRejected}
                      </td>
                      <td className="px-4 py-4 text-center tabular-nums font-black text-orange-700 dark:text-orange-300">
                        {totalRework}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-black tabular-nums ${
                            avgPerformance >= 80
                              ? "bg-green-200 text-green-800"
                              : avgPerformance >= 50
                                ? "bg-orange-200 text-orange-800"
                                : "bg-red-200 text-red-800"
                          }`}
                        >
                          {avgPerformance}%
                        </span>
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls - Responsive */}
          {totalPerformancePages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gray-50/30 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Show
                </label>
                <select
                  value={performancePageSize}
                  onChange={(e) => {
                    setPerformancePageSize(Number(e.target.value));
                    setPerformancePage(1);
                  }}
                  className="px-2 py-1 text-xs font-bold border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none"
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest hidden xs:inline">
                  {startIndex + 1}-{Math.min(endIndex, totalPerformanceItems)}{" "}
                  of {totalPerformanceItems}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPerformancePage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={performancePage === 1}
                  className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-30 transition-all hover:bg-gray-50 shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1 overflow-x-auto max-w-[120px] sm:max-w-none scrollbar-none">
                  {Array.from(
                    { length: totalPerformancePages },
                    (_, i) => i + 1,
                  )
                    .filter(
                      (num) =>
                        totalPerformancePages <= 3 ||
                        Math.abs(num - performancePage) <= 1 ||
                        num === 1 ||
                        num === totalPerformancePages,
                    )
                    .map((pageNum, idx, arr) => (
                      <React.Fragment key={pageNum}>
                        {idx > 0 && arr[idx - 1] !== pageNum - 1 && (
                          <span className="text-gray-300 text-[10px]">...</span>
                        )}
                        <button
                          onClick={() => setPerformancePage(pageNum)}
                          className={`min-w-[28px] h-7 text-[10px] font-black rounded-lg transition-all ${
                            performancePage === pageNum
                              ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                              : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          {pageNum}
                        </button>
                      </React.Fragment>
                    ))}
                </div>

                <button
                  onClick={() =>
                    setPerformancePage((prev) =>
                      Math.min(totalPerformancePages, prev + 1),
                    )
                  }
                  disabled={performancePage === totalPerformancePages}
                  className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-30 transition-all hover:bg-gray-50 shadow-sm"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Determine page title based on user role
  const getPageTitle = () => {
    if (viewMode === "tenants") {
      return "All Tenants";
    } else if (viewMode === "forms" && selectedTenant) {
      return `${selectedTenant.companyName || selectedTenant.name} - Forms`;
    } else if (!isSuperAdmin && currentTenant) {
      return `${currentTenant.companyName} - Forms`;
    }
    return "Forms";
  };

  // Determine if we should show back button
  const showBackButton = () => {
    return isSuperAdmin && viewMode === "forms" && selectedTenant;
  };

  // Determine if we should show search bar
  const showSearchBar = () => {
    return viewMode === "forms";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      {/* Tenant Info Banner - Hide for inspectors */}
      {currentTenant && !isInspector && (
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-4 lg:space-y-2">
              <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300 uppercase tracking-widest">
                Tenant Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-4 lg:gap-8 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">
                    Business:
                  </span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">
                    {currentTenant.companyName}
                  </span>
                </div>
                {/* <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">ID:</span>
                  <code className="px-2 py-0.5 bg-white dark:bg-gray-800 rounded border border-blue-100 dark:border-blue-800 font-bold text-blue-700 dark:text-blue-400">{currentTenant._id}</code>
                </div> */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">
                    Slug:
                  </span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">
                    {currentTenant.slug}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">
                    Role:
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
                    {user?.role}
                  </span>
                </div>
              </div>
            </div>
            {currentTenant.slug &&
              currentTenant.settings?.showCustomerPortal && (
                <div className="lg:text-right pt-4 lg:pt-0 border-t lg:border-t-0 border-blue-100 dark:border-blue-800">
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">
                    Customer Portal
                  </p>
                  <a
                    href={`https://3wheelertvs.focusengineeringapp.com/${currentTenant.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm font-bold text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 transition-colors break-all"
                  >
                    <Eye className="w-4 h-4 mr-2 flex-shrink-0" />
                    {`3wheelertvs.focusengineeringapp.com/${currentTenant.slug}`}
                  </a>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Main Dashboard Container */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 sm:p-6 lg:p-8 shadow-sm">
        {/* Header with Breadcrumb */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              {showBackButton() && (
                <button
                  onClick={handleBackToTenants}
                  className="p-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl text-blue-600 dark:text-blue-400 transition-all group shadow-sm"
                  title="Back to Tenants"
                >
                  <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                </button>
              )}
              <h2 className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                {getPageTitle()}
              </h2>
            </div>

            {/* Search Bar - Responsive width */}
            {showSearchBar() && !isInspector && (
              <div className="relative w-full sm:max-w-xs md:max-w-sm lg:max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors group-focus-within:text-blue-500" />
                <input
                  type="text"
                  placeholder="Search forms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all shadow-sm"
                />
              </div>
            )}
          </div>

          {/* Stats Summary - Responsive Grid */}
          {viewMode === "forms" &&
            selectedTenant &&
            !isInspector &&
            tenantStats[selectedTenant._id] && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
                <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl p-4 sm:p-6 border border-blue-100 dark:border-blue-900/20 group hover:bg-blue-50 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/40 rounded-xl group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold text-blue-600/50 dark:text-blue-400/50 uppercase tracking-widest">
                      Forms
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                    {tenantStats[selectedTenant._id].totalForms}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
                    Active managed forms
                  </p>
                </div>

                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl p-4 sm:p-6 border border-emerald-100 dark:border-emerald-900/20 group hover:bg-emerald-50 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 sm:p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl group-hover:scale-110 transition-transform">
                      <Users className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold text-emerald-600/50 dark:text-emerald-400/50 uppercase tracking-widest">
                      Growth
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                    {tenantStats[selectedTenant._id].totalResponses}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
                    Total user submissions
                  </p>
                </div>

                <div className="bg-purple-50/50 dark:bg-purple-900/10 rounded-2xl p-4 sm:p-6 border border-purple-100 dark:border-purple-900/20 group hover:bg-purple-50 transition-colors sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/40 rounded-xl group-hover:scale-110 transition-transform">
                      <Smile className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold text-purple-600/50 dark:text-purple-400/50 uppercase tracking-widest">
                      Performance
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                      {tenantStats[selectedTenant._id].performanceScore}%
                    </p>
                    <div className="flex-1 h-2 bg-purple-100 dark:bg-purple-900/40 rounded-full overflow-hidden ml-4">
                      <div
                        className="h-full bg-purple-600 rounded-full"
                        style={{
                          width: `${tenantStats[selectedTenant._id].performanceScore}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
                    Average quality score
                  </p>
                </div>
              </div>
            )}

          {/* New Review Breakdown Chart - Show for all users when data is available */}
          {!isSuperAdmin && (
            <MyReviewBreakdownChart myReviewStats={myReviewStats} />
          )}
        </div>

        {/* Debug Info - Remove in production 
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
            <p className="font-semibold">Debug Info:</p>
            <p>User Role: {user?.role}</p>
            <p>Is Superadmin: {isSuperAdmin ? 'Yes' : 'No'}</p>
            <p>View Mode: {viewMode}</p>
            <p>Selected Tenant: {selectedTenant?.companyName || 'None'}</p>
            <p>Selected Tenant ID: {selectedTenant?._id || 'None'}</p>
            <p>Selected Tenant Slug: {selectedTenant?.slug || 'None'}</p>
            <p>Total Forms in System: {formsData?.forms?.length || 0}</p>
            <p>Filtered Forms: {filteredForms.length}</p>
          </div>
        )}
          */}

        {/* Content Area */}
        {viewMode === "tenants" ? renderTenantCards() : renderFormCards()}

        {/* Inspection Summary Table - Visible for all but specially important for inspectors */}
        {renderSummaryTable()}

        {/* Performance Table - Visible for admins and superadmins */}
        {renderPerformanceTable()}
      </div>
    </div>
  );
}