import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  ListTodo,
  BarChart2,
  Settings,
  Menu,
  X,
  ChevronRight,
  Mail,
  LogOut,
  Building2,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";

interface MenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  description: string;
}

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();
  const { isCollapsed, isMobileOpen, toggleSidebar, openMobile, closeMobile } =
    useSidebar();

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
    {
      title: "System Settings",
      icon: Settings,
      path: "/system/management",
      description: "Configure system-wide settings",
    },
  ];

  const authenticatedMenuItems: MenuItem[] = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
      description: "View shop analytics and service statistics",
    },
    {
      title: "Service Analytics",
      icon: BarChart2,
      path: "/forms/analytics",
      description: "Detailed service analytics and insights",
    },
    {
      title: "Customer Requests",
      icon: FileText,
      path: "/responses/all",
      description: "View customer service requests",
    },
    {
      title: "Request Management",
      icon: ListTodo,
      path: "/forms/management",
      description: "Manage and organize service requests",
    },
    {
      title: "Shop Settings",
      icon: Settings,
      path: "/system/management",
      description: "Configure shop settings and preferences",
    },
    {
      title: "Email System",
      icon: Mail,
      path: "/mail/test",
      description: "Test and configure email notifications",
    },
  ];

  // Determine which menu items to show based on user role
  let menuItems = publicMenuItems;
  if (isAuthenticated && user) {
    menuItems =
      user.role === "superadmin" ? superAdminMenuItems : authenticatedMenuItems;
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-blue-900 z-40 transition-all duration-300
          ${isCollapsed ? "w-16" : "w-64"}
          ${
            isMobileOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-blue-800">
          {!isCollapsed && (
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-white" />
              <span className="ml-3 text-lg font-medium text-white">
                Focus Form
              </span>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex p-2 hover:bg-blue-800 rounded-lg transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-white" />
            ) : (
              <X className="w-4 h-4 text-white" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3">
          <div className="space-y-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeMobile}
                  className={`
                    group relative flex items-center px-3 py-3 rounded-lg transition-all duration-200
                    ${
                      isActive
                        ? "bg-blue-700 text-white"
                        : "text-white hover:bg-blue-800 hover:text-white"
                    }
                  `}
                  title={isCollapsed ? item.title : ""}
                >
                  <Icon className="w-5 h-5 flex-shrink-0 text-white" />
                  {!isCollapsed && (
                    <span className="ml-3 font-medium">{item.title}</span>
                  )}

                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-blue-800 text-white text-sm rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                      {item.title}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer - Sign Out */}
        {isAuthenticated && (
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <button
              onClick={handleLogout}
              className={`
                group relative flex items-center w-full px-3 py-3 rounded-lg transition-all duration-200
                text-white hover:bg-red-600 hover:text-white
              `}
              title={isCollapsed ? "Sign Out" : ""}
            >
              <LogOut className="w-5 h-5 flex-shrink-0 text-white" />
              {!isCollapsed && (
                <span className="ml-3 font-medium">Sign Out</span>
              )}

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-red-600 text-white text-sm rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                  Sign Out
                </div>
              )}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
