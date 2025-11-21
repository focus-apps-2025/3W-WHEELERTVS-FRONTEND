import React, {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { Loader2, Image as ImageIcon, Upload, Trash2 } from "lucide-react";
import { apiClient, ApiError } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useLogo } from "../../context/LogoContext";
import { useNotification } from "../../context/NotificationContext";

const MODULE_OPTIONS = [
  { key: "dashboard:view", label: "Dashboard" },
  { key: "analytics:view", label: "Service Analytics" },
  { key: "requests:view", label: "Customer Requests" },
  { key: "requests:manage", label: "Request Management" },
] as const;

type ModuleKey = (typeof MODULE_OPTIONS)[number]["key"];

interface SubAdmin {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  permissions: string[];
  isActive: boolean;
}

interface CreateFormState {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
  permissions: Set<ModuleKey>;
}

const createInitialFormState = (): CreateFormState => ({
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  password: "",
  permissions: new Set<ModuleKey>(),
});

export default function AdminManagement() {
  const { user, tenant, updateTenant, loading: authLoading } = useAuth();
  const { logo, updateLogo } = useLogo();
  const { showSuccess, showError } = useNotification();
  const [admins, setAdmins] = useState<SubAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingProgress, setBrandingProgress] = useState<{
    percentage: number;
    loaded: number;
    total: number;
    timeRemaining?: number;
    speed?: number;
  } | null>(null);
  const [form, setForm] = useState<CreateFormState>(() => createInitialFormState());

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Fetch tenant information if missing (only for superadmin)
  useEffect(() => {
    const fetchTenantIfNeeded = async () => {
      if (user?.tenantId && !tenant && !authLoading && user.role === "superadmin") {
        try {
          const tenantResponse = await apiClient.getTenant(user.tenantId);
          updateTenant(tenantResponse.tenant);
        } catch (err) {
          console.warn("Failed to fetch tenant information:", err);
        }
      }
    };

    fetchTenantIfNeeded();
  }, [user?.tenantId, user?.role, tenant, authLoading, updateTenant]);

  const loadSubAdmins = useCallback(async () => {
    if (!isAdmin) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.getUsers({ role: "subadmin", limit: 100 });
      setAdmins(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to load administrators";
      setError(message);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadSubAdmins();
  }, [loadSubAdmins]);

  const handleBrandingFileChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const tenantId = user?.tenantId || tenant?._id;
    if (!tenantId) {
      setError("Tenant information not available. Please refresh the page.");
      return;
    }

    const input = event.target;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    // File size validation is now handled in the uploadFile method
    setBrandingSaving(true);
    setError(null);
    setBrandingProgress(null);

    try {
      const uploadResult = await apiClient.uploadFile(
        file,
        "tenant_logo",
        undefined, // No associatedId for tenant logo
        (progress) => {
          setBrandingProgress(progress);
        }
      );

      const logoUrl = apiClient.resolveUploadedFileUrl(uploadResult) + '?t=' + Date.now();
      const settings = { ...(tenant?.settings || {}), logo: logoUrl };

      await apiClient.updateTenant(tenantId, { settings });
      if (tenant) {
        updateTenant({ ...tenant, settings });
      }
      updateLogo(logoUrl);
      showSuccess("Tenant logo updated successfully", "Logo Updated");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to upload logo";
      setError(message);
      showError(message, "Error");
    } finally {
      setBrandingSaving(false);
      setBrandingProgress(null);
      input.value = "";
    }
  };

  const handleBrandingRemove = async () => {
    const tenantId = user?.tenantId || tenant?._id;
    if (!tenantId || brandingSaving) {
      return;
    }

    setBrandingSaving(true);
    setError(null);

    try {
      const settings = { ...(tenant?.settings || {}), logo: "" };
      await apiClient.updateTenant(tenantId, { settings });
      if (tenant) {
        updateTenant({ ...tenant, settings });
      }
      updateLogo("");
      showSuccess("Tenant logo removed", "Logo Removed");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to remove logo";
      setError(message);
      showError(message, "Error");
    } finally {
      setBrandingSaving(false);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleFormPermission = (permission: ModuleKey) => {
    setForm((prev) => {
      const nextPermissions = new Set(prev.permissions);
      if (nextPermissions.has(permission)) {
        nextPermissions.delete(permission);
      } else {
        nextPermissions.add(permission);
      }
      return { ...prev, permissions: nextPermissions };
    });
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAdmin) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
        role: "subadmin",
        permissions: Array.from(form.permissions),
      };

      const result = await apiClient.createUser(payload);
      const created = result.user as SubAdmin | undefined;

      setForm(createInitialFormState());

      if (created) {
        setAdmins((prev) => [...prev, created]);
      } else {
        await loadSubAdmins();
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create administrator";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePermission = async (adminId: string, permission: ModuleKey) => {
    if (!isAdmin) {
      return;
    }

    setUpdatingId(adminId);
    setError(null);

    try {
      const target = admins.find((item) => item._id === adminId);
      if (!target) {
        return;
      }

      const nextPermissions = new Set(target.permissions || []);
      if (nextPermissions.has(permission)) {
        nextPermissions.delete(permission);
      } else {
        nextPermissions.add(permission);
      }

      await apiClient.updateUser(adminId, {
        permissions: Array.from(nextPermissions),
      });

      setAdmins((prev) =>
        prev.map((item) =>
          item._id === adminId
            ? { ...item, permissions: Array.from(nextPermissions) }
            : item
        )
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update permissions";
      setError(message);
      await loadSubAdmins();
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-gray-900 border border-neutral-200 dark:border-gray-700 rounded-lg p-6">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Access restricted</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-300">
            You need administrator rights to manage tenant administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="bg-white dark:bg-gray-900 border border-neutral-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Admin Management</h1>
            <p className="mt-2 text-neutral-600 dark:text-neutral-300">
              Create and manage sub-admins for your tenant and control their module access.
            </p>
          </div>
        </div>
      </div>

      {authLoading ? (
        <div className="bg-white dark:bg-gray-900 border border-neutral-200 dark:border-gray-700 rounded-lg p-6">
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 text-neutral-400 dark:text-neutral-500 mx-auto mb-4 animate-spin" />
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">Loading...</h3>
            <p className="text-neutral-600 dark:text-neutral-300">Loading tenant information...</p>
          </div>
        </div>
      ) : tenant && user?.role === "superadmin" ? (
        <div className="bg-white dark:bg-gray-900 border border-neutral-200 dark:border-gray-700 rounded-lg p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg border border-neutral-200 dark:border-gray-700 bg-neutral-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                {logo ? (
                  <img src={logo} alt="Tenant logo" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-10 h-10 text-neutral-400 dark:text-neutral-500" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Tenant Branding</h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">Upload a logo to personalize the portal experience for your team.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {brandingSaving ? (
                <div className="flex flex-col gap-2 min-w-[200px]">
                  <div className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-200">
                    <Upload className="w-4 h-4 animate-pulse" />
                    <span>
                      {brandingProgress
                        ? `Uploading... ${brandingProgress.percentage}%`
                        : "Uploading..."
                      }
                    </span>
                  </div>
                  {brandingProgress && (
                    <>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${brandingProgress.percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
                        {brandingProgress.timeRemaining
                          ? `${Math.floor(brandingProgress.timeRemaining / 60)}:${(brandingProgress.timeRemaining % 60).toString().padStart(2, '0')} remaining`
                          : 'Calculating...'
                        }
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <label className={`inline-flex items-center gap-2 rounded-lg border border-primary-200 dark:border-primary-500 px-4 py-2 text-sm font-medium text-primary-700 dark:text-primary-200 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/40 dark:bg-primary-900/20 transition`}>
                  <Upload className="w-4 h-4" />
                  <span>Upload Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBrandingFileChange}
                  />
                </label>
              )}
              {logo && (
                <button
                  type="button"
                  onClick={handleBrandingRemove}
                  disabled={brandingSaving}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40 dark:bg-red-900/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-neutral-200 dark:border-gray-700 rounded-lg p-6">
          <div className="text-center py-8">
            <ImageIcon className="w-12 h-12 text-neutral-400 dark:text-neutral-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">Tenant Branding</h3>
            <p className="text-neutral-600 dark:text-neutral-300">
              {user?.role === "superadmin"
                ? "Tenant information not available. Please contact support."
                : "Tenant branding is only available for super administrators."
              }
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-neutral-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Create sub-admin</h2>
        <form className="mt-4 space-y-4" onSubmit={handleCreate}>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              name="firstName"
              value={form.firstName}
              onChange={handleInputChange}
              required
              placeholder="First name"
              className="w-full rounded-lg border border-neutral-200 dark:border-gray-700 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              name="lastName"
              value={form.lastName}
              onChange={handleInputChange}
              required
              placeholder="Last name"
              className="w-full rounded-lg border border-neutral-200 dark:border-gray-700 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleInputChange}
              required
              placeholder="Email address"
              className="w-full rounded-lg border border-neutral-200 dark:border-gray-700 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              name="username"
              value={form.username}
              onChange={handleInputChange}
              required
              placeholder="Username"
              className="w-full rounded-lg border border-neutral-200 dark:border-gray-700 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleInputChange}
              required
              placeholder="Temporary password"
              className="md:col-span-2 w-full rounded-lg border border-neutral-200 dark:border-gray-700 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Module access</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {MODULE_OPTIONS.map((option) => (
                <label
                  key={option.key}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-neutral-300 dark:border-gray-600 text-primary-600 dark:text-primary-400 focus:ring-primary-500"
                    checked={form.permissions.has(option.key)}
                    onChange={() => toggleFormPermission(option.key)}
                  />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary-600 dark:bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 dark:hover:bg-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add sub-admin"}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-neutral-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Existing sub-admins</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          </div>
        ) : admins.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-300">
            No sub-admins have been created yet. Add one using the form above.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {admins.map((admin) => {
              const permissionSet = new Set(admin.permissions || []);

              return (
                <div
                  key={admin._id}
                  data-testid={`subadmin-card-${admin._id}`}
                  className="rounded-lg border border-neutral-200 dark:border-gray-700 px-4 py-4 bg-white dark:bg-gray-800"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {admin.firstName} {admin.lastName}
                      </p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-300">{admin.email}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Username: {admin.username}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        admin.isActive
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-neutral-100 text-neutral-500 dark:bg-gray-800 dark:text-neutral-400"
                      }`}
                    >
                      {admin.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {MODULE_OPTIONS.map((option) => (
                      <label
                        key={`${admin._id}-${option.key}`}
                        className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-800"
                      >
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                          {option.label}
                        </span>
                        <input
                          data-testid={`permission-${admin._id}-${option.key}`}
                          type="checkbox"
                          className="h-4 w-4 rounded border-neutral-300 dark:border-gray-600 text-primary-600 dark:text-primary-400 focus:ring-primary-500"
                          checked={permissionSet.has(option.key)}
                          onChange={() => handleTogglePermission(admin._id, option.key)}
                          disabled={updatingId === admin._id}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
