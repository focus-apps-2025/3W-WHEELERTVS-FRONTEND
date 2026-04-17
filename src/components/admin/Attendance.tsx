import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { 
  Calendar, 
  Download, 
  Search, 
  Filter, 
  Users, 
  Clock, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  TrendingUp,
  User,
  Activity
} from 'lucide-react';

export default function Attendance() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0], // Last 7 days
    endDate: new Date().toISOString().split('T')[0],
    inspectorId: '',
    status: '',
    shiftId: ''
  });
  const [shifts, setShifts] = useState<any[]>([]);
  const [inspectors, setInspectors] = useState<any[]>([]);

  useEffect(() => {
    fetchMetadata();
    fetchTodaySummary();
    fetchReport();
  }, []);

  const fetchMetadata = async () => {
    try {
      const [shiftsRes, inspectorsRes] = await Promise.all([
        apiClient.getShifts(),
        apiClient.getUsers({ role: 'inspector', limit: 1000 })
      ]);
      setShifts(shiftsRes?.data || []);
      setInspectors(inspectorsRes?.users || []);
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }
  };

  const fetchTodaySummary = async () => {
    setSummaryLoading(true);
    try {
      const response = await apiClient.getAttendanceSummary();
      setSummary(response);
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getHRAttendanceReport(filters);
      setData(response?.data || response);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await apiClient.exportHRAttendanceReport(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_report_${filters.startDate}_to_${filters.endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      alert('Export failed');
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Attendance Management</h1>
            <p className="text-gray-500">Track, monitor, and analyze team attendance</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={fetchTodaySummary}
              className="flex items-center justify-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-xl font-bold border hover:bg-gray-50 transition shadow-sm"
            >
              <Activity size={18} className="text-blue-500" />
              Refresh Status
            </button>
            <button 
              onClick={handleExport}
              className="flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-100"
            >
              <Download size={20} />
              Export Report
            </button>
          </div>
        </div>

        {/* Today's Real-time Status */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                <Users size={64} />
              </div>
              <div className="relative z-10">
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Team</div>
                <div className="text-3xl font-black text-gray-900">{summary.totalUsers}</div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform text-green-600">
                <CheckCircle2 size={64} />
              </div>
              <div className="relative z-10">
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Present Today</div>
                <div className="text-3xl font-black text-green-600">{summary.present}</div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform text-red-600">
                <AlertCircle size={64} />
              </div>
              <div className="relative z-10">
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Absent Today</div>
                <div className="text-3xl font-black text-red-600">{summary.absent}</div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform text-blue-600">
                <Activity size={64} />
              </div>
              <div className="relative z-10">
                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Active Now</div>
                <div className="text-3xl font-black text-blue-600">{summary.activeNow}</div>
              </div>
            </div>
          </div>
        )}

        {/* Filters Panel */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={18} className="text-gray-400" />
            <h2 className="font-bold text-gray-900">Historical Filters</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">From</label>
              <input 
                type="date" 
                className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={filters.startDate}
                onChange={e => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">To</label>
              <input 
                type="date" 
                className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={filters.endDate}
                onChange={e => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Inspector</label>
              <select 
                className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={filters.inspectorId}
                onChange={e => setFilters({ ...filters, inspectorId: e.target.value })}
              >
                <option value="">All Staff</option>
                {inspectors?.map(ins => (
                  <option key={ins._id} value={ins._id}>{ins.firstName} {ins.lastName}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Status</label>
              <select 
                className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={filters.status}
                onChange={e => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late Arrival</option>
                <option value="half-day">Half Day</option>
                <option value="absent">Absent</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Shift</label>
              <select 
                className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={filters.shiftId}
                onChange={e => setFilters({ ...filters, shiftId: e.target.value })}
              >
                <option value="">All Shifts</option>
                {shifts?.map(s => (
                  <option key={s._id} value={s._id}>{s.displayName}</option>
                ))}
              </select>
            </div>
            <button 
              onClick={fetchReport}
              className="bg-blue-600 text-white rounded-xl h-11 font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <Search size={18} />
              Apply
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-3xl border border-dashed">
            <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
            <p className="text-gray-500 font-medium">Generating attendance report...</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            
            {/* Range Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Present Days</div>
                  <div className="text-xl font-black text-gray-900">{data?.summary?.totalPresentDays || 0}</div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-10 h-10 bg-yellow-50 text-yellow-600 rounded-xl flex items-center justify-center shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Late Arrivals</div>
                  <div className="text-xl font-black text-gray-900">{data?.summary?.totalLateArrivals || 0}</div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Absent Days</div>
                  <div className="text-xl font-black text-gray-900">{data?.summary?.totalAbsentDays || 0}</div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avg. Attendance</div>
                  <div className="text-xl font-black text-gray-900">{data?.summary?.avgAttendanceRate || 0}%</div>
                </div>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">Detailed Attendance Logs</h3>
                <span className="text-xs font-bold text-gray-500 bg-white px-3 py-1 rounded-full border">{data?.detailedLogs?.length || 0} Records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Staff Member</th>
                      <th className="px-6 py-4">Shift Details</th>
                      <th className="px-6 py-4">In / Out</th>
                      <th className="px-6 py-4">Work Hours</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-center">Map</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.detailedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">No attendance records found for the selected filters.</td>
                      </tr>
                    ) : (
                      data?.detailedLogs?.map((log: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900 text-sm">{log.date}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center text-xs font-black border border-blue-100">
                                {log.inspector?.charAt(0) || '?'}
                              </div>
                              <span className="font-bold text-gray-700 text-sm">{log.inspector}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-gray-600 text-xs font-medium">
                              <Clock size={12} className="text-gray-400" />
                              {log.shift}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-gray-700 font-bold">{log.checkIn || '--:--'}</span>
                              <span className="text-[10px] text-gray-400 font-medium">{log.checkOut || '--:--'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-black text-blue-600 text-sm">{log.hours}h</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                              log.status === 'present' ? 'bg-green-50 text-green-700 border border-green-100' : 
                              log.status === 'late' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                              log.status === 'half-day' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                              'bg-red-50 text-red-700 border border-red-100'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {log.location ? (
                              <button 
                                title={log.location}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition border border-transparent hover:border-blue-100"
                                onClick={() => alert(log.location)}
                              >
                                <MapPin size={16} />
                              </button>
                            ) : (
                              <span className="text-gray-300 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Performance Ranking */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">Performance by Inspector</h3>
                <TrendingUp size={16} className="text-gray-400" />
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data?.inspectorStats?.map((stat: any, idx: number) => (
                  <div key={idx} className="p-5 rounded-2xl border border-gray-100 bg-gray-50/30 hover:shadow-md transition group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="font-bold text-gray-900">{stat.name}</div>
                      <div className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                        stat.rate >= 90 ? 'bg-green-100 text-green-700' : 
                        stat.rate >= 75 ? 'bg-blue-100 text-blue-700' : 
                        'bg-orange-100 text-orange-700'
                      }`}>{stat.rate}% Rate</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-white rounded-xl p-2 border border-gray-50">
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">P</div>
                        <div className="font-black text-green-600 text-sm">{stat.present}</div>
                      </div>
                      <div className="bg-white rounded-xl p-2 border border-gray-50">
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">L</div>
                        <div className="font-black text-yellow-600 text-sm">{stat.late}</div>
                      </div>
                      <div className="bg-white rounded-xl p-2 border border-gray-50">
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">H</div>
                        <div className="font-black text-orange-600 text-sm">{stat.halfDay}</div>
                      </div>
                      <div className="bg-white rounded-xl p-2 border border-gray-50">
                        <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">A</div>
                        <div className="font-black text-red-600 text-sm">{stat.absent}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-20 rounded-3xl border border-dashed text-center space-y-4 shadow-sm">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <Calendar size={40} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Attendance Report</h3>
              <p className="text-gray-500 max-w-sm mx-auto mt-2">Select a date range and filters to generate a detailed attendance analysis for your team.</p>
            </div>
            <button 
              onClick={fetchReport}
              className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 transition shadow-xl shadow-blue-200"
            >
              Generate Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
