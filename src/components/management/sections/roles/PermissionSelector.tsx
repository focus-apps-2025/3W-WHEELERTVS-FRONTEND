import React from "react";

interface Permission {
  id: string;
  label: string;
}

interface Category {
  id: string;
  label: string;
  permissions: Permission[];
}

interface PermissionSelectorProps {
  category: Category;
  selectedPermissions: Set<string>;
  onTogglePermission: (permissionId: string) => void;
}

export default function PermissionSelector({
  category,
  selectedPermissions,
  onTogglePermission,
}: PermissionSelectorProps) {
  return (
    <div className="space-y-3">
      <h6 className="text-sm font-medium text-primary-700">{category.label}</h6>
      <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg border border-neutral-200">
        {category.permissions.map((permission) => (
          <label
            key={permission.id}
            className="flex items-center space-x-2 text-sm p-2 rounded-lg hover:bg-white transition-colors cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedPermissions.has(permission.id)}
              onChange={() => onTogglePermission(permission.id)}
              className="rounded text-primary-600 focus:ring-primary-500"
            />
            <span className="text-primary-700">{permission.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
