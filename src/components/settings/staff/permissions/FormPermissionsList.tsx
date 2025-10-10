import React from 'react';
import type { FormPermission } from '../../../../types/staff';
import type { Question } from '../../../../types/forms';

interface FormPermissionsListProps {
  forms: Question[];
  formPermissions: FormPermission[];
  onUpdateFormPermissions: (formPermissions: FormPermission[]) => void;
}

export default function FormPermissionsList({
  forms,
  formPermissions,
  onUpdateFormPermissions,
}: FormPermissionsListProps) {
  const handleTogglePermission = (formId: string, permission: keyof FormPermission['permissions']) => {
    const updatedPermissions = [...formPermissions];
    const formIndex = updatedPermissions.findIndex(fp => fp.formId === formId);
    
    if (formIndex >= 0) {
      updatedPermissions[formIndex] = {
        ...updatedPermissions[formIndex],
        permissions: {
          ...updatedPermissions[formIndex].permissions,
          [permission]: !updatedPermissions[formIndex].permissions[permission],
        },
      };
    } else {
      const form = forms.find(f => f.id === formId);
      if (form) {
        updatedPermissions.push({
          formId,
          formTitle: form.title,
          permissions: {
            respond: permission === 'respond',
            viewResponses: permission === 'viewResponses',
            edit: permission === 'edit',
            addFollowUp: permission === 'addFollowUp',
            delete: permission === 'delete',
            publicVisibility: permission === 'publicVisibility',
          },
        });
      }
    }
    
    onUpdateFormPermissions(updatedPermissions);
  };

  const getFormPermission = (formId: string): FormPermission['permissions'] => {
    return formPermissions.find(fp => fp.formId === formId)?.permissions || {
      respond: false,
      viewResponses: false,
      edit: false,
      addFollowUp: false,
      delete: false,
      publicVisibility: false,
    };
  };

  const permissionLabels = [
    { key: 'respond', label: 'Submit Response' },
    { key: 'viewResponses', label: 'View Responses' },
    { key: 'edit', label: 'Edit Form' },
    { key: 'addFollowUp', label: 'Add Follow-up Forms' },
    { key: 'delete', label: 'Delete Form' },
    { key: 'publicVisibility', label: 'Make Form Public' },
  ] as const;

  if (forms.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        No forms available. Create forms to manage permissions.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 min-w-[200px]">
              Form Title
            </th>
            {permissionLabels.map(({ key, label }) => (
              <th key={key} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {forms.map((form) => {
            const permissions = getFormPermission(form.id);
            return (
              <tr key={form.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
                  {form.title}
                </td>
                {permissionLabels.map(({ key }) => (
                  <td key={key} className="px-4 py-3 text-center">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={permissions[key]}
                        onChange={() => handleTogglePermission(form.id, key)}
                        className="rounded text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 h-4 w-4"
                      />
                      <span className="sr-only">{key}</span>
                    </label>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}