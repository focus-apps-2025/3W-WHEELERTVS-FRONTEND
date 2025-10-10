import React, { useState, useEffect } from 'react';
import type { Role } from '../../../../types';
import RoleList from './roles/RoleList';
import RoleForm from './roles/RoleForm';
import { rolesApi } from '../../../../api/roles';

interface RoleManagementProps {
  onClose: () => void;
}

export default function RoleManagement({ onClose }: RoleManagementProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Load roles on component mount
  useEffect(() => {
    const loadRoles = () => {
      const savedRoles = rolesApi.getAll();
      setRoles(savedRoles);
    };
    loadRoles();

    // Listen for storage changes
    const handleStorageChange = () => {
      loadRoles();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleAddRole = (roleData: Omit<Role, 'id'>) => {
    const newRole: Role = {
      id: crypto.randomUUID(),
      ...roleData,
    };
    rolesApi.save(newRole);
    setRoles(prev => [...prev, newRole]);
  };

  const handleUpdateRole = (updatedRole: Role) => {
    rolesApi.save(updatedRole);
    setRoles(prev => prev.map(role => 
      role.id === updatedRole.id ? updatedRole : role
    ));
    setEditingRole(null);
  };

  const handleDeleteRole = (id: string) => {
    if (window.confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      rolesApi.delete(id);
      setRoles(roles.filter(role => role.id !== id));
    }
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
  };

  const handleCancelEdit = () => {
    setEditingRole(null);
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
          onSubmit={handleUpdateRole}
          onCancel={handleCancelEdit}
        />
      ) : (
        <RoleForm onSubmit={handleAddRole} />
      )}

      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Existing Roles</h3>
        <RoleList
          roles={roles}
          onDeleteRole={handleDeleteRole}
          onEditRole={handleEditRole}
        />
      </div>
    </div>
  );
}