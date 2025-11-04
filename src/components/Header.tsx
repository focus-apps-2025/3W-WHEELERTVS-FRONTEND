import React from "react";
import { User } from "lucide-react";
import { useLogo } from "../context/LogoContext";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";

export default function Header() {
  const { logo } = useLogo();
  const { user, isAuthenticated } = useAuth();
  const { isCollapsed, isMobileOpen } = useSidebar();

  return (
    <>
      <header
        className={`fixed top-0 right-0 left-0 h-16 bg-white border-b border-neutral-200 z-30 transition-all duration-300 ${
          !isMobileOpen ? (isCollapsed ? "lg:pl-16" : "lg:pl-64") : "pl-0"
        }`}
      >
        <div className="flex items-center justify-between h-full px-6">
          {/* Left side - logo only */}
          <div className="flex items-center">
            {/* Mobile logo when sidebar is closed */}
            <div className="lg:hidden flex items-center">
              {logo ? (
                <img
                  src={logo}
                  alt="Logo"
                  className="h-8 w-auto object-contain"
                />
              ) : (
                <span className="text-lg font-medium text-primary-600">
                  Focus Form
                </span>
              )}
            </div>
          </div>

          {/* Right side - user info only */}
          <div className="flex items-center">
            {isAuthenticated && (
              <div className="flex items-center space-x-3 px-3 py-2 bg-primary-50 rounded-lg">
                <User className="w-5 h-5 text-primary-600" />
                <span className="text-sm font-medium text-primary-600">
                  {user?.firstName} {user?.lastName}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
