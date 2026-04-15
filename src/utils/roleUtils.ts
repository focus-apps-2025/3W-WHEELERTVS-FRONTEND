export const permissionCategories = [
  {
    id: "forms",
    label: "Form Management",
    permissions: [
      { id: "create_form", label: "Create Forms" },
      { id: "edit_form", label: "Edit Forms" },
      { id: "delete_form", label: "Delete Forms" },
      { id: "view_form", label: "View Forms" },
      { id: "view_responses", label: "View Responses" },
      { id: "export_responses", label: "Export Responses" },
    ],
  },
  {
    id: "responses",
    label: "Response Management",
    permissions: [
      { id: "verify_responses", label: "Verify Responses" },
      { id: "delete_responses", label: "Delete Responses" },
      { id: "assign_responses", label: "Assign Responses" },
      { id: "add_comments", label: "Add Comments" },
    ],
  },
  {
    id: "users",
    label: "User Management",
    permissions: [
      { id: "manage_users", label: "Manage Users" },
      { id: "manage_roles", label: "Manage Roles" },
      { id: "view_audit_logs", label: "View Audit Logs" },
    ],
  },
  {
    id: "settings",
    label: "System Settings",
    permissions: [
      { id: "manage_settings", label: "Manage Settings" },
      { id: "manage_templates", label: "Manage Templates" },
      { id: "manage_integrations", label: "Manage Integrations" },
    ],
  },
] as const;

export const availablePermissions = permissionCategories.flatMap(
  (category) => category.permissions,
);

export type Permission = (typeof availablePermissions)[number]["id"];

export function hasPermission(
  userPermissions: string[],
  requiredPermission: Permission,
): boolean {
  return (
    userPermissions.includes("all") ||
    userPermissions.includes(requiredPermission)
  );
}

export function getDefaultPermissions(): Set<string> {
  return new Set(["view_form", "view_responses"]);
}

export function getRoleColor(roleName: string): string {
  const colors: Record<string, string> = {
    Administrator:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300",
    "Form Manager":
      "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
    "Response Reviewer":
      "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300",
    Inspector:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
    Subadmin:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300",
    default: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300",
  };

  return colors[roleName] || colors.default;
}
