import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

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
  const [open, setOpen] = useState(false);

  // Check if all permissions in this category are selected
  const allSelected = category.permissions.every((permission) =>
    selectedPermissions.has(permission.id)
  );

  // Check if some permissions are selected (for indeterminate state)
  const someSelected =
    category.permissions.some((permission) =>
      selectedPermissions.has(permission.id)
    ) && !allSelected;

  // Handle select all for this category
  const handleSelectAll = () => {
    if (allSelected) {
      // If all are selected, deselect all
      category.permissions.forEach((permission) => {
        if (selectedPermissions.has(permission.id)) {
          onTogglePermission(permission.id);
        }
      });
    } else {
      // If not all are selected, select all
      category.permissions.forEach((permission) => {
        if (!selectedPermissions.has(permission.id)) {
          onTogglePermission(permission.id);
        }
      });
    }
  };

  return (
    <div className="border rounded-md p-3 dark:border-gray-700">
      {/* HEADER WITH SELECT ALL CHECKBOX */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          {/* Select All Checkbox */}
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(input) => {
                if (input) {
                  input.indeterminate = someSelected;
                }
              }}
              onChange={handleSelectAll}
              className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700"
            />
          </label>

          {/* Category Toggle Button */}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 text-sm font-medium text-primary-700 dark:text-primary-200 hover:text-primary-800 dark:hover:text-primary-100 transition-colors"
          >
            <span>{open ? "➖" : "➕"}</span>
            <span>{category.label}</span>
          </button>
        </div>

        {/* Selected Count */}
        <span className="text-xs text-primary-500 bg-primary-50 dark:bg-primary-900/30 px-2 py-1 rounded-full">
          {
            category.permissions.filter((p) => selectedPermissions.has(p.id))
              .length
          }
          /{category.permissions.length}
        </span>
      </div>

      {/* COLLAPSIBLE CONTENT — INLINE HORIZONTAL */}
      {open && (
        <div className="flex flex-wrap gap-4 mt-3 pl-10">
          {category.permissions.map((permission) => (
            <label
              key={permission.id}
              className="flex items-center space-x-2 text-sm cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={selectedPermissions.has(permission.id)}
                onChange={() => onTogglePermission(permission.id)}
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700 group-hover:border-primary-400 transition-colors"
              />
              <span className="text-primary-700 dark:text-primary-200 group-hover:text-primary-800 dark:group-hover:text-primary-100 transition-colors">
                {permission.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
