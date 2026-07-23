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
  ChevronRight,
  Eye,
} from "lucide-react";
import { useLogo } from "../context/LogoContext";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";
import ProfileModal from "./ProfileModal";
import NotificationCenter from "./ui/NotificationCenter";
import { Calendar, MessageCircle } from "lucide-react";
import { useForms } from "../hooks/useApi";

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
  const [mobileActiveDropdown, setMobileActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { logo } = useLogo();
  const { user, isAuthenticated, logout, tenant } = useAuth();
  const { isMobileOpen, closeMobile, toggleMobile } = useSidebar();
  const { darkMode, toggleDarkMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileActiveFormId, setMobileActiveFormId] = useState<string | null>(null);
  const [hoveredFormId, setHoveredFormId] = useState<string | null>(null);
  const [isAnalyticsHovered, setIsAnalyticsHovered] = useState(false);
  const closeTimeoutRef = useRef<any>(null);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsAnalyticsHovered(true);
  };

  const handleMouseLeave = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsAnalyticsHovered(false);
      setHoveredFormId(null);
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const permissionSet = React.useMemo(() => new Set(user?.permissions || []), [user?.permissions]);

  // Fetch available forms for the dropdown
  const { data: formsData } = useForms(
    isAuthenticated &&
    !!user &&
    ["admin", "superadmin", "inspector", "subadmin"].includes(user?.role || "")
  );

  // Filter forms based on permissions
  const visibleForms = React.useMemo(() => {
    if (!isAuthenticated || !user) return [];
    const forms = formsData?.forms || [];
    
    return forms.filter((form: any) => {
      const formId = form._id || form.id;
      if (!formId) return false;
      
      // Admins and superadmins see all forms
      if (user.role === 'admin' || user.role === 'superadmin') {
        return true;
      }
      
      // For inspector/subadmin, check if they have ANY analytics permission for this form
      const subTypes = ['response', 'dashboard', 'overall', 'questions', 'sections'];
      for (const subType of subTypes) {
        if (permissionSet.has(`analytics:form:${formId}:${subType}`)) {
          return true;
        }
      }
      return false;
    });
  }, [formsData, user, isAuthenticated, permissionSet]);

  const getAllowedTabsForForm = React.useCallback((formId: string) => {
    const tabs = [
      { name: "Dashboard", key: "dashboard", subType: "dashboard" },
      { name: "Questions", key: "question", subType: "questions" },
      { name: "Sections", key: "section", subType: "sections" },
      { name: "Overall", key: "overall", subType: "overall" },
      { name: "Responses", key: "responses", subType: "response" },
    ];

    if (user?.role === "admin" || user?.role === "superadmin") {
      return tabs;
    }

    return tabs.filter(tab => 
      permissionSet.has(`analytics:form:${formId}:${tab.subType}`)
    );
  }, [user, permissionSet]);

  const canViewInternalTracking = user?.role === "superadmin" || ["admin", "tenant_admin", "subadmin"].includes(user?.role || "") && (
    tenant?.internalTrackingEnabled === true &&
    Array.isArray(tenant?.allowedTenantIds) &&
    tenant.allowedTenantIds.length > 0
  );

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
      title: "Overall",
      icon: BarChart2,
      path: "/overall",
      description: "View overall statistics",
      permission: "analytics:view",
      roles: ["admin", "inspector", "subadmin"],
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
      title: "Overall",
      icon: BarChart2,
      path: "/overall",
      description: "View overall statistics",
      permission: "Overall:view",
      roles: ["admin", "inspector", "subadmin"],
    },
    {
      title: "Service Analytics",
      icon: BarChart2,
      path: "/forms/analytics",
      description: "Detailed service analytics and insights",
      permission: "analytics:view",
      roles: ["admin", "inspector", "subadmin"],
    },
    {
      title: "Customer Requests",
      icon: FileText,
      path: "/responses/all",
      description: "View customer service requests",
      permission: MODULE_PERMISSIONS.CUSTOMER_REQUESTS,
    },
    ...(canViewInternalTracking
      ? [
        {
          title: "Internal Tracking",
          icon: Eye,
          path: "/internal-tracking",
          description: "View cross-tenant performance data",
          roles: ["admin", "tenant_admin", "subadmin"] as string[],
        },
      ]
      : []),
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
      roles: ["inspector", "admin", "tenant_admin", "staff", "subadmin"],
    },
  ];

  const adminManagementMenuItem: MenuItem = {
    title: "Admin Management",
    icon: Users,
    path: "/admin/management",
    description: "Manage tenant administrators and permissions",
    roles: ["admin"],
  };

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

      // Admin role bypass - admins see everything
      if (user.role === "admin") {
        return true;
      }

      // Special handling for analytics permissions: the tree only ever
      // grants "analytics:form:<id>:<tab>" leaves, never "analytics:view".
      if (item.permission === "analytics:view") {
        return Array.from(permissionSet).some(permission =>
          permission.startsWith("analytics:form:")
        );
      }

      // Same problem for Customer Requests: the tree only grants
      // "requests:dashboard" / "requests:response", never "requests:view".
      if (item.permission === MODULE_PERMISSIONS.CUSTOMER_REQUESTS) {
        return (
          permissionSet.has("requests:view") ||
          permissionSet.has("requests:dashboard") ||
          permissionSet.has("requests:response")
        );
      }

      return permissionSet.has(item.permission);
    });

    if (user.role === "admin" || user.role === "subadmin") {
      // Admin Management - admins always see it, subadmins need permission
      if (user.role === "admin" || permissionSet.has("admin:manage")) {
        filteredItems.push(adminManagementMenuItem);
      }

      // Attendance - admins always see everything, subadmins only see the
      // specific children they were granted.
      const attendanceChildren = [
        (user.role === "admin" ||
          [
            "attendance:record:report",
            "attendance:record:response",
            "attendance:record:calendar",
            "attendance:record:summary",
          ].some((permission) => permissionSet.has(permission))) && {
          title: "Attendance Record",
          icon: UserCheck,
          path: "/admin/attendance",
          description: "Track user attendance and working hours",
          roles: ["admin", "subadmin"],
        },
        (user.role === "admin" || permissionSet.has("attendance:activityLogs")) && {
          title: "Activity Logs",
          icon: History,
          path: "/admin/activity-logs",
          description: "View user logins and activity logs",
          roles: ["admin", "subadmin"],
        },
      ].filter(Boolean) as MenuItem[];

      if (attendanceChildren.length > 0) {
        filteredItems.push({
          title: "Attendance",
          icon: UserCheck,
          path: attendanceChildren[0].path,
          description: "Track user attendance and working hours",
          roles: ["admin", "subadmin"],
          children: attendanceChildren,
        });
      }

      // HR - admins always see everything, subadmins only see the specific
      // children they were granted (previously ANY one HR permission
      // revealed ALL 4 children — fixed here).
      const hrChildren = [
        (user.role === "admin" || permissionSet.has("hr:leaves")) && {
          title: "Leaves",
          icon: Calendar,
          path: "/hr/leaves",
          description: "Manage leave requests and status",
          roles: ["admin", "subadmin"],
        },
        (user.role === "admin" || permissionSet.has("hr:permission")) && {
          title: "Permissions",
          icon: Clock,
          path: "/hr/permissions",
          description: "Manage short leave and gate pass",
          roles: ["admin", "subadmin"],
        },
        (user.role === "admin" || permissionSet.has("hr:shifts")) && {
          title: "Shifts",
          icon: CalendarDays,
          path: "/shifts",
          description: "Manage inspector shifts",
          roles: ["admin", "subadmin"],
        },
        (user.role === "admin" || permissionSet.has("hr:reports")) && {
          title: "HR Reports",
          icon: ShieldCheck,
          path: "/hr-attendance",
          description: "Detailed shift-based attendance reports",
          roles: ["admin", "subadmin"],
        },
      ].filter(Boolean) as MenuItem[];

      if (hrChildren.length > 0) {
        filteredItems.push({
          title: "HR",
          icon: CalendarDays,
          path: hrChildren[0].path,
          description: "Leaves, Permissions, Shifts, HR Reports",
          roles: ["admin", "subadmin"],
          children: hrChildren,
        });
      }
    }

    // Chat System: inspector/admin/tenant_admin/staff keep unrestricted
    // access. subadmin needs the "chat" leaf granted in the permission tree
    // (it's already included via roles above so it survives the generic
    // filter; here we additionally require the permission for subadmin only).
    if (
      user.role === "subadmin" &&
      !permissionSet.has("chat")
    ) {
      return filteredItems.filter((item) => item.title !== "Chat System");
    }

    return filteredItems;
  })();

  return (
    <>
      <header
        className={`fixed top-0 right-0 left-0 ${isMobileOpen ? "h-auto pb-4" : "h-16"} bg-white dark:bg-gray-900 border-b border-neutral-200 dark:border-gray-700 z-[10000] transition-all duration-300`}
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

                if (item.title === "Service Analytics") {
                  const activeFormTabs = hoveredFormId ? getAllowedTabsForForm(hoveredFormId) : [];
                  const activeForm = visibleForms.find(f => (f._id || f.id) === hoveredFormId);

                  return (
                    <div
                      key={item.path}
                      className="relative"
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                    >
                      <Link
                        to={item.path}
                        className={`
                          flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200
                          ${isActive
                            ? "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400"
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                          }
                        `}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {item.title}
                        <ChevronRight className="w-3 h-3 ml-1 rotate-90" />
                      </Link>

                      <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 flex z-50 overflow-hidden transition-all duration-200 ${isAnalyticsHovered ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'} ${hoveredFormId ? 'w-[28rem]' : 'w-64'}`}>
                        {/* Left Pane - Forms List */}
                        <div className="w-64 max-h-80 overflow-y-auto py-1.5 flex-shrink-0">
                          {visibleForms.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 italic">
                              No forms available
                            </div>
                          ) : (
                            visibleForms.map((form) => {
                              const formId = form._id || form.id;
                              const isCurrentHovered = hoveredFormId === formId;

                              return (
                                <button
                                  key={formId}
                                  onMouseEnter={() => setHoveredFormId(formId)}
                                  onClick={() => navigate(`/forms/${formId}/analytics`)}
                                  className={`
                                    flex items-center justify-between px-4 py-2.5 text-sm text-left w-full transition-colors duration-150
                                    ${isCurrentHovered
                                      ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 font-semibold"
                                      : "text-gray-755 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    }
                                  `}
                                >
                                  <span className="truncate pr-2">{form.title}</span>
                                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isCurrentHovered ? 'text-primary-500 dark:text-primary-400 transform translate-x-0.5' : 'text-gray-300 dark:text-gray-655'}`} />
                                </button>
                              );
                            })
                          )}
                        </div>

                        {/* Right Pane - Tabs List */}
                        {hoveredFormId && activeForm && (
                          <div className="w-48 bg-gray-50/50 dark:bg-gray-800/40 p-2 max-h-80 overflow-y-auto flex flex-col space-y-1 border-l border-gray-100 dark:border-gray-800 flex-shrink-0">
                            {activeFormTabs.length === 0 ? (
                              <div className="px-3 py-3 text-xs text-gray-400 dark:text-gray-500 italic text-center">
                                No permitted actions
                              </div>
                            ) : (
                              activeFormTabs.map((tab) => (
                                <Link
                                  key={tab.key}
                                  to={`/forms/${hoveredFormId}/analytics?tab=${tab.key}`}
                                  className="flex items-center px-3.5 py-2 rounded-lg text-sm text-gray-755 dark:text-gray-300 hover:bg-white hover:text-primary-700 dark:hover:bg-gray-800 dark:hover:text-primary-400 shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all duration-150 font-medium"
                                >
                                  {tab.name}
                                </Link>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

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
                          ${isOpen
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
                      ${isActive
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
          <div className="lg:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 max-h-[calc(100vh-64px)] overflow-y-auto">
            <nav className="flex flex-col p-4 space-y-2">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = mobileActiveDropdown === item.title;

                if (item.title === "Service Analytics") {
                  return (
                    <div key={item.title} className="flex flex-col space-y-1">
                      <button
                        onClick={() => {
                          setMobileActiveDropdown(isExpanded ? null : "Service Analytics");
                          setMobileActiveFormId(null);
                        }}
                        className={`
                          flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200
                          ${isExpanded
                            ? "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400"
                            : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                          }
                        `}
                      >
                        <div className="flex items-center">
                          <Icon className="w-5 h-5 mr-3" />
                          {item.title}
                        </div>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>

                      {isExpanded && (
                        <div className="pl-6 flex flex-col space-y-1 mt-1 border-l-2 border-gray-100 dark:border-gray-800 ml-4">
                          {visibleForms.length === 0 ? (
                            <div className="pl-4 py-2 text-xs text-gray-400 italic">
                              No forms available
                            </div>
                          ) : (
                            visibleForms.map((form) => {
                              const formId = form._id || form.id;
                              const isFormExpanded = mobileActiveFormId === formId;
                              const allowedTabs = getAllowedTabsForForm(formId);

                              return (
                                <div key={formId} className="flex flex-col space-y-1">
                                  <button
                                    onClick={() => setMobileActiveFormId(isFormExpanded ? null : formId)}
                                    className={`
                                      flex items-center justify-between pl-4 pr-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200
                                      ${isFormExpanded
                                        ? "text-primary-700 dark:text-primary-400 bg-gray-50 dark:bg-gray-800/40"
                                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                      }
                                    `}
                                  >
                                    <span className="truncate pr-2 text-left">{form.title}</span>
                                    {allowedTabs.length > 0 && (
                                      <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isFormExpanded ? 'rotate-90' : ''}`} />
                                    )}
                                  </button>

                                  {isFormExpanded && allowedTabs.length > 0 && (
                                    <div className="pl-8 flex flex-col space-y-1 mt-1 border-l border-gray-100 dark:border-gray-800 ml-4">
                                      {allowedTabs.map((tab) => {
                                        const isTabActive = location.pathname === `/forms/${formId}/analytics` && new URLSearchParams(location.search).get("tab") === tab.key;
                                        return (
                                          <Link
                                            key={tab.key}
                                            to={`/forms/${formId}/analytics?tab=${tab.key}`}
                                            onClick={closeMobile}
                                            className={`
                                              block py-2 text-sm transition-colors duration-200
                                              ${isTabActive
                                                ? "text-primary-700 font-bold dark:text-primary-400"
                                                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                                              }
                                            `}
                                          >
                                            {tab.name}
                                          </Link>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                if (hasChildren) {
                  return (
                    <div key={item.title} className="flex flex-col space-y-1">
                      <button
                        onClick={() => setMobileActiveDropdown(isExpanded ? null : item.title)}
                        className={`
                          flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200
                          ${isExpanded
                            ? "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400"
                            : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                          }
                        `}
                      >
                        <div className="flex items-center">
                          <Icon className="w-5 h-5 mr-3" />
                          {item.title}
                        </div>
                        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>

                      {isExpanded && (
                        <div className="pl-12 flex flex-col space-y-1 mt-1">
                          {item.children?.map((child) => {
                            const isChildActive = location.pathname === child.path;
                            return (
                              <Link
                                key={child.path}
                                to={child.path}
                                onClick={closeMobile}
                                className={`
                                  block py-2 text-sm transition-colors duration-200
                                  ${isChildActive
                                    ? "text-primary-700 font-bold dark:text-primary-400"
                                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                                  }
                                `}
                              >
                                {child.title}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={closeMobile}
                    className={`
                      flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200
                      ${isActive
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
