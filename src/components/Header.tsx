import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  User,
  Sun,
  Moon,
  LayoutDashboard,
  FileText,
  BarChart2,
  Building2,
  Users,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useLogo } from "../context/LogoContext";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";

interface MenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  description: string;
  roles?: string[];
  permission?: string;
}

const MODULE_PERMISSIONS = {
  DASHBOARD: "dashboard:view",
  ANALYTICS: "analytics:view",
  CUSTOMER_REQUESTS: "requests:view",
  REQUEST_MANAGEMENT: "requests:manage",
} as const;

export default function Header() {
  const { logo } = useLogo();
  const { user, isAuthenticated, logout, tenant } = useAuth();
  const { isMobileOpen, toggleSidebar, closeMobile } = useSidebar();
  const { darkMode, toggleDarkMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const publicMenuItems: MenuItem[] = [
    {
      title: "Service Requests",
      icon: FileText,
      path: "/forms/preview",
      description: "Submit service requests for your vehicle",
    },
  ];

  const superAdminMenuItems: MenuItem[] = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
      description: "View system overview and statistics",
    },
    {
      title: "Tenant Management",
      icon: Building2,
      path: "/superadmin/tenants",
      description: "Manage all tenants and branches",
    },
  ];

  const tenantMenuItems: MenuItem[] = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
      description: "View shop analytics and service statistics",
      permission: MODULE_PERMISSIONS.DASHBOARD,
    },
    {
      title: "Service Analytics",
      icon: BarChart2,
      path: "/forms/analytics",
      description: "Detailed service analytics and insights",
      permission: MODULE_PERMISSIONS.ANALYTICS,
    },
    {
      title: "Customer Requests",
      icon: FileText,
      path: "/responses/all",
      description: "View customer service requests",
      permission: MODULE_PERMISSIONS.CUSTOMER_REQUESTS,
    },
    // {
    //   title: "Request Management",
    //   icon: ListTodo,
    //   path: "/forms/management",
    //   description: "Manage and organize service requests",
    //   permission: MODULE_PERMISSIONS.REQUEST_MANAGEMENT,
    // },
  ];

  const adminManagementMenuItem: MenuItem = {
    title: "Admin Management",
    icon: Users,
    path: "/admin/management",
    description: "Manage tenant administrators and permissions",
    roles: ["admin"],
  };

  const permissionSet = new Set(user?.permissions || []);

  const menuItems: MenuItem[] = (() => {
    if (!isAuthenticated || !user) {
      return publicMenuItems;
    }

    if (user.role === "superadmin") {
      return superAdminMenuItems;
    }

    const filteredItems = tenantMenuItems.filter((item) => {
      if (item.roles && !item.roles.includes(user.role)) {
        return false;
      }

      if (!item.permission) {
        return true;
      }

      if (user.role === "admin") {
        return true;
      }

      return permissionSet.has(item.permission);
    });

    if (user.role === "admin") {
      filteredItems.push(adminManagementMenuItem);
    }

    return filteredItems;
  })();

  return (
    <>
      <header
        className="fixed top-0 right-0 left-0 h-16 bg-white dark:bg-gray-900 border-b border-neutral-200 dark:border-gray-700 z-30 transition-all duration-300"
      >
        <div className="flex items-center justify-between h-full px-6">
          {/* Left side - logo */}
          <div className="flex items-center min-w-[200px]">
            {/* Mobile menu button */}
            <button
              onClick={toggleSidebar}
              className="lg:hidden mr-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {isMobileOpen ? (
                <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              )}
            </button>

            {logo ? (
              <div className="flex items-center">
                <img
                  src={logo}
                  alt="Logo"
                  className="h-8 w-auto object-contain"
                />
                <span className="ml-3 text-lg font-medium truncate text-gray-900 dark:text-white hidden sm:block">
                  {tenant?.companyName || tenant?.name || "Focus Form"}
                </span>
              </div>
            ) : (
              <div className="flex items-center">
                <span className="text-lg font-medium text-primary-600 dark:text-primary-400 hidden sm:block">
                  Focus Form
                </span>
              </div>
            )}
          </div>

          {/* Center - Navigation */}
          <nav className="hidden lg:flex items-center justify-center flex-1 px-4">
            <div className="flex items-center space-x-1">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200
                      ${
                        isActive
                          ? "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Right side - theme toggle and user info */}
          <div className="flex items-center justify-end gap-3 min-w-[200px]">
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
              <>
                <div className="hidden md:flex items-center space-x-3 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                  <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                    {user?.firstName} {user?.lastName}
                  </span>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileOpen && (
          <div className="lg:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <nav className="flex flex-col p-4 space-y-2">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={closeMobile}
                    className={`
                      flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200
                      ${
                        isActive
                          ? "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                      }
                    `}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.title}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
