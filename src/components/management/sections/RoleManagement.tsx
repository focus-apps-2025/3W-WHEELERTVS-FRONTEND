import React, { useState, useEffect } from "react";
import type { Role } from "../../../types";
import RoleList from "./roles/RoleList";
import RoleForm from "./roles/RoleForm";
import ManagementCard from "../shared/ManagementCard";
import { rolesApi } from "../../../api/roles";
import { useNotification } from "../../../context/NotificationContext";

export default function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError, showConfirm } = useNotification();

  // Load roles on component mount
  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const rolesData = await rolesApi.getAll();
      setRoles(rolesData);
    } catch (err) {
      console.error("Failed to load roles:", err);
      setError("Failed to load roles. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async (roleData: Omit<Role, "id">) => {
    try {
      setError(null);
      const newRole = await rolesApi.save(roleData as Role);
      setRoles([...roles, newRole]);
      showSuccess("Role created successfully", "Success");
    } catch (err: any) {
      console.error("Failed to create role:", err);
      const errorMsg =
        err.message || "Failed to create role. Please try again.";
      setError(errorMsg);
      showError(errorMsg, "Error");
    }
  };

  const handleUpdateRole = async (updatedRole: Role) => {
    try {
      setError(null);
      const savedRole = await rolesApi.save(updatedRole);
      setRoles(
        roles.map((role) => (role.id === updatedRole.id ? savedRole : role))
      );
      setEditingRole(null);
      showSuccess("Role updated successfully", "Success");
    } catch (err: any) {
      console.error("Failed to update role:", err);
      const errorMsg =
        err.message || "Failed to update role. Please try again.";
      setError(errorMsg);
      showError(errorMsg, "Error");
    }
  };

  const handleDeleteRole = async (id: string) => {
    showConfirm(
      "Are you sure you want to delete this role? This action cannot be undone.",
      async () => {
        try {
          setError(null);
          await rolesApi.delete(id);
          setRoles(roles.filter((role) => role.id !== id));
          showSuccess("Role deleted successfully", "Success");
        } catch (err: any) {
          console.error("Failed to delete role:", err);
          const errorMsg =
            err.message || "Failed to delete role. Please try again.";
          setError(errorMsg);
          showError(errorMsg, "Error");
        }
      },
      "Delete Role",
      "Delete",
      "Cancel"
    );
  };

  return (
    <ManagementCard
      title="Role Management"
      description="Create and manage roles to control access to system features"
      className="space-y-6"
    >
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 dark:bg-red-900/30 dark:border-red-800">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>{error}</p>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={loadRoles}
                  className="bg-red-100 px-3 py-1 text-sm font-medium text-red-800 rounded-md hover:bg-red-200 dark:bg-red-900/40 dark:text-red-200 dark:hover:bg-red-900/60"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 text-gray-900 dark:text-gray-100">
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-4 dark:text-white">
            {editingRole ? "Edit Role" : "Create New Role"}
          </h4>
          {editingRole ? (
            <RoleForm
              initialData={editingRole}
              onSubmit={(roleData) =>
                handleUpdateRole({ ...roleData, id: editingRole.id })
              }
            />
          ) : (
            <RoleForm onSubmit={handleAddRole} />
          )}
        </div>

        <div>
          <h4 className="text-md font-medium text-gray-900 mb-4 dark:text-white">
            Existing Roles
          </h4>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-primary-400"></div>
            </div>
          ) : (
            <RoleList
              roles={roles}
              onDeleteRole={handleDeleteRole}
              onEditRole={setEditingRole}
            />
          )}
        </div>
      </div>
    </ManagementCard>
  );
}
