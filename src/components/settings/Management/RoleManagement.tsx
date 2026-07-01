import React, { useState } from 'react';
import type { Role } from '../../../types';
import RoleList from './roles/RoleList';
import RoleForm from './roles/RoleForm';

interface RoleManagementProps {
  onClose: () => void;
}

export default function RoleManagement({ onClose }: RoleManagementProps) {
  const [roles, setRoles] = useState<Role[]>([
    {
      id: '1',
      name: 'Admin',
      description: 'Full access to all features',
      permissions: ['create_form', 'edit_form', 'delete_form', 'manage_team', 'manage_roles'],
      formPermissions: [],
    },
    {
      id: '2',
      name: 'Editor',
      description: 'Can create and edit forms',
      permissions: ['create_form', 'edit_form', 'view_responses'],
      formPermissions: [],
    },
    {
      id: '3',
      name: 'Viewer',
      description: 'Can only view forms and responses',
      permissions: ['view_form', 'view_responses'],
      formPermissions: [],
    },
  ]);

  const handleAddRole = (roleData: Omit<Role, 'id'>) => {
    const newRole: Role = {
      id: crypto.randomUUID(),
      ...roleData,
    };
    setRoles([...roles, newRole]);
  };

  const handleDeleteRole = (id: string) => {
    if (window.confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      setRoles(roles.filter(role => role.id !== id));
    }
  };

  const handleTogglePermission = (roleId: string, permission: string) => {
    setRoles(roles.map(role => {
      if (role.id === roleId) {
        const permissions = role.permissions.includes(permission)
          ? role.permissions.filter(p => p !== permission)
          : [...role.permissions, permission];
        return { ...role, permissions };
      }
      return role;
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <RoleForm onAddRole={handleAddRole} />
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Existing Roles</h3>
        <RoleList
          roles={roles}
          onDeleteRole={handleDeleteRole}
          onTogglePermission={handleTogglePermission}
        />
      </div>
    </div>
  );
}