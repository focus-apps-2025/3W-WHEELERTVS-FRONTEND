import React from 'react';
import { LayoutDashboard, FileText, ListTodo, BarChart2, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MODULE_PERMISSIONS = {
  DASHBOARD: "dashboard:view",
  ANALYTICS: "analytics:view",
  CUSTOMER_REQUESTS: "requests:view",
  REQUEST_MANAGEMENT: "requests:manage",
} as const;

export default function MenuBar() {
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  
  const publicMenuItems = [
    {
      title: 'Forms Preview',
      icon: FileText,
      path: '/forms/preview',
      description: 'Preview and respond to forms',
    },
  ];

  const authenticatedMenuItems = [
    {
      title: 'Dashboard',
      icon: LayoutDashboard,
      path: '/dashboard',
      description: 'View analytics and form statistics',
      permission: MODULE_PERMISSIONS.DASHBOARD,
    },
    {
      title: 'Forms Analytics',
      icon: BarChart2,
      path: '/forms/analytics',
      description: 'Detailed form analytics and insights',
      permission: MODULE_PERMISSIONS.ANALYTICS,
    },
    {
      title: 'Forms Preview',
      icon: FileText,
      path: '/forms/preview',
      description: 'Preview and respond to forms',
    },
    {
      title: 'Forms Management',
      icon: ListTodo,
      path: '/forms/management',
      description: 'Manage and organize your forms',
      permission: MODULE_PERMISSIONS.REQUEST_MANAGEMENT,
    },
    {
      title: 'System Management',
      icon: Settings,
      path: '/system/management',
      description: 'Configure system settings and preferences',
      roles: ['admin', 'superadmin'],
    },
  ];

  const menuItems = (() => {
    if (!isAuthenticated || !user) {
      return publicMenuItems;
    }

    if (user.role === 'superadmin' || user.role === 'admin') {
      return authenticatedMenuItems;
    }

    const permissionSet = new Set(user.permissions || []);
    return authenticatedMenuItems.filter(item => {
      // If item has role restrictions, check them
      if ('roles' in item && item.roles && !item.roles.includes(user.role)) {
        return false;
      }

      // If item has permission requirements, check them
      if ('permission' in item && item.permission) {
        return permissionSet.has(item.permission);
      }

      return true;
    });
  })();

  return (
    <div className="fixed left-0 top-16 h-full w-16 lg:w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-10">
      <nav className="p-2 lg:p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className="group relative flex items-center px-3 lg:px-4 py-3.5 rounded-lg transition-all duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/30"
            >
              <div className={`flex items-center transition-all duration-200 ${
                isActive 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
              }`}>
                <Icon className={`w-6 h-6 transition-transform duration-200 group-hover:scale-110 ${
                  isActive ? 'scale-110' : ''
                }`} />
                <span className={`hidden lg:block ml-3 font-medium transition-colors duration-200 ${
                  isActive 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                }`}>
                  {item.title}
                </span>
              </div>

              {/* Tooltip for mobile view */}
              <div className="lg:hidden absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap">
                {item.title}
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 w-1 h-8 bg-blue-600 dark:bg-blue-400 rounded-r transform -translate-x-2" />
              )}

              {/* Description tooltip on desktop */}
              <div className="hidden lg:block absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                {item.description}
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}