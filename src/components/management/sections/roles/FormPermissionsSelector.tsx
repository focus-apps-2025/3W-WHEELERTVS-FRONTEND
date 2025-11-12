import React from "react";
import type { FormPermission } from "../../../../types/staff";
import type { Question } from "../../../../types/forms";

interface FormPermissionsSelectorProps {
  formPermissions: FormPermission[];
  onChange: (formPermissions: FormPermission[]) => void;
}

export default function FormPermissionsSelector({
  formPermissions,
  onChange,
}: FormPermissionsSelectorProps) {
  const [forms] = React.useState<Question[]>(() => {
    // Get forms from local storage
    const data = localStorage.getItem("form_questions");
    return data ? JSON.parse(data) : [];
  });

  const handleTogglePermission = (
    formId: string,
    permission: keyof FormPermission["permissions"]
  ) => {
    const updatedPermissions = [...formPermissions];
    const formIndex = updatedPermissions.findIndex(
      (fp) => fp.formId === formId
    );

    if (formIndex >= 0) {
      updatedPermissions[formIndex] = {
        ...updatedPermissions[formIndex],
        permissions: {
          ...updatedPermissions[formIndex].permissions,
          [permission]: !updatedPermissions[formIndex].permissions[permission],
        },
      };
    } else {
      const form = forms.find((f) => f.id === formId);
      if (form) {
        updatedPermissions.push({
          formId,
          formTitle: form.title,
          permissions: {
            respond: false,
            viewResponses: false,
            edit: false,
            addFollowUp: false,
            delete: false,
            publicVisibility: false,
            [permission]: true,
          },
        });
      }
    }

    onChange(updatedPermissions);
  };

  const getFormPermission = (formId: string): FormPermission["permissions"] => {
    return (
      formPermissions.find((fp) => fp.formId === formId)?.permissions || {
        respond: false,
        viewResponses: false,
        edit: false,
        addFollowUp: false,
        delete: false,
        publicVisibility: false,
      }
    );
  };

  const permissionLabels = [
    { key: "respond", label: "Submit Response" },
    { key: "viewResponses", label: "View Responses" },
    { key: "edit", label: "Edit Form" },
    { key: "addFollowUp", label: "Add Follow-up" },
    { key: "delete", label: "Delete Form" },
    { key: "publicVisibility", label: "Public Visibility" },
  ] as const;

  return (
    <div className="space-y-4">
      <h6 className="text-sm font-medium text-primary-700 dark:text-primary-200">
        Form-Specific Permissions
      </h6>
      <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-neutral-200 dark:border-gray-700 shadow-sm">
        <table className="min-w-full divide-y divide-neutral-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-gray-800/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-primary-700 dark:text-primary-200 uppercase tracking-wider">
                Form Title
              </th>
              {permissionLabels.map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-3 text-center text-xs font-medium text-primary-700 dark:text-primary-200 uppercase tracking-wider"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-neutral-200 dark:divide-gray-800">
            {forms.map((form) => {
              const permissions = getFormPermission(form.id);
              return (
                <tr
                  key={form.id}
                  className="bg-white hover:bg-gray-50 dark:bg-gray-900/50 dark:hover:bg-gray-800 transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-primary-900 dark:text-gray-100">
                    {form.title}
                  </td>
                  {permissionLabels.map(({ key, label }) => (
                    <td key={key} className="px-4 py-3">
                      <label className="flex items-center space-x-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={permissions[key]}
                          onChange={() => handleTogglePermission(form.id, key)}
                          className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500 h-4 w-4 dark:bg-gray-900 dark:border-gray-700"
                        />
                        <span className="text-sm text-primary-600 group-hover:text-primary-900 dark:text-primary-200 dark:group-hover:text-primary-100">
                          {label}
                        </span>
                      </label>
                    </td>
                  ))}
                </tr>
              );
            })}
            {forms.length === 0 && (
              <tr className="bg-white dark:bg-gray-900/40">
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-primary-500 dark:text-gray-300"
                >
                  No forms available. Create forms to manage permissions.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
