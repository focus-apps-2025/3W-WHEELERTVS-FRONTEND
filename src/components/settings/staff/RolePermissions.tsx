import React from 'react';
import { permissionCategories } from '../../../utils/roleUtils';
import PermissionCategory from './permissions/PermissionCategory';

interface RolePermissionsProps {
  roleId: string;
  permissions: string[];
  onTogglePermission: (roleId: string, permission: string) => void;
}

export default function RolePermissions({
  roleId,
  permissions,
  onTogglePermission,
}: RolePermissionsProps) {
  const selectedPermissions = new Set(permissions);

  return (
    <div className="space-y-4">
      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Permissions
      </h5>
      {permissionCategories.map((category) => (
        <PermissionCategory
          key={category.id}
          category={category}
          selectedPermissions={selectedPermissions}
          onTogglePermission={(permission) => onTogglePermission(roleId, permission)}
        />
      ))}
    </div>
  );
}