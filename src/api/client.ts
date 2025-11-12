// const API_BASE_URL = "http://localhost:5000/api";
/const API_BASE_URL = "https://formsapi.focusengineeringapp.com/api";
// https://forms-backend-96nd.onrender.com
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
}

class ApiError extends Error {
  constructor(public status: number, public response: any, message?: string) {
    super(message || "API Error");
    this.name = "ApiError";
  }
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem("auth_token");
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem("auth_token", token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem("auth_token");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      const data: ApiResponse<T> = await response.json();

      if (!response.ok) {
        // Enhanced error message for validation errors
        let errorMessage = data.message || "Request failed";
        if (data.errors && Array.isArray(data.errors)) {
          const errorDetails = data.errors
            .map((err: any) =>
              typeof err === "string" ? err : `${err.field}: ${err.message}`
            )
            .join(", ");
          errorMessage = `${errorMessage}: ${errorDetails}`;
        }
        throw new ApiError(response.status, data, errorMessage);
      }

      if (!data.success) {
        let errorMessage = data.message || "Request failed";
        if (data.errors && Array.isArray(data.errors)) {
          const errorDetails = data.errors
            .map((err: any) =>
              typeof err === "string" ? err : `${err.field}: ${err.message}`
            )
            .join(", ");
          errorMessage = `${errorMessage}: ${errorDetails}`;
        }
        throw new ApiError(response.status, data, errorMessage);
      }

      return data.data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, null, "Network error or server unavailable");
    }
  }

  // Authentication
  async login(credentials: {
    email: string;
    password: string;
    tenantSlug?: string;
  }) {
    const data = await this.request<{ user: any; token: string; tenant?: any }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(credentials),
      }
    );

    this.setToken(data.token);
    return data;
  }

  async logout() {
    this.clearToken();
  }

  async getProfile() {
    return this.request<{ user: any }>("/auth/profile");
  }

  async changePassword(passwords: {
    currentPassword: string;
    newPassword: string;
  }) {
    return this.request("/auth/change-password", {
      method: "PUT",
      body: JSON.stringify(passwords),
    });
  }

  // Users
  async getUsers(params?: {
    role?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();

    if (params?.role) {
      query.set("role", params.role);
    }

    if (params?.search) {
      query.set("search", params.search);
    }

    if (typeof params?.page === "number") {
      query.set("page", params.page.toString());
    }

    if (typeof params?.limit === "number") {
      query.set("limit", params.limit.toString());
    }

    const endpoint = `/users${query.toString() ? `?${query.toString()}` : ""}`;

    return this.request<{ users: any[]; pagination: any }>(endpoint);
  }

  async createUser(userData: any) {
    return this.request<{ user: any }>("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id: string, userData: any) {
    return this.request<{ user: any }>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: string) {
    return this.request(`/users/${id}`, {
      method: "DELETE",
    });
  }

  async resetUserPassword(id: string, newPassword: string) {
    return this.request(`/users/${id}/reset-password`, {
      method: "PUT",
      body: JSON.stringify({ newPassword }),
    });
  }

  // Forms
  async getForms() {
    return this.request<{ forms: any[] }>("/forms");
  }

  async getPublicForms(tenantSlug?: string) {
    const endpoint = tenantSlug
      ? `/forms/public/${tenantSlug}`
      : "/forms/public";
    return this.request<{ forms: any[] }>(endpoint);
  }

  async getForm(id: string) {
    return this.request<{ form: any }>(`/forms/${id}`);
  }

  async getFormById(id: string) {
    return this.request<{ form: any }>(`/forms/${id}`);
  }

  async getPublicForm(id: string, tenantSlug?: string) {
    const endpoint = tenantSlug
      ? `/forms/${id}/public/${tenantSlug}`
      : `/forms/${id}/public`;
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url);
    const data: ApiResponse<{ form: any }> = await response.json();

    if (!response.ok) {
      throw new ApiError(response.status, data, data.message);
    }

    if (!data.success) {
      throw new ApiError(response.status, data, data.message);
    }

    return data.data;
  }

  async createForm(formData: any) {
    return this.request<{ form: any }>("/forms", {
      method: "POST",
      body: JSON.stringify(formData),
    });
  }

  async updateForm(id: string, formData: any) {
    return this.request<{ form: any }>(`/forms/${id}`, {
      method: "PUT",
      body: JSON.stringify(formData),
    });
  }

  async deleteForm(id: string) {
    return this.request(`/forms/${id}`, {
      method: "DELETE",
    });
  }

  async updateFormVisibility(id: string, isVisible: boolean) {
    return this.request(`/forms/${id}/visibility`, {
      method: "PATCH",
      body: JSON.stringify({ isVisible }),
    });
  }

  async updateFormActiveStatus(id: string, isActive: boolean) {
    return this.request(`/forms/${id}/active`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    });
  }

  async duplicateForm(id: string) {
    return this.request<{ form: any }>(`/forms/${id}/duplicate`, {
      method: "POST",
    });
  }

  // Child Form Management (Parent-Child Relationships)
  async linkChildForm(parentFormId: string, childFormId: string) {
    return this.request<{ parentForm: any; childForm: any }>(
      `/forms/${parentFormId}/child-forms`,
      {
        method: "POST",
        body: JSON.stringify({ childFormId }),
      }
    );
  }

  async unlinkChildForm(parentFormId: string, childFormId: string) {
    return this.request(`/forms/${parentFormId}/child-forms/${childFormId}`, {
      method: "DELETE",
    });
  }

  async getChildForms(parentFormId: string) {
    return this.request<{
      parentFormId: string;
      parentFormTitle: string;
      childForms: any[];
    }>(`/forms/${parentFormId}/child-forms`);
  }

  async reorderChildForms(parentFormId: string, childFormOrder: string[]) {
    return this.request(`/forms/${parentFormId}/child-forms/reorder`, {
      method: "PUT",
      body: JSON.stringify({ childFormOrder }),
    });
  }

  // Responses
  async getResponses() {
    return this.request<{ responses: any[]; pagination?: any }>(
      "/responses?limit=1000"
    );
  }

  async getFormResponses(formId: string) {
    return this.request<{ responses: any[] }>(`/responses/form/${formId}`);
  }

  async getResponse(id: string) {
    return this.request<{ response: any }>(`/responses/${id}`);
  }

  async createResponse(responseData: any) {
    return this.request<{ response: any }>("/responses", {
      method: "POST",
      body: JSON.stringify(responseData),
    });
  }

  async submitResponse(formId: string, responseData: any) {
    return this.request<{ response: any }>(`/responses/${formId}`, {
      method: "POST",
      body: JSON.stringify(responseData),
    });
  }

  async updateResponse(id: string, responseData: any) {
    return this.request<{ response: any }>(`/responses/${id}`, {
      method: "PUT",
      body: JSON.stringify(responseData),
    });
  }

  async deleteResponse(id: string) {
    return this.request(`/responses/${id}`, {
      method: "DELETE",
    });
  }

  async assignResponse(id: string, assignedTo: string) {
    return this.request(`/responses/${id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo }),
    });
  }

  async exportFormResponses(formId: string, format: "excel" | "csv" = "excel") {
    const response = await fetch(
      `${this.baseUrl}/responses/form/${formId}/export?format=${format}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    if (!response.ok) {
      throw new ApiError(response.status, null, "Export failed");
    }

    return response.blob();
  }

  // Analytics
  async getDashboardAnalytics() {
    return this.request<any>("/analytics/dashboard");
  }

  async getFormAnalytics(formId: string) {
    return this.request<any>(`/analytics/form/${formId}`);
  }

  async getUserAnalytics() {
    return this.request<any>("/analytics/users");
  }

  // Roles
  async getRoles() {
    return this.request<{ roles: any[] }>("/roles");
  }

  async createRole(roleData: any) {
    return this.request<{ role: any }>("/roles", {
      method: "POST",
      body: JSON.stringify(roleData),
    });
  }

  async updateRole(id: string, roleData: any) {
    return this.request<{ role: any }>(`/roles/${id}`, {
      method: "PUT",
      body: JSON.stringify(roleData),
    });
  }

  async deleteRole(id: string) {
    return this.request(`/roles/${id}`, {
      method: "DELETE",
    });
  }

  async getAvailablePermissions() {
    return this.request<{ permissions: string[] }>("/roles/permissions");
  }

  async assignRole(userId: string, roleId: string) {
    return this.request("/roles/assign", {
      method: "POST",
      body: JSON.stringify({ userId, roleId }),
    });
  }

  async getUsersByRole(roleId: string) {
    return this.request<{ users: any[]; role: any; pagination: any }>(
      `/roles/${roleId}/users`
    );
  }

  // Files
  async uploadFile(file: File, category: string = "general") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("token", this.token);

    const response = await fetch(`${this.baseUrl}/files/upload`, {
      method: "POST",
      body: formData,
    });

    const data: ApiResponse<any> = await response.json();

    if (!response.ok || !data.success) {
      throw new ApiError(response.status, data, data.message);
    }

    return data.data;
  }

  resolveUploadedFileUrl(uploadResult: any) {
    if (!uploadResult) {
      return "";
    }

    if (typeof uploadResult === "string") {
      return uploadResult;
    }

    if (uploadResult.url) {
      return uploadResult.url;
    }

    if (uploadResult.secureUrl) {
      return uploadResult.secureUrl;
    }

    if (uploadResult.location) {
      return uploadResult.location;
    }

    if (uploadResult.path) {
      return this.getFileUrl(uploadResult.path);
    }

    if (uploadResult.filename) {
      return this.getFileUrl(uploadResult.filename);
    }

    if (uploadResult.file?.url) {
      return uploadResult.file.url;
    }

    if (uploadResult.file?.filename) {
      return this.getFileUrl(uploadResult.file.filename);
    }

    if (uploadResult.key) {
      return this.getFileUrl(uploadResult.key);
    }

    return "";
  }

  async getUserFiles() {
    return this.request<{ files: any[] }>("/files");
  }

  async deleteFile(id: string) {
    return this.request(`/files/${id}`, {
      method: "DELETE",
    });
  }

  getFileUrl(filename: string) {
    return `${this.baseUrl}/files/${filename}`;
  }

  // Profile
  async getUserProfile() {
    return this.request<{ profile: any }>("/profile");
  }

  async updateUserProfile(profileData: any) {
    return this.request<{ profile: any }>("/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    });
  }

  async updateProfileSettings(settings: any) {
    return this.request<{ profile: any }>("/profile/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
  }

  async uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append("avatar", file);

    const response = await fetch(`${this.baseUrl}/profile/avatar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    });

    const data: ApiResponse<any> = await response.json();

    if (!response.ok || !data.success) {
      throw new ApiError(response.status, data, data.message);
    }

    return data.data;
  }

  // Tenants (SuperAdmin only)
  async getTenants(search: string = "", status: string = "all") {
    return this.request<{ tenants: any[]; total: number }>(
      `/tenants?search=${search}&status=${status}`
    );
  }

  async createTenant(tenantData: any) {
    return this.request<{ tenant: any; admin: any }>("/tenants", {
      method: "POST",
      body: JSON.stringify(tenantData),
    });
  }

  async updateTenant(tenantId: string, tenantData: any) {
    return this.request<{ tenant: any; admin?: any }>(`/tenants/${tenantId}`, {
      method: "PUT",
      body: JSON.stringify(tenantData),
    });
  }

  async deleteTenant(tenantId: string) {
    return this.request(`/tenants/${tenantId}`, {
      method: "DELETE",
    });
  }

  async getTenantStats(tenantId: string) {
    return this.request<{ stats: any }>(`/tenants/${tenantId}/stats`);
  }

  async toggleTenantStatus(tenantId: string) {
    return this.request<{ tenant: any }>(`/tenants/${tenantId}/toggle-status`, {
      method: "PATCH",
    });
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();
export { ApiError };
export type { ApiResponse };
