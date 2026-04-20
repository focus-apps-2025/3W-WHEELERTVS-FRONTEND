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
  MessageCircle,
  LogOut,
  Building2,
  Users,
  Clock,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSidebar } from "../../context/SidebarContext";
import { useLogo } from "../../context/LogoContext";
import { useAttendanceStatus } from "../../context/AttendanceContext";

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

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout, user, tenant } = useAuth();
  const { logo } = useLogo();
  const { isCheckedIn } = useAttendanceStatus();
  const { isCollapsed, isMobileOpen, toggleSidebar, openMobile, closeMobile } =
    useSidebar();

  const isGuest = React.useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return (
      searchParams.get("guest") === "true" ||
      !!localStorage.getItem("guest_auth_token")
    );
  }, [location.search]);

  if (isGuest) return null;

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
      title: "Free Trial",
      icon: Clock,
      path: "/superadmin/free-trial",
      description: "Manage tenants on free trial",
    },
    {
      title: "Global Forms",
      icon: FileText,
      path: "/superadmin/forms",
      description: "Manage and assign global forms",
    },
    // {
    //   title: "System Settings",
    //   icon: Settings,
    //   path: "/system/management",
    //   description: "Configure system-wide settings",
    // },
  ];

  const tenantMenuItems: MenuItem[] = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
      description: "View shop analytics and service statistics",
      permission: MODULE_PERMISSIONS.DASHBOARD,
      roles: ["admin", "inspector"],
    },
    {
      title: "Service Analytics",
      icon: BarChart2,
      path: "/forms/analytics",
      description: "Detailed service analytics and insights",
      permission: MODULE_PERMISSIONS.ANALYTICS,
      roles: ["admin", "inspector"],
    },
    {
      title: "Customer Requests",
      icon: FileText,
      path: "/responses/all",
      description: "View customer service requests",
      permission: MODULE_PERMISSIONS.CUSTOMER_REQUESTS,
    },
    {
      title: "Request Management",
      icon: ListTodo,
      path: "/forms/management",
      description: "Manage and organize service requests",
      permission: MODULE_PERMISSIONS.REQUEST_MANAGEMENT,
      roles: ["admin", "inspector"],
    },
    {
      title: "Email System",
      icon: Mail,
      path: "/mail/test",
      description: "Test and configure email notifications",
      roles: ["admin"],
    },
    {
      title: "WhatsApp System",
      icon: MessageCircle,
      path: "/whatsapp/test",
      description: "Test and configure WhatsApp notifications",
      roles: ["admin"],
    },
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

      // Hide Service Analytics for inspector if they haven't checked in
      if (
        item.path === "/forms/analytics" &&
        user.role === "inspector" &&
        !isCheckedIn
      ) {
        return false;
      }

      if (!item.permission) {
        return true;
      }

      if (user.role === "admin" || user.role === "inspector") {
        return true;
      }

      return permissionSet.has(item.permission);
    });

    if (user.role === "admin" || user.role === "inspector") {
      filteredItems.push(adminManagementMenuItem);
    }

    return filteredItems;
  })();

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
          fixed top-0 left-0 h-full z-40 transition-all duration-300 bg-[#1e3a8a]
          ${isCollapsed ? "w-16" : "w-64"}
          ${
            isMobileOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          <div className="flex items-center">
            {logo ? (
              <>
                {/* <img
                  src={logo}
                  alt="Tenant logo"
                  className={`${isCollapsed ? "h-8 w-8" : "h-10 w-auto"} object-contain`}
                /> */}
                {!isCollapsed && (
                  <span className="ml-3 text-lg font-medium truncate text-white">
                    {tenant?.companyName || tenant?.name || "Focus Form"}
                  </span>
                )}
              </>
            ) : (
              <>
                <FileText
                  className={`${isCollapsed ? "w-6 h-6" : "w-8 h-8"} text-white`}
                />
                {!isCollapsed && (
                  <span className="ml-3 text-lg font-medium text-white">
                    Focus Form
                  </span>
                )}
              </>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex p-2 hover:bg-white/10 rounded-lg transition-colors"
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
                        ? "bg-white/20 text-white shadow-sm"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }
                  `}
                  title={isCollapsed ? item.title : ""}
                >
                  <Icon className="w-5 h-5 flex-shrink-0 text-white" />
                  {!isCollapsed && (
                    <span className="ml-3 font-medium text-white">
                      {item.title}
                    </span>
                  )}

                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 text-sm rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 bg-[#1e3a8a] text-white">
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
              className="group relative flex items-center w-full px-3 py-3 rounded-lg transition-all duration-200 text-white hover:bg-red-600 hover:text-white"
              title={isCollapsed ? "Sign Out" : ""}
            >
              <LogOut className="w-5 h-5 flex-shrink-0 text-white" />
              {!isCollapsed && (
                <span className="ml-3 font-medium text-white">Sign Out</span>
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
