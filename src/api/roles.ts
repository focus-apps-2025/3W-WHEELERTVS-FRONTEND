import type { Role } from "../types";
import { apiClient } from "./client";

export const rolesApi = {
  getAll: async (): Promise<Role[]> => {
    try {
      const data = await apiClient.getRoles();
      return data.roles || [];
    } catch (error) {
      console.error("Failed to fetch roles:", error);
      return [];
    }
  },

  getById: async (id: string): Promise<Role | undefined> => {
    try {
      const roles = await rolesApi.getAll();
      return roles.find((r) => r.id === id);
    } catch (error) {
      console.error("Failed to fetch role by id:", error);
      return undefined;
    }
  },

  save: async (role: Role): Promise<Role> => {
    try {
      if (role.id) {
        // Update existing role
        const data = await apiClient.updateRole(role.id, role);
        return data.role;
      } else {
        // Create new role
        const data = await apiClient.createRole(role);
        return data.role;
      }
    } catch (error) {
      console.error("Failed to save role:", error);
      throw error;
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      await apiClient.deleteRole(id);
    } catch (error) {
      console.error("Failed to delete role:", error);
      throw error;
    }
  },

  deleteMany: async (ids: string[]): Promise<void> => {
    try {
      // Delete roles one by one since backend doesn't support bulk delete
      await Promise.all(ids.map((id) => apiClient.deleteRole(id)));
    } catch (error) {
      console.error("Failed to delete roles:", error);
      throw error;
    }
  },

  getAvailablePermissions: async () => {
    try {
      const data = await apiClient.getAvailablePermissions();
      return data.permissions;
    } catch (error) {
      console.error("Failed to fetch available permissions:", error);
      return [];
    }
  },

  assignRole: async (userId: string, roleId: string) => {
    try {
      await apiClient.assignRole(userId, roleId);
    } catch (error) {
      console.error("Failed to assign role:", error);
      throw error;
    }
  },

  getUsersByRole: async (roleId: string) => {
    try {
      const data = await apiClient.getUsersByRole(roleId);
      return data;
    } catch (error) {
      console.error("Failed to get users by role:", error);
      throw error;
    }
  },
};
