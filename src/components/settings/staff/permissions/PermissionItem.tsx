import React from 'react';

interface PermissionItemProps {
  permission: {
    id: string;
    label: string;
  };
  isSelected: boolean;
  onToggle: () => void;
}

export default function PermissionItem({
  permission,
  isSelected,
  onToggle,
}: PermissionItemProps) {
  return (
    <label className="flex items-center space-x-2 text-sm p-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
      />
      <span className="text-gray-700 dark:text-gray-300">
        {permission.label}
      </span>
    </label>
  );
}