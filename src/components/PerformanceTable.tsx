
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";
import { Users, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";

const PerformanceTable = ({
  useInternalTrackingEndpoint = false,
}: {
  useInternalTrackingEndpoint?: boolean;
}) => {
  const { user } = useAuth();
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

  const [showPerformanceTable, setShowPerformanceTable] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Pagination states
  const [performancePage, setPerformancePage] = useState(1);
  const [performancePageSize, setPerformancePageSize] = useState(10);

  const isSuperAdmin = user?.role === "superadmin";

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

  const toggleRowExpansion = (userName: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(userName)) {
        next.delete(userName);
      } else {
        next.add(userName);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!showPerformanceTable || !user) {
      return;
    }
    
    // Block non-admin/inspector users only in non-internal tracking mode
    if (!useInternalTrackingEndpoint && user.role !== "admin" && user.role !== "superadmin") {
      return;
    }

    let cancelled = false;
    const fetchAndProcessData = async () => {
      setPerformanceTableLoading(true);
      try {
        // 1. Fetch all data concurrently
        const usersPromise = Promise.all([
            apiClient.getUsers({ role: "admin", limit: 100 }),
            apiClient.getUsers({ role: "subadmin", limit: 100 }),
            apiClient.getUsers({ role: "inspector", limit: 100 }),
        ]);

        let summaryUrl = "/analytics/inspector-summary";
        const params = new URLSearchParams();
        if (perfStartDate) params.append("startDate", perfStartDate);
        if (perfEndDate) params.append("endDate", perfEndDate);
        const queryString = params.toString();
        if (queryString) summaryUrl += `?${queryString}`;
        const summaryPromise = apiClient.get<any>(summaryUrl);
        
        const tablePromise = useInternalTrackingEndpoint
          ? apiClient.get("/internal-tracking/performance", {
              params: { startDate: perfStartDate, endDate: perfEndDate },
            })
          : apiClient.getPerformanceTable({
              startDate: perfStartDate,
              endDate: perfEndDate,
            });

        const [[adminData, subadminData, inspectorData], summaryResponse, tableResponse] = await Promise.all([usersPromise, summaryPromise, tablePromise]);

        if (cancelled) return;

        // 2. Process users to get activeUserNames
        const allUsers = [
          ...(Array.isArray(adminData.users) ? adminData.users : []),
          ...(Array.isArray(subadminData.users) ? subadminData.users : []),
          ...(Array.isArray(inspectorData.users) ? inspectorData.users : []),
        ];
        const activeUsers = buildActiveUserNames(allUsers);
        setActiveUserNames(activeUsers);

        const localIsInspectorActive = (item: any) => {
            if (!isUserActive(item)) return false;
            const inspectorName = getInspectorName(item);
            if (!inspectorName || activeUsers.size === 0) return true;
            const aliases = getUserNameAliases({ username: inspectorName });
            return Array.from(aliases).some((alias) => activeUsers.has(alias));
        };

        // 3. Process summary and table data
        const summaryData = summaryResponse.data.summary || [];
        setPerfInspectorSummary(summaryData);

        const tableData = useInternalTrackingEndpoint ? tableResponse.data : tableResponse.success ? tableResponse.data : [];

        const dispatchMap = new Map<string, number>();
        summaryData.forEach((item: any) => {
          const userName = item.qcInspector;
          if (userName && item.statusCounts?.Dispatched) {
            dispatchMap.set(userName, (dispatchMap.get(userName) || 0) + (item.statusCounts.Dispatched || 0));
          }
        });

        const filteredRows = tableData.filter(
          (row: any) =>
            isUserActive(row) &&
            localIsInspectorActive(row) &&
            row.performanceScore >= 0,
        );

        const mergedData = filteredRows.map((row: any) => ({
          ...row,
          dispatched: dispatchMap.get(row.name) || row.dispatched || 0,
        }));

        setPerformanceTableData(mergedData);

      } catch (error) {
        console.error("Error fetching performance data:", error);
        if (!cancelled) {
          setPerformanceTableData([]);
          setPerfInspectorSummary([]);
          setActiveUserNames(new Set());
        }
      } finally {
        if (!cancelled) {
          setPerformanceTableLoading(false);
        }
      }
    };

    fetchAndProcessData();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    perfStartDate,
    perfEndDate,
    showPerformanceTable,
    buildActiveUserNames,
    isUserActive,
    getUserNameAliases,
    getInspectorName,
    useInternalTrackingEndpoint
  ]);

  const performanceStatuses = useMemo(() => {
    const isNumeric = (str: string) => /^\d+$/.test(str);
    const statuses = Array.from(
      new Set(
        perfInspectorSummary.flatMap((item: any) =>
          Object.keys(item.statusCounts || {}),
        ),
      ),
    );
    return statuses.filter(status => !isNumeric(status));
  }, [perfInspectorSummary]);

  const {
    inspectorStatusMap,
    totalPerformanceItems,
    totalPerformancePages,
    startIndex,
    endIndex,
    paginatedPerformance,
    totalDispatched,
    totalTotalSubmitted,
    totalTotalReviewed,
    totalAccepted,
    totalRejected,
    totalRework,
    avgPerformance,
    statusTotals,
    totalDirectOk,
    totalReworkQCCompleted,
    totalDispatchPending,
    totalReviewPending,
  } = useMemo(() => {
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

    return {
      inspectorStatusMap,
      totalPerformanceItems,
      totalPerformancePages,
      startIndex,
      endIndex,
      paginatedPerformance,
      totalDispatched,
      totalTotalSubmitted,
      totalTotalReviewed,
      totalAccepted,
      totalRejected,
      totalRework,
      avgPerformance,
      statusTotals,
      totalDirectOk,
      totalReworkQCCompleted,
      totalDispatchPending,
      totalReviewPending,
    };
  }, [performanceTableData, perfInspectorSummary, performancePage, performancePageSize, performanceStatuses]);

  if (!useInternalTrackingEndpoint && user?.role !== "admin" && user?.role !== "superadmin") return null;

  if (!showPerformanceTable) {
    return (
      <div className="mt-12 border-t border-gray-100 dark:border-gray-600 pt-8">
        <div className="flex items-center gap-3 mb-6">
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

        <button
          onClick={() => setShowPerformanceTable(true)}
          className="w-full py-8 bg-purple-50 dark:bg-purple-900/10 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-3xl hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-all group"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-purple-700 dark:text-purple-300">
                Load Performance Table
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                View per-user performance data
              </p>
            </div>
          </div>
        </button>
      </div>
    );
  }

  if (performanceTableLoading) {
    return (
      <div className="mt-12 text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-500 text-sm">Loading performance data...</p>
      </div>
    );
  }

  if (performanceTableData.length === 0) {
    return (
      <div className="mt-12 border-t border-gray-100 dark:border-gray-600 pt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-6 bg-purple-600 rounded-full"></div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">
            Performance Table
          </h3>
        </div>
        <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 dark:bg-gray-900/20 rounded-2xl border border-gray-100 dark:border-gray-700">
          No performance data available for the selected date range.
          <button
            onClick={() => {
              setShowPerformanceTable(false);
              setTimeout(() => setShowPerformanceTable(true), 100);
            }}
            className="block mx-auto mt-3 px-4 py-2 text-xs font-bold text-purple-600 hover:text-purple-700 bg-purple-50 rounded-xl transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
                const today = new Date().toISOString().split("T")[0];
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                setPerfStartDate(sevenDaysAgo.toISOString().split("T")[0]);
                setPerfEndDate(today);
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
         <div className="max-h-[600px] overflow-y-auto">
           <table className="w-full text-[11px] text-left border-collapse">
             <thead className="bg-gray-50/80 dark:bg-gray-700/80 sticky top-0 z-10 text-gray-700 dark:text-gray-300 uppercase text-[9px] font-black tracking-wider">
               <tr>
                 {isSuperAdmin && (
                   <th className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap">
                     Tenant
                   </th>
                 )}
                 <th className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap">
                   User Name
                 </th>
                 {performanceStatuses
                   .filter((status) => status !== "Dispatched")
                   .map((status) => (
                     <th
                       key={status}
                       className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-indigo-600"
                     >
                       {status}
                     </th>
                   ))}
                 <th className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-violet-600">
                   Dispatch Pending
                 </th>
                 {performanceStatuses.includes("Dispatched") && (
                   <th className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-indigo-600">
                     Dispatched
                   </th>
                 )}
                 <th className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">
                   Total Submitted
                 </th>
                 <th className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">
                   Total Reviewed
                 </th>
                 <th className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-amber-600">
                   Review Pending
                 </th>
                 <th className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-green-600">
                   Accepted
                 </th>
                 <th className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-red-600">
                   Rejected
                 </th>
                 <th className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center text-orange-600">
                   Reworked
                 </th>
                 <th className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">
                   Performance Score
                 </th>
                 <th className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">
                   Performance Category
                 </th>
                 <th className="px-2 py-2 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap text-center">
                   Actions
                 </th>
               </tr>
             </thead>
 <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
               {paginatedPerformance.map((row, idx) => (
                 <React.Fragment key={row.name || idx}>
                   <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer" onClick={() => toggleRowExpansion(row.name)}>
                     {isSuperAdmin && (
                       <td className="px-2 py-1.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                         {row.tenantName}
                       </td>
                     )}
                     <td className="px-2 py-1.5 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                       {row.name}
                     </td>
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
                            className={`px-2 py-1.5 font-bold text-center tabular-nums transition-opacity ${isZero ? "opacity-20 text-gray-400" : colorClass}`}
                          >
                            {count}
                          </td>
                        );
                      })}
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
                          className={`px-2 py-1.5 font-bold text-center tabular-nums transition-opacity ${isZero ? "opacity-20 text-gray-400" : "text-violet-600 dark:text-violet-400"}`}
                        >
                          {dispatchPending}
                        </td>
                      );
                    })()}
                    {performanceStatuses.includes("Dispatched") &&
                      (() => {
                        const count =
                          inspectorStatusMap[row.name]?.["Dispatched"] || 0;
                        const isZero = count === 0;
                        return (
                          <td
                            className={`px-2 py-1.5 font-bold text-center tabular-nums transition-opacity ${isZero ? "opacity-20 text-gray-400" : "text-blue-600 dark:text-blue-400"}`}
                          >
                            {count}
                          </td>
                        );
                      })()}
                    <td className="px-2 py-1.5 font-bold text-center tabular-nums">
                      {row.totalSubmitted}
                    </td>
                    <td className="px-2 py-1.5 font-bold text-center tabular-nums">
                      {row.totalReviewed}
                    </td>
                    <td
                      className={`px-2 py-1.5 font-bold text-center tabular-nums ${(() => {
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
                    <td className="px-2 py-1.5 font-bold text-center text-green-600 tabular-nums">
                      {row.accepted}
                    </td>
                    <td className="px-2 py-1.5 font-bold text-center text-red-600 tabular-nums">
                      {row.rejected}
                    </td>
                    <td className="px-2 py-1.5 font-bold text-center text-orange-600 tabular-nums">
                      {row.rework}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-black tabular-nums ${row.performanceScore >= 80
                            ? "bg-green-100 text-green-700"
                            : row.performanceScore >= 50
                              ? "bg-orange-100 text-orange-700"
                              : "bg-red-100 text-red-700"
                            }`}
                      >
                        {row.performanceScore}%
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-black ${(() => {
                          const score = row.performanceScore || 0;
                          if (score < 60) return "bg-red-100 text-red-700";
                          if (score < 70) return "bg-orange-100 text-orange-700";
                          if (score < 80) return "bg-yellow-100 text-yellow-700";
                          if (score < 90) return "bg-green-100 text-green-700";
                          return "bg-emerald-100 text-emerald-700";
                        })()}`}
                      >
                        {(() => {
                          const score = row.performanceScore || 0;
                          if (score < 60) return "Not met performer";
                          if (score < 70) return "partially met performer";
                          if (score < 80) return "Met expectation";
                          if (score < 90) return "exceeded Performance";
                          return "Exemplary performer"}
                        )()}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleRowExpansion(row.name); }}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                        title={expandedRows.has(row.name) ? "Collapse" : "Expand"}
                      >
                        {expandedRows.has(row.name) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>

                  {expandedRows.has(row.name) &&
                    (() => {
                      // 1. Group summary items by form
                      const forms = new Map<string, any[]>();
                      perfInspectorSummary
                        .filter((item: any) => item.qcInspector === row.name)
                        .forEach((item: any) => {
                          const formName = item.formTitle || "Unknown Form";
                          if (!forms.has(formName)) forms.set(formName, []);
                          forms.get(formName)!.push(item);
                        });

                      if (forms.size === 0) return null;

                      // 2. Map over forms to create a <React.Fragment> of <tr> elements
                      return Array.from(forms.entries()).map(([formName, items], formIdx) => {
                        // 3. For each form, calculate the summary stats, including review outcomes
                        const formSummary = (items as any[]).reduce((acc, it) => {
                            const sc = it.statusCounts || {};
                            for (const status in sc) {
                                acc.statuses[status] = (acc.statuses[status] || 0) + sc[status];
                            }
                            acc.totalReviewed += it.totalReviewed || 0;
                            acc.accepted += it.accepted || 0;
                            acc.rework += it.rework || 0;
                            acc.rejected_outcome += it.rejected || 0;
                            return acc;
                        }, {
                            statuses: {} as Record<string, number>,
                            totalReviewed: 0,
                            accepted: 0,
                            rework: 0,
                            rejected_outcome: 0,
                        });

                        const v = formSummary.statuses;
                        const directOk = v["Direct Ok"] || 0;
                        const reworkQCCompleted = v["Rework QC Completed"] || 0;
                        const dispatched = v["Dispatched"] || 0;
                        
                        const totalSubmitted = performanceStatuses
                          .filter(s => s !== 'Dispatched')
                          .reduce((sum, status) => sum + (v[status] || 0), 0);

                        const { totalReviewed, accepted, rework, rejected_outcome } = formSummary;

                        const dispatchPending = Math.max(0, directOk + reworkQCCompleted - dispatched);
                        const reviewPending = Math.max(0, dispatched - totalReviewed);
                        
                        const rowBg = formIdx % 2 === 0 ? "bg-purple-50/20 dark:bg-purple-900/10" : "bg-purple-50/40 dark:bg-purple-900/20";
                        
                        return (
                          <tr key={`${row.name}-${formName}-${formIdx}`} className={rowBg}>
                            {isSuperAdmin && <td className="px-2 py-1.5"></td>}
                            <td className="px-2 py-1.5 font-medium text-purple-800 dark:text-purple-200 whitespace-nowrap pl-6 truncate">
                              {formName}
                            </td>
                            {performanceStatuses.filter(s => s !== 'Dispatched').map(status => (
                              <td key={status} className="px-2 py-1.5 font-bold text-center tabular-nums">
                                {v[status] || 0}
                              </td>
                            ))}
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums">{dispatchPending}</td>
                            {performanceStatuses.includes("Dispatched") && (
                                <td className="px-2 py-1.5 font-bold text-center tabular-nums">
                                    {dispatched}
                                </td>
                            )}
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums">{totalSubmitted}</td>
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums">{totalReviewed}</td>
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums">{reviewPending}</td>
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums">{accepted}</td>
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums">{rejected_outcome}</td>
                            <td className="px-2 py-1.5 font-bold text-center tabular-nums">{rework}</td>
                            {/* Empty cells for alignment */}
                            <td className="px-2 py-1.5"></td>
                            <td className="px-2 py-1.5"></td>
                            <td className="px-2 py-1.5"></td>
                          </tr>
                        );
                      });
                    })()}
                </React.Fragment>
              ))}
<tr className="bg-gray-100 dark:bg-gray-700 border-t-2 border-gray-300 dark:border-gray-500 font-black text-gray-900 dark:text-white">
              {isSuperAdmin && (
                <td className="px-2 py-1.5 whitespace-nowrap text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  —
                </td>
              )}
              <td className="px-2 py-1.5 whitespace-nowrap text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-200">
                Total
              </td>
              {performanceStatuses
                .filter((s) => s !== "Dispatched")
                .map((status) => (
                  <td
                    key={status}
                    className={`px-2 py-1.5 text-center tabular-nums font-black ${status === "Direct Ok" ||
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
              <td className="px-2 py-1.5 text-center tabular-nums font-black text-violet-700 dark:text-violet-300">
                {totalDispatchPending}
              </td>
              {performanceStatuses.includes("Dispatched") && (
                <td className="px-2 py-1.5 text-center tabular-nums font-black text-blue-700 dark:text-blue-300">
                  {totalDispatched}
                </td>
              )}
              <td className="px-2 py-1.5 text-center tabular-nums font-black">
                {totalTotalSubmitted}
              </td>
              <td className="px-2 py-1.5 text-center tabular-nums font-black">
                {totalTotalReviewed}
              </td>
              <td className="px-2 py-1.5 text-center tabular-nums font-black text-amber-700 dark:text-amber-300">
                {totalReviewPending}
              </td>
              <td className="px-2 py-1.5 text-center tabular-nums font-black text-green-700 dark:text-green-300">
                {totalAccepted}
              </td>
              <td className="px-2 py-1.5 text-center tabular-nums font-black text-red-700 dark:text-red-300">
                {totalRejected}
              </td>
              <td className="px-2 py-1.5 text-center tabular-nums font-black text-orange-700 dark:text-orange-300">
                {totalRework}
              </td>
              <td className="px-2 py-1.5 text-center">
                <span
                  className={`px-2 py-1 rounded-full text-[10px] font-black tabular-nums ${avgPerformance >= 80
                      ? "bg-green-200 text-green-800"
                      : avgPerformance >= 50
                        ? "bg-orange-200 text-orange-800"
                        : "bg-red-200 text-red-800"
                    }`}
                >
                  {avgPerformance}%
                </span>
              </td>
              <td className="px-2 py-1.5 text-center">
                <span
                  className={`px-2 py-1 rounded-full text-[10px] font-black ${(() => {
                    if (avgPerformance < 60) return "bg-red-100 text-red-700";
                    if (avgPerformance < 70) return "bg-orange-100 text-orange-700";
                    if (avgPerformance < 80) return "bg-yellow-100 text-yellow-700";
                    if (avgPerformance < 90) return "bg-green-100 text-green-700";
                    return "bg-emerald-100 text-emerald-700";
                  })()}`}
                >
                  {avgPerformance < 60
                    ? "Not met performer"
                    : avgPerformance < 70
                      ? "partially met performer"
                      : avgPerformance < 80
                        ? "Met expectation"
                        : avgPerformance < 90
                          ? "exceeded Performance"
                          : "Exemplary performer"}
                </span>
              </td>
              <td className="px-2 py-1.5 text-center">
                <span className="text-xs text-gray-400">—</span>
              </td>
            </tr>
            </tbody>
          </table>
        </div>
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
                        className={`min-w-[28px] h-7 text-[10px] font-black rounded-lg transition-all ${performancePage === pageNum
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

export default PerformanceTable;
