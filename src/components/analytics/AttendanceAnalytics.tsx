import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Clock, 
  Calendar, 
  BarChart3, 
  Search, 
  Download, 
  ChevronRight, 
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

interface Shift {
  _id: string;
  name: string;
  displayName: string;
  startTime: string;
  endTime: string;
  gracePeriod: number;
  lateMarkingAfter: number;
  halfDayMarkingAfter: number;
  assignedInspectors: any[];
  isNightShift: boolean;
}

interface AttendanceSummary {
  totalUsers: number;
  present: number;
  absent: number;
  activeNow: number;
}

export default function AttendanceAnalytics() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [shiftStats, setShiftStats] = useState<Record<string, { present: number, absent: number }>>({});

  useEffect(() => {
    fetchInitialData();
  }, [selectedDate]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [shiftsRes, summaryRes] = await Promise.all([
        apiClient.getShifts(),
        apiClient.getHRTenantSummary()
      ]);

      if (shiftsRes?.data) setShifts(shiftsRes.data);
      if (summaryRes?.data) setSummary(summaryRes.data);

      const shiftPromises = (shiftsRes?.data || []).map(async (shift: any) => {
        try {
          const report = await apiClient.getHRAttendanceReport({
            startDate: selectedDate,
            endDate: selectedDate,
            shiftId: shift._id,
          });
          const logs = report?.data?.detailedLogs || [];
          return {
            id: shift._id,
            present: logs.filter((l: any) => l.status === 'present' || l.status === 'late').length,
            absent: logs.filter((l: any) => l.status === 'absent').length,
          };
        } catch (e) {
          return { id: shift._id, present: 0, absent: 0 };
        }
      });

      const results = await Promise.all(shiftPromises);
      const stats: Record<string, { present: number, absent: number }> = {};
      results.forEach((r) => {
        stats[r.id] = { present: r.present, absent: r.absent };
      });
      setShiftStats(stats);
    } catch (error: any) {
      showError(error.message || "Failed to fetch attendance analytics");
    } finally {
      setLoading(false);
    }
  };

  const filteredShifts = useMemo(() => {
    return shifts.filter(shift => 
      shift.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shift.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [shifts, searchTerm]);

  const handleExport = async (shiftId?: string) => {
    try {
      const blob = await apiClient.exportHRAttendanceReport({
        startDate: selectedDate,
        endDate: selectedDate,
        shiftId
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-report-${selectedDate}${shiftId ? `-${shiftId}` : ''}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      showSuccess("Export started successfully");
    } catch (error: any) {
      showError(error.message || "Export failed");
    }
  };

  if (loading && shifts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary-600 mb-4" size={40} />
        <p className="text-gray-500">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-primary-800 dark:text-primary-400">
            Attendance Reports
          </h1>
          <p className="text-xs sm:text-sm text-primary-600 dark:text-primary-500">
            Shift-based attendance tracking and analytics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-500" size={16} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-primary-100 dark:border-gray-800 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500 outline-none w-full"
            />
          </div>
          <button
            onClick={() => handleExport()}
            className="btn-secondary w-full sm:w-auto flex items-center justify-center"
          >
            <Download size={16} className="mr-2" />
            Export All Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg mr-4">
              <Users className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div className="text-2xl font-medium text-primary-600 dark:text-primary-400">
                {summary?.totalUsers || 0}
              </div>
              <div className="text-sm text-primary-500">Total Staff</div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg mr-4">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-medium text-green-600 dark:text-green-400">
                {summary?.present || 0}
              </div>
              <div className="text-sm text-green-500">Present Today</div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg mr-4">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-medium text-red-600 dark:text-red-400">
                {summary?.absent || 0}
              </div>
              <div className="text-sm text-red-500">Absent</div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg mr-4">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-medium text-amber-600 dark:text-amber-400">
                {summary?.activeNow || 0}
              </div>
              <div className="text-sm text-amber-500">Active Now</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by shift name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>
      </div>

      {filteredShifts.length === 0 ? (
        <div className="card p-20 text-center border-dashed">
          <Clock size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No shifts found</h3>
          <p className="text-gray-500 mt-1 text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredShifts.map((shift) => (
            <div 
              key={shift._id}
              className="card flex flex-col overflow-hidden hover:border-primary-300 transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                      {shift.displayName}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                      <Clock size={14} className="text-primary-500" />
                      {shift.startTime} - {shift.endTime}
                    </div>
                  </div>
                  {shift.isNightShift && (
                    <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-semibold uppercase tracking-wider border border-indigo-100">
                      Night
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-lg border border-green-100 dark:border-green-900/20 text-center">
                    <p className="text-[10px] font-semibold text-green-600 dark:text-green-400 uppercase mb-1">Present</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-300">
                      {shiftStats[shift._id]?.present || 0}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/20 text-center">
                    <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase mb-1">Absent</p>
                    <p className="text-xl font-bold text-red-700 dark:text-green-300">
                      {shiftStats[shift._id]?.absent || 0}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm border-t border-gray-50 dark:border-gray-800 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Users size={14} /> Total Staff
                    </span>
                    <span className="text-gray-900 dark:text-white font-semibold">{shift.assignedInspectors?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-2">
                      <AlertCircle size={14} /> Grace Period
                    </span>
                    <span className="text-gray-900 dark:text-white font-semibold">{shift.gracePeriod}m</span>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                <button 
                  onClick={() => navigate(`/hr-attendance?shiftId=${shift._id}&date=${selectedDate}`)}
                  className="flex-1 btn-secondary text-xs py-2 bg-white dark:bg-gray-900"
                >
                  View Details
                  <ArrowRight size={14} className="ml-1" />
                </button>
                <button 
                  onClick={() => handleExport(shift._id)}
                  className="btn-secondary px-3 py-2 bg-white dark:bg-gray-900"
                  title="Export Shift Report"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
