import React, { createContext, useContext, useState, useEffect } from 'react';

interface LogoContextType {
  logo: string;
  updateLogo: (newLogo: string) => void;
}

const LogoContext = createContext<LogoContextType>({
  logo: '',
  updateLogo: () => {},
});

export function LogoProvider({ children }: { children: React.ReactNode }) {
  const [logo, setLogo] = useState(() => {
    return localStorage.getItem('companyLogo') || '';
  });

  useEffect(() => {
    localStorage.setItem('companyLogo', logo);
  }, [logo]);

  const updateLogo = (newLogo: string) => {
    setLogo(newLogo);
  };

  return (
    <LogoContext.Provider value={{ logo, updateLogo }}>
      {children}
    </LogoContext.Provider>
  );
}

export const useLogo = () => useContext(LogoContext);