import React from 'react';
import type { Role } from '../../../types';
import type { StaffMember } from '../../../types';

interface RoleSelectProps {
  value: string;
  onChange: (role: StaffMember['role']) => void;
  roles: Role[];
  loading: boolean;
}

export default function RoleSelect({ value, onChange, roles, loading }: RoleSelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Role
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as StaffMember['role'])}
        className="w-full px-3 py-2 bg-gray-50 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        required
        disabled={loading}
      >
        {loading ? (
          <option>Loading roles...</option>
        ) : roles.length > 0 ? (
          roles.map(role => (
            <option key={role.id} value={role.name.toLowerCase()}>
              {role.name}
            </option>
          ))
        ) : (
          <>
       
          </>
        )}
      </select>
    </div>
  );
}