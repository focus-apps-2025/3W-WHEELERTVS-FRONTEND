import React from 'react';
import { Shield, Trash2, Edit2 } from 'lucide-react';
import type { Role } from '../../../types';

interface RoleListProps {
  roles: Role[];
  onDeleteRole: (id: string) => void;
  onEditRole: (role: Role) => void;
}

export default function RoleList({ roles, onDeleteRole, onEditRole }: RoleListProps) {
  return (
    <div className="space-y-4">
      {roles.map((role) => (
        <div
          key={role.id}
          className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center">
              <Shield className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                {role.name}
              </h4>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onEditRole(role)}
                className="flex items-center px-3 py-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <Edit2 className="w-4 h-4 mr-1.5" />
                <span className="text-sm">Edit</span>
              </button>
              <button
                onClick={() => onDeleteRole(role.id)}
                className="flex items-center px-3 py-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                <span className="text-sm">Delete</span>
              </button>
            </div>
          </div>

          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
            {role.description}
          </p>

          <div className="mt-4">
            <h6 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
              System Permissions:
            </h6>
            <div className="flex flex-wrap gap-2">
              {role.permissions.slice(0, 3).map((permission) => (
                <span
                  key={permission}
                  className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                >
                  {permission.replace(/_/g, ' ')}
                </span>
              ))}
              {role.permissions.length > 3 && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  +{role.permissions.length - 3} more
                </span>
              )}
            </div>
          </div>

          {role.formPermissions.length > 0 && (
            <div className="mt-4">
              <h6 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                Form Permissions:
              </h6>
              <div className="grid gap-2 sm:grid-cols-2">
                {role.formPermissions.slice(0, 2).map((fp) => (
                  <div
                    key={fp.formId}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2"
                  >
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {fp.formTitle}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(fp.permissions)
                        .filter(([_, value]) => value)
                        .slice(0, 2)
                        .map(([key]) => (
                          <span
                            key={key}
                            className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300"
                          >
                            {key}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              {role.formPermissions.length > 2 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  +{role.formPermissions.length - 2} more forms
                </p>
              )}
            </div>
          )}
        </div>
      ))}

      {roles.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No roles have been created yet.
        </div>
      )}
    </div>
  );
}