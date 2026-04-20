import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient } from "../api/client";
import { useAuth } from "./AuthContext";

interface AttendanceContextType {
  isCheckedIn: boolean;
  loading: boolean;
  refreshStatus: () => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType>({
  isCheckedIn: false,
  loading: true,
  refreshStatus: async () => {},
});

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshStatus = async () => {
    if (!isAuthenticated || user?.role !== 'inspector') {
      setIsCheckedIn(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.getMyHRAttendanceStatus();
      const statusData = response?.shift !== undefined ? response : response?.data;
      
      const attendance = statusData?.attendance;
      const currentlyCheckedIn = !!(attendance?.checkInTime && !attendance?.checkOutTime);
      
      setIsCheckedIn(currentlyCheckedIn);
    } catch (error) {
      console.error('Error fetching attendance status:', error);
      setIsCheckedIn(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();
  }, [user, isAuthenticated]);

  return (
    <AttendanceContext.Provider value={{ isCheckedIn, loading, refreshStatus }}>
      {children}
    </AttendanceContext.Provider>
  );
}

export const useAttendanceStatus = () => useContext(AttendanceContext);
