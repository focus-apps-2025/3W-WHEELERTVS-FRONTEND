import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";

interface LogoContextType {
  logo: string;
  updateLogo: (newLogo: string) => void;
}

const LogoContext = createContext<LogoContextType>({
  logo: "",
  updateLogo: () => {},
});

export function LogoProvider({ children }: { children: React.ReactNode }) {
  const { tenant } = useAuth();
  const [logo, setLogo] = useState<string>(() => {
    if (tenant?.settings?.logo) {
      return tenant.settings.logo;
    }
    if (tenant?._id) {
      return localStorage.getItem(`tenant_logo_${tenant._id}`) || "";
    }
    return localStorage.getItem("companyLogo") || "";
  });

  useEffect(() => {
    if (tenant?.settings?.logo) {
      setLogo(tenant.settings.logo);
      if (tenant._id) {
        localStorage.setItem(`tenant_logo_${tenant._id}`, tenant.settings.logo);
      }
      return;
    }

    if (tenant?._id) {
      const stored = localStorage.getItem(`tenant_logo_${tenant._id}`) || "";
      setLogo(stored);
      return;
    }

    const fallback = localStorage.getItem("companyLogo") || "";
    setLogo(fallback);
  }, [tenant?._id, tenant?.settings?.logo]);

  const updateLogo = (newLogo: string) => {
    setLogo(newLogo);
    if (tenant?._id) {
      if (newLogo) {
        localStorage.setItem(`tenant_logo_${tenant._id}`, newLogo);
      } else {
        localStorage.removeItem(`tenant_logo_${tenant._id}`);
      }
    } else {
      if (newLogo) {
        localStorage.setItem("companyLogo", newLogo);
      } else {
        localStorage.removeItem("companyLogo");
      }
    }
  };

  return (
    <LogoContext.Provider value={{ logo, updateLogo }}>
      {children}
    </LogoContext.Provider>
  );
}

export const useLogo = () => useContext(LogoContext);
