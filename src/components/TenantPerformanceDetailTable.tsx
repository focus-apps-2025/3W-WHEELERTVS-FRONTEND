
import React, { useState, useEffect, useMemo } from "react";
import { apiClient } from "../api/client";
import { Users, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

const getPerformanceCategory = (score: number) => {
    if (score >= 90) return "Exemplary performer";
    if (score >= 80) return "Exceeded Performance";
    if (score >= 70) return "Met expectation";
    if (score >= 60) return "Partially met performer";
    return "Not met performer";
  };

  const getCategoryBadgeColor = (score: number) => {
    if (score >= 90)
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    if (score >= 80)
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    if (score >= 70)
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    if (score >= 60)
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  };

export default function TenantPerformanceDetailTable({ tenant, onBack }: { tenant: any, onBack: () => void }) {
  const [performanceTableData, setPerformanceTableData] = useState<any[]>([]);
  const [performanceTableLoading, setPerformanceTableLoading] = useState(false);
  const [perfStartDate, setPerfStartDate] = useState("");
  const [perfEndDate, setPerfEndDate] = useState("");
  const [perfInspectorSummary, setPerfInspectorSummary] = useState<any[]>([]);
  const [performancePage, setPerformancePage] = useState(1);
  const [performancePageSize, setPerformancePageSize] = useState(10);
  
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const fetchAllData = async () => {
      setPerformanceTableLoading(true);
      setPerformanceTableData([]); // Clear previous data

      try {
        // Step 1: Fetch Inspector Summary
        let summaryUrl = `/analytics/inspector-summary`;
        const summaryParams = new URLSearchParams();
        if (perfStartDate) summaryParams.append("startDate", perfStartDate);
        if (perfEndDate) summaryParams.append("endDate", perfEndDate);
        summaryParams.append("tenantId", tenant._id);
        
        const summaryQueryString = summaryParams.toString();
        if (summaryQueryString) summaryUrl += `?${summaryQueryString}`;
        
        const summaryResponse = await apiClient.get<any>(summaryUrl, { signal });
        if (signal.aborted) return;

        const summaryData = summaryResponse.data?.summary || [];
        const dispatchMap = new Map<string, number>();
        summaryData.forEach((item: any) => {
          const userName = item.qcInspector;
          if (userName && item.statusCounts?.Dispatched) {
            const currentCount = dispatchMap.get(userName) || 0;
            dispatchMap.set(
              userName,
              currentCount + (item.statusCounts.Dispatched || 0),
            );
          }
        });

        // Step 2: Fetch Performance Table
        const tableResponse = await apiClient.getPerformanceTable({
          startDate: perfStartDate,
          endDate: perfEndDate,
          tenantId: tenant._id
        }, { signal });
        
        if (signal.aborted) return;

        if (tableResponse.success) {
          const mergedData = tableResponse.data.map((row: any) => ({
            ...row,
            dispatched: dispatchMap.get(row.name) || row.dispatched || 0,
          }));
          setPerformanceTableData(mergedData);
        }

      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Error fetching performance data:", error);
        }
      } finally {
        if (!signal.aborted) {
          setPerformanceTableLoading(false);
        }
      }
    };

    fetchAllData();

    return () => {
      controller.abort();
    };
  }, [tenant._id, perfStartDate, perfEndDate]);

  const total = useMemo(() => performanceTableData.reduce(
    (acc, user) => {
      acc.dispatchPending += user.dispatched || 0;
      acc.totalSubmitted += user.totalSubmitted || 0;
      acc.totalReviewed += user.totalReviewed || 0;
      acc.reviewPending += user.reviewPending || 0;
      acc.accepted += user.accepted || 0;
      acc.rejected += user.rejected || 0;
      acc.reworked += user.reworked || 0;
      return acc;
    },
    {
      dispatchPending: 0,
      totalSubmitted: 0,
      totalReviewed: 0,
      reviewPending: 0,
      accepted: 0,
      rejected: 0,
      reworked: 0,
    },
  ), [performanceTableData]);

  const totalPerformanceScore = useMemo(() =>
    performanceTableData.length > 0
      ? Math.round(
          performanceTableData.reduce(
            (sum, user) => sum + (user.performanceScore || 0),
            0,
          ) / performanceTableData.length,
        )
      : 0, [performanceTableData]);
    
  const totalPages = Math.ceil(performanceTableData.length / performancePageSize);
  const paginatedData = useMemo(() => performanceTableData.slice(
    (performancePage - 1) * performancePageSize,
    performancePage * performancePageSize,
  ), [performanceTableData, performancePage, performancePageSize]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
        <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                        <Users className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                            {tenant.companyName}
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Per-user performance data
                        </p>
                    </div>
                </div>
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>
            </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-none overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-purple-600 rounded-full"></div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white leading-none">
              Performance Table
            </h3>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center bg-gray-50 dark:bg-gray-900/50 rounded-xl px-4 py-2 border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-purple-500 transition-all">
              <span className="text-[10px] font-black text-gray-400 mr-3 uppercase tracking-wider">
                From
              </span>
              <input
                type="date"
                value={perfStartDate}
                onChange={(e) => setPerfStartDate(e.target.value)}
                className="bg-transparent text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none w-full"
              />
            </div>
            <div className="flex items-center bg-gray-50 dark:bg-gray-900/50 rounded-xl px-4 py-2 border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-purple-500 transition-all">
              <span className="text-[10px] font-black text-gray-400 mr-3 uppercase tracking-wider">
                To
              </span>
              <input
                type="date"
                value={perfEndDate}
                onChange={(e) => setPerfEndDate(e.target.value)}
                className="bg-transparent text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none w-full"
              />
            </div>
            {(perfStartDate || perfEndDate) && (
              <button
                onClick={() => {
                  setPerfStartDate("");
                  setPerfEndDate("");
                }}
                className="px-4 py-2 text-xs font-black text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-900/20 rounded-xl transition-colors uppercase tracking-widest"
              >
                Clear
              </button>
            )}
          </div>
        </div>

            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
            <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-md sticky top-0 z-10 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-black tracking-[0.1em]">
              <tr>
                <th className="px-4 py-4 border-b border-gray-100 dark:border-gray-700">User Name</th>
                <th className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 text-center">Dispatch Pending</th>
                <th className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 text-center">Total Submitted</th>
                <th className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 text-center">Total Reviewed</th>
                <th className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 text-center">Review Pending</th>
                <th className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 text-center text-emerald-600">Accepted</th>
                <th className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 text-center text-rose-600">Rejected</th>
                <th className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 text-center text-amber-600">Reworked</th>
                <th className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 text-center">Performance Score</th>
                <th className="px-4 py-4 border-b border-gray-100 dark:border-gray-700 text-center">Performance Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {performanceTableLoading ? (
                    <tr>
                        <td colSpan={10} className="text-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent mx-auto mb-4"></div>
                            <p className="text-gray-500 text-sm">Loading performance data...</p>
                        </td>
                    </tr>
                ) : paginatedData.length === 0 ? (
                    <tr>
                        <td colSpan={10} className="text-center py-16">
                            <Users className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">No User Data</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No performance data found for the selected period.</p>
                        </td>
                    </tr>
                ) : (
                    <>
                    {paginatedData.map((user, idx) => (
                        <tr key={user.userId || idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20 transition-colors">
                        <td className="px-4 py-4 font-bold text-gray-800 dark:text-white whitespace-nowrap">{user.name}</td>
                        <td className="px-4 py-4 text-center font-bold text-blue-600 dark:text-blue-400 tabular-nums">{user.dispatched || 0}</td>
                        <td className="px-4 py-4 text-center font-bold text-gray-700 dark:text-gray-300 tabular-nums">{user.totalSubmitted}</td>
                        <td className="px-4 py-4 text-center font-bold text-gray-700 dark:text-gray-300 tabular-nums">{user.totalReviewed}</td>
                        <td className="px-4 py-4 text-center font-bold text-gray-700 dark:text-gray-300 tabular-nums">{user.reviewPending}</td>
                        <td className="px-4 py-4 text-center font-bold text-emerald-600 dark:text-emerald-500 tabular-nums">{user.accepted}</td>
                        <td className="px-4 py-4 text-center font-bold text-rose-600 dark:text-rose-500 tabular-nums">{user.rejected}</td>
                        <td className="px-4 py-4 text-center font-bold text-amber-600 dark:text-amber-500 tabular-nums">{user.reworked}</td>
                        <td className="px-4 py-4 text-center font-black tabular-nums">{user.performanceScore}%</td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getCategoryBadgeColor(user.performanceScore)}`}>
                            {getPerformanceCategory(user.performanceScore)}
                            </span>
                        </td>
                        </tr>
                    ))}
                    </>
                )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100/80 dark:bg-gray-800/50 font-black text-gray-800 dark:text-white">
                <td className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 text-xs uppercase tracking-widest">Total</td>
                <td className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 text-center tabular-nums">{total.dispatchPending}</td>
                <td className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 text-center tabular-nums">{total.totalSubmitted}</td>
                <td className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 text-center tabular-nums">{total.totalReviewed}</td>
                <td className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 text-center tabular-nums">{total.reviewPending}</td>
                <td className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 text-center text-emerald-600 tabular-nums">{total.accepted}</td>
                <td className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 text-center text-rose-600 tabular-nums">{total.rejected}</td>
                <td className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 text-center text-amber-600 tabular-nums">{total.reworked}</td>
                <td className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 text-center tabular-nums">{totalPerformanceScore}%</td>
                <td className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getCategoryBadgeColor(totalPerformanceScore)}`}>
                        {getPerformanceCategory(totalPerformanceScore)}
                    </span>
                </td>
              </tr>
            </tfoot>
            </table>
            </div>

            {totalPages > 1 && (
            <div className="bg-gray-50/50 dark:bg-gray-900/30 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Showing{" "}
                    <span className="text-gray-900 dark:text-white tabular-nums">
                    {(performancePage - 1) * performancePageSize + 1}-{Math.min(performancePage * performancePageSize, performanceTableData.length)}
                    </span>{" "}
                    of{" "}
                    <span className="text-gray-900 dark:text-white tabular-nums">
                    {performanceTableData.length}
                    </span>
                </p>

                <div className="flex items-center gap-2">
                    <button
                    onClick={() => setPerformancePage((p) => Math.max(1, p - 1))}
                    disabled={performancePage === 1}
                    className="p-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm group"
                    >
                    <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-purple-600" />
                    </button>
                    
                    <span className="text-xs font-black text-gray-500 dark:text-gray-400 px-2">
                        Page {performancePage} of {totalPages}
                    </span>

                    <button
                    onClick={() => setPerformancePage((p) => Math.min(totalPages, p + 1))}
                    disabled={performancePage === totalPages}
                    className="p-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-30 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm group"
                    >
                    <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-purple-600" />
                    </button>
                </div>
                </div>
            </div>
            )}
        </div>
    </div>
  );
}
