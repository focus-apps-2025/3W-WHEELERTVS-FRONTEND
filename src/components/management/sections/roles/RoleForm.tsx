import React, { useState, useMemo } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import type { Role } from "../../../../types";
import PermissionTree from "../../../common/PermissionTree";
import { buildPermissionTree } from "../../../../config/permissionTree";

interface RoleFormProps {
  onSubmit: (role: Omit<Role, "id">) => void;
  initialData?: Role;
  forms?: any[];
}

export default function RoleForm({ onSubmit, initialData, forms = [] }: RoleFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    permissions: new Set<string>(initialData?.permissions || []),
    formPermissions: initialData?.formPermissions || [],
    canCreateForms: initialData?.canCreateForms || false,
  });

  const permissionTree = useMemo(() => buildPermissionTree(forms), [forms]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      description: formData.description,
      permissions: Array.from(formData.permissions),
      formPermissions: formData.formPermissions,
      canCreateForms: formData.canCreateForms,
    });

    if (!initialData) {
      setFormData({
        name: "",
        description: "",
        permissions: new Set<string>(),
        formPermissions: [],
        canCreateForms: false,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-neutral-100 dark:border-gray-800 shadow-sm dark:bg-gray-900/50 backdrop-blur-sm transition-all duration-300">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-100 dark:border-gray-850">
        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white">
            {initialData ? "Edit Role" : "Create New Role"}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Configure system and module access levels for this role
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 dark:text-gray-300 uppercase tracking-wider">
              Role Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm"
              placeholder="e.g. Inspector Supervisor"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 dark:text-gray-300 uppercase tracking-wider">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm"
              placeholder="e.g. Has access to all reports and chats"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 py-2">
          <input
            type="checkbox"
            id="canCreateForms"
            checked={formData.canCreateForms}
            onChange={(e) =>
              setFormData({ ...formData, canCreateForms: e.target.checked })
            }
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 border-gray-300 cursor-pointer animate-none"
          />
          <label htmlFor="canCreateForms" className="text-sm font-semibold text-gray-700 dark:text-gray-350 cursor-pointer select-none">
            Can Create / Manage Forms
          </label>
        </div>

        <div className="pt-4 border-t border-neutral-100 dark:border-gray-850">
          <label className="block text-xs font-semibold text-gray-600 mb-3.5 dark:text-gray-300 uppercase tracking-wider">
            Module Access & Permissions
          </label>
          <div className="bg-neutral-50 dark:bg-gray-950/40 rounded-2xl p-6 border border-neutral-100 dark:border-gray-800">
            <PermissionTree
              nodes={permissionTree}
              selected={formData.permissions}
              onChange={(next) =>
                setFormData((prev) => ({ ...prev, permissions: next }))
              }
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-neutral-100 dark:border-gray-850">
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95 duration-200">
            <Plus className="w-4 h-4" />
            {initialData ? "Update Role" : "Create Role"}
          </button>
        </div>
      </div>
    </form>
  );
}
