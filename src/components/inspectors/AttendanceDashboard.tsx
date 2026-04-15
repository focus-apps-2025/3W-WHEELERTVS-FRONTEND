import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  LogOut, 
  LogIn,
  Loader2,
  Calendar,
  Navigation
} from 'lucide-react';

export default function AttendanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
    fetchHistory();
    requestLocation();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await apiClient.getMyHRAttendanceStatus();
      console.log('My status response:', response);
      
      // API returns data directly (not wrapped in response.data)
      if (response && response.shift !== undefined) {
        setStatus(response);
      } else if (response && response.data) {
        setStatus(response.data);
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (page = 1) => {
    try {
      const response = await apiClient.getMyHRAttendanceHistory({ page, limit: 10 });
      if (response && response.data) {
        setHistory(response.data.history);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const requestLocation = () => {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
      },
      (err) => {
        setLocError('Location permission denied. Please enable GPS to mark attendance.');
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handlePunchIn = async () => {
    if (!location) {
      alert('Location required. Please enable GPS.');
      requestLocation();
      return;
    }

    if (location.accuracy > 50) {
      if (!window.confirm(`GPS accuracy is low (${Math.round(location.accuracy)}m). Proceed anyway?`)) return;
    }

    setPunching(true);
    try {
      await apiClient.checkIn({
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy
      });
      fetchStatus();
      fetchHistory();
    } catch (error: any) {
      alert(error.message || 'Check-in failed');
    } finally {
      setPunching(false);
    }
  };

  const handlePunchOut = async () => {
    if (!location) {
      alert('Location required. Please enable GPS.');
      requestLocation();
      return;
    }

    setPunching(true);
    try {
      await apiClient.checkOut({
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy
      });
      fetchStatus();
      fetchHistory();
    } catch (error: any) {
      alert(error.message || 'Check-out failed');
    } finally {
      setPunching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-gray-600 font-medium">Loading your dashboard...</p>
      </div>
    );
  }

  const shift = status?.shift;
  const attendance = status?.attendance;
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Header/Status */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Hello, Inspector</h1>
            <p className="text-gray-500 text-sm">{new Date().toDateString()}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-blue-600">{currentTime}</div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Local Time</p>
          </div>
        </div>

        {/* Shift Card */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 text-white shadow-xl shadow-blue-200">
          <div className="flex items-center gap-3 mb-4">
            <Clock size={24} className="text-blue-200" />
            <span className="font-bold opacity-80">Your Assigned Shift</span>
          </div>
          
          {shift ? (
            <div className="space-y-4">
              <div className="text-3xl font-black">{shift.displayName}</div>
              <div className="flex items-center gap-4 text-blue-100 font-medium bg-white/10 p-3 rounded-2xl border border-white/10">
                <div className="flex-1">
                  <div className="text-xs uppercase opacity-70">Start</div>
                  <div className="text-lg">{shift.startTime}</div>
                </div>
                <div className="h-8 w-px bg-white/20"></div>
                <div className="flex-1">
                  <div className="text-xs uppercase opacity-70">End</div>
                  <div className="text-lg">{shift.endTime}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/10 p-4 rounded-2xl border border-white/10 text-center">
              <AlertCircle className="mx-auto mb-2 opacity-80" />
              <p className="font-bold">No shift assigned to you today.</p>
              <p className="text-xs text-blue-200 mt-1">Please contact your admin.</p>
            </div>
          )}
        </div>

        {/* Action Section */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200">
          {locError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-700 text-sm">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-bold">Location Error</p>
                <p className="opacity-80">{locError}</p>
                <button onClick={requestLocation} className="mt-2 text-red-800 font-black underline">Try Again</button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {location && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-2xl text-green-700 text-xs">
                <Navigation size={16} className="shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <div className="font-bold">Location Active</div>
                  <div className="opacity-80 truncate">{location.lat.toFixed(4)}, {location.lng.toFixed(4)} (±{Math.round(location.accuracy)}m)</div>
                </div>
                <CheckCircle2 size={16} />
              </div>
            )}

            {!attendance?.checkInTime ? (
              <button
                disabled={!shift || !location || punching}
                onClick={handlePunchIn}
                className="w-full h-20 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 text-white rounded-3xl font-black text-xl shadow-lg shadow-green-100 transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                {punching ? <Loader2 className="animate-spin" /> : <LogIn size={28} />}
                Clock In
              </button>
            ) : !attendance?.checkOutTime ? (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-center">
                  <p className="text-xs text-blue-600 font-bold uppercase tracking-widest mb-1">Clocked In At</p>
                  <p className="text-2xl font-black text-blue-900">{new Date(attendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="text-xs text-blue-400 mt-1 flex items-center justify-center gap-1">
                    <MapPin size={12} /> {attendance.checkInPlace || 'Location Captured'}
                  </p>
                </div>
                <button
                  disabled={punching || !location}
                  onClick={handlePunchOut}
                  className="w-full h-20 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 text-white rounded-3xl font-black text-xl shadow-lg shadow-red-100 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  {punching ? <Loader2 className="animate-spin" /> : <LogOut size={28} />}
                  Clock Out
                </button>
              </div>
            ) : (
              <div className="p-8 bg-gray-100 border border-gray-200 rounded-3xl text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Shift Completed!</h3>
                <p className="text-gray-500 mt-1">You have successfully clocked out for today.</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest border-t pt-4">
                  <div>
                    <div>Punch In</div>
                    <div className="text-gray-900 text-sm mt-1">{new Date(attendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div>
                    <div>Punch Out</div>
                    <div className="text-gray-900 text-sm mt-1">{new Date(attendance.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* History Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <History size={20} className="text-gray-400" />
            <h2 className="font-bold text-gray-700 uppercase tracking-widest text-sm">Recent Activity</h2>
          </div>

          <div className="space-y-3">
            {history?.length === 0 ? (
              <div className="bg-white p-8 border border-dashed rounded-3xl text-center text-gray-400 flex flex-col items-center gap-2">
                <Calendar size={32} />
                <p>No attendance history found.</p>
              </div>
            ) : (
              history?.map(item => (
                <div key={item._id} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    item.status === 'present' ? 'bg-green-50 text-green-600' : 
                    item.status === 'late' ? 'bg-yellow-50 text-yellow-600' :
                    'bg-orange-50 text-orange-600'
                  }`}>
                    {item.status === 'present' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="font-bold text-gray-900">{new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1"><LogIn size={12} /> {item.checkInTime ? new Date(item.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                      <span className="flex items-center gap-1"><LogOut size={12} /> {item.checkOutTime ? new Date(item.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    item.status === 'present' ? 'bg-green-100 text-green-700' : 
                    item.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {item.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
