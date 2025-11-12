import React from "react";
import { User, Sun, Moon } from "lucide-react";
import { useLogo } from "../context/LogoContext";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";

export default function Header() {
  const { logo } = useLogo();
  const { user, isAuthenticated } = useAuth();
  const { isCollapsed, isMobileOpen } = useSidebar();
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <>
      <header
        className={`fixed top-0 right-0 left-0 h-16 bg-white dark:bg-gray-900 border-b border-neutral-200 dark:border-gray-700 z-30 transition-all duration-300 ${
          !isMobileOpen ? (isCollapsed ? "lg:pl-16" : "lg:pl-64") : "pl-0"
        }`}
      >
        <div className="flex items-center justify-between h-full px-6">
          {/* Left side - logo only */}
          <div className="flex items-center">
            {logo ? (
              <img
                src={logo}
                alt="Logo"
                className="h-8 w-auto object-contain"
              />
            ) : (
              <span className="text-lg font-medium text-primary-600 dark:text-primary-400">
                Focus Form
              </span>
            )}
          </div>

          {/* Right side - theme toggle and user info */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-yellow-500" />
              ) : (
                <Moon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              )}
            </button>
            {isAuthenticated && (
              <div className="flex items-center space-x-3 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
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
