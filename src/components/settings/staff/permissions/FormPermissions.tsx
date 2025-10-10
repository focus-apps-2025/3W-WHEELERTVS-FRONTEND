import React from 'react';
import { Eye, Edit2, Trash2 } from 'lucide-react';
import type { FormPermission } from '../../../../types/staff';
import type { Question } from '../../../../types/forms';

interface FormPermissionsProps {
  forms: Question[];
  formPermissions: FormPermission[];
  onUpdateFormPermissions: (formPermissions: FormPermission[]) => void;
}

export default function FormPermissions({
  forms,
  formPermissions,
  onUpdateFormPermissions,
}: FormPermissionsProps) {
  const handleTogglePermission = (formId: string, type: 'view' | 'edit' | 'delete') => {
    const updatedPermissions = [...formPermissions];
    const formIndex = updatedPermissions.findIndex(fp => fp.formId === formId);
    
    if (formIndex >= 0) {
      updatedPermissions[formIndex] = {
        ...updatedPermissions[formIndex],
        permissions: {
          ...updatedPermissions[formIndex].permissions,
          [type]: !updatedPermissions[formIndex].permissions[type],
        },
      };
    } else {
      updatedPermissions.push({
        formId,
        formTitle: forms.find(f => f.id === formId)?.title || '',
        permissions: {
          view: type === 'view',
          edit: type === 'edit',
          delete: type === 'delete',
        },
      });
    }
    
    onUpdateFormPermissions(updatedPermissions);
  };

  const getFormPermission = (formId: string): FormPermission['permissions'] => {
    return formPermissions.find(fp => fp.formId === formId)?.permissions || {
      view: false,
      edit: false,
      delete: false,
    };
  };

  return (
    <div className="space-y-4">
      <h6 className="text-sm font-medium text-gray-600 dark:text-gray-400">
        Form-Specific Permissions
      </h6>
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Form Title
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                View
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Edit
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Delete
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {forms.map((form) => {
              const permissions = getFormPermission(form.id);
              return (
                <tr key={form.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {form.title}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleTogglePermission(form.id, 'view')}
                      className={`p-2 rounded-lg transition-colors ${
                        permissions.view
                          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20'
                          : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                      }`}
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleTogglePermission(form.id, 'edit')}
                      className={`p-2 rounded-lg transition-colors ${
                        permissions.edit
                          ? 'text-green-600 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/20'
                          : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                      }`}
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleTogglePermission(form.id, 'delete')}
                      className={`p-2 rounded-lg transition-colors ${
                        permissions.delete
                          ? 'text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20'
                          : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                      }`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}