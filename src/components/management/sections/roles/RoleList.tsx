import React from "react";
import { Shield, Trash2, Edit2 } from "lucide-react";
import type { Role } from "../../../../types";

interface RoleListProps {
  roles: Role[];
  onDeleteRole: (id: string) => void;
  onEditRole: (role: Role) => void;
}

export default function RoleList({
  roles,
  onDeleteRole,
  onEditRole,
}: RoleListProps) {
  return (
    <div className="space-y-4 text-gray-900 dark:text-gray-100">
      {roles.map((role) => (
        <div
          key={role.id}
          className="bg-white rounded-lg shadow-sm p-6 border border-neutral-200 dark:bg-gray-800 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-50 rounded-lg dark:bg-primary-900/40">
                <Shield className="w-5 h-5 text-primary-600 dark:text-primary-300" />
              </div>
              <div>
                <h4 className="text-lg font-medium text-primary-900 dark:text-gray-100">
                  {role.name}
                </h4>
                <p className="text-sm text-primary-500 dark:text-gray-300">{role.description}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {role.isSystem ? (
                <span className="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full dark:text-gray-300 dark:bg-gray-700/60">
                  System Role
                </span>
              ) : (
                <>
                  <button
                    onClick={() => onEditRole(role)}
                    className="p-2 text-primary-600 hover:text-primary-800 rounded-lg hover:bg-primary-50 transition-colors dark:text-primary-300 dark:hover:text-primary-100 dark:hover:bg-primary-900/40"
                    title="Edit Role"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onDeleteRole(role.id)}
                    className="p-2 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-50 transition-colors dark:text-red-300 dark:hover:text-red-200 dark:hover:bg-red-900/40"
                    title="Delete Role"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h6 className="text-sm font-medium text-primary-600 mb-2 dark:text-primary-200">
                Permissions
              </h6>
              <div className="flex flex-wrap gap-2">
                {role.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="px-2 py-1 text-xs rounded-full bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200"
                  >
                    {permission.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>

            {role.formPermissions.length > 0 && (
              <div>
                <h6 className="text-sm font-medium text-primary-600 mb-2 dark:text-primary-200">
                  Form Permissions
                </h6>
                <div className="grid gap-2">
                  {role.formPermissions.map((fp) => (
                    <div
                      key={fp.formId}
                      className="bg-gray-50 rounded-lg p-3 border border-neutral-200 dark:bg-gray-900/40 dark:border-gray-700"
                    >
                      <div className="text-sm font-medium text-primary-700 mb-2 dark:text-primary-200">
                        {fp.formTitle}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(fp.permissions)
                          .filter(([_, value]) => value)
                          .map(([key]) => (
                            <span
                              key={key}
                              className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200"
                            >
                              {key}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}

      {roles.length === 0 && (
        <div className="text-center py-8 text-primary-500 dark:text-gray-300">
          No roles have been created yet.
        </div>
      )}
    </div>
  );
}
