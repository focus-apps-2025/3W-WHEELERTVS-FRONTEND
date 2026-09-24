import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { apiClient } from "../api/client";

export type DataScopeOption =
  | "overall"
  | "last_7_days"
  | "last_15_days"
  | "last_1_month"
  | "last_3_months"
  | "last_6_months"
  | "last_1_year";

export interface DataScopeOptionInfo {
  id: DataScopeOption;
  label: string;
  days: number | null;
}

export const DATA_SCOPE_OPTIONS: DataScopeOptionInfo[] = [
  { id: "overall", label: "Overall Data (All Time)", days: null },
  { id: "last_7_days", label: "Last 7 Days", days: 7 },
  { id: "last_15_days", label: "Last 15 Days", days: 15 },
  { id: "last_1_month", label: "Last 1 Month (30 Days)", days: 30 },
  { id: "last_3_months", label: "Last 3 Months (90 Days)", days: 90 },
  { id: "last_6_months", label: "Last 6 Months (180 Days)", days: 180 },
  { id: "last_1_year", label: "Last 1 Year (365 Days)", days: 365 },
];

interface DataScopeContextType {
  dataScope: DataScopeOption;
  updateDataScope: (newScope: DataScopeOption) => Promise<void>;
  getCutoffDate: (scope?: DataScopeOption) => Date | null;
  filterByDataScope: <T>(
    items: T[],
    dateExtractor: (item: T) => Date | string | number | null | undefined
  ) => T[];
  isWithinDataScope: (dateInput: Date | string | number | null | undefined) => boolean;
  getDataScopeLabel: (scope?: DataScopeOption) => string;
}

const STORAGE_KEY = "user_data_scope_pref";

const DataScopeContext = createContext<DataScopeContextType>({
  dataScope: "overall",
  updateDataScope: async () => {},
  getCutoffDate: () => null,
  filterByDataScope: (items) => items,
  isWithinDataScope: () => true,
  getDataScopeLabel: () => "Overall Data (All Time)",
});

export function DataScopeProvider({ children }: { children: React.ReactNode }) {
  const { user, tenant } = useAuth();
  const [dataScope, setDataScopeState] = useState<DataScopeOption>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DATA_SCOPE_OPTIONS.some((opt) => opt.id === saved)) {
      return saved as DataScopeOption;
    }
    return "overall";
  });

  // Sync with tenant default or user object if available
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (user && (user as any).dataScope) {
      const scope = (user as any).dataScope;
      if (DATA_SCOPE_OPTIONS.some((opt) => opt.id === scope)) {
        setDataScopeState(scope);
        localStorage.setItem(STORAGE_KEY, scope);
        return;
      }
    }
    if (!saved && tenant?.settings?.defaultDataScope) {
      const tenantScope = tenant.settings.defaultDataScope as DataScopeOption;
      if (DATA_SCOPE_OPTIONS.some((opt) => opt.id === tenantScope)) {
        setDataScopeState(tenantScope);
      }
    }
  }, [user, tenant]);

  const updateDataScope = async (newScope: DataScopeOption) => {
    setDataScopeState(newScope);
    localStorage.setItem(STORAGE_KEY, newScope);

    // Save to user profile via API if logged in
    try {
      if (user) {
        await apiClient.put("/profile", {
          settings: { dataScope: newScope },
          dataScope: newScope,
        });
      }
    } catch (err) {
      console.warn("Could not sync dataScope to user profile on server:", err);
    }
  };

  const getCutoffDate = (scope: DataScopeOption = dataScope): Date | null => {
    const option = DATA_SCOPE_OPTIONS.find((opt) => opt.id === scope);
    if (!option || option.days === null) return null;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - option.days);
    cutoff.setHours(0, 0, 0, 0);
    return cutoff;
  };

  const isWithinDataScope = (
    dateInput: Date | string | number | null | undefined
  ): boolean => {
    if (!dateInput) return true;
    const cutoff = getCutoffDate();
    if (!cutoff) return true; // Overall mode

    const targetDate = new Date(dateInput);
    if (isNaN(targetDate.getTime())) return true;

    return targetDate >= cutoff;
  };

  const filterByDataScope = <T,>(
    items: T[],
    dateExtractor: (item: T) => Date | string | number | null | undefined
  ): T[] => {
    if (!Array.isArray(items)) return [];
    const cutoff = getCutoffDate();
    if (!cutoff) return items; // Overall mode, return all items

    return items.filter((item) => {
      const rawDate = dateExtractor(item);
      if (!rawDate) return true; // Keep if no date available
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return true;
      return d >= cutoff;
    });
  };

  const getDataScopeLabel = (scope: DataScopeOption = dataScope): string => {
    const opt = DATA_SCOPE_OPTIONS.find((o) => o.id === scope);
    return opt ? opt.label : "Overall Data";
  };

  return (
    <DataScopeContext.Provider
      value={{
        dataScope,
        updateDataScope,
        getCutoffDate,
        filterByDataScope,
        isWithinDataScope,
        getDataScopeLabel,
      }}
    >
      {children}
    </DataScopeContext.Provider>
  );
}

export function useDataScope() {
  return useContext(DataScopeContext);
}
