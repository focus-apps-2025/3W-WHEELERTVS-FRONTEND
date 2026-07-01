import React from 'react';

interface Permission {
  id: string;
  label: string;
}

interface Category {
  id: string;
  label: string;
  permissions: Permission[];
}

interface PermissionCategoryProps {
  category: Category;
  selectedPermissions: Set<string>;
  onTogglePermission: (permissionId: string) => void;
}

export default function PermissionCategory({
  category,
  selectedPermissions,
  onTogglePermission,
}: PermissionCategoryProps) {
  return (
    <div className="space-y-3">
      <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {category.label}
      </h6>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
        {category.permissions.map((permission) => (
          <label
            key={permission.id}
            className="flex items-center space-x-2 text-sm p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedPermissions.has(permission.id)}
              onChange={() => onTogglePermission(permission.id)}
              className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-600"
            />
            <span className="text-gray-700 dark:text-gray-300">
              {permission.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}