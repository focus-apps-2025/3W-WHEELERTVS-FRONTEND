import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient, ApiError } from "../api/client";
import type { StaffMember } from "../types";

interface User {
  _id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  mobile?: string;
  department?: string;
  position?: string;
  lastLogin?: string;
  customRole?: any;
  permissions?: string[];
  tenantId?: string;
}

interface TenantSettings {
  logo?: string;
  primaryColor?: string;
  companyEmail?: string;
  companyPhone?: string;
}

interface TenantSubscription {
  plan: string;
  maxUsers: number;
  maxForms: number;
}

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  companyName: string;
  isActive: boolean;
  settings?: TenantSettings;
  subscription?: TenantSubscription;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  login: (
    email: string,
    password: string,
    tenantSlug?: string
  ) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  updateTenant: (tenant: Tenant | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  tenant: null,
  login: async () => false,
  logout: () => {},
  isAuthenticated: false,
  loading: false,
  error: null,
  updateTenant: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateTenantState = (nextTenant: Tenant | null) => {
    setTenant(nextTenant);
    if (nextTenant) {
      localStorage.setItem("tenant_info", JSON.stringify(nextTenant));
    } else {
      localStorage.removeItem("tenant_info");
    }
  };

  const isAuthenticated = !!user;

  // Check for existing auth token on app start
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem("auth_token");
      const storedTenant = localStorage.getItem("tenant_info");

      if (token) {
        try {
          const response = await apiClient.getProfile();
          setUser(response.user);

          // Restore tenant info if available
          if (storedTenant) {
            const parsedTenant = JSON.parse(storedTenant);
            setTenant(parsedTenant);

            // If tenant exists but doesn't have _id, try to fetch it (only for superadmin)
            if (parsedTenant && !parsedTenant._id && response.user.tenantId && response.user.role === "superadmin") {
              try {
                const tenantResponse = await apiClient.getTenant(response.user.tenantId);
                updateTenantState(tenantResponse.tenant);
              } catch (tenantErr) {
                console.warn("Failed to fetch tenant information:", tenantErr);
                // Keep the stored tenant if fetch fails
              }
            }
          } else if (response.user.tenantId && response.user.role === "superadmin") {
            // No stored tenant but user has tenantId, try to fetch it (only for superadmin)
            try {
              const tenantResponse = await apiClient.getTenant(response.user.tenantId);
              updateTenantState(tenantResponse.tenant);
            } catch (tenantErr) {
              console.warn("Failed to fetch tenant information:", tenantErr);
            }
          }
        } catch (err) {
          apiClient.clearToken();
          updateTenantState(null);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (
    email: string,
    password: string,
    tenantSlug?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.login({
        email,
        password,
        ...(tenantSlug && { tenantSlug }),
      });

      setUser(response.user);
      updateTenantState(response.tenant || null);

      setLoading(false);
      return true;
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError) {
        if (err.status === 400 || err.status === 401) {
          setError("Incorrect email or password.");
        } else {
          const serverMessage =
            (err.response && (err.response as { message?: string }).message) ||
            err.message ||
            "Login failed. Please try again.";
          setError(serverMessage);
        }
      } else {
        setError("Login failed. Please try again.");
      }
      return false;
    }
  };

  const logout = () => {
    apiClient.logout();
    setUser(null);
    updateTenantState(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, tenant, login, logout, isAuthenticated, loading, error, updateTenant: updateTenantState }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
