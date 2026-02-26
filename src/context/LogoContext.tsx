import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";

const DEFAULT_LOGO = "/logoimages/logo.jpeg";

interface LogoContextType {
  logo: string;
  updateLogo: (newLogo: string) => void;
}

const LogoContext = createContext<LogoContextType>({
  logo: DEFAULT_LOGO,
  updateLogo: () => {},
});

const getValidLogo = (logoValue: string | null | undefined): string => {
  if (logoValue && typeof logoValue === 'string' && logoValue.trim()) {
    return logoValue.trim();
  }
  return DEFAULT_LOGO;
};

export function LogoProvider({ children }: { children: React.ReactNode }) {
  const { tenant } = useAuth();
  const [logo, setLogo] = useState<string>(() => {
    if (tenant?.settings?.logo) {
      return getValidLogo(tenant.settings.logo);
    }
    if (tenant?._id) {
      return getValidLogo(localStorage.getItem(`tenant_logo_${tenant._id}`));
    }
    return getValidLogo(localStorage.getItem("companyLogo"));
  });

  useEffect(() => {
    let newLogo = DEFAULT_LOGO;

    if (tenant?.settings?.logo) {
      newLogo = getValidLogo(tenant.settings.logo);
    } else if (tenant?._id) {
      newLogo = getValidLogo(localStorage.getItem(`tenant_logo_${tenant._id}`));
    } else {
      newLogo = getValidLogo(localStorage.getItem("companyLogo"));
    }

    setLogo(newLogo);
  }, [tenant?._id, tenant?.settings?.logo]);

  const updateLogo = (newLogo: string) => {
    const validLogo = getValidLogo(newLogo);
    setLogo(validLogo);

    if (tenant?._id) {
      if (validLogo && validLogo !== DEFAULT_LOGO) {
        localStorage.setItem(`tenant_logo_${tenant._id}`, validLogo);
      } else {
        localStorage.removeItem(`tenant_logo_${tenant._id}`);
      }
    } else {
      if (validLogo && validLogo !== DEFAULT_LOGO) {
        localStorage.setItem("companyLogo", validLogo);
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
