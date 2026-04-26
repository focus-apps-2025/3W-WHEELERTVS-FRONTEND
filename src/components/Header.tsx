import React, { useState, useRef, useEffect } from "react";
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
  X,
  History,
  Clock,
  CalendarDays,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useLogo } from "../context/LogoContext";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";
import ProfileModal from "./ProfileModal";
import NotificationCenter from "./ui/NotificationCenter";
import { Calendar, MessageCircle } from "lucide-react";

interface MenuItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  description: string;
  roles?: string[];
  permission?: string;
  children?: MenuItem[];
}

const MODULE_PERMISSIONS = {
  DASHBOARD: "dashboard:view",
  ANALYTICS: "analytics:view",
  CUSTOMER_REQUESTS: "requests:view",
  REQUEST_MANAGEMENT: "requests:manage",
} as const;

export default function Header() {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { logo } = useLogo();
  const { user, isAuthenticated, logout } = useAuth();
  const { isMobileOpen, closeMobile, toggleMobile } = useSidebar();
  const { darkMode, toggleDarkMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const isGuest = React.useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return (
      searchParams.get("guest") === "true" ||
      !!localStorage.getItem("guest_auth_token")
    );
  }, [location.search]);

  if (isGuest) return null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeDropdown]);

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
      title: "Global Forms",
      icon: FileText,
      path: "/superadmin/forms",
      description: "Manage forms across all tenants",
    },
    {
      title: "Attendance",
      icon: UserCheck,
      path: "/admin/attendance",
      description: "Track user attendance and working hours",
      children: [
        {
          title: "Attendance Record",
          icon: UserCheck,
          path: "/admin/attendance",
          description: "Track user attendance and working hours",
        },
        {
          title: "Activity Logs",
          icon: History,
          path: "/admin/activity-logs",
          description: "View user logins and activity logs",
        },
      ],
    },
  ];

  const tenantMenuItems: MenuItem[] = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
      description: "View shop analytics and service statistics",
      permission: MODULE_PERMISSIONS.DASHBOARD,
      roles: ["admin", "inspector", "subadmin"],
    },
    {
      title: "Service Analytics",
      icon: BarChart2,
      path: "/forms/analytics",
      description: "Detailed service analytics and insights",
      permission: MODULE_PERMISSIONS.ANALYTICS,
      roles: ["admin", "inspector", "subadmin"],
    },
    {
      title: "Customer Requests",
      icon: FileText,
      path: "/responses/all",
      description: "View customer service requests",
      permission: MODULE_PERMISSIONS.CUSTOMER_REQUESTS,
    },
    {
      title: "Attendance",
      icon: UserCheck,
      path: "/attendance-dashboard",
      description: "Mark your daily attendance",
      roles: ["inspector"],
    },
    {
      title: "Leaves",
      icon: Calendar,
      path: "/hr/leaves",
      description: "Apply for leave",
      roles: ["inspector"],
    },
    {
      title: "Permissions",
      icon: Clock,
      path: "/hr/permissions",
      description: "Apply for permissions",
      roles: ["inspector"],
    },
    {
      title: "Chat System",
      icon: MessageCircle,
      path: "/inspector/chat",
      description: "Communicate with Service Analytics administrators",
      roles: ["inspector", "admin", "tenant_admin", "staff"],
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
      filteredItems.push({
        title: "Attendance",
        icon: UserCheck,
        path: "/admin/attendance",
        description: "Track user attendance and working hours",
        roles: ["admin"],
        children: [
          {
            title: "Attendance Record",
            icon: UserCheck,
            path: "/admin/attendance",
            description: "Track user attendance and working hours",
            roles: ["admin"],
          },
          {
            title: "Activity Logs",
            icon: History,
            path: "/admin/activity-logs",
            description: "View user logins and activity logs",
            roles: ["admin"],
          },
        ],
      });
      filteredItems.push({
        title: "HR",
        icon: CalendarDays,
        path: "/hr/leaves",
        description: "Leaves, Permissions, Shifts, HR Reports",
        roles: ["admin", "subadmin"],
        children: [
          {
            title: "Leaves",
            icon: Calendar,
            path: "/hr/leaves",
            description: "Manage leave requests and status",
            roles: ["admin", "subadmin"],
          },
          {
            title: "Permissions",
            icon: Clock,
            path: "/hr/permissions",
            description: "Manage short leave and gate pass",
            roles: ["admin", "subadmin"],
          },
          {
            title: "Shifts",
            icon: CalendarDays,
            path: "/shifts",
            description: "Manage inspector shifts",
            roles: ["admin", "subadmin"],
          },
          {
            title: "HR Reports",
            icon: ShieldCheck,
            path: "/hr-attendance",
            description: "Detailed shift-based attendance reports",
            roles: ["admin", "subadmin"],
          },
        ],
      });
    }

    return filteredItems;
  })();

  return (
    <>
      <header
        className={`fixed top-0 right-0 left-0 ${isMobileOpen ? "h-auto pb-4" : "h-16"} bg-white dark:bg-gray-900 border-b border-neutral-200 dark:border-gray-700 z-30 transition-all duration-300`}
      >
        <div className="flex items-center justify-between h-16 px-6">
          {/* Left side - logo */}
          <div className="flex items-center min-w-[200px]">
            {/* Mobile menu button */}
            <button
              onClick={toggleMobile}
              className="lg:hidden mr-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {isMobileOpen ? (
                <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              )}
            </button>

            <div className="flex items-center">
              <img
                src={logo}
                alt="Logo"
                className="h-8 w-auto object-contain max-w-[150px]"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          </div>

          {/* Center - Navigation */}
          <nav className="hidden lg:flex items-center justify-center flex-1 px-4">
            <div className="flex items-center space-x-1">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;

                if (item.children) {
                  const isOpen = activeDropdown === item.title;
                  return (
                    <div
                      key={item.path || item.title}
                      className="relative"
                      ref={isOpen ? dropdownRef : null}
                    >
                      <button
                        onClick={() => setActiveDropdown(isOpen ? null : item.title)}
                        className={`
                          flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200
                          ${
                            isOpen
                              ? "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                          }
                        `}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {item.title}
                      </button>
                      {isOpen && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                          {item.children.map((child) => (
                            <Link
                              key={child.path}
                              to={child.path}
                              onClick={() => {
                                setActiveDropdown(null);
                              }}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              {child.title}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

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

            {isAuthenticated && <NotificationCenter />}

            {isAuthenticated && (
              <>
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="hidden md:flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                  title="View Profile"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 group-hover:bg-primary-200 dark:group-hover:bg-primary-900/50 transition-colors">
                    <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Profile
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[100px]">
                      {user?.firstName} {user?.lastName}
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => setShowProfileModal(true)}
                  className="md:hidden p-2 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                  title="View Profile"
                >
                  <User className="w-5 h-5" />
                </button>

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

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </>
  );
}
