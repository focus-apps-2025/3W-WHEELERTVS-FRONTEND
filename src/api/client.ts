// Automatically detect environment and set API base URL
const API_BASE_URL = (() => {
  const hostname = window.location.hostname;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.");

  const baseUrl = isLocal
    ? "http://localhost:5000/api"
    : "https://formsapi.focusengineeringapp.com/api";

  console.log(
    `🔗 API Base URL: ${baseUrl} (Environment: ${
      isLocal ? "Local" : "Production"
    })`
  );
  return baseUrl;
})();
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
}
0.0;

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

  private ensureAbsoluteFileUrl(value: string) {
    if (!value) {
      return "";
    }
    if (
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("data:")
    ) {
      return value;
    }
    const normalized = value.startsWith("/") ? value : `/${value}`;
    try {
      const url = new URL(this.baseUrl);
      return `${url.origin}${normalized}`;
    } catch {
      return normalized;
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
  async getForms(params?: { isGlobal?: boolean; search?: string }) {
    const query = new URLSearchParams();
    if (params?.isGlobal !== undefined) {
      query.set("isGlobal", params.isGlobal.toString());
    }
    if (params?.search) {
      query.set("search", params.search);
    }
    const endpoint = `/forms${query.toString() ? `?${query.toString()}` : ""}`;
    return this.request<{ forms: any[] }>(endpoint);
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

  async updateFormLocationEnabled(id: string, locationEnabled: boolean) {
    return this.request(`/forms/${id}/location`, {
      method: "PATCH",
      body: JSON.stringify({ locationEnabled }),
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

  async getFormResponses(formId: string, options?: { analytics?: boolean }) {
    const query = options?.analytics ? "?analytics=true" : "";
    return this.request<{ responses: any[] }>(
      `/responses/form/${formId}${query}`
    );
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

  async batchImportResponses(batchData: any) {
    return this.request<any>("/responses/batch/import", {
      method: "POST",
      body: JSON.stringify(batchData),
    });
  }

  async processImages(answers: any, submissionId?: string) {
    return this.request<any>("/responses/process-images", {
      method: "POST",
      body: JSON.stringify({ answers, submissionId }),
    });
  }

  async convertImageUrl(imageUrl: string) {
    return this.request<{ cloudinaryUrl: string }>("/responses/convert-image", {
      method: "POST",
      body: JSON.stringify({ imageUrl }),
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
    const headers: Record<string, string> = {};

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(
      `${this.baseUrl}/responses/form/${formId}/export?format=${format}`,
      {
        headers,
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

  async getGlobalFormStats(formId: string) {
    return this.request<{ stats: any[] }>(`/forms/${formId}/global-stats`);
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
  async uploadFile(
    file: File,
    category: string = "general",
    associatedId?: string,
    onProgress?: (progress: {
      percentage: number;
      loaded: number;
      total: number;
      timeRemaining?: number;
      speed?: number;
    }) => void
  ) {
    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new ApiError(
        400,
        null,
        `File size (${(file.size / 1024 / 1024).toFixed(
          2
        )}MB) exceeds maximum limit of 10MB`
      );
    }

    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "focus_forms_unsigned");
      formData.append("folder", `focus_forms/${category}`);

      if (associatedId) {
        formData.append("tags", `associatedId_${associatedId}`);
      }

      const xhr = new XMLHttpRequest();
      const startTime = Date.now();

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable && onProgress) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          const elapsed = Date.now() - startTime;
          const speed = event.loaded / (elapsed / 1000); // bytes per second
          const remaining = (event.total - event.loaded) / speed;
          const timeRemaining = isFinite(remaining)
            ? Math.round(remaining)
            : undefined;

          onProgress({
            percentage,
            loaded: event.loaded,
            total: event.total,
            timeRemaining,
            speed,
          });
        }
      });

      xhr.addEventListener("load", () => {
        try {
          const data = JSON.parse(xhr.responseText);

          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({
              url: data.secure_url,
              file: {
                url: data.secure_url,
                filename: data.public_id,
                originalName: file.name,
                size: file.size,
              },
            });
          } else {
            reject(
              new ApiError(
                xhr.status,
                data,
                data.error?.message || "Upload failed"
              )
            );
          }
        } catch (error) {
          reject(
            new ApiError(xhr.status, null, "Invalid response from server")
          );
        }
      });

      xhr.addEventListener("error", () => {
        reject(new ApiError(0, null, "Network error during upload"));
      });

      xhr.addEventListener("abort", () => {
        reject(new ApiError(0, null, "Upload was cancelled"));
      });

      xhr.open(
        "POST",
        "https://api.cloudinary.com/v1_1/dsfi2hwoq/image/upload"
      );
      xhr.send(formData);
    });
  }

  resolveUploadedFileUrl(uploadResult: any) {
    if (!uploadResult) {
      return "";
    }

    if (typeof uploadResult === "string") {
      return this.ensureAbsoluteFileUrl(uploadResult);
    }

    if (uploadResult.url) {
      return this.ensureAbsoluteFileUrl(uploadResult.url);
    }

    if (uploadResult.secureUrl) {
      return this.ensureAbsoluteFileUrl(uploadResult.secureUrl);
    }

    if (uploadResult.location) {
      return this.ensureAbsoluteFileUrl(uploadResult.location);
    }

    if (uploadResult.path) {
      return this.getFileUrl(uploadResult.path);
    }

    if (uploadResult.filename) {
      return this.getFileUrl(uploadResult.filename);
    }

    if (uploadResult.file?.url) {
      return this.ensureAbsoluteFileUrl(uploadResult.file.url);
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
    return this.request<{ profile: any; user?: any }>("/profile", {
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

    const headers: Record<string, string> = {};

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}/profile/avatar`, {
      method: "POST",
      headers,
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

  async getTenant(tenantId: string) {
    return this.request<{ tenant: any }>(`/tenants/${tenantId}`);
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

  async addAdminToTenant(
    tenantId: string,
    adminData: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    }
  ) {
    return this.request<{
      admin: {
        _id: string;
        firstName: string;
        lastName: string;
        email: string;
        role: string;
        isActive: boolean;
      };
    }>(`/tenants/${tenantId}/add-admin`, {
      method: "POST",
      body: JSON.stringify(adminData),
    });
  }

  async removeAdminFromTenant(tenantId: string, adminId: string) {
    return this.request(`/tenants/${tenantId}/remove-admin/${adminId}`, {
      method: "DELETE",
    });
  }

  // Parameters
  async getParameters(params?: {
    type?: "main" | "followup";
    search?: string;
    formId?: string;
  }) {
    const query = new URLSearchParams();

    if (params?.type) {
      query.set("type", params.type);
    }

    if (params?.search) {
      query.set("search", params.search);
    }

    if (params?.formId) {
      query.set("formId", params.formId);
    }

    const endpoint = `/parameters${
      query.toString() ? `?${query.toString()}` : ""
    }`;

    return this.request<{ parameters: any[] }>(endpoint);
  }

  async createParameter(parameterData: {
    name: string;
    type: "main" | "followup";
    formId: string;
    tenantId?: string;
  }) {
    return this.request<{ parameter: any }>("/parameters", {
      method: "POST",
      body: JSON.stringify(parameterData),
    });
  }

  async updateParameter(
    id: string,
    parameterData: {
      name: string;
      type: "main" | "followup";
      formId: string;
    }
  ) {
    return this.request<{ parameter: any }>(`/parameters/${id}`, {
      method: "PUT",
      body: JSON.stringify(parameterData),
    });
  }

  async deleteParameter(id: string) {
    return this.request(`/parameters/${id}`, {
      method: "DELETE",
    });
  }
  async processBulkImages(answers: any, batchId?: string) {
    return this.request<any>("/responses/process-bulk-images", {
      method: "POST",

      body: JSON.stringify({ answers, batchId }),
    });
  }

  async generatePDF(options: {
    htmlContent: string;
    filename?: string;
    format?: "custom" | "a4";
    compressed?: boolean;
  }): Promise<Blob> {
    const url = `${this.baseUrl}/pdf/generate`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const requestBody = {
      htmlContent: options.htmlContent,
      filename: options.filename || "report.pdf",
      format: options.format || "custom",
      compressed: false,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API Error Response:", errorData);
        throw new Error(
          errorData.details ||
            errorData.error ||
            `PDF generation failed: ${response.statusText}`
        );
      }

      return response.blob();
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw new Error(
          "PDF generation timed out (120s). The document may be too large. Try with fewer sections or images."
        );
      }
      throw error;
    }
  }

  // Form Invite Management
  async uploadInvites(formId: string, formData: FormData) {
    const url = `${this.baseUrl}/forms/${formId}/invites/upload`;

    const headers: Record<string, string> = {};

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    // Don't set Content-Type for FormData - browser will set it automatically with boundary

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    const data: ApiResponse<any> = await response.json();

    if (!response.ok || !data.success) {
      throw new ApiError(response.status, data, data.message);
    }

    return data;
  }

  async sendInvites(
    formId: string,
    data: { emails: Array<{ email: string; phone?: string }> }
  ) {
    const response = await this.request<any>(`/forms/${formId}/invites/send`, {
      method: "POST",
      body: JSON.stringify(data),
    });

    // Your backend returns {success: true, message: '...', data: {...}}
    // The this.request() method already extracts the 'data' field
    // So 'response' here IS the data object
    return {
      success: true, // Manually add this back
      message: "Invites processed successfully",
      data: response, // response contains {total, successful, failed, results, failures}
    };
  }

  async getInviteStats(formId: string) {
    return this.request<{
      form: any;
      invites: {
        total: number;
        sent: number;
        responded: number;
        expired: number;
        responseRate: number;
      };
      responses: {
        total: number;
        invited: number;
        public: number;
      };
    }>(`/forms/${formId}/invites/stats`);
  }

  async getFormInvites(
    formId: string,
    options?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      dateFilter?: string;
      startDate?: string;
      endDate?: string;
      sortBy?: string;
      sortOrder?: string;
    }
  ) {
    const query = new URLSearchParams();

    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          query.append(key, value.toString());
        }
      });
    }

    const endpoint = `/forms/${formId}/invites${
      query.toString() ? `?${query.toString()}` : ""
    }`;
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      headers,
    });

    const data: ApiResponse<any> = await response.json();

    if (!response.ok || !data.success) {
      throw new ApiError(
        response.status,
        data,
        data.message || "Failed to fetch invites"
      );
    }

    return data.data;
  }

  // WhatsApp Invite Management
  async uploadWhatsAppInvites(formId: string, formData: FormData) {
    const url = `${this.baseUrl}/forms/${formId}/invites/whatsapp/upload`;

    const headers: Record<string, string> = {};

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    const data: ApiResponse<any> = await response.json();

    if (!response.ok || !data.success) {
      throw new ApiError(response.status, data, data.message);
    }

    return data;
  }

  async sendWhatsAppInvites(
    formId: string,
    data: { phones: Array<{ phone: string; email?: string }> }
  ) {
    const response = await this.request<any>(`/forms/${formId}/invites/whatsapp/send`, {
      method: "POST",
      body: JSON.stringify(data),
    });

    return {
      success: true,
      message: "WhatsApp invites processed successfully",
      data: response,
    };
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();
export { ApiError };
export type { ApiResponse };
