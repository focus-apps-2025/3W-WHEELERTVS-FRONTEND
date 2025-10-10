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

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  companyName: string;
  isActive: boolean;
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
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  tenant: null,
  login: async () => false,
  logout: () => {},
  isAuthenticated: false,
  loading: false,
  error: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            setTenant(JSON.parse(storedTenant));
          }
        } catch (err) {
          // Token is invalid, clear it
          apiClient.clearToken();
          localStorage.removeItem("tenant_info");
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

      // Store tenant info if available
      if (response.tenant) {
        setTenant(response.tenant);
        localStorage.setItem("tenant_info", JSON.stringify(response.tenant));
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

  const logout = () => {
    apiClient.logout();
    setUser(null);
    setTenant(null);
    setError(null);
    localStorage.removeItem("tenant_info");
  };

  return (
    <AuthContext.Provider
      value={{ user, tenant, login, logout, isAuthenticated, loading, error }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
