import { useState, useEffect } from 'react';
import type { Role } from '../types';
import { rolesApi } from '../api/roles';

export function useRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRoles = () => {
      const savedRoles = rolesApi.getAll();
      setRoles(savedRoles);
      setLoading(false);
    };

    loadRoles();

    // Listen for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'roles') {
        loadRoles();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const addRole = (role: Omit<Role, 'id'>) => {
    const newRole: Role = {
      id: crypto.randomUUID(),
      ...role
    };
    rolesApi.save(newRole);
    setRoles(prev => [...prev, newRole]);
    return newRole;
  };

  const updateRole = (role: Role) => {
    rolesApi.save(role);
    setRoles(prev => prev.map(r => r.id === role.id ? role : r));
  };

  const deleteRole = (id: string) => {
    rolesApi.delete(id);
    setRoles(prev => prev.filter(r => r.id !== id));
  };

  return {
    roles,
    loading,
    addRole,
    updateRole,
    deleteRole
  };
}