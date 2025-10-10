import { useState, useCallback } from 'react';
import type { Role } from '../types';
import { rolesApi } from '../api/roles';

export function useRoleManagement(initialRoles: Role[] = []) {
  const [roles, setRoles] = useState<Role[]>(() => {
    const savedRoles = rolesApi.getAll();
    return savedRoles.length > 0 ? savedRoles : initialRoles;
  });

  const addRole = useCallback((roleData: Omit<Role, 'id'>) => {
    const newRole: Role = {
      id: crypto.randomUUID(),
      ...roleData,
    };
    rolesApi.save(newRole);
    setRoles(prev => [...prev, newRole]);
    return newRole;
  }, []);

  const updateRole = useCallback((updatedRole: Role) => {
    rolesApi.save(updatedRole);
    setRoles(prev => prev.map(role => 
      role.id === updatedRole.id ? updatedRole : role
    ));
  }, []);

  const deleteRole = useCallback((id: string) => {
    const roleToDelete = roles.find(role => role.id === id);
    if (!roleToDelete) return;

    const confirmMessage = `Are you sure you want to delete the role "${roleToDelete.name}"? This action cannot be undone.`;
    
    if (window.confirm(confirmMessage)) {
      rolesApi.delete(id);
      setRoles(prev => prev.filter(role => role.id !== id));
    }
  }, [roles]);

  return {
    roles,
    addRole,
    updateRole,
    deleteRole,
  };
}