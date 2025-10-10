import React, { useState } from 'react';
import type { Role } from '../../../types';
import RoleList from './RoleList';
import RoleForm from './RoleForm';

interface RoleManagementProps {
  onClose: () => void;
}

export default function RoleManagement({ onClose }: RoleManagementProps) {
  const [roles, setRoles] = useState<Role[]>([
    {
      id: '1',
      name: 'Administrator',
      description: 'Full access to all features',
      permissions: ['create_form', 'edit_form', 'delete_form', 'manage_team', 'manage_roles'],
      formPermissions: [],
    },
    {
      id: '2',
      name: 'Form Manager',
      description: 'Can create and edit forms',
      permissions: ['create_form', 'edit_form', 'view_responses'],
      formPermissions: [],
    },
    {
      id: '3',
      name: 'Response Reviewer',
      description: 'Can only view forms and responses',
      permissions: ['view_form', 'view_responses'],
      formPermissions: [],
    },
  ]);

  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const handleAddRole = (roleData: Omit<Role, 'id'>) => {
    const newRole: Role = {
      id: crypto.randomUUID(),
      ...roleData,
    };
    setRoles([...roles, newRole]);
  };

  const handleUpdateRole = (updatedRole: Role) => {
    setRoles(roles.map(role => 
      role.id === updatedRole.id ? updatedRole : role
    ));
    setEditingRole(null);
  };

  const handleDeleteRole = (id: string) => {
    if (window.confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      setRoles(roles.filter(role => role.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Role Management</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Create and manage roles to control access to different features of the system.
        </p>
      </div>

      {editingRole ? (
        <RoleForm
          initialData={editingRole}
          onSubmit={(roleData) => handleUpdateRole({ ...roleData, id: editingRole.id })}
        />
      ) : (
        <RoleForm onSubmit={handleAddRole} />
      )}

      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Existing Roles</h3>
        <RoleList
          roles={roles}
          onDeleteRole={handleDeleteRole}
          onEditRole={setEditingRole}
        />
      </div>
    </div>
  );
}