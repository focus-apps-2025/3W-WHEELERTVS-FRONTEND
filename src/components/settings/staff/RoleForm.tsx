import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Role, FormPermission } from '../../../types/staff';
import type { Question } from '../../../types/forms';
import FormPermissionsList from './permissions/FormPermissionsList';
import { questionsApi } from '../../../api/storage';
import { permissionCategories } from '../../../utils/roleUtils';
import PermissionCategory from './permissions/PermissionCategory';

interface RoleFormProps {
  initialData?: Role | null;
  onSubmit: (role: Omit<Role, 'id'> | Role) => void;
  onCancel?: () => void;
}

export default function RoleForm({ initialData, onSubmit, onCancel }: RoleFormProps) {
  const [formData, setFormData] = useState({
    id: initialData?.id || '',
    name: initialData?.name || '',
    description: initialData?.description || '',
    permissions: new Set(initialData?.permissions || []),
    formPermissions: initialData?.formPermissions || [],
  });

  const [forms] = React.useState<Question[]>(() => questionsApi.getAll());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.description) {
      const roleData = {
        ...formData,
        permissions: Array.from(formData.permissions),
      };
      onSubmit(roleData);
      
      if (!initialData) {
        setFormData({
          id: '',
          name: '',
          description: '',
          permissions: new Set(),
          formPermissions: [],
        });
      }
    }
  };

  const handleUpdateFormPermissions = (formPermissions: FormPermission[]) => {
    setFormData(prev => ({ ...prev, formPermissions }));
  };

  const handleTogglePermission = (permissionId: string) => {
    setFormData(prev => {
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
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h4 className="text-lg font-medium text-gray-900 dark:text-white">
          {initialData ? 'Edit Role' : 'Create New Role'}
        </h4>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </div>
      
      <div className="p-6 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter role name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Enter role description"
              rows={3}
              required
            />
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              System Permissions
            </h5>
            <div className="space-y-6">
              {permissionCategories.map((category) => (
                <PermissionCategory
                  key={category.id}
                  category={category}
                  selectedPermissions={formData.permissions}
                  onTogglePermission={handleTogglePermission}
                />
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Form-Specific Permissions
            </h5>
            <div className="min-w-max">
              <FormPermissionsList
                forms={forms}
                formPermissions={formData.formPermissions}
                onUpdateFormPermissions={handleUpdateFormPermissions}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            {initialData ? 'Update Role' : 'Create Role'}
          </button>
        </div>
      </div>
    </form>
  );
}