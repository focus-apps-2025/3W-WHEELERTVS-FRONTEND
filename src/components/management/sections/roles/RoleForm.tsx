import React, { useState } from "react";
import { Plus } from "lucide-react";
import type { Role } from "../../../../types";
import PermissionSelector from "./PermissionSelector";
import FormPermissionsSelector from "./FormPermissionsSelector";
import { permissionCategories } from "../../../../utils/roleUtils";

interface RoleFormProps {
  onSubmit: (role: Omit<Role, "id">) => void;
  initialData?: Role;
}

export default function RoleForm({ onSubmit, initialData }: RoleFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    permissions: new Set(initialData?.permissions || []),
    formPermissions: initialData?.formPermissions || [],
    canCreateForms: initialData?.canCreateForms || false,
  });

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
        permissions: new Set(),
        formPermissions: [],
        canCreateForms: false,
      });
    }
  };

  const handlePermissionChange = (categoryId: string, permissionId: string) => {
    setFormData((prev) => {
      const newPermissions = new Set(prev.permissions);
      if (newPermissions.has(permissionId)) {
        newPermissions.delete(permissionId);
      } else {
        newPermissions.add(permissionId);
      }
      return { ...prev, permissions: newPermissions };
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 shadow-sm dark:bg-gray-800 dark:border dark:border-gray-700">
      <h4 className="text-lg font-medium text-primary-600 mb-6 dark:text-primary-300">
        {initialData ? "Edit Role" : "Create New Role"}
      </h4>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-primary-600 mb-1 dark:text-primary-200">
            Role Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="input-field"
            placeholder="Enter role name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-primary-600 mb-1 dark:text-primary-200">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="input-field"
            placeholder="Enter role description"
            rows={3}
          />
        </div>

        <div>
          <label className="flex items-center space-x-2 text-sm font-medium text-primary-600 dark:text-primary-200">
            <input
              type="checkbox"
              checked={formData.canCreateForms}
              onChange={(e) =>
                setFormData({ ...formData, canCreateForms: e.target.checked })
              }
              className="rounded text-primary-600 focus:ring-primary-500 dark:bg-gray-900 dark:border-gray-700"
            />
            <span>Can Create New Forms</span>
          </label>
        </div>

        <div>
          <h5 className="text-sm font-medium text-primary-700 mb-4 dark:text-primary-200">
            System Permissions
          </h5>
          <div className="space-y-6">
            {permissionCategories.map((category) => (
              <PermissionSelector
                key={category.id}
                category={category}
                selectedPermissions={formData.permissions}
                onTogglePermission={(permissionId) =>
                  handlePermissionChange(category.id, permissionId)
                }
              />
            ))}
          </div>
        </div>

        <div>
          <FormPermissionsSelector
            formPermissions={formData.formPermissions}
            onChange={(formPermissions) =>
              setFormData({ ...formData, formPermissions })
            }
          />
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            {initialData ? "Update Role" : "Create Role"}
          </button>
        </div>
      </div>
    </form>
  );
}
