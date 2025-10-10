import React from 'react';
import { Shield, Trash2, Edit2, Globe } from 'lucide-react';
import type { Role } from '../../../../../types';

interface RoleListProps {
  roles: Role[];
  onDeleteRole: (id: string) => void;
  onEditRole: (role: Role) => void;
}

export default function RoleList({ roles, onDeleteRole, onEditRole }: RoleListProps) {
  return (
    <div className="overflow-hidden bg-white dark:bg-gray-800 shadow-sm rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Role Name
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Description
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Permissions
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Form Permissions
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {roles.map((role) => (
            <tr key={role.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <Shield className="w-5 h-5 text-blue-500 mr-2" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {role.name}
                    </div>
                    {role.canCreateForms && (
                      <span className="inline-flex items-center px-2 py-0.5 mt-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                        <Globe className="w-3 h-3 mr-1" />
                        Can Create Forms
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {role.description}
                </div>
              </td>
              <td className="px-6 py-4">
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
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-2">
                  {role.formPermissions.slice(0, 2).map((fp) => (
                    <div key={fp.formId} className="text-xs">
                      <div className="font-medium text-gray-700 dark:text-gray-300">
                        {fp.formTitle}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
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
                  {role.formPermissions.length > 2 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      +{role.formPermissions.length - 2} more
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={() => onEditRole(role)}
                    className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                    title="Edit Role"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onDeleteRole(role.id)}
                    className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    title="Delete Role"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {roles.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                No roles have been created yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}