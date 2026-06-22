import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient, ApiError } from "../api/client";
import type { StaffMember } from "../types";

interface User {
  _id: string;
  id?: string;
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
  showCustomerPortal?: boolean;
  officeLocation?: {
    lat: number;
    lng: number;
    radius: number;
  };
  timezone?: string;
}

interface TenantSubscription {
  plan: string;
  maxUsers: number;
  maxForms: number;
  endDate?: string;
  startDate?: string;
}

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  companyName: string;
  isActive: boolean;
  settings?: TenantSettings;
  subscription?: TenantSubscription;
  internalTrackingEnabled?: boolean;
  allowedTenantIds?: string[];
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  login: (
    email: string,
    password: string,
    tenantSlug?: string,
    location?: any,
  ) => Promise<boolean>;
  signup: (signupData: {
    name: string;
    slug: string;
    companyName: string;
    adminEmail: string;
    adminPassword: string;
    adminFirstName: string;
    adminLastName: string;
  }) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  updateTenant: (tenant: Tenant | null) => void;
  updateUser: (updatedUser: Partial<User>) => void;
  refreshTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  tenant: null,
  login: async () => false,
  signup: async () => false,
  logout: () => {},
  isAuthenticated: false,
  loading: false,
  error: null,
  updateTenant: () => {},
  updateUser: () => {},
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

  const updateUserState = (updatedUser: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updatedUser });
    }
  };

const isAuthenticated = !!user;

   // Refresh tenant data from backend (for getting latest internalTrackingEnabled, etc.)
   const refreshTenant = async () => {
     try {
       const response = await apiClient.getCurrentTenant();
       if (response.tenant) {
         updateTenantState(response.tenant);
       }
     } catch (err) {
       console.warn("Failed to refresh tenant data:", err);
     }
   };

   // Check for existing auth token on app start
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem("auth_token");
      const storedTenant = localStorage.getItem("tenant_info");

if (token) {
         try {
           const response = await apiClient.getProfile();
           setUser(response.user);

           if (response.tenant) {
             updateTenantState(response.tenant);
           } else if (storedTenant) {
             const parsedTenant = JSON.parse(storedTenant);
             setTenant(parsedTenant);
           }

// Always fetch fresh tenant data to ensure internalTrackingEnabled etc. are up to date
           await refreshTenant();
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
    tenantSlug?: string,
    location?: any,
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.login({
        email,
        password,
        ...(tenantSlug && { tenantSlug }),
        ...(location && { location }),
      });

      setUser(response.user);
      updateTenantState(response.tenant || null);

      // Clear guest session info if a regular user logs in
      localStorage.removeItem("guest_auth_token");
      localStorage.removeItem("guest_email");
      localStorage.removeItem("guest_form_id");
      localStorage.removeItem("guest_expires_at");

      // Store sessionLogId for logout tracking
      if (response.sessionLogId) {
        localStorage.setItem("session_log_id", response.sessionLogId);
      }

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

  const signup = async (signupData: {
    name: string;
    slug: string;
    companyName: string;
    adminEmail: string;
    adminPassword: string;
    adminFirstName: string;
    adminLastName: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      await apiClient.signup(signupData);
      setLoading(false);
      return true;
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError) {
        const serverMessage =
          (err.response && (err.response as { message?: string }).message) ||
          err.message ||
          "Signup failed. Please try again.";
        setError(serverMessage);
      } else {
        setError("Signup failed. Please try again.");
      }
      return false;
    }
  };

  const logout = () => {
    const sessionLogId = localStorage.getItem("session_log_id");
    apiClient.logout(sessionLogId || undefined);
    localStorage.removeItem("session_log_id");
    setUser(null);
    updateTenantState(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        login,
        signup,
        logout,
        isAuthenticated,
        loading,
        error,
        updateTenant: updateTenantState,
        updateUser: updateUserState,
        refreshTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
