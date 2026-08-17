import React, { useState, useEffect } from "react";
import type { Role } from "../../../types";
import RoleList from "./roles/RoleList";
import RoleForm from "./roles/RoleForm";
import { rolesApi } from "../../../api/roles";
import { apiClient } from "../../../api/client";
import { useNotification } from "../../../context/NotificationContext";

export default function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showSuccess, showError, showConfirm } = useNotification();

  // Load roles and forms on component mount
  useEffect(() => {
    loadRoles();
    loadForms();
  }, []);

  const loadForms = async () => {
    try {
      const data = await apiClient.getForms();
      setForms(data.forms || []);
    } catch (err) {
      console.error("Failed to load forms for permission tree:", err);
    }
  };

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

  const handleUpdateRole = async (updatedRole: Omit<Role, "id">) => {
    if (!editingRole) return;
    try {
      setError(null);
      const payload = { ...updatedRole, id: editingRole.id } as Role;
      const savedRole = await rolesApi.save(payload);
      setRoles(
        roles.map((role) => (role.id === editingRole.id ? savedRole : role))
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
    <div className="space-y-6 text-gray-900 dark:text-gray-100">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 dark:bg-red-900/20 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
          <button onClick={loadRoles} className="ml-3 underline font-semibold">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Existing Roles (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-gray-800">
            <div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                Existing Roles
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Manage your tenant's custom system access roles
              </p>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
            </div>
          ) : (
            <RoleList
              roles={roles}
              onDeleteRole={handleDeleteRole}
              onEditRole={(role) => {
                setEditingRole(role);
                // Scroll smoothly to top on small screens
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}
        </div>

        {/* Right Column: Create/Edit Role Form (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative">
            {editingRole && (
              <button 
                onClick={() => setEditingRole(null)} 
                className="absolute top-6 right-6 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-305 hover:underline z-10 font-bold"
              >
                Cancel Edit
              </button>
            )}
            <RoleForm
              key={editingRole ? `edit-${editingRole.id}` : "create"}
              initialData={editingRole || undefined}
              forms={forms}
              onSubmit={editingRole ? handleUpdateRole : handleAddRole}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
