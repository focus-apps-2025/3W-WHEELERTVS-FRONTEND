import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiClient, ApiError, type ApiResponse } from "./client";

describe("ApiClient", () => {
  let client: ApiClient;
  let fetchMock: any;

  beforeEach(() => {
    client = new ApiClient("http://test-api.com/api");
    localStorage.clear();
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with default API_BASE_URL if none provided", () => {
      const defaultClient = new ApiClient();
      expect(defaultClient).toBeDefined();
    });

    it("should initialize with custom baseUrl", () => {
      const customClient = new ApiClient("http://custom.com/api");
      expect(customClient).toBeDefined();
    });

    it("should load token from localStorage on initialization", () => {
      localStorage.setItem("auth_token", "existing-token");
      const newClient = new ApiClient("http://test-api.com/api");
      expect(newClient).toBeDefined();
    });
  });

  describe("token management", () => {
    it("should set token and save to localStorage", () => {
      client.setToken("test-token");
      expect(localStorage.getItem("auth_token")).toBe("test-token");
    });

    it("should clear token and remove from localStorage", () => {
      client.setToken("test-token");
      client.clearToken();
      expect(localStorage.getItem("auth_token")).toBeNull();
    });

    it("should clear token correctly when not previously set", () => {
      client.clearToken();
      expect(localStorage.getItem("auth_token")).toBeNull();
    });
  });

  describe("authentication methods", () => {
    it("should login with email and password", async () => {
      const mockResponse = {
        success: true,
        data: {
          user: { id: "1", email: "test@test.com" },
          token: "new-token",
          tenant: { id: "tenant-1" },
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.login({
        email: "test@test.com",
        password: "password123",
      });

      expect(result.token).toBe("new-token");
      expect(localStorage.getItem("auth_token")).toBe("new-token");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/auth/login",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should login with tenantSlug parameter", async () => {
      const mockResponse = {
        success: true,
        data: { user: { id: "1" }, token: "token", tenant: { slug: "test" } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.login({
        email: "test@test.com",
        password: "pass",
        tenantSlug: "my-tenant",
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/auth/login",
        expect.objectContaining({
          body: expect.stringContaining("tenantSlug"),
        })
      );
    });

    it("should handle login failure with API error", async () => {
      const mockResponse = {
        success: false,
        message: "Invalid credentials",
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => mockResponse,
      });

      await expect(
        client.login({ email: "test@test.com", password: "wrong" })
      ).rejects.toThrow(ApiError);
    });

    it("should logout and clear token", async () => {
      client.setToken("token");
      await client.logout();
      expect(localStorage.getItem("auth_token")).toBeNull();
    });

    it("should get user profile", async () => {
      client.setToken("test-token");
      const mockResponse = {
        success: true,
        data: { user: { id: "1", email: "test@test.com" } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getProfile();
      expect(result.user).toBeDefined();
    });

    it("should include authorization header when token is set", async () => {
      client.setToken("test-token");
      const mockResponse = { success: true, data: { user: { id: "1" } } };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.getProfile();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should change password", async () => {
      client.setToken("test-token");
      const mockResponse = {
        success: true,
        data: {},
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.changePassword({
        currentPassword: "old",
        newPassword: "new",
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/auth/change-password",
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining("currentPassword"),
        })
      );
    });
  });

  describe("user operations", () => {
    beforeEach(() => {
      client.setToken("test-token");
    });

    it("should fetch users without parameters", async () => {
      const mockResponse = {
        success: true,
        data: {
          users: [{ id: "1", email: "user@test.com" }],
          pagination: { total: 1 },
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getUsers();
      expect(result.users).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/users",
        expect.any(Object)
      );
    });

    it("should fetch users with role filter", async () => {
      const mockResponse = {
        success: true,
        data: { users: [], pagination: { total: 0 } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.getUsers({ role: "teacher" });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("role=teacher"),
        expect.any(Object)
      );
    });

    it("should fetch users with search parameter", async () => {
      const mockResponse = {
        success: true,
        data: { users: [], pagination: { total: 0 } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.getUsers({ search: "john" });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("search=john"),
        expect.any(Object)
      );
    });

    it("should fetch users with pagination parameters", async () => {
      const mockResponse = {
        success: true,
        data: { users: [], pagination: { total: 0 } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.getUsers({ page: 2, limit: 10 });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("page=2"),
        expect.any(Object)
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("limit=10"),
        expect.any(Object)
      );
    });

    it("should create user", async () => {
      const userData = { email: "new@test.com", role: "teacher" };
      const mockResponse = {
        success: true,
        data: { user: { id: "2", ...userData } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      const result = await client.createUser(userData);
      expect(result.user.email).toBe("new@test.com");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/users",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("new@test.com"),
        })
      );
    });

    it("should update user", async () => {
      const userData = { email: "updated@test.com" };
      const mockResponse = {
        success: true,
        data: { user: { id: "1", ...userData } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.updateUser("1", userData);
      expect(result.user.email).toBe("updated@test.com");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/users/1",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });

    it("should delete user", async () => {
      const mockResponse = { success: true, data: {} };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.deleteUser("1");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/users/1",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });
  });

  describe("file URL resolution", () => {
    it("should return empty string for empty value", () => {
      const result = client.ensureAbsoluteFileUrl("");
      expect(result).toBe("");
    });

    it("should return absolute HTTP URL unchanged", () => {
      const url = "http://example.com/file.jpg";
      const result = client.ensureAbsoluteFileUrl(url);
      expect(result).toBe(url);
    });

    it("should return absolute HTTPS URL unchanged", () => {
      const url = "https://example.com/file.jpg";
      const result = client.ensureAbsoluteFileUrl(url);
      expect(result).toBe(url);
    });

    it("should return data URL unchanged", () => {
      const url = "data:image/jpeg;base64,abc123";
      const result = client.ensureAbsoluteFileUrl(url);
      expect(result).toBe(url);
    });

    it("should convert relative path to absolute", () => {
      const result = client.ensureAbsoluteFileUrl("uploads/file.jpg");
      expect(result).toContain("test-api.com/uploads/file.jpg");
    });

    it("should handle path starting with slash", () => {
      const result = client.ensureAbsoluteFileUrl("/uploads/file.jpg");
      expect(result).toContain("test-api.com/uploads/file.jpg");
    });

    it("should handle invalid base URL gracefully", () => {
      const clientWithBadUrl = new ApiClient("not-a-valid-url");
      const result = clientWithBadUrl.ensureAbsoluteFileUrl("file.jpg");
      expect(result).toBe("/file.jpg");
    });
  });

  describe("resolveUploadedFileUrl", () => {
    it("should return empty string for null uploadResult", () => {
      const result = client.resolveUploadedFileUrl(null);
      expect(result).toBe("");
    });

    it("should return empty string for undefined uploadResult", () => {
      const result = client.resolveUploadedFileUrl(undefined);
      expect(result).toBe("");
    });

    it("should handle string uploadResult", () => {
      const result = client.resolveUploadedFileUrl("http://example.com/file.jpg");
      expect(result).toBe("http://example.com/file.jpg");
    });

    it("should extract url from uploadResult object", () => {
      const result = client.resolveUploadedFileUrl({
        url: "http://example.com/file.jpg",
      });
      expect(result).toBe("http://example.com/file.jpg");
    });

    it("should extract secureUrl from uploadResult object", () => {
      const result = client.resolveUploadedFileUrl({
        secureUrl: "https://secure.example.com/file.jpg",
      });
      expect(result).toBe("https://secure.example.com/file.jpg");
    });

    it("should extract location from uploadResult object", () => {
      const result = client.resolveUploadedFileUrl({
        location: "s3://bucket/file.jpg",
      });
      expect(result).toBe("s3://bucket/file.jpg");
    });

    it("should extract path from uploadResult object", () => {
      const result = client.resolveUploadedFileUrl({
        path: "file.jpg",
      });
      expect(result).toContain("test-api.com/files/file.jpg");
    });

    it("should extract filename from uploadResult object", () => {
      const result = client.resolveUploadedFileUrl({
        filename: "photo.jpg",
      });
      expect(result).toContain("test-api.com/files/photo.jpg");
    });

    it("should extract file.url from nested file object", () => {
      const result = client.resolveUploadedFileUrl({
        file: { url: "http://example.com/file.jpg" },
      });
      expect(result).toBe("http://example.com/file.jpg");
    });

    it("should extract file.filename from nested file object", () => {
      const result = client.resolveUploadedFileUrl({
        file: { filename: "document.pdf" },
      });
      expect(result).toContain("test-api.com/files/document.pdf");
    });

    it("should extract key from uploadResult object", () => {
      const result = client.resolveUploadedFileUrl({
        key: "uploads/key-file.jpg",
      });
      expect(result).toContain("test-api.com/files/uploads/key-file.jpg");
    });

    it("should return empty string when no recognizable property exists", () => {
      const result = client.resolveUploadedFileUrl({
        someOtherProp: "value",
      });
      expect(result).toBe("");
    });

    it("should prioritize url over other properties", () => {
      const result = client.resolveUploadedFileUrl({
        url: "http://priority.com/file.jpg",
        secureUrl: "https://secondary.com/file.jpg",
      });
      expect(result).toBe("http://priority.com/file.jpg");
    });
  });

  describe("file operations", () => {
    beforeEach(() => {
      client.setToken("test-token");
    });

    it("should get user files", async () => {
      const mockResponse = {
        success: true,
        data: { files: [{ id: "1", name: "file1.jpg" }] },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getUserFiles();
      expect(result.files).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/files",
        expect.any(Object)
      );
    });

    it("should delete file", async () => {
      const mockResponse = { success: true, data: {} };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.deleteFile("file-1");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/files/file-1",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("should get file URL", () => {
      const url = client.getFileUrl("file.jpg");
      expect(url).toBe("http://test-api.com/api/files/file.jpg");
    });

    it("should upload avatar", async () => {
      const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
      const mockResponse = {
        success: true,
        data: { avatarUrl: "http://example.com/avatar.jpg" },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.uploadAvatar(file);
      expect(result.avatarUrl).toBeDefined();
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/profile/avatar",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should throw error when avatar upload fails", async () => {
      const file = new File(["content"], "avatar.jpg", { type: "image/jpeg" });
      const mockResponse = {
        success: false,
        message: "Upload failed",
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => mockResponse,
      });

      await expect(client.uploadAvatar(file)).rejects.toThrow(ApiError);
    });
  });

  describe("profile operations", () => {
    beforeEach(() => {
      client.setToken("test-token");
    });

    it("should get user profile", async () => {
      const mockResponse = {
        success: true,
        data: { profile: { id: "1", name: "John" } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getUserProfile();
      expect(result.profile.name).toBe("John");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/profile",
        expect.any(Object)
      );
    });

    it("should update user profile", async () => {
      const profileData = { name: "Jane" };
      const mockResponse = {
        success: true,
        data: { profile: { id: "1", ...profileData } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.updateUserProfile(profileData);
      expect(result.profile.name).toBe("Jane");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/profile",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });

    it("should update profile settings", async () => {
      const settings = { notifications: true };
      const mockResponse = {
        success: true,
        data: { profile: { settings } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.updateProfileSettings(settings);
      expect(result.profile.settings.notifications).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/profile/settings",
        expect.objectContaining({
          method: "PATCH",
        })
      );
    });
  });

  describe("tenant operations", () => {
    beforeEach(() => {
      client.setToken("test-token");
    });

    it("should get tenants without parameters", async () => {
      const mockResponse = {
        success: true,
        data: {
          tenants: [{ id: "1", name: "Tenant 1" }],
          total: 1,
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getTenants();
      expect(result.tenants).toHaveLength(1);
    });

    it("should get tenants with search parameter", async () => {
      const mockResponse = {
        success: true,
        data: { tenants: [], total: 0 },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.getTenants("search-term", "active");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("search=search-term"),
        expect.any(Object)
      );
    });

    it("should get tenants with status parameter", async () => {
      const mockResponse = {
        success: true,
        data: { tenants: [], total: 0 },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.getTenants("", "inactive");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("status=inactive"),
        expect.any(Object)
      );
    });

    it("should create tenant", async () => {
      const tenantData = { name: "New Tenant" };
      const mockResponse = {
        success: true,
        data: {
          tenant: { id: "2", ...tenantData },
          admin: { id: "admin-1" },
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      const result = await client.createTenant(tenantData);
      expect(result.tenant.name).toBe("New Tenant");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/tenants",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should update tenant", async () => {
      const tenantData = { name: "Updated Tenant" };
      const mockResponse = {
        success: true,
        data: { tenant: { id: "1", ...tenantData } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.updateTenant("1", tenantData);
      expect(result.tenant.name).toBe("Updated Tenant");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/tenants/1",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });

    it("should delete tenant", async () => {
      const mockResponse = { success: true, data: {} };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.deleteTenant("1");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/tenants/1",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });

    it("should get tenant stats", async () => {
      const mockResponse = {
        success: true,
        data: { stats: { users: 10, forms: 5 } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getTenantStats("1");
      expect(result.stats.users).toBe(10);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/tenants/1/stats",
        expect.any(Object)
      );
    });

    it("should toggle tenant status", async () => {
      const mockResponse = {
        success: true,
        data: { tenant: { id: "1", status: "inactive" } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.toggleTenantStatus("1");
      expect(result.tenant.status).toBe("inactive");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/tenants/1/toggle-status",
        expect.objectContaining({
          method: "PATCH",
        })
      );
    });
  });

  describe("parameter operations", () => {
    beforeEach(() => {
      client.setToken("test-token");
    });

    it("should get parameters without filters", async () => {
      const mockResponse = {
        success: true,
        data: { parameters: [{ id: "1", name: "param1" }] },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getParameters();
      expect(result.parameters).toHaveLength(1);
    });

    it("should get parameters with type filter", async () => {
      const mockResponse = {
        success: true,
        data: { parameters: [] },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.getParameters({ type: "main" });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("type=main"),
        expect.any(Object)
      );
    });

    it("should get parameters with search filter", async () => {
      const mockResponse = {
        success: true,
        data: { parameters: [] },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.getParameters({ search: "test" });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("search=test"),
        expect.any(Object)
      );
    });

    it("should get parameters with formId filter", async () => {
      const mockResponse = {
        success: true,
        data: { parameters: [] },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.getParameters({ formId: "form-1" });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("formId=form-1"),
        expect.any(Object)
      );
    });

    it("should create parameter", async () => {
      const paramData = {
        name: "New Param",
        type: "main" as const,
        formId: "form-1",
      };
      const mockResponse = {
        success: true,
        data: { parameter: { id: "1", ...paramData } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      const result = await client.createParameter(paramData);
      expect(result.parameter.name).toBe("New Param");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/parameters",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should update parameter", async () => {
      const paramData = {
        name: "Updated Param",
        type: "followup" as const,
        formId: "form-1",
      };
      const mockResponse = {
        success: true,
        data: { parameter: { id: "1", ...paramData } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.updateParameter("1", paramData);
      expect(result.parameter.name).toBe("Updated Param");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/parameters/1",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });

    it("should delete parameter", async () => {
      const mockResponse = { success: true, data: {} };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.deleteParameter("1");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/parameters/1",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      client.setToken("test-token");
    });

    it("should throw ApiError on non-ok response", async () => {
      const mockResponse = {
        success: false,
        message: "Not found",
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => mockResponse,
      });

      await expect(client.getUsers()).rejects.toThrow(ApiError);
    });

    it("should throw ApiError on success false", async () => {
      const mockResponse = {
        success: false,
        message: "Validation error",
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await expect(client.getUsers()).rejects.toThrow(ApiError);
    });

    it("should include validation errors in ApiError message", async () => {
      const mockResponse = {
        success: false,
        message: "Validation failed",
        errors: [
          { field: "email", message: "Invalid email" },
          { field: "password", message: "Too short" },
        ],
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => mockResponse,
      });

      try {
        await client.createUser({});
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toContain("email");
        expect((error as ApiError).message).toContain("password");
      }
    });

    it("should handle string errors in error array", async () => {
      const mockResponse = {
        success: false,
        message: "Error occurred",
        errors: ["Error 1", "Error 2"],
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => mockResponse,
      });

      try {
        await client.getUsers();
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toContain("Error 1");
      }
    });

    it("should throw ApiError with generic message on network error", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      await expect(client.getUsers()).rejects.toThrow(ApiError);
    });

    it("ApiError should have correct status and response properties", async () => {
      const mockResponse = {
        success: false,
        message: "Unauthorized",
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => mockResponse,
      });

      try {
        await client.getUsers();
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.status).toBe(401);
        expect(apiError.response.message).toBe("Unauthorized");
      }
    });
  });

  describe("forms operations", () => {
    beforeEach(() => {
      client.setToken("test-token");
    });

    it("should get forms", async () => {
      const mockResponse = {
        success: true,
        data: { forms: [{ id: "1", title: "Form 1" }] },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getForms();
      expect(result.forms).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/forms",
        expect.any(Object)
      );
    });

    it("should get form by id", async () => {
      const mockResponse = {
        success: true,
        data: { form: { id: "1", title: "Form 1" } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getFormById("1");
      expect(result.form.title).toBe("Form 1");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/forms/1",
        expect.any(Object)
      );
    });

    it("should create form", async () => {
      const formData = { title: "New Form" };
      const mockResponse = {
        success: true,
        data: { form: { id: "2", ...formData } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      const result = await client.createForm(formData);
      expect(result.form.title).toBe("New Form");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/forms",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should update form", async () => {
      const formData = { title: "Updated Form" };
      const mockResponse = {
        success: true,
        data: { form: { id: "1", ...formData } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.updateForm("1", formData);
      expect(result.form.title).toBe("Updated Form");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/forms/1",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });

    it("should delete form", async () => {
      const mockResponse = { success: true, data: {} };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.deleteForm("1");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/forms/1",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });
  });

  describe("responses operations", () => {
    beforeEach(() => {
      client.setToken("test-token");
    });

    it("should get responses", async () => {
      const mockResponse = {
        success: true,
        data: { responses: [{ id: "1", formId: "form-1" }] },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getResponses();
      expect(result.responses).toHaveLength(1);
    });

    it("should get responses with filters", async () => {
      const mockResponse = {
        success: true,
        data: { responses: [] },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.getResponses({
        formId: "form-1",
        page: 1,
        limit: 10,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("formId=form-1"),
        expect.any(Object)
      );
    });

    it("should get response by id", async () => {
      const mockResponse = {
        success: true,
        data: { response: { id: "1", data: {} } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getResponseById("1");
      expect(result.response.id).toBe("1");
    });

    it("should create response", async () => {
      const responseData = { formId: "form-1", data: {} };
      const mockResponse = {
        success: true,
        data: { response: { id: "1", ...responseData } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      const result = await client.createResponse(responseData);
      expect(result.response.formId).toBe("form-1");
    });

    it("should update response", async () => {
      const responseData = { status: "submitted" };
      const mockResponse = {
        success: true,
        data: { response: { id: "1", ...responseData } },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.updateResponse("1", responseData);
      expect(result.response.status).toBe("submitted");
    });

    it("should delete response", async () => {
      const mockResponse = { success: true, data: {} };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.deleteResponse("1");
      expect(fetchMock).toHaveBeenCalledWith(
        "http://test-api.com/api/responses/1",
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });
  });

  describe("request headers", () => {
    it("should always include Content-Type header", async () => {
      const mockResponse = { success: true, data: {} };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.getForms();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should merge custom headers with default headers", async () => {
      const mockResponse = { success: true, data: {} };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.getForms();

      const callArgs = fetchMock.mock.calls[0][1];
      expect(callArgs.headers).toHaveProperty("Content-Type");
      expect(callArgs.headers).toHaveProperty("Authorization");
    });
  });

  describe("API response handling", () => {
    it("should extract data from success response", async () => {
      client.setToken("test-token");
      const mockResponse = {
        success: true,
        data: { users: [{ id: "1" }] },
        message: "Success",
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getUsers();
      expect(result.users).toBeDefined();
      expect(result.users[0].id).toBe("1");
    });

    it("should handle response without message", async () => {
      client.setToken("test-token");
      const mockResponse = {
        success: true,
        data: { users: [] },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getUsers();
      expect(result.users).toBeDefined();
    });

    it("should handle response with empty errors array", async () => {
      client.setToken("test-token");
      const mockResponse = {
        success: true,
        data: {},
        errors: [],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getForms();
      expect(result).toBeDefined();
    });
  });
});
