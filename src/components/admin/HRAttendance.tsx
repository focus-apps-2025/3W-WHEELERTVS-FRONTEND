import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
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
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  User
} from 'lucide-react';

export default function HRAttendance() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0], // 1st of current month
    endDate: new Date().toISOString().split('T')[0],
    inspectorId: '',
    status: '',
    shiftId: ''
  });
  const [shifts, setShifts] = useState<any[]>([]);
  const [inspectors, setInspectors] = useState<any[]>([]);

  useEffect(() => {
    fetchMetadata();
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

  const fetchReport = async () => {
    setLoading(true);
    try {
      console.log('Fetching report with filters:', filters);
      const response = await apiClient.getHRAttendanceReport(filters);
      console.log('Report response:', response);
      console.log('Report response.data:', response?.data);
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
            <h1 className="text-2xl font-bold text-gray-900">Attendance Reports</h1>
            <p className="text-gray-600">Shift-based attendance tracking and analytics</p>
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-green-700 transition shadow-lg shadow-green-100"
          >
            <Download size={20} />
            Export Excel
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Start Date</label>
            <input 
              type="date" 
              className="w-full border rounded-xl p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={filters.startDate}
              onChange={e => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">End Date</label>
            <input 
              type="date" 
              className="w-full border rounded-xl p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={filters.endDate}
              onChange={e => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Inspector</label>
            <select 
              className="w-full border rounded-xl p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={filters.inspectorId}
              onChange={e => setFilters({ ...filters, inspectorId: e.target.value })}
            >
              <option value="">All Inspectors</option>
              {inspectors?.map(ins => (
                <option key={ins._id} value={ins._id}>{ins.firstName} {ins.lastName}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">Status</label>
            <select 
              className="w-full border rounded-xl p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
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
              className="w-full border rounded-xl p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
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
            className="bg-blue-600 text-white rounded-xl h-10 font-bold hover:bg-blue-700 transition"
          >
            Apply Filters
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-3xl border border-dashed">
            <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
            <p className="text-gray-500 font-medium">Processing attendance data...</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Present Days</div>
                    <div className="text-2xl font-black text-gray-900">{data?.summary?.totalPresentDays || 0}</div>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-2xl flex items-center justify-center">
                    <Clock size={24} />
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Late Arrivals</div>
                    <div className="text-2xl font-black text-gray-900">{data?.summary?.totalLateArrivals || 0}</div>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Absent Days</div>
                    <div className="text-2xl font-black text-gray-900">{data?.summary?.totalAbsentDays || 0}</div>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Avg. Rate</div>
                    <div className="text-2xl font-black text-gray-900">{data?.summary?.avgAttendanceRate || 0}%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-black text-gray-900 uppercase tracking-widest text-sm">Daily Logs</h3>
                <span className="text-xs font-bold text-gray-500">{data?.detailedLogs?.length || 0} Records Found</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 text-xs font-black text-gray-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Inspector</th>
                      <th className="px-6 py-4">Shift</th>
                      <th className="px-6 py-4">Check-in</th>
                      <th className="px-6 py-4">Check-out</th>
                      <th className="px-6 py-4">Hours</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.detailedLogs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-400 italic">No attendance logs found for selected criteria.</td>
                      </tr>
                    ) : (
                      data?.detailedLogs?.map((log: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900">{log.date}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-xs font-bold">
                                {log.inspector?.charAt(0) || '?'}
                              </div>
                              <span className="font-bold text-gray-700">{log.inspector}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                              <Clock size={14} />
                              {log.shift}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-600">{log.checkIn || '-'}</td>
                          <td className="px-6 py-4 font-medium text-gray-600">{log.checkOut || '-'}</td>
                          <td className="px-6 py-4 font-black text-blue-600 text-sm">{log.hours}h</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              log.status === 'present' ? 'bg-green-100 text-green-700' : 
                              log.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                              log.status === 'half-day' ? 'bg-orange-100 text-orange-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {log.location && (
                              <button 
                                title={log.location}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                                onClick={() => alert(log.location)}
                              >
                                <MapPin size={18} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inspector Stats */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                <h3 className="font-black text-gray-900 uppercase tracking-widest text-sm">Performance by Inspector</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data?.inspectorStats?.map((stat: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/30 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-4">
                      <div className="font-bold text-gray-900">{stat.name}</div>
                      <div className="text-xs font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{stat.rate}% Rate</div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <div className="text-xs text-gray-400">P</div>
                        <div className="font-bold text-green-600">{stat.present}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">L</div>
                        <div className="font-bold text-yellow-600">{stat.late}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">H</div>
                        <div className="font-bold text-orange-600">{stat.halfDay}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">A</div>
                        <div className="font-bold text-red-600">{stat.absent}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-20 rounded-3xl border border-dashed text-center space-y-4">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
              <Filter size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Configure Your Report</h3>
              <p className="text-gray-500">Pick a date range and filters above to see attendance analytics.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
